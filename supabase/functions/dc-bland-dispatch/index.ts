import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { isOnDNC, normalizeE164 } from "../_shared/dnc.ts";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";


// Maps Bland businessType strings → dc_businesses.business_key values
// so the gate helper can match kill-switches and schedules.
const BIZ_TYPE_TO_KEY: Record<string, string> = {
  brandaro: 'brandaro',
  surplus_funds: 'surplus_funds',
  wholesale_re: 'real_estate',
  gasmask: 'gasmask',
};


const AREA_CODE_TO_STATE: Record<string, string> = {
  '201':'NJ','202':'DC','203':'CT','205':'AL','206':'WA','207':'ME','208':'ID','209':'CA',
  '210':'TX','212':'NY','213':'CA','214':'TX','215':'PA','216':'OH','217':'IL','218':'MN',
  '219':'IN','220':'OH','223':'PA','224':'IL','225':'LA','228':'MS','229':'GA','231':'MI',
  '234':'OH','239':'FL','240':'MD','248':'MI','251':'AL','252':'NC','253':'WA','254':'TX',
  '256':'AL','260':'IN','262':'WI','267':'PA','269':'MI','270':'KY','272':'PA','274':'WI',
  '276':'VA','278':'MI','281':'TX','301':'MD','302':'DE','303':'CO','304':'WV','305':'FL',
  '307':'WY','308':'NE','309':'IL','310':'CA','312':'IL','313':'MI','314':'MO','315':'NY',
  '316':'KS','317':'IN','318':'LA','319':'IA','320':'MN','321':'FL','323':'CA','325':'TX',
  '330':'OH','331':'IL','332':'NY','334':'AL','336':'NC','337':'LA','339':'MA','340':'VI',
  '346':'TX','347':'NY','351':'MA','352':'FL','360':'WA','361':'TX','364':'KY','380':'OH',
  '385':'UT','386':'FL','401':'RI','402':'NE','404':'GA','405':'OK','406':'MT','407':'FL',
  '408':'CA','409':'TX','410':'MD','412':'PA','413':'MA','414':'WI','415':'CA','417':'MO',
  '419':'OH','423':'TN','424':'CA','425':'WA','430':'TX','432':'TX','434':'VA','435':'UT',
  '440':'OH','442':'CA','443':'MD','445':'PA','458':'OR','463':'IN','469':'TX','470':'GA',
  '475':'CT','478':'GA','479':'AR','480':'AZ','484':'PA','501':'AR','502':'KY','503':'OR',
  '504':'LA','505':'NM','507':'MN','508':'MA','509':'WA','510':'CA','512':'TX','513':'OH',
  '515':'IA','516':'NY','517':'MI','518':'NY','520':'AZ','530':'CA','531':'NE','534':'WI',
  '539':'OK','540':'VA','541':'OR','551':'NJ','559':'CA','561':'FL','562':'CA','563':'IA',
  '564':'WA','567':'OH','570':'PA','571':'VA','573':'MO','574':'IN','575':'NM','580':'OK',
  '585':'NY','586':'MI','601':'MS','602':'AZ','603':'NH','605':'SD','606':'KY','607':'NY',
  '608':'WI','609':'NJ','610':'PA','612':'MN','614':'OH','615':'TN','616':'MI','617':'MA',
  '618':'IL','619':'CA','620':'KS','623':'AZ','626':'CA','627':'CA','628':'CA','629':'TN',
  '630':'IL','631':'NY','636':'MO','641':'IA','646':'NY','650':'CA','651':'MN','657':'CA',
  '660':'MO','661':'CA','662':'MS','667':'MD','669':'CA','678':'GA','681':'WV','682':'TX',
  '689':'FL','701':'ND','702':'NV','703':'VA','704':'NC','706':'GA','707':'CA','708':'IL',
  '712':'IA','713':'TX','714':'CA','715':'WI','716':'NY','717':'PA','718':'NY','719':'CO',
  '720':'CO','724':'PA','725':'NV','726':'TX','727':'FL','731':'TN','732':'NJ','734':'MI',
  '737':'TX','740':'OH','743':'NC','747':'CA','754':'FL','757':'VA','760':'CA','762':'GA',
  '763':'MN','765':'IN','769':'MS','770':'GA','772':'FL','773':'IL','774':'MA','775':'NV',
  '779':'IL','781':'MA','785':'KS','786':'FL','801':'UT','802':'VT','803':'SC','804':'VA',
  '805':'CA','806':'TX','808':'HI','810':'MI','812':'IN','813':'FL','814':'PA','815':'IL',
  '816':'MO','817':'TX','818':'CA','828':'NC','830':'TX','831':'CA','832':'TX','838':'NY',
  '843':'SC','845':'NY','847':'IL','848':'NJ','850':'FL','854':'SC','856':'NJ','857':'MA',
  '858':'CA','859':'KY','860':'CT','862':'NJ','863':'FL','864':'SC','865':'TN','870':'AR',
  '872':'IL','878':'PA','901':'TN','903':'TX','904':'FL','906':'MI','907':'AK','908':'NJ',
  '909':'CA','910':'NC','912':'GA','913':'KS','914':'NY','915':'TX','916':'CA','917':'NY',
  '918':'OK','919':'NC','920':'WI','925':'CA','928':'AZ','929':'NY','930':'IN','931':'TN',
  '936':'TX','937':'OH','938':'AL','940':'TX','941':'FL','947':'MI','949':'CA','951':'CA',
  '952':'MN','954':'FL','956':'TX','959':'CT','970':'CO','971':'OR','972':'TX','973':'NJ',
  '978':'MA','979':'TX','980':'NC','984':'NC','985':'LA','989':'MI',
};

function getStateFromPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const areaCode = cleaned.length === 11 ? cleaned.substring(1, 4) : cleaned.substring(0, 3);
  return AREA_CODE_TO_STATE[areaCode] || 'CA';
}

// ===== T7c-A Phase 3 (2026-07-08): unified pool cascade =====
// dc-bland-dispatch sends `from` unconditionally to Bland via inline fetch.
// Whether Bland honors `from` depends on whether the number is registered
// as Bring-Your-Own-Number in the Bland dashboard:
//   • bland_registered=true rows in dc_phone_numbers → Bland honors `from`.
//   • bland_registered=false rows → Bland substitutes its own default outbound
//     number regardless of what we send (pool pick is bookkeeping only).
// Cascade order:
//   1) dc_phone_numbers: business + state + is_active (prefer bland_registered)
//   2) select_best_number_for_business RPC (any state, warming/risk-aware)
//   3) bland_owned_numbers (permanent Bland-owned fallback, e.g. Dallas)
//   4) [ALL POOLS EXHAUSTED] → refuse to dial
// bump_number_usage_v2 is called ONLY when a dc_phone_numbers (Twilio pool)
// row was selected — never for bland_owned_numbers picks.
type PoolPick =
  | { source: 'dc_phone_numbers'; id: string; phone_number: string; bland_registered: boolean }
  | { source: 'bland_owned_numbers'; id: string; phone_number: string }
  | null;

