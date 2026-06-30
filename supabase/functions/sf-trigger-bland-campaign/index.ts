import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { logLeadSync, logLeadSyncBatch } from "../_shared/dc_sync_log.ts";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";

const SF_OUTREACH_PROMPT = `You are calling on behalf of Dynasty Recovery Group. You are a professional, friendly representative helping people recover unclaimed money owed to them.

Your goal is to reach {{first_name}} and let them know there may be unclaimed surplus funds from a property in {{county}}, {{state}} that legally belong to them.

Script:
"Hi, may I speak with {{first_name}}?

Hi {{first_name}}, my name is Sarah calling from Dynasty Recovery Group.

I'm reaching out because our records indicate there may be unclaimed funds from a property transaction in {{county}} county that could be owed to you — potentially {{amount}} dollars.

These are funds the government is holding but hasn't been able to return because they couldn't locate you.

Our company specializes in recovering these funds for people at no upfront cost — we only get paid when you do.

Would you have 2 minutes for me to explain how this works?"

If interested: Collect best callback time and email. Say a specialist will call within 24 hours.
If not interested: Thank them and end politely.
If wrong number: Apologize and end call.
If voicemail: "Hi, this message is for {{first_name}}. This is Dynasty Recovery Group calling about unclaimed funds that may be owed to you from {{county}} county. Please call us back. This is a legitimate recovery service — no cost to you unless we recover."`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const BLAND_API_KEY = Deno.env.get('BLAND_API_KEY');
    if (!BLAND_API_KEY) throw new Error('BLAND_API_KEY not configured');

    const body = await req.json();
    const ids: string[] = body.lead_ids || (body.lead_id ? [body.lead_id] : []);
    if (ids.length === 0) throw new Error('lead_ids or lead_id required');

    const { data: leads, error: leadsErr } = await supabase
      .from('surplus_funds_leads')
      .select('*')
      .in('id', ids)
      .not('phone', 'is', null);
    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No callable leads found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert into dc_leads
    const dcLeadRows = leads.map((l: any) => ({
      business_id: 'surplus_funds',
      business_name: 'Dynasty Recovery Group',
      business: 'surplus_funds',
      first_name: l.first_name,
      last_name: l.last_name,
      phone: l.phone,
      email: l.email,
      address: l.property_address || l.address,
      city: l.city,
      state: l.state,
      lead_type: 'surplus_funds_claimant',
      lead_source: l.lead_source || 'csv_upload',
      status: 'queued',
      external_ref_id: l.id,
    }));
    const { data: insertedDcLeads, error: dcInsertErr } = await supabase
      .from('dc_leads').insert(dcLeadRows).select('id, external_ref_id');

    // === Step 5 sync log (direction='in', source='sf-trigger-bland-campaign') ===
    // Instrumentation only — does not alter sync behavior.
    await logLeadSyncBatch(supabase, leads.map((l: any) => {
      const matched = (insertedDcLeads || []).find((d: any) => d.external_ref_id === l.id);
      return {
        business_unit_key: 'surplus_funds',
        lead_id: l.id,
        dc_lead_id: matched?.id || null,
        sync_direction: 'in' as const,
        status_before: l.status || null,
        status_after: 'queued',
        sync_source: 'sf-trigger-bland-campaign',
        success: !dcInsertErr,
        error_message: dcInsertErr?.message || null,
      };
    }));

    const state = body.state || leads[0].state || 'FL';
    const label = body.campaign_name || `SF_${state}_${new Date().toISOString().slice(0,10)}_${Date.now()}`;

    // Build Bland batch calls

    let blandSuccessCount = 0;
    let blandError: string | null = null;
    const blandCallIds: string[] = [];
    const gateBlocks: Array<{ lead_id: string; code: string; reason: string; retryable: boolean }> = [];
    let killSwitchHit = false;

    for (const l of leads as any[]) {
      // === Per-lead dispatch gate (kill-switch, calling hours, throttle) ===
      // Campaign row isn't created until after the loop, so we scope on
      // business_unit_key only. Kill-switch (business_unit) is the critical
      // mid-batch protection — re-checked per lead so a kill-switch engaged
      // partway through a batch aborts remaining leads.
      const gate = await checkDispatchGates(supabase, { businessUnitKey: 'surplus_funds' });
      if (!gate.allowed) {
        gateBlocks.push({ lead_id: l.id, code: gate.code, reason: gate.reason, retryable: gate.retryable });
        console.warn('[sf-trigger gate-blocked]', l.id, gate.code, gate.reason);
        // Kill-switch = non-retryable → mark lead cancelled and stop dialing
        // entirely (no point checking subsequent leads against the same switch).
        if (!gate.retryable) {
          killSwitchHit = true;
          // NOTE: supabase-js returns errors in `error`, it does NOT throw on
          // PostgREST failures (CHECK constraint, RLS, FK, etc.). Without this
          // destructure the failure is invisible — first smoke-test pass on
          // 2026-06-30 had the 'cancelled' status silently rejected by the
          // status CHECK constraint and looked like a stuck lead. Always
          // inspect `error` and fan failures into dc_lead_sync_log.
          const { error: cancelErr } = await supabase.from('surplus_funds_leads')
            .update({ status: 'cancelled' })
            .eq('id', l.id);
          if (cancelErr) {
            console.error('[sf-trigger cancel update failed]', l.id, cancelErr);
            await logLeadSync(supabase, {
              business_unit_key: 'surplus_funds', lead_id: l.id,
              sync_direction: 'in', status_after: 'cancelled',
              sync_source: 'sf-trigger-bland-campaign:cancel-on-kill-switch',
              success: false, error_message: cancelErr.message,
            });
          }
          // Cancel the rest of the batch in one shot.
          const remaining = (leads as any[]).slice((leads as any[]).indexOf(l) + 1).map((r: any) => r.id);
          if (remaining.length > 0) {
            const { error: bulkCancelErr } = await supabase.from('surplus_funds_leads')
              .update({ status: 'cancelled' })
              .in('id', remaining);
            if (bulkCancelErr) {
              console.error('[sf-trigger bulk cancel failed]', remaining, bulkCancelErr);
              await logLeadSyncBatch(supabase, remaining.map((rid: string) => ({
                business_unit_key: 'surplus_funds', lead_id: rid,
                sync_direction: 'in' as const, status_after: 'cancelled',
                sync_source: 'sf-trigger-bland-campaign:cancel-on-kill-switch-bulk',
                success: false, error_message: bulkCancelErr.message,
              })));
            }
            for (const rid of remaining) {
              gateBlocks.push({ lead_id: rid, code: gate.code, reason: gate.reason, retryable: false });
            }
          }
          break;
        }
        // Retryable (hours/throttle) → leave lead queued, skip this lead
        continue;
      }

      const taskPrompt = SF_OUTREACH_PROMPT
        .replaceAll('{{first_name}}', l.first_name || 'there')
        .replaceAll('{{county}}', l.county || 'your county')
        .replaceAll('{{state}}', l.state || state)
        .replaceAll('{{amount}}', l.surplus_amount ? `$${Number(l.surplus_amount).toLocaleString()}` : 'a significant amount');

      const payload = {
        phone_number: l.phone,
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
          hub: 'surplus_funds',
          county: l.county,
          state: l.state,
        },
        webhook: `${SUPABASE_URL}/functions/v1/dc-bland-webhook`,
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
          const { error: callIdErr } = await supabase.from('surplus_funds_leads')
            .update({ bland_call_id: blandJson.call_id })
            .eq('id', l.id);
          if (callIdErr) {
            console.error('[sf-trigger bland_call_id write failed]', l.id, callIdErr);
            await logLeadSync(supabase, {
              business_unit_key: 'surplus_funds', lead_id: l.id,
              sync_direction: 'in', sync_source: 'sf-trigger-bland-campaign:bland_call_id-write',
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

    // Insert campaign record
    const { data: campaign, error: campaignErr } = await supabase
      .from('dc_campaigns')
      .insert({
        name: label,
        business: 'surplus_funds',
        agent_type: 'cold_outreach',
        status: blandError ? 'failed' : 'active',
        total_leads: leads.length,
        agent_name: 'SF Outreach',
      })
      .select()
      .single();
    if (campaignErr) console.error('[sf-trigger dc_campaigns insert failed]', campaignErr);

    // Mark leads as in_campaign — but DO NOT clobber cancelled-by-kill-switch
    // status. Only touch leads that weren't gate-blocked as non-retryable.
    const cancelledIds = new Set(gateBlocks.filter((g) => !g.retryable).map((g) => g.lead_id));
    const idsToMark = leads.map((l: any) => l.id).filter((id: string) => !cancelledIds.has(id));
    if (idsToMark.length > 0) {
      const { error: queueErr } = await supabase
        .from('surplus_funds_leads')
        .update({
          status: 'queued',
          dc_campaign_id: campaign?.id,
          bland_call_triggered: true,
          bland_call_triggered_at: new Date().toISOString(),
        })
        .in('id', idsToMark);
      if (queueErr) {
        console.error('[sf-trigger post-loop queue update failed]', queueErr);
        await logLeadSyncBatch(supabase, idsToMark.map((id: string) => ({
          business_unit_key: 'surplus_funds', lead_id: id,
          sync_direction: 'in' as const, status_after: 'queued',
          sync_source: 'sf-trigger-bland-campaign:post-loop-queue',
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
    console.error('[sf-trigger-bland-campaign] error', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
