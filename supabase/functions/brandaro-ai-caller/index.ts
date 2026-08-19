import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";
import { logLeadSync } from "../_shared/dc_sync_log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUSINESS_UNIT_KEY = "brandaro";

/**
 * FIX (2026-08-19): every Bland dispatch since 2026-08-03 died with
 * "Invalid 'from' - you might not own this number". Root cause: the from-number
 * cascade hands Bland a *Twilio*-owned number out of dc_phone_numbers
 * (business='brandaro'), but Bland only accepts caller IDs registered inside the
 * Bland account. We now resolve the caller ID against Bland's own inventory and
 * fall back to letting Bland pick one (omit `from`) rather than sending a number
 * the provider will always reject.
 */
async function resolveBlandFrom(
  apiKey: string,
  preferred: string | null,
): Promise<{ from: string | null; source: string }> {
  const envFrom = Deno.env.get("BLAND_FROM_NUMBER");
  let owned: string[] = [];
  try {
    const res = await fetch("https://api.bland.ai/v1/inbound", {
      headers: { Authorization: apiKey },
    });
    if (res.ok) {
      const data = await res.json();
      owned = (data?.inbound_numbers ?? [])
        .map((n: any) => n?.phone_number)
        .filter((n: any) => typeof n === "string");
    } else {
      console.error(`[brandaro-ai-caller] bland inbound lookup http=${res.status}`);
    }
  } catch (e) {
    console.error("[brandaro-ai-caller] bland inbound lookup failed:", e);
  }

  if (preferred && owned.includes(preferred)) return { from: preferred, source: "pool_bland_owned" };
  if (envFrom && (owned.length === 0 || owned.includes(envFrom))) {
    return { from: envFrom, source: "env_bland_from_number" };
  }
  if (owned.length > 0) {
    if (preferred) {
      console.warn(
        `[brandaro-ai-caller] pool number ${preferred} is not owned by the Bland account — substituting ${owned[0]}`,
      );
    }
    return { from: owned[0], source: "bland_inventory" };
  }
  console.warn("[brandaro-ai-caller] no Bland-owned caller ID available — letting Bland assign one");
  return { from: null, source: "bland_assigned" };
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const { batch_size = 5, language_filter, test_phone } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // T7c-B-b Session 4: dispatch rewired from Twilio+TwiML to Bland /v1/calls.
    // Session 3 from-number cascade (select_best_number_for_business + bookkeeping)
    // preserved below unchanged; only the outbound-dial layer is replaced.
    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY");
    // FIX (b): the UUID stored in BRANDARO_SALES_AGENT_ID is a Bland *pathway* id,
    // not an agent id. Sending it as `agent_id` made every call fail with
    // "Agent not found". We now send it as `pathway_id` (new-style secret name
    // BRANDARO_SALES_PATHWAY_ID is preferred, legacy name kept as fallback).
    const BRANDARO_SALES_PATHWAY_ID =
      Deno.env.get("BRANDARO_SALES_PATHWAY_ID") || Deno.env.get("BRANDARO_SALES_AGENT_ID");
    if (!BLAND_API_KEY) {
      throw new Error("BLAND_API_KEY not configured");
    }
    if (!BRANDARO_SALES_PATHWAY_ID) {
      throw new Error("BRANDARO_SALES_PATHWAY_ID (or legacy BRANDARO_SALES_AGENT_ID) not configured");
    }

    // === TEST OVERRIDE ===
    // `test_phone` dials one explicit number and bypasses the lead table, the
    // dispatch gates, the 24h recent-call filter and all DB bookkeeping. It
    // exists so outbound dialing can be validated without calling a real
    // business. It never touches brandaro_leads_master or brandaro_ai_calls.
    if (test_phone) {
      if (!/^\+[1-9]\d{6,14}$/.test(String(test_phone))) {
        return new Response(
          JSON.stringify({ success: false, error: "test_phone must be E.164, e.g. +15551234567" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Same from-number cascade as the live path, minus the usage bookkeeping.
      let testFrom: string | null = null;
      try {
        const { data: sel, error: selErr } = await supabase.rpc(
          "select_best_number_for_business",
          { p_business: "brandaro" }
        );
        if (selErr) throw selErr;
        const row = Array.isArray(sel) ? sel[0] : sel;
        testFrom = row?.phone_number ?? null;
      } catch (e) {
        console.error("[brandaro-ai-caller][TEST] number selection failed:", e);
      }
      if (!testFrom) {
        const { data: fbRows } = await supabase
          .from("dc_phone_numbers")
          .select("phone_number")
          .eq("business", "brandaro")
          .eq("status", "active")
          .order("daily_call_count", { ascending: true })
          .limit(1);
        testFrom = fbRows?.[0]?.phone_number ?? null;
      }
      const testResolved = await resolveBlandFrom(BLAND_API_KEY, testFrom);
      testFrom = testResolved.from;

      const testPayload: Record<string, unknown> = {
        phone_number: test_phone,
        ...(testFrom ? { from: testFrom } : {}),
        pathway_id: BRANDARO_SALES_PATHWAY_ID,
        metadata: { campaign: "brandaro-ai-caller-test", test: true },
      };


      const tRes = await fetch("https://api.bland.ai/v1/calls", {
        method: "POST",
        headers: { Authorization: BLAND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });
      const tText = await tRes.text();
      let tData: any = {};
      try { tData = tText ? JSON.parse(tText) : {}; } catch { tData = { raw: tText }; }
      const tCallId = tData.call_id || tData.callId || null;
      const tErrored =
        !tRes.ok ||
        String(tData?.status || "").toLowerCase() === "error" ||
        Boolean(tData?.errors) ||
        !tCallId;

      console.log(`[brandaro-ai-caller][TEST] to=${test_phone} from=${testFrom} http=${tRes.status} body=${tText}`);

      return new Response(
        JSON.stringify({
          success: !tErrored,
          test_mode: true,
          to: test_phone,
          from: testFrom,
          call_id: tCallId,
          provider_status: tRes.status,
          provider_response: tData,
        }),
        { status: tErrored ? 502 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch leads that haven't been AI-called recently
    let query = supabase
      .from("brandaro_leads_master")
      .select("id, business_name, phone, language, region, intent_score")
      .not("phone", "is", null)
      .order("intent_score", { ascending: false })
      .limit(batch_size);

    if (language_filter) {
      query = query.eq("language", language_filter);
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ message: "No leads to call", called: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out recently called leads (24h)
    const leadIds = leads.map((l: any) => l.id);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentCalls, error: recentErr } = await supabase
      .from("brandaro_ai_calls")
      .select("lead_id")
      .in("lead_id", leadIds)
      .gte("created_at", oneDayAgo);
    if (recentErr) {
      console.error("[brandaro-ai-caller] recent-calls lookup failed:", recentErr);
    }

    const recentlyCalledIds = new Set((recentCalls || []).map((c: any) => c.lead_id));
    const eligibleLeads = leads.filter((l: any) => !recentlyCalledIds.has(l.id));

    const results: any[] = [];
    let gateBlocked = 0;

    for (const lead of eligibleLeads) {
      try {
        // === PRE-DIAL GATE (kill-switch + calling-hours + throttle) ===
        // Brandaro retrofit: business-unit scope only (no campaign_id in this flow).
        // Kill-switch = non-retryable; hours/throttle = retryable (queue/lead untouched).
        const gate = await checkDispatchGates(supabase, {
          businessUnitKey: BUSINESS_UNIT_KEY,
        });
        if (!gate.allowed) {
          console.log(`[brandaro-ai-caller] GATE BLOCK code=${gate.code} retryable=${gate.retryable} lead=${lead.id} reason=${gate.reason}`);
          // Fire-and-forget sync log (helper never throws; failures only console.error'd)
          await logLeadSync(supabase, {
            business_unit_key: BUSINESS_UNIT_KEY,
            lead_id: lead.id,
            sync_direction: 'out',
            sync_source: 'brandaro-ai-caller',
            success: false,
            error_message: `gate_block:${gate.code} retryable=${gate.retryable} ${gate.reason ?? ''}`.trim(),
          });
          results.push({
            lead_id: lead.id,
            status: "gate_blocked",
            gate_code: gate.code,
            gate_retryable: gate.retryable,
            reason: gate.reason,
          });
          gateBlocked++;
          continue;
        }

        // Gate allowed — log the successful dispatch attempt (pre-Twilio)
        await logLeadSync(supabase, {
          business_unit_key: BUSINESS_UNIT_KEY,
          lead_id: lead.id,
          sync_direction: 'out',
          sync_source: 'brandaro-ai-caller',
          success: true,
        });

        const { data: callRecord, error: insertErr } = await supabase
          .from("brandaro_ai_calls")
          .insert({
            lead_id: lead.id,
            language: lead.language || "spanish",
            status: "initiating",
            called_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertErr) {
          console.error(`Failed to create call record for ${lead.id}:`, insertErr);
          continue;
        }

        // === FROM-NUMBER CASCADE (T7c-B-b Phase 1) — preserved from Session 3 ===
        // 1) select_best_number_for_business('brandaro')
        // 2) exhausted -> refuse (pool_exhausted=true)
        // 3) RPC throws -> emergency fallback to any active brandaro pool row (no bookkeeping)
        let fromNumber: string | null = null;
        let poolRowId: string | null = null;
        let fromSource: "pool" | "emergency" = "pool";

        try {
          const { data: sel, error: selErr } = await supabase.rpc(
            "select_best_number_for_business",
            { p_business: "brandaro" }
          );
          if (selErr) throw selErr;
          const row = Array.isArray(sel) ? sel[0] : sel;
          if (row && row.phone_number) {
            fromNumber = row.phone_number;
            poolRowId = row.id ?? row.number_id ?? null;
          } else {
            console.log(`[brandaro-ai-caller] [POOL EXHAUSTED] lead=${lead.id} — refusing to dial`);
            await supabase
              .from("brandaro_ai_calls")
              .update({ status: "failed", outcome: JSON.stringify({ pool_exhausted: true }) })
              .eq("id", callRecord.id);
            results.push({ lead_id: lead.id, status: "failed", pool_exhausted: true });
            continue;
          }
        } catch (rpcErr) {
          console.error(`[brandaro-ai-caller] [SELECTION ERROR] lead=${lead.id}:`, rpcErr);
          const { data: fallbackRows } = await supabase
            .from("dc_phone_numbers")
            .select("phone_number")
            .eq("business", "brandaro")
            .eq("status", "active")
            .order("daily_call_count", { ascending: true })
            .limit(1);
          const fb = fallbackRows?.[0]?.phone_number;
          if (!fb) {
            await supabase
              .from("brandaro_ai_calls")
              .update({ status: "failed", outcome: JSON.stringify({ selection_error: String(rpcErr), no_fallback: true }) })
              .eq("id", callRecord.id);
            results.push({ lead_id: lead.id, status: "failed", selection_error: true });
            continue;
          }
          fromNumber = fb;
          fromSource = "emergency";
        }

        // === BLAND DISPATCH (T7c-B-b Session 4) ===
        // Bland agent handles opening + conversation; we only pass context via metadata.
        const firstName = (lead.business_name || "").split(/\s+/)[0] || "there";
        const blandPayload: Record<string, unknown> = {
          phone_number: lead.phone,
          from: fromNumber!,
          pathway_id: BRANDARO_SALES_PATHWAY_ID,
          webhook: `${supabaseUrl}/functions/v1/bland-agent-webhook`,
          metadata: {
            lead_id: lead.id,
            first_name: firstName,
            business_name: lead.business_name || null,
            campaign: "brandaro-ai-caller",
            pool_row_id: poolRowId,
            call_record_id: callRecord.id,
          },
        };

        const blandRes = await fetch("https://api.bland.ai/v1/calls", {
          method: "POST",
          headers: {
            Authorization: BLAND_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(blandPayload),
        });

        const blandText = await blandRes.text();
        let blandData: any = {};
        try { blandData = blandText ? JSON.parse(blandText) : {}; } catch { blandData = { raw: blandText }; }

        // FIX (c): Bland frequently returns HTTP 200 with { status: "error" } and no
        // call_id. Treating that as success is what produced the false "200 OK"
        // rate. A dispatch only counts as success when the provider both returns
        // 2xx AND hands back a call id with a non-error status.
        const blandCallId = blandData.call_id || blandData.callId || null;
        const providerErrored =
          !blandRes.ok ||
          String(blandData?.status || "").toLowerCase() === "error" ||
          Boolean(blandData?.errors) ||
          !blandCallId;

        if (providerErrored) {
          const reason =
            blandData?.message || blandData?.error || blandData?.errors ||
            (!blandCallId ? "provider returned no call_id" : "unknown provider error");
          console.error(`[brandaro-ai-caller] Bland dispatch failed lead=${lead.id} status=${blandRes.status}:`, blandData);
          const { error: failUpdErr } = await supabase
            .from("brandaro_ai_calls")
            .update({
              status: "failed",
              outcome: JSON.stringify({ bland_status: blandRes.status, reason, bland_response: blandData }),
            })
            .eq("id", callRecord.id);
          if (failUpdErr) {
            console.error(`[brandaro-ai-caller] failed-status UPDATE failed for ${callRecord.id}:`, failUpdErr);
          }
          results.push({
            lead_id: lead.id,
            status: "failed",
            bland_status: blandRes.status,
            error: typeof reason === "string" ? reason : JSON.stringify(reason),
          });
          continue;
        }


        const { error: successUpdErr } = await supabase
          .from("brandaro_ai_calls")
          .update({ call_sid: blandCallId, status: "initiated" })
          .eq("id", callRecord.id);
        if (successUpdErr) {
          console.error(`[brandaro-ai-caller] success UPDATE (call_sid) failed for ${callRecord.id}:`, successUpdErr);
        }

        // Bookkeeping: only when the pool cascade (not emergency fallback) supplied the number.
        if (fromSource === "pool" && poolRowId) {
          const { error: bumpErr } = await supabase.rpc("bump_number_usage_v2", {
            p_id: poolRowId,
          });
          if (bumpErr) {
            console.error(`[brandaro-ai-caller] bump_number_usage_v2 failed for ${poolRowId}:`, bumpErr);
          }
        }

        results.push({ lead_id: lead.id, status: "initiated", call_id: blandCallId, from: fromNumber, from_source: fromSource });

        // 3s pacing between calls
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (callErr) {
        console.error(`Error calling lead ${lead.id}:`, callErr);
        results.push({ lead_id: lead.id, status: "error", error: String(callErr) });
      }
    }

    const called = results.filter((r) => r.status === "initiated").length;
    const failed = results.filter((r) => r.status === "failed" || r.status === "error").length;

    return new Response(
      JSON.stringify({
        // FIX (c): the batch reports honest counts. `success` is false when the
        // batch attempted dials and none of them actually reached the provider.
        success: !(failed > 0 && called === 0),
        total_eligible: eligibleLeads.length,
        results,
        gate_blocked: gateBlocked,
        called,
        failed,
        first_error: results.find((r) => r.status === "failed" || r.status === "error")?.error ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Caller error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
