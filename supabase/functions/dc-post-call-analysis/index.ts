// Generic Dynasty Connect post-call analysis.
// Accepts a business_unit_key + call_log_id (and/or lead_id + transcript),
// looks up dc_business_units.lead_table_name, runs the shared Claude analysis
// for that unit, and writes the structured result back to the lead row.
//
// Drop-in replacement target for sf-post-call-analysis / re-post-call-analysis.
// Old functions remain deployed until manual cutover.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

type PostProcessPayload = { table: string; payload: Record<string, any> } | null;

type AnalysisConfig = {
  systemPrompt: string;
  jsonSchema: string;
  applyUpdate: (analysis: any) => Record<string, any>;
  buildPostProcess?: (leadId: string, analysis: any) => PostProcessPayload;
  // Fields that must NEVER overwrite an existing (non-null) row value.
  // Handler fetches the current row pre-update and strips conflicting keys
  // from the update payload. Used by top_tier (pricing_range, service_area, email).
  nullOnlyFields?: string[];
};

const ANALYSIS_CONFIGS: Record<string, AnalysisConfig> = {
  surplus_funds: {
    systemPrompt: 'You analyze call transcripts for a surplus funds recovery company. Extract structured data from the conversation. Return JSON only.',
    jsonSchema: `{
  "interest_level": "high"|"medium"|"low"|"none",
  "interest_score": 1-10,
  "claimant_confirmed_identity": true|false,
  "claimant_knows_about_funds": true|false,
  "key_objections": [],
  "agreed_to_callback": true|false,
  "callback_time": string|null,
  "email_provided": string|null,
  "sentiment": "positive"|"neutral"|"negative",
  "red_flags": [],
  "recommended_action": "send_contract"|"schedule_callback"|"attorney_review"|"remove"|"monitor",
  "summary": string
}`,
    applyUpdate: (a) => {
      const update: Record<string, any> = {
        interest_score: a.interest_score,
        interest_level: a.interest_level,
        ai_summary: a.summary,
        recommended_action: a.recommended_action,
        callback_time: a.callback_time,
        updated_at: new Date().toISOString(),
      };
      if (a.email_provided) update.email = a.email_provided;
      return update;
    },
  },
  real_estate: {
    systemPrompt: 'You analyze call transcripts for a wholesale real estate company. Extract structured data from the conversation. Return JSON only.',
    jsonSchema: `{
  "interest_level": "high"|"medium"|"low"|"none",
  "interest_score": 1-10,
  "seller_motivation": "high"|"medium"|"low",
  "timeline_to_sell": string|null,
  "mortgage_situation": string|null,
  "property_condition": string|null,
  "asking_price_mentioned": number|null,
  "agreed_to_appointment": true|false,
  "appointment_time": string|null,
  "key_objections": [],
  "sentiment": "positive"|"neutral"|"negative",
  "recommended_action": "book_appointment"|"send_offer"|"warm_follow_up"|"remove"|"skip_trace",
  "summary": string
}`,
    applyUpdate: (a) => {
      const motivationScoreMap: Record<string, number> = { high: 9, medium: 6, low: 3 };
      const update: Record<string, any> = {
        interest_score: a.interest_score,
        interest_level: a.interest_level,
        ai_summary: a.summary,
        recommended_action: a.recommended_action,
        appointment_time: a.appointment_time,
        seller_motivation_score: motivationScoreMap[a.seller_motivation] ?? null,
        motivation: a.seller_motivation,
        timeline: a.timeline_to_sell,
        updated_at: new Date().toISOString(),
      };
      if (a.asking_price_mentioned) update.asking_price = a.asking_price_mentioned;
      return update;
    },
    buildPostProcess: (leadId, a) => {
      if (a.recommended_action !== 'book_appointment') return null;
      return {
        table: 're_va_tasks',
        payload: {
          lead_id: leadId,
          task_type: 'appointment_set',
          priority: 'urgent',
          status: 'queued',
          notes: `AI recommends booking appointment. Summary: ${a.summary}`,
          script: 'Confirm appointment time and qualify property details.',
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };
    },
  },
  unforgettable_times: {
    systemPrompt:
      "You analyze call transcripts for Unforgettable Times, an event-services company calling event-industry suppliers (halls, caterers, DJs, decorators, photographers, rentals, bartenders, staffing agencies) to recruit them as platform partners. Extract structured data about partnership willingness and onboarding readiness. Return JSON only.",
    jsonSchema: `{
  "interest_level": "high"|"medium"|"low"|"none",
  "interest_score": 1-10,
  "category_confirmed_on_call": "event_hall"|"caterer"|"dj"|"decorator"|"photographer"|"rentals"|"bartender"|"staffing"|"other"|null,
  "is_decision_maker": true|false,
  "currently_accepting_referrals": true|false|null,
  "preferred_contact_channel": "phone"|"sms"|"email"|"in_person"|null,
  "best_callback_window": string|null,
  "email_provided": string|null,
  "service_areas_mentioned": [],
  "pricing_signal": "premium"|"mid"|"budget"|"unknown",
  "capacity_constraint": string|null,
  "key_objections": [],
  "agreed_to_onboarding": true|false,
  "agreed_to_send_info_packet": true|false,
  "callback_time": string|null,
  "sentiment": "positive"|"neutral"|"negative",
  "red_flags": [],
  "recommended_action": "send_onboarding_link"|"schedule_callback"|"send_info_packet"|"manual_outreach"|"deprioritize"|"remove",
  "summary": string
}`,
    applyUpdate: (a) => {
      const levelScoreMap: Record<string, number> = { high: 9, medium: 6, low: 3, none: 1 };
      // ai_score_post_call = analysis interest_score (1-10) if present, else mapped from interest_level.
      // Never overwrites ai_score (pre-call qualification — kept distinct on purpose).
      const postCallScore = typeof a.interest_score === "number"
        ? a.interest_score
        : (levelScoreMap[a.interest_level] ?? null);

      // Parse callback_time into a timestamp where possible; null on parse failure
      // so we don't write garbage into callback_due_at.
      let callbackDue: string | null = null;
      if (a.callback_time) {
        const parsed = new Date(a.callback_time);
        if (!isNaN(parsed.getTime())) callbackDue = parsed.toISOString();
      }

      const update: Record<string, any> = {
        ai_score_post_call: postCallScore,
        next_step: a.recommended_action,
        ai_score_reasons: {
          post_call_analysis: a,
          analyzed_at: new Date().toISOString(),
        },
        best_time_to_call: a.best_callback_window ?? undefined,
        callback_due_at: callbackDue ?? undefined,
        notes: a.summary
          ? `[${new Date().toISOString().slice(0, 10)}] Post-call: ${a.summary}`
          : undefined,
        updated_at: new Date().toISOString(),
      };

      if (a.agreed_to_onboarding === true) {
        update.automation_state = "ready_for_onboarding";
      }
      if (a.recommended_action === "remove") {
        update.ai_call_eligible = false;
      }
      if (a.email_provided && typeof a.email_provided === "string") {
        // Note: applyUpdate cannot conditionally check current row state, so we
        // always write. The lead update is best-effort; callers can layer a
        // never-overwrite rule downstream if needed.
        update.email = a.email_provided;
      }

      // Strip undefineds so we don't accidentally null-out columns.
      for (const k of Object.keys(update)) if (update[k] === undefined) delete update[k];
      return update;
    },
    buildPostProcess: (leadId, a) => {
      // VA-flag only — never auto-fires the onboarding link send.
      // Mirror RE's book_appointment pattern: insert a ut_va_tasks row with
      // action_type='send_onboarding_link' for a human VA to action.
      if (a.recommended_action !== "send_onboarding_link") return null;
      return {
        table: "ut_va_tasks",
        payload: {
          lead_id: leadId,
          task_type: "send_onboarding_link",
          action_type: "send_onboarding_link",
          priority: "high",
          status: "queued",
          notes: `AI recommends sending onboarding link. Summary: ${a.summary || "(no summary)"}`,
          script:
            "Confirm partner details, send the onboarding link via their preferred channel, and log the send.",
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };
    },
  },
  top_tier: {
    systemPrompt:
      "You analyze call transcripts for Top Tier Experience, a luxury concierge dispatch platform recruiting suppliers (chauffeurs, exotic-car operators, helicopter operators, party-bus operators, sprinter-van operators, yacht/watercraft operators) as commission partners (15% standard, never lower). Extract structured data about supplier qualification, fleet capacity, pricing posture, insurance status, and commission acceptance. Return JSON only.",
    jsonSchema: `{
  "interest_level": "high"|"medium"|"low"|"none",
  "interest_score": 1-10,
  "is_decision_maker": true|false,
  "fleet_or_capacity_signal": string|null,
  "service_area_mentioned": [],
  "pricing_range_mentioned": string|null,
  "price_floor_mentioned": number|null,
  "insurance_on_file": true|false|null,
  "commission_acceptable_15pct": true|false|null,
  "preferred_contact_channel": "phone"|"sms"|"email"|null,
  "email_provided": string|null,
  "best_callback_window": string|null,
  "callback_time": string|null,
  "key_objections": [],
  "sentiment": "positive"|"neutral"|"negative",
  "red_flags": [],
  "recommended_action": "auto_promote"|"vetting_required"|"schedule_callback"|"send_info_packet"|"manual_outreach"|"deprioritize"|"remove",
  "summary": string
}`,
    // pricing_range, service_area, email are nullOnlyFields — see below.
    nullOnlyFields: ['pricing_range', 'service_area', 'email'],
    applyUpdate: (a) => {
      const update: Record<string, any> = {
        tt_last_disposition: undefined, // do not overwrite webhook-set disposition
        updated_at: new Date().toISOString(),
      };

      // Parse callback_time if present (does not overwrite tt_callback_at unless analysis returned one)
      if (a.callback_time) {
        const parsed = new Date(a.callback_time);
        if (!isNaN(parsed.getTime())) update.tt_callback_at = parsed.toISOString();
      }

      // Pricing range — write only if currently null on the row (enforced by nullOnlyFields).
      if (a.pricing_range_mentioned && typeof a.pricing_range_mentioned === 'string') {
        update.pricing_range = a.pricing_range_mentioned;
      }

      // Service area — only if non-empty array (and only if currently null on row).
      if (Array.isArray(a.service_area_mentioned) && a.service_area_mentioned.length > 0) {
        update.service_area = a.service_area_mentioned;
      }

      // Email — only if currently null on row.
      if (a.email_provided && typeof a.email_provided === 'string') {
        update.email = a.email_provided;
      }

      // Notes — append the analysis summary. Per the v1 contract,
      // recommended_action='auto_promote' is a vetting-team SIGNAL only;
      // it never invokes the promotion RPC from here. The note is marked
      // explicitly so the vetting queue UI can highlight these rows.
      const today = new Date().toISOString().slice(0, 10);
      const noteLines: string[] = [];
      if (a.summary) noteLines.push(`[${today}] Post-call analysis: ${a.summary}`);
      if (a.recommended_action === 'auto_promote') {
        noteLines.push(`[${today}] ⚑ analysis recommends auto-promotion — awaiting vetting team review`);
      } else if (a.recommended_action) {
        noteLines.push(`[${today}] Recommended action: ${a.recommended_action}`);
      }
      if (noteLines.length) update.tt_acquisition_notes = noteLines.join('\n');

      // Strip undefineds so we don't accidentally null-out columns.
      for (const k of Object.keys(update)) if (update[k] === undefined) delete update[k];
      return update;
    },
    // No buildPostProcess for v1 — vetting team works from stage-filtered views.
  },
};





serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const body = await req.json();
    const businessUnitKey: string = body.business_unit_key || body.hub;
    const leadId: string | undefined = body.lead_id;
    const callId: string | undefined = body.call_id || body.call_log_id;
    let transcript: string | undefined = body.transcript;
    const isDryRun = body.dry_run === true;

    if (!businessUnitKey) throw new Error('business_unit_key required');
    if (!leadId) throw new Error('lead_id required');

    const config = ANALYSIS_CONFIGS[businessUnitKey];
    if (!config) {
      throw new Error(`No analysis config registered for business_unit_key="${businessUnitKey}"`);
    }

    // Resolve lead table from registry
    const { data: unit, error: unitErr } = await supabase
      .from('dc_businesses')
      .select('business_key, lead_table_name, sync_enabled')
      .eq('business_key', businessUnitKey)
      .maybeSingle();
    if (unitErr) throw new Error(`registry lookup failed: ${unitErr.message}`);
    if (!unit?.lead_table_name) {
      throw new Error(`dc_businesses.lead_table_name not set for ${businessUnitKey}`);
    }
    const leadTable = unit.lead_table_name as string;

    // If transcript not provided, try pulling from dynasty_ai_calls by call_id
    if (!transcript && callId) {
      const { data: call } = await supabase
        .from('dynasty_ai_calls')
        .select('transcript')
        .eq('call_id', callId)
        .maybeSingle();
      transcript = call?.transcript || undefined;
    }
    if (!transcript) throw new Error('transcript required (provide directly or via resolvable call_id)');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1200,
        system: config.systemPrompt,
        messages: [{
          role: 'user',
          content: `Analyze this call transcript and return JSON only — no other text:\n${config.jsonSchema}\n\nTranscript:\n${transcript}`,
        }],
      }),
    });
    const claudeJson = await claudeRes.json();
    const text = claudeJson.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in Claude response');
    const analysis = JSON.parse(match[0]);

    const update = config.applyUpdate(analysis);
    const postProcessPayload: PostProcessPayload = config.buildPostProcess
      ? config.buildPostProcess(leadId, analysis)
      : null;

    // Enforce nullOnlyFields: never overwrite an existing non-null row value.
    // Pulls the candidate columns from the live row and strips conflicting
    // keys from the update payload. Used by top_tier for pricing_range,
    // service_area, email.
    const strippedNullOnly: string[] = [];
    if (config.nullOnlyFields && config.nullOnlyFields.length > 0) {
      const candidates = config.nullOnlyFields.filter((f) => f in update);
      if (candidates.length > 0) {
        const { data: currentRow, error: currentErr } = await supabase
          .from(leadTable)
          .select(candidates.join(','))
          .eq('id', leadId)
          .maybeSingle();
        if (currentErr) {
          console.warn(`[dc-post-call-analysis] nullOnly precheck failed (${currentErr.message}) — skipping nullOnly enforcement to avoid silent data loss`);
        } else if (currentRow) {
          for (const field of candidates) {
            const existingVal = (currentRow as Record<string, any>)[field];
            const isNonNull = existingVal !== null && existingVal !== undefined
              && !(Array.isArray(existingVal) && existingVal.length === 0)
              && !(typeof existingVal === 'string' && existingVal.trim() === '');
            if (isNonNull) {
              delete (update as Record<string, any>)[field];
              strippedNullOnly.push(field);
            }
          }
        }
      }
    }


    if (!isDryRun) {
      const { error: updateErr } = await supabase.from(leadTable).update(update).eq('id', leadId);
      if (updateErr) throw new Error(`lead update failed: ${updateErr.message}`);

      if (postProcessPayload) {
        try {
          await supabase.from(postProcessPayload.table).insert(postProcessPayload.payload);
        } catch (e) {
          console.error(`[dc-post-call-analysis] postProcess(${businessUnitKey}) failed`, e);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: isDryRun,
      business_unit_key: businessUnitKey,
      lead_table: leadTable,
      analysis,
      call_id: callId,
      would_update: { table: leadTable, lead_id: leadId, payload: update },
      would_post_process: postProcessPayload,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[dc-post-call-analysis] error', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