async function selectFromNumberCascade(
  supabase: any,
  business: string,
  prospectState: string,
): Promise<PoolPick> {
  // 1) State-matched pool row, prefer BYON-registered
  const { data: stateMatch } = await supabase
    .from('dc_phone_numbers')
    .select('id, phone_number, bland_registered')
    .eq('business', business)
    .eq('state', prospectState)
    .eq('is_active', true)
    .order('bland_registered', { ascending: false })
    .order('last_called_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (stateMatch?.phone_number) {
    console.log(`[POOL CASCADE 1/4 state-match] business=${business} state=${prospectState} number=${stateMatch.phone_number} bland_registered=${stateMatch.bland_registered}`);
    return { source: 'dc_phone_numbers', id: stateMatch.id, phone_number: stateMatch.phone_number, bland_registered: !!stateMatch.bland_registered };
  }

  // 2) RPC fallback: warming/risk/rotation aware, any state
  const { data: rpcRows } = await supabase.rpc('select_best_number_for_business', { p_business: business });
  const rpcPick = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (rpcPick?.phone_number) {
    console.log(`[POOL CASCADE 2/4 rpc-fallback] business=${business} number=${rpcPick.phone_number} bland_registered=${rpcPick.bland_registered}`);
    return { source: 'dc_phone_numbers', id: rpcPick.id, phone_number: rpcPick.phone_number, bland_registered: !!rpcPick.bland_registered };
  }

  // 3) bland_owned_numbers (permanent Bland-side numbers, e.g. Dallas)
  const { data: bown } = await supabase
    .from('bland_owned_numbers')
    .select('id, phone_number, state')
    .eq('business', business)
    .eq('is_active', true)
    .order('state', { ascending: prospectState === 'TX' ? false : true })
    .limit(5);
  const preferred = (bown || []).find((r: any) => r.state === prospectState) || (bown || [])[0];
  if (preferred?.phone_number) {
    console.log(`[POOL CASCADE 3/4 bland-owned] business=${business} state=${preferred.state} number=${preferred.phone_number}`);
    return { source: 'bland_owned_numbers', id: preferred.id, phone_number: preferred.phone_number };
  }

  // 4) Exhausted
  console.error(`[ALL POOLS EXHAUSTED] business=${business} state=${prospectState} — refusing to dial`);
  return null;
}

