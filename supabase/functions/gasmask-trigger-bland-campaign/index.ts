// GasMask trigger — mirrors sf/re-trigger-bland-campaign pattern:
//   - Per-record dispatch gates (kill-switch, calling-hours, throttle)
//   - dc_leads + dc_campaigns rows for unified reporting
//   - dc_lead_sync_log instrumentation for every mutation
//
// Unlike sf/re which call Bland directly, this function delegates the actual
// dial to the existing `gasmask-ai-caller` (Twilio + ElevenLabs). The
// Bland-vs-ElevenLabs unification is the Step 3 open question and is handled
// in a follow-up batch — this function is wire-compatible with either path.
//
// Two cohort_types are supported:
//   prospect     — cold outreach, reads/writes `sales_prospects.gasmask_call_status`
//   reactivation — dormant-customer outreach, reads/writes
//                  `store_master.gasmask_call_status`, filtered by
//                  `reactivation_dormancy_days` (default 90, tunable per call).
//
// IMPORTANT: per ops decision, reactivation is BUILT but must not be triggered
// for real volume until prospect-cohort calling has shipped clean smoke results
// AND received explicit go-ahead. This function will accept reactivation
// requests; the gate on actually dispatching them is operational, not code-level.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { logLeadSync, logLeadSyncBatch } from "../_shared/dc_sync_log.ts";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";

type CohortType = "prospect" | "reactivation";

interface CohortRow {
  id: string;
  store_name: string;
  phone: string | null;
  city: string | null;
  prior_status: string | null;
}

