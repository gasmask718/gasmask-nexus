// Dynasty Direct Wholesaler Outreach trigger — Bland-direct dispatch for
// existing + prospect grabba wholesalers. Modeled on tt-trigger-bland-campaign:
//   - Per-record dispatch gates (kill-switch via kill_switch_state /
//     dc_businesses.sync_enabled, calling-hours, throttle)
//   - Per-record DNC enforcement via isOnDNC (fails CLOSED)
//   - Excludes phone_invalid + compliance_hold + is_simulation
//   - dc_leads + dc_campaigns rows for unified reporting
//   - logLeadSync / logLeadSyncBatch on every mutation, sync_direction='in'
//   - Explicit { error } checking on every Supabase write
//   - Hard-reject if wholesaler_ids missing AND limit missing → HTTP 400
//
// DD-specific:
//   - Cohort: wholesalers (status='active')
//   - Per-record E.164 normalization; bad phones skipped with gate_block='bad_phone'
//   - Per-record product_list lookup via wholesaler_orders → wholesaler_supply_order_items
//     * rows found → call_type='inventory_check', product_list = distinct product_names
//     * no rows   → call_type='new_pitch',        product_list = full 9-product active catalog
//   - request_data injects call_type + product_list for Anthony's two-flow branching
//   - analysis_schema matches Anthony's approved schema exactly
//   - AddToDNC tool OMITTED (degraded posture; webhook transcript-catch is fallback)
//
// BUSINESS_UNIT_KEY = 'dynasty_direct' — matches dc_businesses.business_key
// and the dc-bland-webhook dynasty_direct branch (Step 3).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { logLeadSync, logLeadSyncBatch, logGateBlock } from "../_shared/dc_sync_log.ts";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";
import { isOnDNC, normalizeE164 } from "../_shared/dnc.ts";

const BUSINESS_UNIT_KEY = "dynasty_direct";
const BUSINESS_NAME = "Dynasty Direct";
const BLAND_AGENT_ID = "b230ceb1-b355-45de-9355-750e3c604c53";
const AGENT_DISPLAY_NAME = "DD Wholesaler Outreach (Bland)";
const DEFAULT_MAX_ATTEMPTS = 3;

