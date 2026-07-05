import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { logLeadSync, logLeadSyncBatch, logGateBlock } from "../_shared/dc_sync_log.ts";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";
import { fetchVoicemailTranscript } from "../_shared/voicemail_template.ts";

// Playboxxx outbound Bland trigger.
// Architecture mirrors sf-trigger-bland-campaign:
//   - reads leads from `playboxxx_leads` (BLOCKER: table not yet created — see deliverables)
//   - dispatch gate + kill-switch + throttle via checkDispatchGates
//   - Bland call created with pathway_id (pathway prompt is source of truth)
//   - task included as fallback while pathway is being finalized
//   - webhook: dc-bland-webhook (shared)
//   - DNC handling: relies on pathway-level AddToDNC tool (configured in Bland)
const PLAYBOXXX_OUTREACH_PROMPT = `You are calling on behalf of Playboxxx (internal-only outreach).

"Hi, may I speak with {{first_name}}?"

Introduce yourself, keep it brief, and follow the pathway. If they opt out at any point, immediately acknowledge and end the call.`;

const BLAND_AGENT_ID = "a403b22a-3f36-4c0f-9ae5-712e8048ea44";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // HARD-REJECT GUARD — full-cohort dispatch without explicit scope is forbidden.
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const rawIds = Array.isArray(body?.lead_ids)
    ? body.lead_ids
    : (body?.lead_id ? [body.lead_id] : null);
  if (!rawIds || !Array.isArray(rawIds) || rawIds.length === 0) {
    return new Response(JSON.stringify({
      error: 'strict_mode_violation',
      message: 'Hard reject: lead_ids array is required and cannot be empty. Full-cohort dispatch without explicit scope is not permitted.',
      bland_calls_started: 0,
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const ids: string[] = rawIds;

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const BLAND_API_KEY = Deno.env.get('BLAND_API_KEY');
    if (!BLAND_API_KEY) throw new Error('BLAND_API_KEY not configured');

    const { data: leads, error: leadsErr } = await supabase
      .from('playboxxx_leads')
      .select('*')
      .in('id', ids)
      .not('phone', 'is', null);
    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No callable leads found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mirror dc_leads insert pattern from SF trigger
    const dcLeadRows = leads.map((l: any) => ({
      business_id: 'playboxxx',
      business_name: 'Playboxxx',
      business: 'playboxxx',
      first_name: l.first_name,
      last_name: l.last_name,
      phone: l.phone,
      email: l.email,
      lead_type: 'playboxxx_outreach',
      lead_source: l.lead_source || 'internal',
      status: 'queued',
      external_ref_id: l.id,
    }));
    const { data: insertedDcLeads, error: dcInsertErr } = await supabase
      .from('dc_leads').insert(dcLeadRows).select('id, external_ref_id');

    await logLeadSyncBatch(supabase, leads.map((l: any) => {
      const matched = (insertedDcLeads || []).find((d: any) => d.external_ref_id === l.id);
      return {
        business_unit_key: 'playboxxx',
        lead_id: l.id,
        dc_lead_id: matched?.id || null,
        sync_direction: 'in' as const,
        status_before: l.status || null,
        status_after: 'queued',
        sync_source: 'playboxxx-trigger-bland-campaign',
        success: !dcInsertErr,
        error_message: dcInsertErr?.message || null,
      };
    }));

    const label = body.campaign_name || `PLAYBOXXX_${new Date().toISOString().slice(0,10)}_${Date.now()}`;

    let blandSuccessCount = 0;
    let blandError: string | null = null;
    const blandCallIds: string[] = [];
    const gateBlocks: Array<{ lead_id: string; code: string; reason: string; retryable: boolean }> = [];
    let killSwitchHit = false;

    const vmTranscript = await fetchVoicemailTranscript(supabase, body.voicemail_drop_template_id);

    for (const l of leads as any[]) {
      const gate = await checkDispatchGates(supabase, { businessUnitKey: 'playboxxx' });
      if (!gate.allowed) {
        gateBlocks.push({ lead_id: l.id, code: gate.code, reason: gate.reason, retryable: gate.retryable });
        await logGateBlock(supabase, {
          businessUnitKey: 'playboxxx', leadId: l.id,
          triggerName: 'playboxxx-trigger-bland-campaign',
          gateCode: gate.code, gateReason: gate.reason,
          statusBefore: (l as any).status || null,
        });
        console.warn('[playboxxx-trigger gate-blocked]', l.id, gate.code, gate.reason);
        if (!gate.retryable) {
          killSwitchHit = true;
          const { error: cancelErr } = await supabase.from('playboxxx_leads')
            .update({ status: 'cancelled' })
            .eq('id', l.id);
          if (cancelErr) {
            console.error('[playboxxx-trigger cancel update failed]', l.id, cancelErr);
            await logLeadSync(supabase, {
              business_unit_key: 'playboxxx', lead_id: l.id,
              sync_direction: 'in', status_after: 'cancelled',
              sync_source: 'playboxxx-trigger-bland-campaign:cancel-on-kill-switch',
              success: false, error_message: cancelErr.message,
            });
          }
          const remaining = (leads as any[]).slice((leads as any[]).indexOf(l) + 1).map((r: any) => r.id);
          if (remaining.length > 0) {
            const { error: bulkCancelErr } = await supabase.from('playboxxx_leads')
              .update({ status: 'cancelled' })
              .in('id', remaining);
            if (bulkCancelErr) {
              console.error('[playboxxx-trigger bulk cancel failed]', remaining, bulkCancelErr);
              await logLeadSyncBatch(supabase, remaining.map((rid: string) => ({
                business_unit_key: 'playboxxx', lead_id: rid,
                sync_direction: 'in' as const, status_after: 'cancelled',
                sync_source: 'playboxxx-trigger-bland-campaign:cancel-on-kill-switch-bulk',
                success: false, error_message: bulkCancelErr.message,
              })));
            }
            for (const rid of remaining) {
              gateBlocks.push({ lead_id: rid, code: gate.code, reason: gate.reason, retryable: false });
            }
          }
          break;
        }
        continue;
      }

      const taskPrompt = PLAYBOXXX_OUTREACH_PROMPT
        .replaceAll('{{first_name}}', l.first_name || 'there');

      const payload = {
        phone_number: l.phone,
        pathway_id: BLAND_AGENT_ID,
        task: taskPrompt,
        voice: 'June',
        language: 'en-US',
        max_duration: 5,
        answered_by_enabled: true,
        wait_for_greeting: true,
        record: true,
        amd: true,
        request_data: {
          lead_id: l.id,
          hub: 'playboxxx',
        },
        webhook: `${SUPABASE_URL}/functions/v1/dc-bland-webhook`,
        ...(vmTranscript ? { voicemail: { message: vmTranscript, action: 'leave_message' } } : {}),
      };

      try {
        const blandRes = await fetch('https://api.bland.ai/v1/calls', {
          method: 'POST',
          headers: { 'Authorization': BLAND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const blandJson = await blandRes.json();
        if (blandRes.ok && blandJson.call_id) {
          blandSuccessCount++;
          blandCallIds.push(blandJson.call_id);
          const { error: callIdErr } = await supabase.from('playboxxx_leads')
            .update({ bland_call_id: blandJson.call_id })
            .eq('id', l.id);
          if (callIdErr) {
            console.error('[playboxxx-trigger bland_call_id write failed]', l.id, callIdErr);
            await logLeadSync(supabase, {
              business_unit_key: 'playboxxx', lead_id: l.id,
              sync_direction: 'in', sync_source: 'playboxxx-trigger-bland-campaign:bland_call_id-write',
              success: false, error_message: callIdErr.message,
            });
          }
        } else {
          blandError = blandError || JSON.stringify(blandJson);
          console.error('[bland call failed]', l.id, blandJson);
        }
      } catch (e: any) {
        blandError = blandError || e.message;
        console.error('[bland call exception]', l.id, e);
      }
    }

    const { data: campaign, error: campaignErr } = await supabase
      .from('dc_campaigns')
      .insert({
        name: label,
        business: 'playboxxx',
        agent_type: 'cold_outreach',
        status: blandError ? 'failed' : 'active',
        total_leads: leads.length,
        agent_name: 'Playboxxx Outreach',
        voicemail_drop_template_id: body.voicemail_drop_template_id || null,
      })
      .select()
      .single();
    if (campaignErr) console.error('[playboxxx-trigger dc_campaigns insert failed]', campaignErr);

    const cancelledIds = new Set(gateBlocks.filter((g) => !g.retryable).map((g) => g.lead_id));
    const idsToMark = leads.map((l: any) => l.id).filter((id: string) => !cancelledIds.has(id));
    if (idsToMark.length > 0) {
      const { error: queueErr } = await supabase
        .from('playboxxx_leads')
        .update({
          status: 'queued',
          dc_campaign_id: campaign?.id,
          bland_call_triggered: true,
          bland_call_triggered_at: new Date().toISOString(),
        })
        .in('id', idsToMark);
      if (queueErr) {
        console.error('[playboxxx-trigger post-loop queue update failed]', queueErr);
        await logLeadSyncBatch(supabase, idsToMark.map((id: string) => ({
          business_unit_key: 'playboxxx', lead_id: id,
          sync_direction: 'in' as const, status_after: 'queued',
          sync_source: 'playboxxx-trigger-bland-campaign:post-loop-queue',
          success: false, error_message: queueErr.message,
        })));
      }
    }

    return new Response(JSON.stringify({
      success: blandSuccessCount > 0,
      campaign_id: campaign?.id,
      bland_calls_started: blandSuccessCount,
      bland_call_ids: blandCallIds,
      leads_queued: leads.length,
      bland_error: blandError,
      gate_blocked_count: gateBlocks.length,
      gate_blocks: gateBlocks,
      kill_switch_hit: killSwitchHit,
      message: blandSuccessCount > 0
        ? `Campaign started. ${blandSuccessCount}/${leads.length} calls initiated${gateBlocks.length ? `, ${gateBlocks.length} gate-blocked` : ''}.`
        : killSwitchHit
          ? 'Dispatch aborted — kill-switch engaged.'
          : 'Leads queued but no Bland calls succeeded.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[playboxxx-trigger-bland-campaign] error', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