const BUSINESS_UNIT = "gasmask";
const BUSINESS_NAME = "GasMask New Stores";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const cohortType: CohortType = body.cohort_type;
    const leadIds: string[] = body.lead_ids || (body.lead_id ? [body.lead_id] : []);
    const dormancyDays: number = Number.isFinite(body.reactivation_dormancy_days)
      ? Math.max(0, Math.floor(body.reactivation_dormancy_days))
      : 90;
    const callPurpose: string = body.call_purpose || (cohortType === "reactivation" ? "reactivation" : "introduction");

    if (cohortType !== "prospect" && cohortType !== "reactivation") {
      return new Response(JSON.stringify({
        success: false,
        error: "cohort_type must be 'prospect' or 'reactivation'",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (leadIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "lead_ids (or lead_id) required — caller selects the cohort universe",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Load cohort rows from the right source table ----
    const cohortTable = cohortType === "prospect" ? "sales_prospects" : "store_master";
    let rows: CohortRow[] = [];

    if (cohortType === "prospect") {
      const { data, error } = await supabase
        .from("sales_prospects")
        .select("id, store_name, phone, city, gasmask_call_status, archived, lead_type")
        .in("id", leadIds)
        .eq("archived", false)
        .eq("lead_type", "store")
        .not("phone", "is", null);
      if (error) throw error;
      rows = (data || []).map((r: any) => ({
        id: r.id, store_name: r.store_name, phone: r.phone, city: r.city,
        prior_status: r.gasmask_call_status || null,
      }));
    } else {
      const dormancyCutoff = new Date(Date.now() - dormancyDays * 86400 * 1000).toISOString();
      const { data, error } = await supabase
        .from("store_master")
        .select("id, store_name, phone, city, gasmask_call_status, last_order_at, deleted_at")
        .in("id", leadIds)
        .is("deleted_at", null)
        .not("phone", "is", null)
        .or(`last_order_at.is.null,last_order_at.lt.${dormancyCutoff}`);
      if (error) throw error;
      rows = (data || []).map((r: any) => ({
        id: r.id, store_name: r.store_name, phone: r.phone, city: r.city,
        prior_status: r.gasmask_call_status || null,
      }));
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `No callable ${cohortType} rows matched the supplied IDs (after phone/dormancy filters).`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Insert dc_leads (sync direction='in') ----
    const dcLeadRows = rows.map((r) => ({
      business_id: BUSINESS_UNIT,
      business_name: BUSINESS_NAME,
      business: BUSINESS_UNIT,
      first_name: r.store_name,
      phone: r.phone,
      city: r.city,
      lead_type: `gasmask_${cohortType}`,
      lead_source: cohortTable,
      status: "queued",
      external_ref_id: r.id,
      metadata: { cohort_type: cohortType, source_table: cohortTable } as any,
    }));
    const { data: insertedDcLeads, error: dcInsertErr } = await supabase
      .from("dc_leads").insert(dcLeadRows).select("id, external_ref_id");
    if (dcInsertErr) console.error("[gasmask-trigger dc_leads insert failed]", dcInsertErr);

    await logLeadSyncBatch(supabase, rows.map((r) => {
      const matched = (insertedDcLeads || []).find((d: any) => d.external_ref_id === r.id);
      return {
        business_unit_key: BUSINESS_UNIT,
        lead_id: r.id,
        dc_lead_id: matched?.id || null,
        sync_direction: "in" as const,
        status_before: r.prior_status,
        status_after: "queued",
        sync_source: `gasmask-trigger-bland-campaign:${cohortType}`,
        success: !dcInsertErr,
        error_message: dcInsertErr?.message || null,
      };
    }));

    // ---- Per-record dispatch ----
    let dispatchedCount = 0;
    let lastError: string | null = null;
    const callSids: string[] = [];
    const gateBlocks: Array<{ lead_id: string; code: string; reason: string; retryable: boolean }> = [];
    let killSwitchHit = false;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      const gate = await checkDispatchGates(supabase, { businessUnitKey: BUSINESS_UNIT });
      if (!gate.allowed) {
        gateBlocks.push({ lead_id: r.id, code: gate.code, reason: gate.reason, retryable: gate.retryable });
        console.warn("[gasmask-trigger gate-blocked]", r.id, gate.code, gate.reason);
        if (!gate.retryable) {
          killSwitchHit = true;
          // Cancel this row + all subsequent rows in the cohort table.
          const { error: cancelErr } = await supabase.from(cohortTable)
            .update({ gasmask_call_status: "cancelled" }).eq("id", r.id);
          if (cancelErr) {
            console.error("[gasmask-trigger cancel update failed]", r.id, cancelErr);
            await logLeadSync(supabase, {
              business_unit_key: BUSINESS_UNIT, lead_id: r.id,
              sync_direction: "in", status_after: "cancelled",
              sync_source: `gasmask-trigger-bland-campaign:${cohortType}:cancel-on-kill-switch`,
              success: false, error_message: cancelErr.message,
            });
          }
          const remaining = rows.slice(i + 1).map((x) => x.id);
          if (remaining.length > 0) {
            const { error: bulkCancelErr } = await supabase.from(cohortTable)
              .update({ gasmask_call_status: "cancelled" }).in("id", remaining);
            if (bulkCancelErr) {
              console.error("[gasmask-trigger bulk cancel failed]", bulkCancelErr);
              await logLeadSyncBatch(supabase, remaining.map((rid) => ({
                business_unit_key: BUSINESS_UNIT, lead_id: rid,
                sync_direction: "in" as const, status_after: "cancelled",
                sync_source: `gasmask-trigger-bland-campaign:${cohortType}:cancel-on-kill-switch-bulk`,
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

      // Delegate the actual dial to gasmask-ai-caller (Twilio+ElevenLabs).
      try {
        const { data: callerRes, error: invokeErr } = await supabase.functions.invoke("gasmask-ai-caller", {
          body: {
            store_id: r.id,
            store_name: r.store_name,
            store_phone: r.phone,
            city: r.city,
            call_purpose: callPurpose,
          },
        });
        if (invokeErr) {
          lastError = lastError || invokeErr.message;
          console.error("[gasmask-ai-caller invoke error]", r.id, invokeErr);
        } else if (callerRes?.success && callerRes.call_sid) {
          dispatchedCount++;
          callSids.push(callerRes.call_sid);
        } else {
          lastError = lastError || JSON.stringify(callerRes);
          console.error("[gasmask-ai-caller non-success]", r.id, callerRes);
        }
      } catch (e: any) {
        lastError = lastError || e.message;
        console.error("[gasmask-ai-caller exception]", r.id, e);
      }
    }

    // ---- dc_campaigns row ----
    const label = body.campaign_name
      || `GM_${cohortType}_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
    const { data: campaign, error: campaignErr } = await supabase
      .from("dc_campaigns")
      .insert({
        name: label,
        business: BUSINESS_UNIT,
        agent_type: `gasmask_${cohortType}`,
        agent_name: `GasMask ${cohortType}`,
        status: dispatchedCount > 0 ? "active" : "failed",
        total_leads: rows.length,
      })
      .select()
      .single();
    if (campaignErr) console.error("[gasmask-trigger dc_campaigns insert failed]", campaignErr);

    // ---- Post-loop cohort status update (skip kill-switch-cancelled rows) ----
    const cancelledIds = new Set(gateBlocks.filter((g) => !g.retryable).map((g) => g.lead_id));
    const idsToMark = rows.map((r) => r.id).filter((id) => !cancelledIds.has(id));
    if (idsToMark.length > 0) {
      const { error: queueErr } = await supabase.from(cohortTable)
        .update({ gasmask_call_status: "queued" }).in("id", idsToMark);
      if (queueErr) {
        console.error("[gasmask-trigger post-loop queue update failed]", queueErr);
        await logLeadSyncBatch(supabase, idsToMark.map((id) => ({
          business_unit_key: BUSINESS_UNIT, lead_id: id,
          sync_direction: "in" as const, status_after: "queued",
          sync_source: `gasmask-trigger-bland-campaign:${cohortType}:post-loop-queue`,
          success: false, error_message: queueErr.message,
        })));
      }
    }

    return new Response(JSON.stringify({
      success: dispatchedCount > 0,
      campaign_id: campaign?.id,
      cohort_type: cohortType,
      cohort_table: cohortTable,
      reactivation_dormancy_days: cohortType === "reactivation" ? dormancyDays : null,
      leads_loaded: rows.length,
      calls_dispatched: dispatchedCount,
      call_sids: callSids,
      last_error: lastError,
      gate_blocked_count: gateBlocks.length,
      gate_blocks: gateBlocks,
      kill_switch_hit: killSwitchHit,
      message: dispatchedCount > 0
        ? `Dispatched ${dispatchedCount}/${rows.length} ${cohortType} calls via gasmask-ai-caller${gateBlocks.length ? `, ${gateBlocks.length} gate-blocked` : ""}.`
        : killSwitchHit
          ? "Dispatch aborted — kill-switch engaged."
          : "Cohort loaded but no calls succeeded.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[gasmask-trigger-bland-campaign] error", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
