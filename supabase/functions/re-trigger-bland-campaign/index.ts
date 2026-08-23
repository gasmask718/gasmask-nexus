import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { logLeadSync, logLeadSyncBatch, logGateBlock } from "../_shared/dc_sync_log.ts";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";
import { fetchVoicemailTranscript } from "../_shared/voicemail_template.ts";
import { outreachAllowed } from "../_shared/outreachGate.ts";

const COLD_SELLER_PROMPT = `You are a real estate acquisition specialist calling homeowners about their property. Be friendly, professional, and respectful.

"Hi, may I speak with {{first_name}}?

Hi {{first_name}}, my name is Mike and I'm a local real estate investor calling about your property at {{address}}.

I'm not a realtor — I'm an investor who buys properties directly from homeowners, often in as-is condition with a fast close and no fees or commissions.

I'm currently looking for properties in {{city}} and wanted to reach out to see if you've had any thoughts about selling, or if there's any situation with the property where a quick cash offer might be helpful?"

If interested in selling: Qualify — Are you the owner? Any mortgage? How much owed? When are you looking to sell? Best number for my acquisitions manager?

If not interested: "No problem — would it be OK if I reached out in 6 months in case circumstances change?"`;

const FSBO_PROMPT = `You are calling about a For Sale By Owner property listing. Be interested and specific.

"Hi {{first_name}}, I saw your property at {{address}} listed for sale.

I'm a cash buyer — I can close in 14 days, no contingencies, no commissions.

What's the best price you'd consider?"

Qualify motivation, condition, timeline. Get a number.`;

const EXPIRED_PROMPT = `You are calling about an expired real estate listing. Be empathetic.

"Hi {{first_name}}, I saw your property at {{address}} was listed and the listing recently expired.

I'm a cash buyer — I can buy it as-is, no agent commissions, close fast.

Would you still consider selling if the price was right?"`;

const WARM_FOLLOWUP_PROMPT = `You are following up with a homeowner you spoke to previously.

"Hi {{first_name}}, this is Mike with the real estate team — we spoke a while back about your property at {{address}}.

I wanted to circle back and see if anything has changed on your end about possibly selling?"`;

const PROMPTS: Record<string, string> = {
  cold_seller: COLD_SELLER_PROMPT,
  fsbo: FSBO_PROMPT,
  expired: EXPIRED_PROMPT,
  warm_follow_up: WARM_FOLLOWUP_PROMPT,
};

