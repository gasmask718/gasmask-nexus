// TopTier Partner Acquisition trigger — Bland-direct dispatch for TopTier
// luxury-experience partner prospects. Modeled on ut-trigger-bland-campaign:
//   - Per-record dispatch gates (kill-switch via dc_businesses.sync_enabled,
//     calling-hours, throttle) with correct retryable semantics
//   - Per-record DNC enforcement via isOnDNC (fails closed)
//   - Excludes simulation rows + categories blocked by the promotion RPC
//   - dc_leads + dc_campaigns rows for unified reporting
//   - logLeadSync / logLeadSyncBatch on every mutation, sync_direction='in'
//   - Explicit { error } checking on every Supabase write
//
// Canonical business_unit_key = 'top_tier' (matches dc_businesses.business_key
// and the dc-bland-webhook TopTier branch from Step 4). NEVER 'tt'.
//
// Cohort:
//   crm_partners
//   WHERE business_slug = 'toptier-experience'
//     AND is_simulation = false
//     AND phone IS NOT NULL AND phone_invalid = false
//     AND partner_category NOT IN ('luxury_residences','amusementparks_affiliate')
//     AND tt_acquisition_stage IN ('prospect','attempted','info_requested')
//     AND (tt_callback_at IS NULL OR tt_callback_at <= now())
//     AND tt_call_attempts < max_attempts (default 5, body-overridable)
//
// NOTE on 'callback': the Step 2 CHECK constraint does NOT include 'callback'
// as a valid stage. The Step 6.2 webhook fix treats callback as a disposition
// only — stage stays at its prior value (typically 'attempted'). So callback
// re-queueing is handled by the tt_callback_at <= now() clause naturally; no
// separate stage value needed.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { logLeadSync, logLeadSyncBatch, logGateBlock } from "../_shared/dc_sync_log.ts";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";
import { isOnDNC } from "../_shared/dnc.ts";

const BUSINESS_UNIT_KEY = "top_tier";
const BUSINESS_NAME = "TopTier Experience";
const BUSINESS_SLUG = "toptier-experience";
const BLAND_AGENT_ID = "9a31fb74-03fb-4e42-bda8-ee6bc276dd1f";
const DEFAULT_MAX_ATTEMPTS = 5;
const CALLABLE_STAGES = ["prospect", "attempted", "info_requested"];
const EXCLUDED_CATEGORIES = ["luxury_residences", "amusementparks_affiliate"];

