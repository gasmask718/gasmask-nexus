import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkDispatchGates } from "../_shared/dispatch_gates.ts";
import { logLeadSync } from "../_shared/dc_sync_log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUSINESS_UNIT_KEY = "brandaro";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const { batch_size = 5, language_filter } = body;

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

        const blandData = await blandRes.json().catch(() => ({}));

        if (!blandRes.ok) {
          console.error(`[brandaro-ai-caller] Bland dispatch failed lead=${lead.id} status=${blandRes.status}:`, blandData);
          const { error: failUpdErr } = await supabase
            .from("brandaro_ai_calls")
            .update({
              status: "failed",
              outcome: JSON.stringify({ bland_status: blandRes.status, bland_response: blandData }),
            })
            .eq("id", callRecord.id);
          if (failUpdErr) {
            console.error(`[brandaro-ai-caller] failed-status UPDATE failed for ${callRecord.id}:`, failUpdErr);
          }
          results.push({ lead_id: lead.id, status: "failed", bland_status: blandRes.status, error: blandData });
          continue;
        }

        const blandCallId = blandData.call_id || blandData.callId || null;
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

    return new Response(
      JSON.stringify({
        total_eligible: eligibleLeads.length,
        results,
        gate_blocked: gateBlocked,
        called: results.filter((r) => r.status === "initiated").length,
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