async function bumpPoolUsageIfApplicable(supabase: any, pick: PoolPick): Promise<void> {
  if (pick?.source === 'dc_phone_numbers') {
    const { error } = await supabase.rpc('bump_number_usage_v2', { p_id: pick.id });
    if (error) console.error('[bump_number_usage_v2 failed]', pick.id, error.message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, ...params } = await req.json();

    if (action === 'cancel-call') {
      const BLAND_API_KEY = Deno.env.get('BLAND_API_KEY');
      const { callId, leadId } = params;

      console.log('[CANCEL REQUESTED]', { callId, leadId });

      const cancelledAt = new Date().toISOString();
      const queuePatch = {
        status: 'cancelled',
        completed_at: cancelledAt,
        updated_at: cancelledAt,
      };

      try {
        let blandStatus: number | null = null;
        let blandBody: string | null = null;

        if (callId) {
          if (!BLAND_API_KEY) throw new Error('BLAND_API_KEY not configured');

          console.log('[CALLING BLAND STOP API]', callId);
          const res = await fetch(`https://api.bland.ai/v1/calls/${callId}/stop`, {
            method: 'POST',
            headers: {
              'Authorization': BLAND_API_KEY,
              'Content-Type': 'application/json',
            },
          });

          blandStatus = res.status;
          blandBody = await res.text();
          console.log('[BLAND STOP RESPONSE]', {
            callId,
            status: blandStatus,
            statusText: res.statusText,
            body: blandBody,
          });

          if (!res.ok) {
            throw new Error(`Bland stop failed (${res.status}): ${blandBody}`);
          }
        }

        if (callId) {
          console.log('[UPDATING QUEUE BY BLAND_CALL_ID]', callId);
          await supabase
            .from('dynasty_call_queue')
            .update(queuePatch)
            .eq('bland_call_id', callId);

          console.log('[UPDATING HISTORY]', callId);
          await supabase
            .from('dynasty_call_history')
            .update({
              status: 'cancelled',
              ended_at: cancelledAt,
            })
            .eq('call_id', callId);

          await supabase
            .from('dynasty_ai_calls')
            .update({
              outcome: 'cancelled',
              call_ended_at: cancelledAt,
            })
            .eq('call_id', callId);
        }

        if (leadId) {
          console.log('[UPDATING QUEUE BY ID]', leadId);
          await supabase
            .from('dynasty_call_queue')
            .update(queuePatch)
            .eq('id', leadId);
        }

        console.log('[CANCEL COMPLETE]', { callId, leadId });

        return new Response(JSON.stringify({
          success: true,
          cancelled: true,
          callId,
          leadId,
          blandStatus,
          blandBody,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[CANCEL EXCEPTION]', { callId, leadId, error: message });

        const errorPatch = {
          ...queuePatch,
          error_message: `Cancel attempted: ${message}`,
        };

        if (callId) {
          await supabase
            .from('dynasty_call_queue')
            .update(errorPatch)
            .eq('bland_call_id', callId);

          await supabase
            .from('dynasty_call_history')
            .update({
              status: 'cancelled',
              ended_at: cancelledAt,
            })
            .eq('call_id', callId);

          await supabase
            .from('dynasty_ai_calls')
            .update({
              outcome: 'cancelled',
              call_ended_at: cancelledAt,
            })
            .eq('call_id', callId);
        }

        if (leadId) {
          await supabase
            .from('dynasty_call_queue')
            .update(errorPatch)
            .eq('id', leadId);
        }

        return new Response(JSON.stringify({
          success: false,
          cancelled: false,
          callId,
          leadId,
          error: message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'make-call') {
      const BLAND_API_KEY = Deno.env.get('BLAND_API_KEY');
      if (!BLAND_API_KEY) throw new Error('BLAND_API_KEY not configured');

      const { phoneNumber, businessType, contactName, businessName, queueId } = params;

      // === PRE-DIAL GATES (kill-switch + calling-hours + throttle) ===
      // No campaign_id is available on this path — gate by business unit only.
      const businessUnitKey = BIZ_TYPE_TO_KEY[businessType as string] || (businessType as string) || null;
      const gate = await checkDispatchGates(supabase, { businessUnitKey });
      if (!gate.allowed) {
        console.log('[GATE BLOCK make-call]', { code: gate.code, reason: gate.reason, businessUnitKey, queueId });
        if (queueId) {
          // Retryable blocks (hours/throttle) leave the queue row alone so it
          // can be retried when the window reopens. Non-retryable (kill-switch)
          // marks it cancelled so it doesn't sit forever.
          if (!gate.retryable) {
            await supabase.from('dynasty_call_queue').update({
              status: 'cancelled',
              error_message: `Gate blocked: ${gate.code}: ${gate.reason}`,
              completed_at: new Date().toISOString(),
            }).eq('id', queueId);
          }
        }
        return new Response(JSON.stringify({
          success: false, gate_blocked: true, gate_code: gate.code,
          gate_retryable: gate.retryable, reason: gate.reason,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // === DNC PRE-DIAL CHECK (must run BEFORE any Bland API call) ===
      const dnc = await isOnDNC(supabase, phoneNumber);
      if (dnc.blocked) {
        console.log('[DNC BLOCKED]', { phoneNumber, reason: dnc.reason, queueId });
        if (queueId) {
          await supabase.from('dynasty_call_queue').update({
            status: 'dnc',
            error_message: `DNC blocked: ${dnc.reason}`,
            completed_at: new Date().toISOString(),
          }).eq('id', queueId);
        }
        return new Response(JSON.stringify({
          success: false, dnc_blocked: true, reason: dnc.reason,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }



      // Get state and matching caller ID
      const prospectState = getStateFromPhone(phoneNumber);
      const { data: phoneMatch } = await supabase
        .from('dynasty_phone_numbers')
        .select('phone_number')
        .eq('state', prospectState)
        .eq('is_active', true)
        .limit(1)
        .single();

      const fromNumber = phoneMatch?.phone_number || '+12142394316';

      const personaMap: Record<string, string> = {
        brandaro: Deno.env.get('BRANDARO_PERSONA_ID') || '358e79c7-fc23-4494-8c89-21d489253bef',
        surplus_funds: Deno.env.get('SF_PERSONA_ID') || '358e79c7-fc23-4494-8c89-21d489253bef',
        wholesale_re: Deno.env.get('RE_PERSONA_ID') || '358e79c7-fc23-4494-8c89-21d489253bef',
        gasmask: Deno.env.get('DC_PERSONA_ID') || '358e79c7-fc23-4494-8c89-21d489253bef',
      };
      const personaId = personaMap[businessType] || personaMap.brandaro;
      console.log('[USING PERSONA]', personaId);

      const blandPayload = {
        phone_number: phoneNumber,
        from: fromNumber,
        persona_id: personaId,
        record: true,
        max_duration: 12,
        webhook: `${Deno.env.get('SUPABASE_URL')}/functions/v1/dc-bland-webhook`,
        dynamic_data: [{
          contact_name: contactName || 'there',
          business_name: businessName || 'your business',
          company_name: businessName || 'your business',
          contact_phone: phoneNumber,
          state: prospectState || 'your area',
          business_type: businessType || 'business',
        }],
      };
      console.log('[BLAND CALL PAYLOAD]', JSON.stringify(blandPayload));

      const blandRes = await fetch('https://api.bland.ai/v1/calls', {
        method: 'POST',
        headers: { 'Authorization': BLAND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(blandPayload),
      });

      const blandData = await blandRes.json();
      if (!blandRes.ok) throw new Error(`Bland API error: ${JSON.stringify(blandData)}`);

      // Fetch source tracking from queue record if available
      let sourceTable: string | null = null;
      let sourceLeadId: string | null = null;

      if (queueId) {
        const { data: queueRecord } = await supabase
          .from('dynasty_call_queue')
          .select('source_table, source_lead_id')
          .eq('id', queueId)
          .single();

        if (queueRecord) {
          sourceTable = queueRecord.source_table || null;
          sourceLeadId = queueRecord.source_lead_id || null;
        }

        await supabase.from('dynasty_call_queue').update({
          status: 'calling',
          bland_call_id: blandData.call_id,
          called_at: new Date().toISOString(),
        }).eq('id', queueId);
      }

      // Create call record WITH source tracking
      await supabase.from('dynasty_ai_calls').insert({
        call_id: blandData.call_id,
        business_unit: businessType,
        from_number: fromNumber,
        to_number: phoneNumber,
        contact_name: contactName,
        company_name: businessName,
        direction: 'outbound',
        outcome: 'in_progress',
        source_table: sourceTable,
        source_lead_id: sourceLeadId,
        call_type: 'ai_outbound',
      });

      return new Response(JSON.stringify({ success: true, call_id: blandData.call_id, from: fromNumber, state: prospectState, source_table: sourceTable }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'start-campaign') {
      const BLAND_API_KEY = Deno.env.get('BLAND_API_KEY');
      if (!BLAND_API_KEY) throw new Error('BLAND_API_KEY not configured');

      const { businessType, concurrency = 5, manualNumberOverride = null, autoMatch = true } = params;

      // === PRE-BATCH GATE (kill-switch + calling-hours) — short-circuit
      // the entire batch before pulling leads, so we don't even mark them.
      const businessUnitKey = BIZ_TYPE_TO_KEY[businessType as string] || (businessType as string) || null;
      const batchGate = await checkDispatchGates(supabase, { businessUnitKey });
      if (!batchGate.allowed) {
        console.log('[GATE BLOCK start-campaign batch]', { code: batchGate.code, reason: batchGate.reason, businessUnitKey });
        return new Response(JSON.stringify({
          success: false, gate_blocked: true, gate_code: batchGate.code,
          gate_retryable: batchGate.retryable, reason: batchGate.reason, dispatched: 0,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: leads } = await supabase
        .from('dynasty_call_queue')
        .select('*')
        .eq('business_type', businessType)
        .eq('status', 'pending')
        .limit(concurrency);

      if (!leads?.length) {
        return new Response(JSON.stringify({ success: true, message: 'No pending leads', dispatched: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = [];
      for (const lead of leads) {
        try {
          // Per-lead gate recheck — honors a kill-switch toggled mid-batch.
          const perLeadGate = await checkDispatchGates(supabase, { businessUnitKey });
          if (!perLeadGate.allowed) {
            console.log('[GATE BLOCK start-campaign per-lead]', { code: perLeadGate.code, leadId: lead.id });
            if (!perLeadGate.retryable) {
              await supabase.from('dynasty_call_queue').update({
                status: 'cancelled',
                error_message: `Gate blocked: ${perLeadGate.code}`,
                completed_at: new Date().toISOString(),
              }).eq('id', lead.id);
            }
            results.push({ id: lead.id, status: 'gate_blocked', code: perLeadGate.code });
            continue;
          }

          // === DNC PRE-DIAL CHECK — must run BEFORE Bland API call ===
          const dncCheck = await isOnDNC(supabase, lead.phone_number);
          if (dncCheck.blocked) {
            console.log('[DNC BLOCKED]', { phone: lead.phone_number, reason: dncCheck.reason, queueId: lead.id });
            await supabase.from('dynasty_call_queue').update({
              status: 'dnc',
              error_message: `DNC blocked: ${dncCheck.reason}`,
              completed_at: new Date().toISOString(),
            }).eq('id', lead.id);
            results.push({ id: lead.id, status: 'dnc_blocked', reason: dncCheck.reason });
            continue;
          }

          let fromNumber: string;
          const prospectState = getStateFromPhone(lead.phone_number);


          if (manualNumberOverride) {
            fromNumber = manualNumberOverride;
            console.log(`[NUMBER SELECTION] Manual override: ${fromNumber}`);
          } else if (autoMatch) {
            const { data: phoneMatch } = await supabase
              .from('dynasty_phone_numbers')
              .select('phone_number')
              .eq('state', prospectState)
              .eq('is_active', true)
              .limit(1)
              .single();
            fromNumber = phoneMatch?.phone_number || '+12142394316';
            console.log(`[NUMBER SELECTION] Auto-matched ${prospectState} → ${fromNumber}`);
          } else {
            fromNumber = '+12142394316';
            console.log(`[NUMBER SELECTION] Fallback: ${fromNumber}`);
          }

          const personaMap: Record<string, string> = {
            brandaro: Deno.env.get('BRANDARO_PERSONA_ID') || '358e79c7-fc23-4494-8c89-21d489253bef',
            surplus_funds: Deno.env.get('SF_PERSONA_ID') || '358e79c7-fc23-4494-8c89-21d489253bef',
            wholesale_re: Deno.env.get('RE_PERSONA_ID') || '358e79c7-fc23-4494-8c89-21d489253bef',
            gasmask: Deno.env.get('DC_PERSONA_ID') || '358e79c7-fc23-4494-8c89-21d489253bef',
          };
          const personaId = personaMap[lead.business_type] || personaMap.brandaro;
          console.log('[USING PERSONA]', personaId);

          const blandPayload = {
            phone_number: lead.phone_number,
            from: fromNumber,
            persona_id: personaId,
            record: true,
            max_duration: 12,
            webhook: `${Deno.env.get('SUPABASE_URL')}/functions/v1/dc-bland-webhook`,
            dynamic_data: [{
              contact_name: lead.contact_name || 'there',
              business_name: lead.business_name || 'your business',
              company_name: lead.business_name || 'your business',
              contact_phone: lead.phone_number,
              state: prospectState || 'your area',
              business_type: lead.business_type || 'business',
            }],
          };
          console.log('[BLAND CALL PAYLOAD]', JSON.stringify(blandPayload));

          const blandRes = await fetch('https://api.bland.ai/v1/calls', {
            method: 'POST',
            headers: { 'Authorization': BLAND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(blandPayload),
          });

          const blandData = await blandRes.json();

          await supabase.from('dynasty_call_queue').update({
            status: 'calling', bland_call_id: blandData.call_id, called_at: new Date().toISOString(),
          }).eq('id', lead.id);

          await supabase.from('dynasty_ai_calls').insert({
            call_id: blandData.call_id, business_unit: lead.business_type,
            from_number: fromNumber, to_number: lead.phone_number,
            contact_name: lead.contact_name, company_name: lead.business_name,
            direction: 'outbound', outcome: 'in_progress',
            source_table: lead.source_table || null,
            source_lead_id: lead.source_lead_id || null,
            call_type: 'ai_outbound',
          });

          results.push({ id: lead.id, call_id: blandData.call_id, status: 'dispatched' });
        } catch (e) {
          await supabase.from('dynasty_call_queue').update({ status: 'failed' }).eq('id', lead.id);
          results.push({ id: lead.id, status: 'failed', error: e.message });
        }
      }

      return new Response(JSON.stringify({ success: true, dispatched: results.filter(r => r.status === 'dispatched').length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-state') {
      const state = getStateFromPhone(params.phoneNumber);
      return new Response(JSON.stringify({ state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