function buildAddToDncTool(supabaseUrl: string, dncToolSecret: string) {
  return {
    name: "AddToDNC",
    description:
      "Add the contact's phone number to the Do Not Call list. " +
      "MUST be called immediately if the contact opts out (see prompt's opt-out block). " +
      "Do not call for soft objections like 'not interested' alone.",
    url: `${supabaseUrl}/functions/v1/gasmask-dnc-write`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gasmask-dnc-secret": dncToolSecret,
    },
    body: {
      phone: "{{input.phone}}",
      reason: "{{input.reason}}",
      call_id: "{{call_id}}",
      source: "bland_agent_tool",
      source_business: "top_tier",
    },
    input_schema: {
      type: "object",
      required: ["phone", "reason"],
      properties: {
        phone: { type: "string", description: "Contact phone in E.164 if possible." },
        reason: { type: "string", description: "Verbatim opt-out quote (≤200 chars)." },
      },
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY");
    if (!BLAND_API_KEY) throw new Error("BLAND_API_KEY not configured");
    const DNC_TOOL_SECRET = Deno.env.get("GASMASK_DNC_TOOL_SECRET");
    if (!DNC_TOOL_SECRET) {
      console.warn("[tt-trigger] GASMASK_DNC_TOOL_SECRET not configured — AddToDNC tool will be OMITTED from Bland calls. Opt-outs will only be captured via post-call webhook disposition, not in-call. NOT SAFE FOR PRODUCTION.");
    }

    const body = await req.json().catch(() => ({}));

    // --- HARD-REJECT GUARD (Fix A) ---
    // Full-cohort dispatch without explicit scope is not permitted post-incident.
    // Require either partner_ids (non-empty) or a numeric limit > 0.
    const _guardPartnerIds = Array.isArray(body.partner_ids) ? body.partner_ids : undefined;
    const _guardLimit = typeof body.limit === "number" && body.limit > 0 ? body.limit : undefined;
    if ((!_guardPartnerIds || _guardPartnerIds.length === 0) && !_guardLimit) {
      return new Response(JSON.stringify({
        error: "strict_mode_violation",
        message: "partner_ids or limit required. Full-cohort dispatch without explicit scope is not permitted.",
        bland_calls_started: 0,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const maxAttempts: number = typeof body.max_attempts === "number" && body.max_attempts > 0
      ? body.max_attempts : DEFAULT_MAX_ATTEMPTS;

    // --- Cohort selection ---
    // If caller passes explicit partner_ids, scope to those (still applying
    // every gate). Otherwise pull the full eligible universe and optionally
    // cap with body.limit.
    const partnerIds: string[] | null = Array.isArray(body.partner_ids) && body.partner_ids.length > 0
      ? body.partner_ids
      : null;
    const limit: number | null = typeof body.limit === "number" && body.limit > 0 ? body.limit : null;

    let q = supabase
      .from("crm_partners")
      .select("id, company_name, contact_name, phone, email, city, state, partner_category, tt_acquisition_stage, tt_call_attempts, tt_callback_at, is_simulation, phone_invalid, business_slug")
      .eq("business_slug", BUSINESS_SLUG)
      .eq("is_simulation", false)
      .eq("phone_invalid", false)
      .eq("compliance_hold", false)
      .not("phone", "is", null)
      .in("tt_acquisition_stage", CALLABLE_STAGES)
      .or(`tt_callback_at.is.null,tt_callback_at.lte.${new Date().toISOString()}`)
      .lt("tt_call_attempts", maxAttempts)
      .not("partner_category", "in", `(${EXCLUDED_CATEGORIES.map((c) => `"${c}"`).join(",")})`);

    if (partnerIds) q = q.in("id", partnerIds);
    if (limit) q = q.limit(limit);

    const { data: leads, error: leadsErr } = await q;
    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        cohort_filter: {
          business_slug: BUSINESS_SLUG,
          callable_stages: CALLABLE_STAGES,
          excluded_categories: EXCLUDED_CATEGORIES,
          max_attempts: maxAttempts,
          partner_ids: partnerIds,
          limit,
        },
        error: "No callable TopTier partner prospects matched the cohort filter.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- dc_leads insert (sync direction='in') ---
    const dcLeadRows = (leads as any[]).map((l) => ({
      business_id: BUSINESS_UNIT_KEY,
      business_name: BUSINESS_NAME,
      business: BUSINESS_UNIT_KEY,
      first_name: l.contact_name || l.company_name,
      phone: l.phone,
      email: l.email,
      city: l.city,
      state: l.state,
      lead_type: "tt_partner_acquisition",
      lead_source: "crm_partners",
      status: "queued",
      external_ref_id: l.id,
      metadata: {
        partner_category: l.partner_category,
        company_name: l.company_name,
        stage: l.tt_acquisition_stage,
        prior_attempts: l.tt_call_attempts,
      } as any,
    }));
    const { data: insertedDcLeads, error: dcInsertErr } = await supabase
      .from("dc_leads").insert(dcLeadRows).select("id, external_ref_id");
    if (dcInsertErr) console.error("[tt-trigger dc_leads insert failed]", dcInsertErr);

    await logLeadSyncBatch(supabase, (leads as any[]).map((l) => {
      const matched = (insertedDcLeads || []).find((d: any) => d.external_ref_id === l.id);
      return {
        business_unit_key: BUSINESS_UNIT_KEY,
        lead_id: l.id,
        dc_lead_id: matched?.id || null,
        sync_direction: "in" as const,
        status_before: l.tt_acquisition_stage || null,
        status_after: "queued",
        sync_source: "tt-trigger-bland-campaign",
        success: !dcInsertErr,
        error_message: dcInsertErr?.message || null,
      };
    }));

    // --- Per-record dispatch ---
    const addToDncTool = DNC_TOOL_SECRET ? buildAddToDncTool(SUPABASE_URL, DNC_TOOL_SECRET) : null;

    const webhookSecret = Deno.env.get("DC_BLAND_WEBHOOK_SECRET");
    const webhookUrl = webhookSecret
      ? `${SUPABASE_URL}/functions/v1/dc-bland-webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${SUPABASE_URL}/functions/v1/dc-bland-webhook`;

    // --- Fetch agent prompt from Bland (single source of truth) ---
    // /v1/calls with agent_id alone is rejected ("Missing required parameter: task").
    // We resolve prompt + first_sentence from GET /v1/agents once per invocation
    // and pass them inline on each per-lead /v1/calls payload. dc_agents.system_prompt
    // is intentionally NOT used as a fallback — it stores a short summary, not the
    // full script that's registered on Bland's side.
    let agentTask: string | null = null;
    let agentFirstSentence: string | null = null;
    try {
      const agentsRes = await fetch("https://api.bland.ai/v1/agents", {
        method: "GET",
        headers: { "Authorization": BLAND_API_KEY },
      });
      const agentsJson = await agentsRes.json();
      const agentList: any[] = Array.isArray(agentsJson)
        ? agentsJson
        : (agentsJson.agents || agentsJson.data || []);
      const ttAgent = agentList.find((a: any) => a.agent_id === BLAND_AGENT_ID);
      if (!ttAgent || !ttAgent.prompt || ttAgent.prompt.length < 100) {
        throw new Error(
          `TopTier Bland agent ${BLAND_AGENT_ID} not found or prompt missing/empty ` +
          `(found=${!!ttAgent}, prompt_len=${ttAgent?.prompt?.length ?? 0}). ` +
          `Re-run tt-create-bland-agent or verify the agent_id constant.`
        );
      }
      agentTask = ttAgent.prompt;
      agentFirstSentence = ttAgent.first_sentence || null;
      console.log(
        `[tt-trigger] Resolved Bland agent prompt (len=${agentTask.length}, ` +
        `first_sentence_len=${agentFirstSentence?.length ?? 0})`
      );
    } catch (e: any) {
      console.error("[tt-trigger] Failed to resolve Bland agent prompt", e);
      return new Response(JSON.stringify({
        success: false,
        error: `Bland agent prompt resolution failed: ${e.message}. No dispatch attempted.`,
        leads_loaded: leads.length,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let blandSuccessCount = 0;
    let blandError: string | null = null;
    const blandCallIds: string[] = [];
    const gateBlocks: Array<{ lead_id: string; code: string; reason: string; retryable: boolean }> = [];
    let killSwitchHit = false;

    for (let i = 0; i < leads.length; i++) {
      const l: any = leads[i];

      const gate = await checkDispatchGates(supabase, { businessUnitKey: BUSINESS_UNIT_KEY });
      if (!gate.allowed) {
        gateBlocks.push({ lead_id: l.id, code: gate.code, reason: gate.reason, retryable: gate.retryable });
        await logGateBlock(supabase, {
          businessUnitKey: BUSINESS_UNIT_KEY, leadId: l.id,
          triggerName: "tt-trigger-bland-campaign",
          gateCode: gate.code, gateReason: gate.reason,
          statusBefore: (l as any).tt_stage || null,
        });
        console.warn("[tt-trigger gate-blocked]", l.id, gate.code, gate.reason);
        if (!gate.retryable) {
          killSwitchHit = true;
          const remaining = (leads as any[]).slice(i + 1).map((r) => r.id);
          for (const rid of remaining) {
            gateBlocks.push({ lead_id: rid, code: gate.code, reason: gate.reason, retryable: false });
          }
          // No "cancelled" stage on crm_partners — leave stage untouched; the
          // gate block is recorded in gateBlocks + dc_lead_sync_log only.
          await logLeadSyncBatch(supabase, remaining.map((rid: string) => ({
            business_unit_key: BUSINESS_UNIT_KEY, lead_id: rid,
            sync_direction: "in" as const,
            sync_source: "tt-trigger-bland-campaign:kill-switch-abort",
            success: false, error_message: `${gate.code}: ${gate.reason}`,
          })));
          break;
        }
        continue;
      }

      // Per-record DNC enforcement — isOnDNC fails CLOSED on lookup error.
      const dncCheck = await isOnDNC(supabase, l.phone);
      if (dncCheck.blocked) {
        console.warn("[tt-trigger dnc-blocked]", l.id, l.phone, dncCheck.reason);
        gateBlocks.push({
          lead_id: l.id,
          code: "dnc_list_block",
          reason: `Phone on DNC list (${dncCheck.reason || "dnc_list"})`,
          retryable: false,
        });
        const { error: dncMarkErr } = await supabase.from("crm_partners")
          .update({
            tt_acquisition_stage: "dnc",
            tt_last_disposition: "dnc",
          })
          .eq("id", l.id);
        await logGateBlock(supabase, {
          businessUnitKey: BUSINESS_UNIT_KEY, leadId: l.id,
          triggerName: "tt-trigger-bland-campaign",
          gateCode: "dnc_list_block",
          gateReason: `Phone on DNC list (${dncCheck.reason || "dnc_list"})`,
          statusBefore: l.tt_acquisition_stage || null,
        });
        if (dncMarkErr) {
          await logLeadSync(supabase, {
            business_unit_key: BUSINESS_UNIT_KEY, lead_id: l.id,
            sync_direction: "in",
            status_before: l.tt_acquisition_stage || null, status_after: "dnc",
            sync_source: "tt-trigger-bland-campaign:dnc-mark-failed",
            success: false, error_message: dncMarkErr.message,
          });
        }
        });
        continue;
      }

      const payload = {
        phone_number: l.phone,
        agent_id: BLAND_AGENT_ID,
        task: agentTask,
        first_sentence: agentFirstSentence,
        voice: "June",
        language: "en-US",
        max_duration: 12,
        answered_by_enabled: true,
        wait_for_greeting: true,
        record: true,
        amd: true,
        tools: addToDncTool ? [addToDncTool] : [],
        request_data: {
          lead_id: l.id,
          hub: "top_tier",
          business_unit_key: BUSINESS_UNIT_KEY,
          partner_category: l.partner_category || "experience",
          company_name: l.company_name || "your company",
          contact_name: l.contact_name || "there",
          city: l.city || "",
        },
        // --- Fix C: Bland analysis_schema. Bland's LLM post-call analysis
        // fills these fields into payload.analysis on the webhook. The
        // dc-bland-webhook top_tier branch uses them (with fallback to
        // payload.disposition / payload.status) to derive canonical.
        analysis_schema: {
          interested: {
            type: "boolean",
            description: "True if the contact expressed genuine interest in joining the TopTier partner network, agreed to receive info, or agreed to vetting outreach",
          },
          email_captured: {
            type: "string",
            description: "Email address provided by the contact during the call, or null if none",
          },
          opted_out: {
            type: "boolean",
            description: "True if the contact asked to be removed from contact lists or expressed clear refusal of further contact",
          },
          callback_requested: {
            type: "boolean",
            description: "True if the contact asked to be called back at a later time",
          },
          wrong_vertical: {
            type: "boolean",
            description: "True if the contact's actual business does not match the expected TopTier partner category",
          },
          already_partner: {
            type: "boolean",
            description: "True if the contact indicated they are already working with TopTier",
          },
        },
        webhook: webhookUrl,
      };

      try {
        const blandRes = await fetch("https://api.bland.ai/v1/calls", {
          method: "POST",
          headers: { "Authorization": BLAND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const blandJson = await blandRes.json();
        if (blandRes.ok && blandJson.call_id) {
          blandSuccessCount++;
          blandCallIds.push(blandJson.call_id);

          // --- Fix B Part 1: pre-create dc_call_logs row so the call is
          // visible in the Call Logs UI immediately. Webhook will upsert the
          // same row (keyed on call_sid) on disposition arrival. Failure here
          // is a warning, NOT a dispatch failure — the Bland call already went
          // out and the webhook can still create the row on completion.
          const { error: callLogErr } = await supabase.from("dc_call_logs").insert({
            call_sid: blandJson.call_id,
            source_business: BUSINESS_UNIT_KEY,
            source_table: "crm_partners",
            source_id: l.id,
            business: BUSINESS_UNIT_KEY,
            to_number: l.phone,
            direction: "outbound",
            status: "dialing",
            agent_id: BLAND_AGENT_ID,
            agent_type: "bland",
            agent_name: "TopTier Partner Acquisition (Bland)",
            lead_name: l.contact_name || l.company_name || null,
          });
          if (callLogErr) {
            console.error("[tt-trigger dc_call_logs insert failed]", l.id, blandJson.call_id, callLogErr);
          }

          // Do NOT mutate stage/disposition here — that's the webhook's job on
          // terminal disposition. We only need attempt-side bookkeeping; the
          // webhook increments tt_call_attempts on disposition arrival.
        } else {
          blandError = blandError || JSON.stringify(blandJson);
          console.error("[bland call failed]", l.id, blandJson);
          await logLeadSync(supabase, {
            business_unit_key: BUSINESS_UNIT_KEY, lead_id: l.id,
            sync_direction: "in",
            sync_source: "tt-trigger-bland-campaign:bland-dispatch-failed",
            success: false,
            error_message: typeof blandJson === "string" ? blandJson : JSON.stringify(blandJson),
          });
        }
      } catch (e: any) {
        blandError = blandError || e.message;
        console.error("[bland call exception]", l.id, e);
        await logLeadSync(supabase, {
          business_unit_key: BUSINESS_UNIT_KEY, lead_id: l.id,
          sync_direction: "in",
          sync_source: "tt-trigger-bland-campaign:bland-dispatch-exception",
          success: false, error_message: e.message,
        });
      }
    }

    // --- dc_campaigns row ---
    const label = body.campaign_name
      || `TT_partner_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
    const { data: campaign, error: campaignErr } = await supabase
      .from("dc_campaigns")
      .insert({
        name: label,
        business: BUSINESS_UNIT_KEY,
        agent_type: "tt_partner_acquisition",
        agent_name: "TopTier Partner Acquisition (Bland)",
        status: blandSuccessCount > 0 ? "active" : "failed",
        total_leads: leads.length,
      })
      .select()
      .single();
    if (campaignErr) console.error("[tt-trigger dc_campaigns insert failed]", campaignErr);

    return new Response(JSON.stringify({
      success: blandSuccessCount > 0,
      campaign_id: campaign?.id,
      bland_calls_started: blandSuccessCount,
      bland_call_ids: blandCallIds,
      leads_loaded: leads.length,
      cohort_filter: {
        business_slug: BUSINESS_SLUG,
        callable_stages: CALLABLE_STAGES,
        excluded_categories: EXCLUDED_CATEGORIES,
        max_attempts: maxAttempts,
        partner_ids: partnerIds,
        limit,
      },
      bland_error: blandError,
      gate_blocked_count: gateBlocks.length,
      gate_blocks: gateBlocks,
      kill_switch_hit: killSwitchHit,
      message: blandSuccessCount > 0
        ? `Dispatched ${blandSuccessCount}/${leads.length} TopTier partner calls${gateBlocks.length ? `, ${gateBlocks.length} gate-blocked` : ""}.`
        : killSwitchHit
          ? "Dispatch aborted — kill-switch engaged."
          : "Cohort loaded but no Bland calls succeeded.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[tt-trigger-bland-campaign] error", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
