// LAUNCH UI: no frontend launch surface exists for this trigger yet.
// VM drop plumbing is ready (fetchVoicemailTranscript wired).
// When a launch UI is built, pass voicemail_drop_template_id in the invoke
// body to enable VM drop.
// UT Partner Outreach trigger — Bland-direct dispatch for Unforgettable Times
// supplier/vendor cohort. Mirrors re-trigger-bland-campaign structure:
//   - Per-record dispatch gates (kill-switch, calling-hours, throttle)
//   - dc_leads + dc_campaigns rows for unified reporting
//   - logLeadSync / logLeadSyncBatch on every mutation, sync_direction='in'
//   - Explicit { error } checking on every Supabase write
//
// Canonical business_unit_key = 'unforgettable_times' (consistent with
// dc_agents.business_unit, the upcoming dc-bland-webhook branch, and the
// AddToDNC tool body's source_business value). NEVER 'ut'.
//
// AddToDNC tool body wired with source_business: 'unforgettable_times',
// pointing at gasmask-dnc-write's stable URL per the generalization decision
// (the rename to dc-dnc-write is deferred to a coordinated follow-up batch).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { logLeadSync, logLeadSyncBatch, logGateBlock } from "../_shared/dc_sync_log.ts";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";
import { isOnDNC } from "../_shared/dnc.ts";
import { fetchVoicemailTranscript } from "../_shared/voicemail_template.ts";
import { errText } from "../_shared/errText.ts";

const BUSINESS_UNIT_KEY = "unforgettable_times";
const BUSINESS_NAME = "Unforgettable Times";
const BLAND_AGENT_ID = "d571d8bc-43b1-4af6-812f-a94b0aff84f9";

