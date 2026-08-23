// Server-side dispatcher tick.
// Invoked by pg_cron every ~10s. Replaces the in-browser polling loop.
//
// For every active AI campaign:
//   1. Compute available slots (max_concurrent_calls - in_flight)
//   2. Atomically claim queued rows via claim_dialer_queue_items()
//   3. Trigger bland-agent-trigger for each
//   4. Sweep stuck calls
//
// Idempotent: SELECT ... FOR UPDATE SKIP LOCKED guarantees no double-dispatch
// even if multiple ticks run concurrently.

import { corsHeaders, svc, logEvent } from "../_shared/dialer.ts";
import { outreachAllowed } from "../_shared/outreachGate.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const IN_FLIGHT_STATES = [
  "dialing", "ringing", "intro_playing", "awaiting_input",
  "answered", "connected", "bridging", "bridged", "in_ai_conversation",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = svc();
    const body = await req.json().catch(() => ({}));
    const sweepOnly = body?.mode === "sweep_only";

    // Always run the stuck-call sweep
    const { data: sweep } = await supabase.rpc("dialer_stuck_call_sweep");
    const sweptCount = Array.isArray(sweep) ? (sweep[0] as any)?.swept_count ?? 0 : 0;
    if (sweptCount > 0) {
      await logEvent({
        supabase,
        event_type: "dispatcher.stuck_swept",
        source: "dispatcher",
        severity: "warning",
        payload: { swept: sweptCount },
      });
    }

    if (sweepOnly) return json({ ok: true, sweep_only: true, swept: sweptCount });

    // OUTREACH GATE (2026-08-23): no campaign dispatches unless a human armed
    // the switch. The stuck-call sweep above always runs — it hangs up stuck
    // calls (customer-protective) and never reaches out to anyone.
    if (!(await outreachAllowed("dispatch_campaign_tick"))) {
      return json({ ok: true, gated: true, switch: "dispatch_campaign_tick", swept: sweptCount });
    }

    // Find active AI campaigns to dispatch
    const { data: campaigns, error: campErr } = await supabase
      .from("dialer_campaigns")
      .select(
        "id, max_concurrent_calls, cps_limit, dial_mode, agent_provider, " +
        "bland_agent_id, agent_id, initial_script",
      )
      .eq("status", "active")
      .neq("dial_mode", "manual");

    if (campErr) throw campErr;
    if (!campaigns || campaigns.length === 0) {
      return json({ ok: true, swept: sweptCount, campaigns: 0 });
    }

    let dispatched = 0;
    for (const c of campaigns as any[]) {
      const maxConc = Math.max(1, c.max_concurrent_calls || 1);

      // Count in-flight for this campaign
      const { count: inFlight } = await supabase
        .from("outbound_call_queue")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id)
        .in("status", IN_FLIGHT_STATES);

      const slots = Math.max(0, maxConc - (inFlight || 0));
      if (slots === 0) continue;

      // Resolve agent_type for this campaign (we still pass agent_type for compat;
      // bland-agent-trigger now ALSO accepts bland_agent_id directly).
      let agentType = "sales-outreach";
      let blandAgentIdStr: string | null = null;
      const blandRowId = c.bland_agent_id || c.agent_id;
      if (blandRowId) {
        const { data: a } = await supabase
          .from("bland_agent_webhooks")
          .select("agent_type, bland_agent_id")
          .eq("id", blandRowId)
          .maybeSingle();
        if (a) {
          agentType = (a as any).agent_type || agentType;
          blandAgentIdStr = (a as any).bland_agent_id || null;
        }
      }

      // Atomically claim N rows
      const { data: claimed, error: claimErr } = await supabase.rpc(
        "claim_dialer_queue_items",
        { p_campaign_id: c.id, p_limit: slots },
      );
      if (claimErr) {
        console.error("claim error:", claimErr);
        continue;
      }
      if (!claimed || claimed.length === 0) continue;

      // Fire each call (don't await Bland — let dispatcher tick stay fast)
      for (const row of claimed as any[]) {
        try {
          const resp = await supabase.functions.invoke("bland-agent-trigger", {
            body: {
              phone_number: row.phone_number,
              agent_type: agentType,
              bland_agent_row_id: blandRowId,         // direct DB row id
              bland_agent_id: blandAgentIdStr,         // direct Bland API id
              prompt: c.initial_script || undefined,
              queue_item_id: row.id,
              campaign_id: c.id,
            },
          });
          if (resp.error || (resp.data as any)?.error) {
            throw new Error(resp.error?.message || (resp.data as any)?.error);
          }
          dispatched++;
        } catch (err) {
          console.error("dispatch invoke failed:", err);
          await supabase
            .from("outbound_call_queue")
            .update({
              status: "failed",
              last_error_severity: "error",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          await logEvent({
            supabase,
            campaign_id: c.id,
            queue_item_id: row.id,
            event_type: "dispatcher.invoke_failed",
            source: "dispatcher",
            severity: "error",
            payload: { error: (err as Error).message },
          });
        }
      }
    }

    return json({ ok: true, swept: sweptCount, dispatched });
  } catch (err) {
    console.error("dispatch-campaign-tick error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
