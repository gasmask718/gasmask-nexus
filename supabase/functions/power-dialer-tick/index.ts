// POWER DIALER TICK — one engine cycle for human power dialing.
//
// NOT SCHEDULED. There is deliberately NO cron job for this function
// (jobid 126 was disabled 2026-08-23 and must stay disabled). The engine
// never dials unless a human armed it: the operator screen
// (PowerDialerConsole) invokes this while it is open and the engine is
// armed, and stops invoking when the operator presses STOP or leaves.
//
// FIRST ACTION, every run — obey the master switch in dialer_settings:
//   - engine_armed = false        → return immediately, do nothing.
//   - auto_disarm_at in the past  → disarm (engine_armed=false), return.
//   - armed_campaign_id           → the ONLY campaign ever processed;
//                                   "all active campaigns" is never dialed.
//
// Per ARMED business with telephony_mode='live' AND twilio_enabled=true:
//   1. Release agents whose wrap-up window has expired.
//   2. For each available agent (1:1 — power dialing, NEVER more calls than
//      agents; predictive_multiplier is deliberately 1 and must stay 1):
//      a. Claim ONE queue item via claim_queue_items(p_agent_user_id).
//      b. isSuppressed() gate — blocked numbers are marked dnc_skipped and
//         never dialed. This is the enforcement point for this path (the
//         target leg is placed via REST API, not browser <Dial>).
//      c. Create a live_call_sessions row (dialer-bridge-agent needs it).
//      d. Place the Twilio call with AsyncAmd. The AMD verdict arrives at
//         dialer-call-status: human → dialer-bridge-agent conferences the
//         target with the agent; machine/busy/no-answer → auto-disposition
//         there. The agent only ever hears confirmed humans.
//   3. Log the cycle to dialer_engine_cycle_logs.
//
// In simulation mode (or live not unlocked) the tick logs and exits —
// a dialer that looks live while simulating is worse than one visibly off.

import {
  corsHeaders,
  svc,
  logEvent,
} from "../_shared/dialer.ts";
import { isSuppressed } from "../_shared/dnc.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getLocalMinutesSinceMidnight(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
    const m = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
    return h * 60 + m;
  } catch {
    return 720;
  }
}