// AddToDNC tool exposed to the Bland agent during the call. Points at the
// (still-named) gasmask-dnc-write endpoint; source_business overrides the
// hardcoded 'gasmask' row value to 'unforgettable_times'.
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
      // Shared-secret header expected by gasmask-dnc-write (same env var
      // GasMask uses — single secret across both businesses for now).
      "x-gasmask-dnc-secret": dncToolSecret,
    },
    body: {
      phone: "{{input.phone}}",
      reason: "{{input.reason}}",
      call_id: "{{call_id}}",
      source: "bland_agent_tool",
      source_business: "unforgettable_times",
    },
    input_schema: {
      type: "object",
      required: ["phone", "reason"],
      properties: {
        phone: { type: "string", description: "Contact phone in E.164 if possible." },
        reason: {
          type: "string",
          description: "Verbatim opt-out quote (≤200 chars).",
        },
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
      // Loud warning — operational risk, not a hard block. Without this secret
      // the Bland agent CANNOT call AddToDNC, which is a TCPA-compliance hazard
      // if real outbound calls run. Smoke tests still run because the per-record
      // dnc_list gate inside the trigger is server-side and independent of the
      // agent tool. PRODUCTION launch MUST configure this secret.
      console.warn(
        "[ut-trigger] GASMASK_DNC_TOOL_SECRET not configured — AddToDNC tool will be OMITTED from Bland calls. Opt-outs will only be captured via post-call webhook disposition, not in-call. NOT SAFE FOR PRODUCTION.",
      );
    }

    const body = await req.json().catch(() => ({}));

    // --- HARD-REJECT GUARD (parity with tt-trigger Fix A) ---
    // Accepts ut_partner_ids | lead_ids | lead_id. Full-cohort dispatch
    // without explicit scope is not permitted.
    const leadIds: string[] =
      Array.isArray(body.ut_partner_ids) && body.ut_partner_ids.length > 0
        ? body.ut_partner_ids
        : Array.isArray(body.lead_ids) && body.lead_ids.length > 0
          ? body.lead_ids
          : body.lead_id
            ? [body.lead_id]
            : [];
    if (leadIds.length === 0) {
      return new Response(
        JSON.stringify({
          error: "strict_mode_violation",
          message:
            "ut_partner_ids (or lead_ids / lead_id) required. Full-cohort dispatch without explicit scope is not permitted.",
          bland_calls_started: 0,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Cohort query: ai_call_eligible=true, has usable phone, status='new' ----
    // 'new' is the canonical pre-touch status on ut_partner_leads. Callers can
    // override with body.status_filter (array) for re-queue scenarios.
    const statusFilter: string[] =
      Array.isArray(body.status_filter) && body.status_filter.length > 0 ? body.status_filter : ["new"];

    const { data: leads, error: leadsErr } = await supabase
      .from("ut_partner_leads")
      .select("id, business_name, contact_name, phone, email, city, state, category, status, ai_call_eligible")
      .in("id", leadIds)
      .eq("ai_call_eligible", true)
      .in("status", statusFilter)
      .not("phone", "is", null);
    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No callable UT partner leads matched (ai_call_eligible=true, status in filter, phone present).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Insert dc_leads (sync direction='in') ----
    const dcLeadRows = (leads as any[]).map((l) => ({
      business_id: BUSINESS_UNIT_KEY,
      business_name: BUSINESS_NAME,
      business: BUSINESS_UNIT_KEY,
      first_name: l.contact_name || l.business_name,
      phone: l.phone,
      email: l.email,
      city: l.city,
      state: l.state,
      lead_type: "ut_partner_outreach",
      lead_source: "ut_partner_leads",
      status: "queued",
      external_ref_id: l.id,
      metadata: { category: l.category, business_name: l.business_name } as any,
    }));
    const { data: insertedDcLeads, error: dcInsertErr } = await supabase
      .from("dc_leads")
      .insert(dcLeadRows)
      .select("id, external_ref_id");
    if (dcInsertErr) console.error("[ut-trigger dc_leads insert failed]", dcInsertErr);

    await logLeadSyncBatch(
      supabase,
      (leads as any[]).map((l) => {
        const matched = (insertedDcLeads || []).find((d: any) => d.external_ref_id === l.id);
        return {
          business_unit_key: BUSINESS_UNIT_KEY,
          lead_id: l.id,
          dc_lead_id: matched?.id || null,
          sync_direction: "in" as const,
          status_before: l.status || null,
          status_after: "queued",
          sync_source: "ut-trigger-bland-campaign",
          success: !dcInsertErr,
          error_message: dcInsertErr?.message || null,
        };
      }),
    );

    // ---- Pathway mode: Bland stores prompt + first message on the pathway itself.
    // No GET /v1/agents lookup needed; pass pathway_id on each /v1/calls payload.

    // ---- Per-record dispatch ----
    const addToDncTool = DNC_TOOL_SECRET ? buildAddToDncTool(SUPABASE_URL, DNC_TOOL_SECRET) : null;

    const webhookSecret = Deno.env.get("DC_BLAND_WEBHOOK_SECRET");
    const webhookUrl = webhookSecret
      ? `${SUPABASE_URL}/functions/v1/dc-bland-webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${SUPABASE_URL}/functions/v1/dc-bland-webhook`;

    let blandSuccessCount = 0;
    let blandError: string | null = null;
    const blandCallIds: string[] = [];
    const gateBlocks: Array<{ lead_id: string; code: string; reason: string; retryable: boolean }> = [];
    let killSwitchHit = false;

    // Voicemail drop template (optional). Fire-and-forget; falls back silently.
    const vmTranscript = await fetchVoicemailTranscript(supabase, body.voicemail_drop_template_id);

    for (let i = 0; i < leads.length; i++) {
      const l: any = leads[i];

      const gate = await checkDispatchGates(supabase, { businessUnitKey: BUSINESS_UNIT_KEY });
      if (!gate.allowed) {
        gateBlocks.push({ lead_id: l.id, code: gate.code, reason: gate.reason, retryable: gate.retryable });
        await logGateBlock(supabase, {
          businessUnitKey: BUSINESS_UNIT_KEY,
          leadId: l.id,
          triggerName: "ut-trigger-bland-campaign",
          gateCode: gate.code,
          gateReason: gate.reason,
          statusBefore: (l as any).status || null,
        });
        console.warn("[ut-trigger gate-blocked]", l.id, gate.code, gate.reason);
        if (!gate.retryable) {
          killSwitchHit = true;
          const { error: cancelErr } = await supabase
            .from("ut_partner_leads")
            .update({ status: "cancelled" })
            .eq("id", l.id);
          if (cancelErr) {
            console.error("[ut-trigger cancel update failed]", l.id, cancelErr);
            await logLeadSync(supabase, {
              business_unit_key: BUSINESS_UNIT_KEY,
              lead_id: l.id,
              sync_direction: "in",
              status_after: "cancelled",
              sync_source: "ut-trigger-bland-campaign:cancel-on-kill-switch",
              success: false,
              error_message: cancelErr.message,
            });
          }
          const remaining = (leads as any[]).slice(i + 1).map((r) => r.id);
          if (remaining.length > 0) {
            const { error: bulkCancelErr } = await supabase
              .from("ut_partner_leads")
              .update({ status: "cancelled" })
              .in("id", remaining);
            if (bulkCancelErr) {
              console.error("[ut-trigger bulk cancel failed]", bulkCancelErr);
              await logLeadSyncBatch(
                supabase,
                remaining.map((rid: string) => ({
                  business_unit_key: BUSINESS_UNIT_KEY,
                  lead_id: rid,
                  sync_direction: "in" as const,
                  status_after: "cancelled",
                  sync_source: "ut-trigger-bland-campaign:cancel-on-kill-switch-bulk",
                  success: false,
                  error_message: bulkCancelErr.message,
                })),
              );
            }
            for (const rid of remaining) {
              gateBlocks.push({ lead_id: rid, code: gate.code, reason: gate.reason, retryable: false });
            }
          }
          break;
        }
        continue;
      }

      // ---- Per-record DNC enforcement ----
      // Compliance gate: if the partner's phone hit dnc_list (via AddToDNC tool
      // on a prior call, or any other source), do NOT dispatch. Mark the lead
      // ai_call_eligible=false + status='dnc' so it falls out of future cohorts.
      // isOnDNC fails-CLOSED on lookup error (block dispatch), per dnc.ts contract.
      const dncCheck = await isOnDNC(supabase, l.phone);
      if (dncCheck.blocked) {
        console.warn("[ut-trigger dnc-blocked]", l.id, l.phone, dncCheck.reason);
        gateBlocks.push({
          lead_id: l.id,
          code: "dnc_list_block",
          reason: `Phone on DNC list (${dncCheck.reason || "dnc_list"})`,
          retryable: false,
        });
        const { error: dncMarkErr } = await supabase
          .from("ut_partner_leads")
          .update({
            status: "dnc",
            ai_call_result: "dnc",
            ai_call_eligible: false,
            last_outcome: "dnc",
          })
          .eq("id", l.id);
        await logGateBlock(supabase, {
          businessUnitKey: BUSINESS_UNIT_KEY,
          leadId: l.id,
          triggerName: "ut-trigger-bland-campaign",
          gateCode: "dnc_list_block",
          gateReason: `Phone on DNC list (${dncCheck.reason || "dnc_list"})`,
          statusBefore: l.status || null,
        });
        if (dncMarkErr) {
          await logLeadSync(supabase, {
            business_unit_key: BUSINESS_UNIT_KEY,
            lead_id: l.id,
            sync_direction: "in",
            status_before: l.status || null,
            status_after: "dnc",
            sync_source: "ut-trigger-bland-campaign:dnc-mark-failed",
            success: false,
            error_message: dncMarkErr.message,
          });
        }
        continue;
      }

      // Dispatch via Bland /v1/calls with the dedicated UT pathway_id.
      // Prompt variables ({{lead_category}}, {{business_name}}) injected via
      // request_data — Bland substitutes them into the pathway's stored prompt.
      const payload = {
        phone_number: l.phone,
        pathway_id: BLAND_AGENT_ID,
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
          hub: "unforgettable_times",
          business_unit_key: BUSINESS_UNIT_KEY,
          lead_category: l.category || "vendor",
          business_name: l.business_name || "your business",
          contact_name: l.contact_name || "there",
          city: l.city || "",
        },
        webhook: webhookUrl,
        ...(vmTranscript ? { voicemail: { message: vmTranscript, action: "leave_message" } } : {}),
      };

      try {
        const blandRes = await fetch("https://api.bland.ai/v1/calls", {
          method: "POST",
          headers: { Authorization: BLAND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const blandJson = await blandRes.json();

        // ===== DEBUG ONLY =====
        return new Response(
          JSON.stringify(
            {
              payload,
              bland: blandJson,
            },
            null,
            2,
          ),
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (blandRes.ok && blandJson.call_id) {
          blandSuccessCount++;
          blandCallIds.push(blandJson.call_id);
          // Record attempt timestamp on the source lead. We deliberately do NOT
          // mutate ai_call_result here — that's the webhook's job on terminal
          // disposition (avoids the orphan-optimistic-update class of bug that
          // useUTAIDialer caused).
          const { error: attemptErr } = await supabase
            .from("ut_partner_leads")
            .update({ ai_call_last_attempt_at: new Date().toISOString() })
            .eq("id", l.id);
          if (attemptErr) {
            console.error("[ut-trigger attempt-timestamp write failed]", l.id, attemptErr);
            await logLeadSync(supabase, {
              business_unit_key: BUSINESS_UNIT_KEY,
              lead_id: l.id,
              sync_direction: "in",
              sync_source: "ut-trigger-bland-campaign:attempt-timestamp-write",
              success: false,
              error_message: attemptErr.message,
            });
          }
        } else {
          blandError = blandError || JSON.stringify(blandJson);
          console.error("[bland call failed]", l.id, blandJson);
        }
      } catch (e: any) {
        blandError = blandError || e.message;
        console.error("[bland call exception]", l.id, errText(e));
      }
    }

    // ---- dc_campaigns row ----
    const label = body.campaign_name || `UT_partner_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
    const { data: campaign, error: campaignErr } = await supabase
      .from("dc_campaigns")
      .insert({
        name: label,
        business: BUSINESS_UNIT_KEY,
        agent_type: "ut_partner_outreach",
        agent_name: "UT Partner Outreach (Bland)",
        status: blandSuccessCount > 0 ? "active" : "failed",
        total_leads: leads.length,
        voicemail_drop_template_id: body.voicemail_drop_template_id || null,
      })
      .select()
      .single();
    if (campaignErr) console.error("[ut-trigger dc_campaigns insert failed]", campaignErr);

    // ---- Post-loop status update — skip kill-switch-cancelled rows ----
    const cancelledIds = new Set(gateBlocks.filter((g) => !g.retryable).map((g) => g.lead_id));
    const idsToMark = (leads as any[]).map((l) => l.id).filter((id) => !cancelledIds.has(id));
    if (idsToMark.length > 0) {
      const { error: queueErr } = await supabase
        .from("ut_partner_leads")
        .update({ status: "queued" })
        .in("id", idsToMark);
      if (queueErr) {
        console.error("[ut-trigger post-loop queue update failed]", queueErr);
        await logLeadSyncBatch(
          supabase,
          idsToMark.map((id) => ({
            business_unit_key: BUSINESS_UNIT_KEY,
            lead_id: id,
            sync_direction: "in" as const,
            status_after: "queued",
            sync_source: "ut-trigger-bland-campaign:post-loop-queue",
            success: false,
            error_message: queueErr.message,
          })),
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: blandSuccessCount > 0,
        campaign_id: campaign?.id,
        bland_calls_started: blandSuccessCount,
        bland_call_ids: blandCallIds,
        leads_loaded: leads.length,
        bland_error: blandError,
        gate_blocked_count: gateBlocks.length,
        gate_blocks: gateBlocks,
        kill_switch_hit: killSwitchHit,
        message:
          blandSuccessCount > 0
            ? `Dispatched ${blandSuccessCount}/${leads.length} UT partner calls${gateBlocks.length ? `, ${gateBlocks.length} gate-blocked` : ""}.`
            : killSwitchHit
              ? "Dispatch aborted — kill-switch engaged."
              : "Cohort loaded but no Bland calls succeeded.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[ut-trigger-bland-campaign] error", errText(error));
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