// Full active catalog fallback for new_pitch flow (9 items, ordered by brand).
// Kept as a spoken-name comma-string per Anthony prompt guide.
const FULL_CATALOG_PITCH_LIST =
  "GasMask Bags, GasMask Redtops, GasMask Tubes, Grabba R Us Boxes, " +
  "Hot Mama Tubes, Hotscolatti Bros Tubes, Hotscolatti Dark, " +
  "Hotscolatti Light, Hotscolatti Mix";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY");
    if (!BLAND_API_KEY) throw new Error("BLAND_API_KEY not configured");

    // AddToDNC intentionally OMITTED per degraded posture. Loud warning so ops
    // sees it in logs and knows opt-outs will only be captured post-call via
    // the webhook transcript catch, not in-call.
    console.warn(
      "[dd-trigger] AddToDNC tool is OMITTED from Bland payload per degraded posture. " +
      "Opt-outs captured only via dc-bland-webhook transcript catch. " +
      "NOT SAFE FOR PRODUCTION until DNC tool is wired."
    );

    const body = await req.json().catch(() => ({}));

    // --- HARD-REJECT GUARD ---
    // Full-cohort dispatch without explicit scope is not permitted post-TT-incident.
    // Require either wholesaler_ids (non-empty) or a numeric limit > 0.
    const _guardIds = Array.isArray(body.wholesaler_ids) ? body.wholesaler_ids : undefined;
    const _guardLimit = typeof body.limit === "number" && body.limit > 0 ? body.limit : undefined;
    if ((!_guardIds || _guardIds.length === 0) && !_guardLimit) {
      return new Response(JSON.stringify({
        error: "strict_mode_violation",
        message: "wholesaler_ids or limit required. Full-cohort dispatch without explicit scope is not permitted.",
        bland_calls_started: 0,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const maxAttempts: number = typeof body.max_attempts === "number" && body.max_attempts > 0
      ? body.max_attempts : DEFAULT_MAX_ATTEMPTS;

    const wholesalerIds: string[] | null =
      Array.isArray(body.wholesaler_ids) && body.wholesaler_ids.length > 0
        ? body.wholesaler_ids
        : null;
    const limit: number | null =
      typeof body.limit === "number" && body.limit > 0 ? body.limit : null;

    // --- Cohort selection ---
    let q = supabase
      .from("wholesalers")
      .select("id, name, contact_name, phone, city, state, status, preferred_contact, call_attempts, callback_due_at")
      .eq("status", "active")
      .is("deleted_at", null)
      .eq("is_simulation", false)
      .eq("phone_invalid", false)
      .eq("compliance_hold", false)
      .not("phone", "is", null)
      .or(`callback_due_at.is.null,callback_due_at.lte.${new Date().toISOString()}`)
      .lt("call_attempts", maxAttempts);

    if (wholesalerIds) q = q.in("id", wholesalerIds);
    if (limit) q = q.limit(limit);

    const { data: leads, error: leadsErr } = await q;
    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        cohort_filter: {
          business_unit: BUSINESS_UNIT_KEY,
          max_attempts: maxAttempts,
          wholesaler_ids: wholesalerIds,
          limit,
        },
        error: "No callable Dynasty Direct wholesalers matched the cohort filter.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- dc_leads insert (sync direction='in') ---
    const dcLeadRows = (leads as any[]).map((l) => ({
      business_id: BUSINESS_UNIT_KEY,
      business_name: BUSINESS_NAME,
      business: BUSINESS_UNIT_KEY,
      first_name: l.contact_name || l.name,
      phone: l.phone,
      city: l.city,
      state: l.state,
      lead_type: "dd_wholesaler_outreach",
      lead_source: "wholesalers",
      status: "queued",
      external_ref_id: l.id,
      metadata: {
        company_name: l.name,
        prior_attempts: l.call_attempts,
      } as any,
    }));
    const { data: insertedDcLeads, error: dcInsertErr } = await supabase
      .from("dc_leads").insert(dcLeadRows).select("id, external_ref_id");
    if (dcInsertErr) console.error("[dd-trigger dc_leads insert failed]", dcInsertErr);

    await logLeadSyncBatch(supabase, (leads as any[]).map((l) => {
      const matched = (insertedDcLeads || []).find((d: any) => d.external_ref_id === l.id);
      return {
        business_unit_key: BUSINESS_UNIT_KEY,
        lead_id: l.id,
        dc_lead_id: matched?.id || null,
        sync_direction: "in" as const,
        status_before: l.status || null,
        status_after: "queued",
        sync_source: "dd-trigger-bland-campaign",
        success: !dcInsertErr,
        error_message: dcInsertErr?.message || null,
      };
    }));

    const webhookSecret = Deno.env.get("DC_BLAND_WEBHOOK_SECRET");
    const webhookUrl = webhookSecret
      ? `${SUPABASE_URL}/functions/v1/dc-bland-webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${SUPABASE_URL}/functions/v1/dc-bland-webhook`;

    // --- Fetch agent prompt from Bland (single source of truth) ---
    let agentTask: string | null = null;
    let agentFirstSentence: string | null = null;
    try {
      const agentsRes = await fetch("https://api.bland.ai/v1/agents", {
        method: "GET",
        headers: { "Authorization": BLAND_API_KEY, "User-Agent": "dynasty-os/1.0" },
      });
      const agentsJson = await agentsRes.json();
      const agentList: any[] = Array.isArray(agentsJson)
        ? agentsJson
        : (agentsJson.agents || agentsJson.data || []);
      const ddAgent = agentList.find((a: any) => a.agent_id === BLAND_AGENT_ID);
      if (!ddAgent || !ddAgent.prompt || ddAgent.prompt.length < 100) {
        throw new Error(
          `Dynasty Direct Bland agent ${BLAND_AGENT_ID} not found or prompt missing/empty ` +
          `(found=${!!ddAgent}, prompt_len=${ddAgent?.prompt?.length ?? 0}).`
        );
      }
      agentTask = ddAgent.prompt;
      agentFirstSentence = ddAgent.first_sentence || null;
      console.log(
        `[dd-trigger] Resolved Bland agent prompt (len=${agentTask.length}, ` +
        `first_sentence_len=${agentFirstSentence?.length ?? 0})`
      );
    } catch (e: any) {
      console.error("[dd-trigger] Failed to resolve Bland agent prompt", e);
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

      // --- Per-record E.164 normalization ---
      const phoneE164 = normalizeE164(l.phone);
      if (!phoneE164 || phoneE164.length < 12 || phoneE164.length > 16) {
        gateBlocks.push({
          lead_id: l.id,
          code: "bad_phone",
          reason: `Phone could not be normalized to E.164 (raw='${l.phone}', normalized='${phoneE164}')`,
          retryable: false,
        });
        console.warn("[dd-trigger bad-phone]", l.id, l.phone);
        await logLeadSync(supabase, {
          business_unit_key: BUSINESS_UNIT_KEY, lead_id: l.id,
          sync_direction: "in",
          sync_source: "dd-trigger-bland-campaign:bad-phone-skip",
          success: false, error_message: `bad_phone: raw='${l.phone}'`,
        });
        continue;
      }

      const gate = await checkDispatchGates(supabase, { businessUnitKey: BUSINESS_UNIT_KEY });
      if (!gate.allowed) {
        gateBlocks.push({ lead_id: l.id, code: gate.code, reason: gate.reason, retryable: gate.retryable });
        await logGateBlock(supabase, {
          businessUnitKey: BUSINESS_UNIT_KEY, leadId: l.id,
          triggerName: "dd-trigger-bland-campaign",
          gateCode: gate.code, gateReason: gate.reason,
          statusBefore: l.status || null,
        });
        console.warn("[dd-trigger gate-blocked]", l.id, gate.code, gate.reason);
        if (!gate.retryable) {
          killSwitchHit = true;
          const remaining = (leads as any[]).slice(i + 1).map((r) => r.id);
          for (const rid of remaining) {
            gateBlocks.push({ lead_id: rid, code: gate.code, reason: gate.reason, retryable: false });
          }
          await logLeadSyncBatch(supabase, remaining.map((rid: string) => ({
            business_unit_key: BUSINESS_UNIT_KEY, lead_id: rid,
            sync_direction: "in" as const,
            sync_source: "dd-trigger-bland-campaign:kill-switch-abort",
            success: false, error_message: `${gate.code}: ${gate.reason}`,
          })));
          break;
        }
        continue;
      }

      // Per-record DNC enforcement — fails CLOSED on lookup error.
      const dncCheck = await isOnDNC(supabase, phoneE164);
      if (dncCheck.blocked) {
        console.warn("[dd-trigger dnc-blocked]", l.id, phoneE164, dncCheck.reason);
        gateBlocks.push({
          lead_id: l.id,
          code: "dnc_list_block",
          reason: `Phone on DNC list (${dncCheck.reason || "dnc_list"})`,
          retryable: false,
        });
        const { error: dncMarkErr } = await supabase.from("wholesalers")
          .update({ last_call_disposition: "dnc" })
          .eq("id", l.id);
        await logGateBlock(supabase, {
          businessUnitKey: BUSINESS_UNIT_KEY, leadId: l.id,
          triggerName: "dd-trigger-bland-campaign",
          gateCode: "dnc_list_block",
          gateReason: `Phone on DNC list (${dncCheck.reason || "dnc_list"})`,
          statusBefore: l.status || null,
        });
        if (dncMarkErr) {
          await logLeadSync(supabase, {
            business_unit_key: BUSINESS_UNIT_KEY, lead_id: l.id,
            sync_direction: "in",
            status_before: l.status || null, status_after: "dnc",
            sync_source: "dd-trigger-bland-campaign:dnc-mark-failed",
            success: false, error_message: dncMarkErr.message,
          });
        }
        continue;
      }

      // --- Per-record product_list resolution ---
      // Check wholesaler_orders → wholesaler_supply_order_items for order history.
      // If present → inventory_check flow with distinct product names.
      // If empty  → new_pitch flow with full 9-product active catalog.
      let productList = FULL_CATALOG_PITCH_LIST;
      let callType: "inventory_check" | "new_pitch" = "new_pitch";
      try {
        const { data: orderRows, error: orderErr } = await supabase
          .from("wholesaler_orders")
          .select("id")
          .eq("wholesaler_id", l.id)
          .limit(50);
        if (orderErr) {
          console.warn("[dd-trigger product-list order lookup failed]", l.id, orderErr);
        } else if (orderRows && orderRows.length > 0) {
          const orderIds = orderRows.map((r: any) => r.id);
          const { data: itemRows, error: itemErr } = await supabase
            .from("wholesaler_supply_order_items")
            .select("product_name")
            .in("order_id", orderIds)
            .limit(50);
          if (itemErr) {
            console.warn("[dd-trigger product-list item lookup failed]", l.id, itemErr);
          } else if (itemRows && itemRows.length > 0) {
            const distinct = Array.from(
              new Set(itemRows.map((r: any) => (r.product_name || "").trim()).filter(Boolean))
            ).slice(0, 20);
            if (distinct.length > 0) {
              productList = distinct.join(", ");
              callType = "inventory_check";
            }
          }
        }
      } catch (e) {
        console.warn("[dd-trigger product-list exception]", l.id, e);
      }

      const payload = {
        phone_number: phoneE164,
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
        tools: [], // AddToDNC omitted per degraded posture
        request_data: {
          wholesaler_id: l.id,
          hub: "dynasty_direct",
          business_unit_key: BUSINESS_UNIT_KEY,
          business_name: l.name || "your store",
          contact_name: l.contact_name || "there",
          city: l.city || "",
          call_type: callType,
          product_list: productList,
        },
        // Bland analysis_schema — matches Anthony's approved schema exactly.
        analysis_schema: {
          reorder_needed: {
            type: "boolean",
            description: "True if any product is low or out and contact indicated they need a reorder (inventory_check calls)",
          },
          any_product_low_or_out: {
            type: "boolean",
            description: "True if the contact reported ANY product in the check list as low or fully out of stock, regardless of whether they asked for a reorder",
          },
          pitch_interested: {
            type: "boolean",
            description: "True if new prospect expressed interest in Dynasty Direct products (new_pitch calls)",
          },
          opted_out: {
            type: "boolean",
            description: "True if contact asked to be removed from call list",
          },
          callback_requested: {
            type: "boolean",
            description: "True if contact asked to be called back later",
          },
          contact_confirmed: {
            type: "boolean",
            description: "True if you reached the owner or manager",
          },
          new_products_interest: {
            type: "boolean",
            description: "True if contact expressed interest in hearing about new products",
          },
          preferred_followup: {
            type: "string",
            description: "Contact's stated preferred follow-up channel: phone, sms, email, whatsapp, or none",
          },
          inventory_summary: {
            type: "string",
            description: "One-to-three sentence plain-English summary of the contact's stated inventory levels. Empty string for new_pitch calls where no inventory was discussed.",
          },
        },
        webhook: webhookUrl,
      };

      try {
        const blandRes = await fetch("https://api.bland.ai/v1/calls", {
          method: "POST",
          headers: {
            "Authorization": BLAND_API_KEY,
            "Content-Type": "application/json",
            "User-Agent": "dynasty-os/1.0",
          },
          body: JSON.stringify(payload),
        });
        const blandJson = await blandRes.json();
        if (blandRes.ok && blandJson.call_id) {
          blandSuccessCount++;
          blandCallIds.push(blandJson.call_id);

          const { error: callLogErr } = await supabase.from("dc_call_logs").insert({
            call_sid: blandJson.call_id,
            source_business: BUSINESS_UNIT_KEY,
            source_table: "wholesalers",
            source_id: l.id,
            business: BUSINESS_UNIT_KEY,
            to_number: phoneE164,
            direction: "outbound",
            status: "dialing",
            agent_id: BLAND_AGENT_ID,
            agent_type: "bland",
            agent_name: AGENT_DISPLAY_NAME,
            lead_name: l.contact_name || l.name || null,
          });
          if (callLogErr) {
            console.error("[dd-trigger dc_call_logs insert failed]", l.id, blandJson.call_id, callLogErr);
          }
        } else {
          blandError = blandError || JSON.stringify(blandJson);
          console.error("[bland call failed]", l.id, blandJson);
          await logLeadSync(supabase, {
            business_unit_key: BUSINESS_UNIT_KEY, lead_id: l.id,
            sync_direction: "in",
            sync_source: "dd-trigger-bland-campaign:bland-dispatch-failed",
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
          sync_source: "dd-trigger-bland-campaign:bland-dispatch-exception",
          success: false, error_message: e.message,
        });
      }
    }

    // --- dc_campaigns row ---
    const label = body.campaign_name
      || `DD_wholesaler_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
    const { data: campaign, error: campaignErr } = await supabase
      .from("dc_campaigns")
      .insert({
        name: label,
        business: BUSINESS_UNIT_KEY,
        agent_type: "dd_wholesaler_outreach",
        agent_name: AGENT_DISPLAY_NAME,
        status: blandSuccessCount > 0 ? "active" : "failed",
        total_leads: leads.length,
      })
      .select()
      .single();
    if (campaignErr) console.error("[dd-trigger dc_campaigns insert failed]", campaignErr);

    return new Response(JSON.stringify({
      success: blandSuccessCount > 0,
      campaign_id: campaign?.id,
      bland_calls_started: blandSuccessCount,
      bland_call_ids: blandCallIds,
      leads_loaded: leads.length,
      cohort_filter: {
        business_unit: BUSINESS_UNIT_KEY,
        max_attempts: maxAttempts,
        wholesaler_ids: wholesalerIds,
        limit,
      },
      bland_error: blandError,
      gate_blocked_count: gateBlocks.length,
      gate_blocks: gateBlocks,
      kill_switch_hit: killSwitchHit,
      message: blandSuccessCount > 0
        ? `Dispatched ${blandSuccessCount}/${leads.length} Dynasty Direct wholesaler calls${gateBlocks.length ? `, ${gateBlocks.length} gate-blocked` : ""}.`
        : killSwitchHit
          ? "Dispatch aborted — kill-switch engaged."
          : "Cohort loaded but no Bland calls succeeded.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[dd-trigger-bland-campaign] error", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
