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
      "You analyze call transcripts for Top Tier Experience, a luxury concierge dispatch platform recruiting suppliers (chauffeurs, exotic-car operators, helicopter operators, party-bus operators, sprinter-van operators, yacht/watercraft operators) as commission partners at a fixed 15% (never lower). Extract structured data about supplier qualification, category fit, decision-maker status, fleet/capacity, service area, pricing posture, insurance, commission acceptance, and onboarding readiness. Return JSON only.",
    jsonSchema: `{
  "interest_level": "high"|"medium"|"low"|"none",
  "interest_score": 1-10,
  "category_confirmed_on_call": true|false,
  "is_decision_maker": true|false,
  "already_top_tier_partner": true|false,
  "service_area_mentioned": [],
  "fleet_or_capacity_signal": string|null,
  "price_floor_mentioned": number|null,
  "insurance_on_file": true|false|null,
  "minimum_lead_time": string|null,
  "commission_acceptable_15pct": true|false|null,
  "agreed_to_onboarding": true|false,
  "agreed_to_info_packet": true|false,
  "preferred_contact_channel": "phone"|"sms"|"email"|null,
  "email_provided": string|null,
  "callback_time": string|null,
  "key_objections": [],
  "sentiment": "positive"|"neutral"|"negative",
  "red_flags": [],
  "recommended_action": "auto_promote"|"vetting_required"|"schedule_callback"|"send_info_packet"|"manual_outreach"|"deprioritize"|"remove",
  "summary": string
}`,
    // pricing_range, service_area, email are null-only on crm_partners.
    // ai_score_post_call and ai_call_eligible may not exist on crm_partners —
    // handler drops them via 42703 tolerant-retry if missing.
    nullOnlyFields: ['pricing_range', 'service_area', 'email'],
    applyUpdate: (a) => {
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      const today = new Date().toISOString().slice(0, 10);

      // interest_score → ai_score_post_call (1–10)
      if (typeof a.interest_score === 'number' && a.interest_score >= 1 && a.interest_score <= 10) {
        update.ai_score_post_call = a.interest_score;
      }

      // callback_time → tt_callback_at (parsed)
      if (a.callback_time) {
        const parsed = new Date(a.callback_time);
        if (!isNaN(parsed.getTime())) update.tt_callback_at = parsed.toISOString();
      }

      // already_top_tier_partner=true → tt_acquisition_stage='existing_partner'
      // (only for true; never overwrite otherwise — vetting team owns stage)
      if (a.already_top_tier_partner === true) {
        update.tt_acquisition_stage = 'existing_partner';
      }

      // Null-only writes (gated by nullOnlyFields precheck).
      if (a.price_floor_mentioned != null) update.pricing_range = String(a.price_floor_mentioned);
      // service_area is ARRAY column — write array directly (no join).
      if (Array.isArray(a.service_area_mentioned) && a.service_area_mentioned.length > 0) {
        update.service_area = a.service_area_mentioned;
      }
      if (a.email_provided && typeof a.email_provided === 'string') update.email = a.email_provided;

      // recommended_action='remove' → ai_call_eligible=false (tolerated if column absent)
      if (a.recommended_action === 'remove') update.ai_call_eligible = false;

      // Timestamped append to tt_acquisition_notes (concat via __append_ sentinel)
      const noteLines: string[] = [];
      if (a.summary) noteLines.push(`[${today}] Post-call analysis: ${a.summary}`);
      if (a.recommended_action === 'auto_promote') {
        noteLines.push(`[${today}] ⚑ analysis recommends auto-promotion — awaiting vetting team review (NO promotion RPC called)`);
      } else if (a.recommended_action === 'remove') {
        noteLines.push(`[${today}] ⚑ analysis recommends removal — ai_call_eligible set false`);
      } else if (a.recommended_action) {
        noteLines.push(`[${today}] Recommended action: ${a.recommended_action}`);
      }
      if (a.category_confirmed_on_call === false) noteLines.push(`[${today}] Category NOT confirmed on call`);
      if (a.agreed_to_onboarding === true) noteLines.push(`[${today}] Agreed to onboarding`);
      if (a.agreed_to_info_packet === true) noteLines.push(`[${today}] Agreed to info packet`);
      if (a.minimum_lead_time) noteLines.push(`[${today}] Minimum lead time: ${a.minimum_lead_time}`);
      if (Array.isArray(a.key_objections) && a.key_objections.length) {
        noteLines.push(`[${today}] Objections: ${a.key_objections.join('; ')}`);
      }
      if (noteLines.length) update.__append_tt_acquisition_notes = noteLines.join('\n');

      for (const k of Object.keys(update)) if (update[k] === undefined) delete update[k];
      return update;
    },
    // No buildPostProcess for v1 — vetting team gates all promotions.
  },
  gasmask: {
    systemPrompt:
      "You analyze call transcripts for GasMask, a smoke-shop distribution brand. Two cohorts: (1) NEW-STORE PROSPECTS — cold outreach to smoke shops offering wholesale onboarding; (2) REACTIVATION — dormant existing store accounts being re-engaged for reorders. Extract interest, reorder/onboarding readiness, product categories, store type confirmation, contact confirmation, opt-out, callback, wrong-number, and objections. Return JSON only.",
    jsonSchema: `{
  "cohort": "prospect"|"reactivation",
  "interested": true|false|null,
  "reorder_needed": true|false|null,
  "onboarding_readiness": "ready"|"considering"|"not_ready"|null,
  "product_categories_interested": [],
  "store_type_confirmed": true|false|null,
  "contact_confirmed": true|false|null,
  "opted_out": true|false,
  "opt_out_reason": string|null,
  "callback_requested": true|false,
  "callback_time": string|null,
  "wrong_number": true|false,
  "objections": [],
  "sentiment": "positive"|"neutral"|"negative",
  "summary": string,
  "overall_score": 1-10
}`,
    applyUpdate: (a) => {
      const today = new Date().toISOString().slice(0, 10);
      const update: Record<string, any> = { updated_at: new Date().toISOString() };

      // Map analysis → gasmask_call_status CHECK values:
      // new|queued|called|voicemail|no_answer|callback|interested|booked|not_interested|wrong_number|dnc|cancelled
      let status: string = 'called';
      if (a.wrong_number === true) status = 'wrong_number';
      else if (a.opted_out === true) status = 'dnc';
      else if (a.callback_requested === true) status = 'callback';
      else if (a.interested === true || a.reorder_needed === true) status = 'interested';
      else if (a.interested === false) status = 'not_interested';
      update.gasmask_call_status = status;

      // Append to notes (TEXT, no length limit on both tables)
      const noteLines: string[] = [];
      if (a.summary) noteLines.push(`[${today}] Post-call: ${a.summary}`);
      if (Array.isArray(a.product_categories_interested) && a.product_categories_interested.length) {
        noteLines.push(`[${today}] Categories: ${a.product_categories_interested.join(', ')}`);
      }
      if (a.onboarding_readiness) noteLines.push(`[${today}] Onboarding readiness: ${a.onboarding_readiness}`);
      if (a.store_type_confirmed === false) noteLines.push(`[${today}] Store type NOT confirmed`);
      if (a.contact_confirmed === false) noteLines.push(`[${today}] Contact NOT confirmed`);
      if (typeof a.overall_score === 'number') noteLines.push(`[${today}] Score: ${a.overall_score}/10`);
      if (a.callback_time) noteLines.push(`[${today}] Callback requested: ${a.callback_time}`);
      if (Array.isArray(a.objections) && a.objections.length) {
        noteLines.push(`[${today}] Objections: ${a.objections.join('; ')}`);
      }
      if (noteLines.length) update.__append_notes = noteLines.join('\n');

      // Reactivation cohort ONLY: also write do_not_call fields on store_master.
      // Handler strips these keys automatically if target table is sales_prospects
      // (via 42703 tolerant-retry).
      if (a._cohort === 'reactivation' && a.opted_out === true) {
        update.do_not_call = true;
        update.do_not_call_reason = a.opt_out_reason || 'Opted out on post-call analysis';
      }

      for (const k of Object.keys(update)) if (update[k] === undefined) delete update[k];
      return update;
    },
    // Handler resolves cohort from body.cohort (fallback: dc_leads.lead_type by external_ref_id).
    // Handler overrides leadTable: 'sales_prospects' (prospect) or 'store_master' (reactivation).
  },
  brandaro: {
    systemPrompt:
      "You analyze call transcripts for Brandaro, a done-for-you web-design and lead-generation agency for local service businesses. Extract interest, decision-maker status, budget signal, and demo/proposal actions ACTUALLY TAKEN on the call (never infer these from interest alone). Also extract objections, callback, and opt-out. Return JSON only.",
    jsonSchema: `{
  "interested": true|false|null,
  "is_decision_maker": true|false|null,
  "budget_confirmed": true|false|null,
  "budget_range_mentioned": string|null,
  "demo_action_on_call": "none"|"scheduled"|"sent"|"viewed_together"|"follow_up_needed",
  "proposal_action_on_call": "none"|"drafted"|"sent"|"discussed"|"negotiated"|"accepted"|"rejected",
  "contact_confirmed": true|false|null,
  "callback_requested": true|false,
  "callback_time": string|null,
  "opted_out": true|false,
  "wrong_number": true|false,
  "objections": [],
  "sentiment": "positive"|"neutral"|"negative",
  "summary": string,
  "overall_score": 1-10
}`,
    applyUpdate: (a) => {
      const today = new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const update: Record<string, any> = { updated_at: nowIso };

      // lead_status CHECK: new|queued|calling|no_answer|voicemail|wrong_number|not_interested|callback|send_info|interested|hot_lead|sold|disqualified
      let lead_status: string | undefined;
      if (a.wrong_number === true) lead_status = 'wrong_number';
      else if (a.opted_out === true) lead_status = 'disqualified';
      else if (a.proposal_action_on_call === 'accepted') lead_status = 'sold';
      else if (a.callback_requested === true) lead_status = 'callback';
      else if (a.interested === true && (a.budget_confirmed === true || a.is_decision_maker === true)) lead_status = 'hot_lead';
      else if (a.interested === true) lead_status = 'interested';
      else if (a.interested === false) lead_status = 'not_interested';
      if (lead_status) update.lead_status = lead_status;

      // demo_status — ONLY if analysis confirms a demo action occurred on call.
      // CHECK values: pending|generating|generated|sent|opened|viewed|follow_up_needed
      switch (a.demo_action_on_call) {
        case 'scheduled': update.demo_status = 'pending'; break;
        case 'sent': update.demo_status = 'sent'; break;
        case 'viewed_together': update.demo_status = 'viewed'; break;
        case 'follow_up_needed': update.demo_status = 'follow_up_needed'; break;
        // 'none' → no write
      }

      // proposal_status — ONLY if analysis confirms a proposal action on call.
      // CHECK values: draft|sent|viewed|negotiation|accepted|rejected
      switch (a.proposal_action_on_call) {
        case 'drafted': update.proposal_status = 'draft'; break;
        case 'sent': update.proposal_status = 'sent'; break;
        case 'discussed': update.proposal_status = 'viewed'; break;
        case 'negotiated': update.proposal_status = 'negotiation'; break;
        case 'accepted': update.proposal_status = 'accepted'; break;
        case 'rejected': update.proposal_status = 'rejected'; break;
        // 'none' → no write
      }

      // Callback timestamp
      if (a.callback_time) {
        const parsed = new Date(a.callback_time);
        if (!isNaN(parsed.getTime())) update.next_callback_at = parsed.toISOString();
      }

      // Call telemetry (handler flags — not columns)
      update.__increment_total_dc_calls = true;
      update.last_dc_call_at = nowIso;
      // dc_call_id: handler injects from webhook payload

      // Append to call_notes (TEXT, no length limit)
      const noteLines: string[] = [];
      if (a.summary) noteLines.push(`[${today}] Post-call: ${a.summary}`);
      if (typeof a.overall_score === 'number') noteLines.push(`[${today}] Score: ${a.overall_score}/10`);
      if (a.budget_range_mentioned) noteLines.push(`[${today}] Budget: ${a.budget_range_mentioned}`);
      if (a.is_decision_maker === false) noteLines.push(`[${today}] Not decision maker`);
      if (a.contact_confirmed === false) noteLines.push(`[${today}] Contact NOT confirmed`);
      if (Array.isArray(a.objections) && a.objections.length) {
        noteLines.push(`[${today}] Objections: ${a.objections.join('; ')}`);
      }
      if (noteLines.length) update.__append_call_notes = noteLines.join('\n');

      for (const k of Object.keys(update)) if (update[k] === undefined) delete update[k];
      return update;
    },
    // Handler: __increment_total_dc_calls → COALESCE(current,0)+1; dc_call_id ← body.call_id.
    // No buildPostProcess for v1.
  },
  dynasty_direct: {
    systemPrompt:
      "You analyze call transcripts for Dynasty Direct, a wholesale distributor calling smoke shop / convenience store wholesalers. Anthony runs one of two flows on the call: an inventory_check (existing account, checking reorder needs on previously ordered products) or a new_pitch (introducing the catalog to a prospect). Extract structured data about reorder needs, stock status, pitch reception, opt-outs, callback preferences, contact confirmation, preferred follow-up channel, and a plain-English inventory summary. Return JSON only.",
    jsonSchema: `{
  "call_type": "inventory_check"|"new_pitch"|"unknown",
  "reorder_needed": true|false,
  "any_product_low_or_out": true|false,
  "pitch_interested": true|false,
  "opted_out": true|false,
  "callback_requested": true|false,
  "callback_time": string|null,
  "contact_confirmed": true|false,
  "new_products_interest": [],
  "preferred_followup": "phone"|"sms"|"email"|"in_person"|null,
  "inventory_summary": string|null,
  "relationship_sentiment": "positive"|"neutral"|"negative",
  "action_required": "send_order_form"|"schedule_delivery"|"schedule_callback"|"remove"|"none",
  "action_notes": string|null,
  "summary": string
}`,
    applyUpdate: (a) => {
      const now = new Date().toISOString();
      const today = now.slice(0, 10);

      // Canonical disposition (mirrors webhook mapping order)
      let disposition: string | null = null;
      if (a.opted_out === true) disposition = 'dnc';
      else if (a.reorder_needed === true || a.pitch_interested === true) disposition = 'interested';
      else if (a.callback_requested === true || a.any_product_low_or_out === true) disposition = 'callback';
      else if (a.action_required === 'remove') disposition = 'dnc';

      // Parse callback_time; null on parse failure so we never write garbage.
      let callbackDue: string | null = null;
      if (a.callback_time) {
        const parsed = new Date(a.callback_time);
        if (!isNaN(parsed.getTime())) callbackDue = parsed.toISOString();
      }

      const update: Record<string, any> = {
        last_call_disposition: disposition ?? undefined,
        callback_due_at: callbackDue ?? undefined,
        updated_at: now,
      };

      // inventory_notes: append timestamped inventory_summary (COALESCE-style
      // via applyUpdate cannot read existing row; handler-level append is done
      // through nullOnlyFields elsewhere. Here we mark the append via a sentinel
      // string and rely on Postgres side to concat — but since applyUpdate is
      // a plain update payload, we prepend today's line and let the caller
      // concat by reading current value. Simpler: write only the new line as
      // an append segment; the handler reads existing value and concats.
      if (a.inventory_summary && typeof a.inventory_summary === 'string') {
        update.__append_inventory_notes = `[${today}] ${a.inventory_summary}`;
      }

      // preferred_contact: only if currently null (enforced via nullOnlyFields).
      if (a.preferred_followup && typeof a.preferred_followup === 'string') {
        update.preferred_contact = a.preferred_followup;
      }

      // phone_invalid: set true if disposition is wrong_number (from action_required
      // or explicit signal). Not part of Anthony's schema directly — leave for
      // webhook to set; do not overwrite here.

      for (const k of Object.keys(update)) if (update[k] === undefined) delete update[k];
      return update;
    },
    nullOnlyFields: ['preferred_contact'],
    buildPostProcess: (leadId, a) => {
      if (a.reorder_needed !== true && a.any_product_low_or_out !== true) return null;
      const note = a.inventory_summary || a.action_notes || a.summary || '(no summary)';
      return {
        table: 'dc_lead_sync_log',
        payload: {
          business_unit_key: 'dynasty_direct',
          lead_id: leadId,
          sync_direction: 'out',
          sync_source: 'dc-post-call-analysis:dynasty_direct:reorder_flag',
          success: true,
          error_message: note,
        },
      };
    },
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

    // Handle __append_* sentinel keys: read current column value from the lead
    // row and concat the new segment with a newline. Never overwrites.
    const appendedFields: string[] = [];
    const appendKeys = Object.keys(update).filter((k) => k.startsWith('__append_'));
    if (appendKeys.length > 0) {
      const targetCols = appendKeys.map((k) => k.replace(/^__append_/, ''));
      const { data: currentRow, error: appendErr } = await supabase
        .from(leadTable)
        .select(targetCols.join(','))
        .eq('id', leadId)
        .maybeSingle();
      if (appendErr) {
        console.warn(`[dc-post-call-analysis] append precheck failed (${appendErr.message}) — writing new segments without concat`);
      }
      for (const k of appendKeys) {
        const col = k.replace(/^__append_/, '');
        const segment = String(update[k] ?? '').trim();
        delete (update as Record<string, any>)[k];
        if (!segment) continue;
        const existing = currentRow ? (currentRow as Record<string, any>)[col] : null;
        (update as Record<string, any>)[col] = existing && String(existing).trim()
          ? `${existing}\n${segment}`
          : segment;
        appendedFields.push(col);
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
      null_only_stripped: strippedNullOnly,
      appended_fields: appendedFields,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[dc-post-call-analysis] error', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