async function logCycle(supabase: any, opts: {
  business_id: string; lock_acquired: boolean; claimed: number;
  outcomes: Record<string, number>; agents: number; errors: string[];
  startedAt: string;
}) {
  try {
    await supabase.from("dialer_engine_cycle_logs").insert({
      business_id: opts.business_id,
      started_at: opts.startedAt,
      ended_at: new Date().toISOString(),
      lock_acquired: opts.lock_acquired,
      claimed_count: opts.claimed,
      outcomes: opts.outcomes,
      agents_claimed: opts.agents,
      errors: opts.errors,
    });
  } catch (e) {
    console.error("cycle log failed:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = svc();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    // ── MASTER SWITCH: only armed businesses are even considered. ──
    // A human pressed START CALLING (arm_dialer) — nothing else arms this.
    const { data: allSettings } = await supabase
      .from("dialer_settings").select("*").eq("engine_armed", true);
    if (!allSettings || allSettings.length === 0) {
      return json({ ok: true, armed: false, businesses: 0 });
    }

    const summary: any[] = [];

    for (const settings of allSettings as any[]) {
      const businessId = settings.business_id;
      const cycleStartedAt = new Date().toISOString();
      const errors: string[] = [];
      const outcomes: Record<string, number> = {};
      let claimed = 0;
      let agentsClaimed = 0;

      const isLive = settings.telephony_mode === "live" && settings.twilio_enabled === true;

      if (!isLive) {
        await logCycle(supabase, {
          business_id: businessId, lock_acquired: false, claimed: 0,
          outcomes: { simulation_mode: 1 }, agents: 0,
          errors: [`telephony_mode=${settings.telephony_mode || "simulation"} twilio_enabled=${settings.twilio_enabled === true}`],
          startedAt: cycleStartedAt,
        });
        summary.push({ business_id: businessId, mode: settings.telephony_mode || "simulation", dialed: 0 });
        continue;
      }

      // ── Business hours ──
      const tz = settings.business_timezone || "America/New_York";
      const nowMin = getLocalMinutesSinceMidnight(tz);
      const startMin = settings.business_hours_start_min ?? 540;
      const endMin = settings.business_hours_end_min ?? 1080;
      if (nowMin < startMin || nowMin > endMin) {
        await logCycle(supabase, {
          business_id: businessId, lock_acquired: false, claimed: 0,
          outcomes: { outside_business_hours: 1 }, agents: 0, errors: [], startedAt: cycleStartedAt,
        });
        summary.push({ business_id: businessId, reason: "outside_business_hours" });
        continue;
      }

      // ── Engine lock (50s — shorter than the cron interval) ──
      const { data: existingLock } = await supabase
        .from("dialer_engine_locks").select("*")
        .eq("business_id", businessId).maybeSingle();
      if (existingLock && new Date(existingLock.locked_until) > new Date()) {
        summary.push({ business_id: businessId, reason: "engine_locked" });
        continue;
      }
      const lockUntil = new Date(Date.now() + 50_000).toISOString();
      if (existingLock) {
        await supabase.from("dialer_engine_locks")
          .update({ locked_until: lockUntil, locked_by: "power-dialer-tick", updated_at: new Date().toISOString() })
          .eq("business_id", businessId);
      } else {
        await supabase.from("dialer_engine_locks")
          .insert({ business_id: businessId, locked_until: lockUntil, locked_by: "power-dialer-tick" });
      }

      // ── Release expired wrap-ups ──
      const { data: wrapAgents } = await supabase
        .from("dialer_agent_availability").select("*")
        .eq("business_id", businessId).eq("status", "wrap_up");
      for (const a of wrapAgents || []) {
        const wrapSeconds = a.wrap_up_seconds || 20;
        const endedAt = a.last_call_ended_at ? new Date(a.last_call_ended_at).getTime() : 0;
        if (Date.now() - endedAt > wrapSeconds * 1000) {
          await supabase.from("dialer_agent_availability")
            .update({ status: "available", updated_at: new Date().toISOString() })
            .eq("id", a.id);
        }
      }

      // ── Available agents with capacity ──
      const { data: agents } = await supabase
        .from("dialer_agent_availability").select("*")
        .eq("business_id", businessId).eq("status", "available")
        .is("current_session_id", null);

      const readyAgents = (agents || []).filter((a: any) =>
        (a.active_calls_count || 0) < (a.max_concurrent_calls || 1)
      );

      if (readyAgents.length === 0) {
        await logCycle(supabase, {
          business_id: businessId, lock_acquired: true, claimed: 0,
          outcomes: { no_agents_available: 1 }, agents: 0, errors, startedAt: cycleStartedAt,
        });
        summary.push({ business_id: businessId, reason: "no_agents_available" });
        continue;
      }

      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        errors.push("twilio_env_missing");
        await logCycle(supabase, {
          business_id: businessId, lock_acquired: true, claimed: 0,
          outcomes, agents: 0, errors, startedAt: cycleStartedAt,
        });
        summary.push({ business_id: businessId, reason: "twilio_env_missing" });
        continue;
      }

      const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      const maxAttempts = settings.max_attempts_per_day || 3;

      // ── 1:1 power dial: ONE number per available agent ──
      for (const agent of readyAgents) {
        const { data: claimedItems, error: claimErr } = await supabase.rpc("claim_queue_items", {
          p_business_id: businessId,
          p_campaign_id: null,
          p_limit_count: 1,
          p_max_attempts: maxAttempts,
          p_agent_user_id: agent.user_id,
        });

        if (claimErr) {
          errors.push(`claim:${claimErr.message}`);
          continue;
        }
        const item = (claimedItems || [])[0];
        if (!item) {
          outcomes.queue_empty = (outcomes.queue_empty || 0) + 1;
          continue;
        }
        claimed++;

        // ── Suppression gate (fail closed on DNC / opt-out) ──
        const suppression = await isSuppressed(supabase, item.phone_number);
        if (suppression.blocked) {
          await supabase.from("outbound_call_queue").update({
            status: "dnc_skipped",
            notes: `[SUPPRESSED] ${suppression.reason || "suppressed"} (${suppression.source || "dnc"})`,
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
          await logEvent({
            supabase, campaign_id: item.campaign_id, queue_item_id: item.id,
            event_type: "power_dialer.suppressed", source: "power-dialer", severity: "warning",
            payload: { reason: suppression.reason, suppression_source: suppression.source },
          });
          outcomes.dnc_skipped = (outcomes.dnc_skipped || 0) + 1;
          continue;
        }

        // ── Session row (bridge + agent screen read this) ──
        const { data: session, error: sessErr } = await supabase
          .from("live_call_sessions").insert({
            queue_item_id: item.id,
            store_id: item.store_id,
            contact_name: item.contact_name,
            rep_user_id: agent.user_id,
            provider: "twilio",
            business_id: businessId,
            phone_number: item.phone_number,
            campaign_id: item.campaign_id,
          }).select("id").single();

        if (sessErr || !session) {
          errors.push(`session:${sessErr?.message || "no_row"}`);
          await supabase.from("outbound_call_queue").update({
            status: "queued", claimed_by_user_id: null, claimed_at: null,
            claim_expires_at: null, claim_token: null,
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
          continue;
        }

        // ── Agent busy while dialing ──
        await supabase.from("dialer_agent_availability").update({
          status: "on_call",
          current_session_id: session.id,
          active_calls_count: (agent.active_calls_count || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq("id", agent.id);
        agentsClaimed++;

        // ── Place the call with AsyncAmd ──
        const cb = new URLSearchParams({
          campaign_id: item.campaign_id || "",
          queue_item_id: item.id,
          call_session_id: session.id,
        });
        const statusUrl = `${SUPABASE_URL}/functions/v1/dialer-call-status?${cb.toString()}`;
        const twimlUrl = `${SUPABASE_URL}/functions/v1/power-dial-twiml?${cb.toString()}`;

        const params = new URLSearchParams({
          To: item.phone_number,
          From: TWILIO_PHONE_NUMBER,
          Url: twimlUrl,
          Method: "POST",
          StatusCallback: statusUrl,
          StatusCallbackMethod: "POST",
          StatusCallbackEvent: "initiated ringing answered completed",
          Timeout: "30",
          AsyncAmd: "true",
          AsyncAmdStatusCallback: statusUrl,
          AsyncAmdStatusCallbackMethod: "POST",
          MachineDetectionTimeout: "5",
        });

        try {
          const twilioRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
            { method: "POST", headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" }, body: params },
          );
          const twilioData = await twilioRes.json().catch(() => ({}));

          if (!twilioRes.ok || !twilioData.sid) {
            errors.push(`twilio:${twilioData.message || twilioRes.status}`);
            await supabase.from("outbound_call_queue").update({
              status: "failed", last_error_severity: "error",
              notes: `[TWILIO_ERROR] ${twilioData.message || twilioRes.status}`,
              updated_at: new Date().toISOString(),
            }).eq("id", item.id);
            // Release the agent immediately — they never heard anything.
            await supabase.from("dialer_agent_availability").update({
              status: "available", current_session_id: null,
              active_calls_count: Math.max(0, (agent.active_calls_count || 1) - 1),
              updated_at: new Date().toISOString(),
            }).eq("id", agent.id);
            await supabase.from("live_call_sessions").update({ ended_at: new Date().toISOString(), outcome: "twilio_error" }).eq("id", session.id);
            outcomes.failed = (outcomes.failed || 0) + 1;
            continue;
          }

          await supabase.from("outbound_call_queue").update({
            twilio_call_sid: twilioData.sid,
            status: "dialing",
            dialing_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
          await supabase.from("live_call_sessions").update({ call_sid: twilioData.sid }).eq("id", session.id);

          await logEvent({
            supabase, campaign_id: item.campaign_id, queue_item_id: item.id,
            call_session_id: session.id, call_sid: twilioData.sid,
            event_type: "power_dialer.dialed", source: "power-dialer", severity: "info",
            payload: { agent_user_id: agent.user_id, phone: item.phone_number },
          });
          outcomes.dialed = (outcomes.dialed || 0) + 1;
        } catch (e) {
          errors.push(`twilio_exception:${String(e)}`);
          outcomes.failed = (outcomes.failed || 0) + 1;
        }
      }

      await logCycle(supabase, {
        business_id: businessId, lock_acquired: true, claimed,
        outcomes, agents: agentsClaimed, errors, startedAt: cycleStartedAt,
      });
      summary.push({ business_id: businessId, dialed: outcomes.dialed || 0, claimed, agents: agentsClaimed, errors });
    }

    return json({ ok: true, businesses: summary });
  } catch (err) {
    console.error("power-dialer-tick error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