const BLAND_AGENT_ID = "b3375dc8-cb93-4d10-9d63-8556631a8887";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // OUTREACH GATE (2026-08-23): nothing dispatches unless a human armed the switch.
  if (!(await outreachAllowed('re_daily_campaign_launch'))) {
    return new Response(JSON.stringify({ ok: true, gated: true, switch: 're_daily_campaign_launch', bland_calls_started: 0 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // HARD-REJECT GUARD - Prevent accidental full-cohort dispatch.
  // Runs BEFORE any env/secret checks so an empty body always returns 400,
  // never 500 from a missing BLAND_API_KEY throw.
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


    const agentType = body.agent_type || 'cold_seller';
    const basePrompt = PROMPTS[agentType] || COLD_SELLER_PROMPT;

    const { data: leads, error: leadsErr } = await supabase
      .from('re_leads')
      .select('*')
      .in('id', ids)
      .not('phone', 'is', null);
    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No callable leads found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dcLeadRows = leads.map((l: any) => ({
      business_id: 're',
      business_name: 'Real Estate OS',
      business: 're',
      first_name: l.first_name,
      last_name: l.last_name,
      phone: l.phone,
      email: l.email,
      address: l.property_address,
      city: l.city,
      state: l.state,
      lead_type: `re_seller_${agentType}`,
      lead_source: l.lead_source || 'csv_upload',
      status: 'queued',
      external_ref_id: l.id,
    }));
    const { data: insertedDcLeads, error: dcInsertErr } = await supabase
      .from('dc_leads').insert(dcLeadRows).select('id, external_ref_id');

    // === Step 5 sync log (direction='in', source='re-trigger-bland-campaign') ===
    // Instrumentation only — does not alter sync behavior.
    await logLeadSyncBatch(supabase, leads.map((l: any) => {
      const matched = (insertedDcLeads || []).find((d: any) => d.external_ref_id === l.id);
      return {
        business_unit_key: 'real_estate',
        lead_id: l.id,
        dc_lead_id: matched?.id || null,
        sync_direction: 'in' as const,
        status_before: l.status || null,
        status_after: 'queued',
        sync_source: 're-trigger-bland-campaign',
        success: !dcInsertErr,
        error_message: dcInsertErr?.message || null,
      };
    }));

    const label = body.campaign_name || `RE_${agentType}_${new Date().toISOString().slice(0,10)}_${Date.now()}`;

    let blandSuccessCount = 0;
    let blandError: string | null = null;
    const blandCallIds: string[] = [];
    const gateBlocks: Array<{ lead_id: string; code: string; reason: string; retryable: boolean }> = [];
    let killSwitchHit = false;

    // Voicemail drop template (optional). Fire-and-forget; falls back silently.
    const vmTranscript = await fetchVoicemailTranscript(supabase, body.voicemail_drop_template_id);

    for (const l of leads as any[]) {
      // === Per-lead dispatch gate (kill-switch, calling hours, throttle) ===
      // Scoped on business_unit_key only; campaign row is created post-loop.
      const gate = await checkDispatchGates(supabase, { businessUnitKey: 'real_estate' });
      if (!gate.allowed) {
        gateBlocks.push({ lead_id: l.id, code: gate.code, reason: gate.reason, retryable: gate.retryable });
        await logGateBlock(supabase, {
          businessUnitKey: 'real_estate', leadId: l.id,
          triggerName: 're-trigger-bland-campaign',
          gateCode: gate.code, gateReason: gate.reason,
          statusBefore: (l as any).status || null,
        });
        console.warn('[re-trigger gate-blocked]', l.id, gate.code, gate.reason);
        if (!gate.retryable) {
          killSwitchHit = true;
          // supabase-js never throws on PostgREST errors — inspect `error` and
          // surface failures, otherwise CHECK/RLS rejections look like stuck
          // leads. (See sf-trigger comment for the smoke-test backstory.)
          const { error: cancelErr } = await supabase.from('re_leads')
            .update({ status: 'cancelled' }).eq('id', l.id);
          if (cancelErr) {
            console.error('[re-trigger cancel update failed]', l.id, cancelErr);
            await logLeadSync(supabase, {
              business_unit_key: 'real_estate', lead_id: l.id,
              sync_direction: 'in', status_after: 'cancelled',
              sync_source: 're-trigger-bland-campaign:cancel-on-kill-switch',
              success: false, error_message: cancelErr.message,
            });
          }
          const remaining = (leads as any[]).slice((leads as any[]).indexOf(l) + 1).map((r: any) => r.id);
          if (remaining.length > 0) {
            const { error: bulkCancelErr } = await supabase.from('re_leads')
              .update({ status: 'cancelled' }).in('id', remaining);
            if (bulkCancelErr) {
              console.error('[re-trigger bulk cancel failed]', remaining, bulkCancelErr);
              await logLeadSyncBatch(supabase, remaining.map((rid: string) => ({
                business_unit_key: 'real_estate', lead_id: rid,
                sync_direction: 'in' as const, status_after: 'cancelled',
                sync_source: 're-trigger-bland-campaign:cancel-on-kill-switch-bulk',
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

      const taskPrompt = basePrompt
        .replaceAll('{{first_name}}', l.first_name || 'there')
        .replaceAll('{{address}}', l.property_address || 'your property')
        .replaceAll('{{city}}', l.city || 'the area');

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
          hub: 're',
          agent_type: agentType,
          address: l.property_address,
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
          const { error: callIdErr } = await supabase.from('re_leads')
            .update({ bland_call_id: blandJson.call_id })
            .eq('id', l.id);
          if (callIdErr) {
            console.error('[re-trigger bland_call_id write failed]', l.id, callIdErr);
            await logLeadSync(supabase, {
              business_unit_key: 'real_estate', lead_id: l.id,
              sync_direction: 'in', sync_source: 're-trigger-bland-campaign:bland_call_id-write',
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
        business: 're',
        agent_type: agentType,
        status: blandSuccessCount > 0 ? 'active' : 'failed',
        total_leads: leads.length,
        agent_name: `RE ${agentType}`,
        voicemail_drop_template_id: body.voicemail_drop_template_id || null,
      })
      .select()
      .single();
    if (campaignErr) console.error('[re-trigger dc_campaigns insert failed]', campaignErr);

    // Do NOT clobber cancelled-by-kill-switch leads.
    const cancelledIds = new Set(gateBlocks.filter((g) => !g.retryable).map((g) => g.lead_id));
    const idsToMark = leads.map((l: any) => l.id).filter((id: string) => !cancelledIds.has(id));
    if (idsToMark.length > 0) {
      const { error: queueErr } = await supabase
        .from('re_leads')
        .update({ status: 'queued', dc_campaign_id: campaign?.id })
        .in('id', idsToMark);
      if (queueErr) {
        console.error('[re-trigger post-loop queue update failed]', queueErr);
        await logLeadSyncBatch(supabase, idsToMark.map((id: string) => ({
          business_unit_key: 'real_estate', lead_id: id,
          sync_direction: 'in' as const, status_after: 'queued',
          sync_source: 're-trigger-bland-campaign:post-loop-queue',
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
    console.error('[re-trigger-bland-campaign] error', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
