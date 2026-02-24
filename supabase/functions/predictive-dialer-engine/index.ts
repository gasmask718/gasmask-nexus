import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function simulateOutcome(): "answered" | "voicemail" | "no_answer" | "failed" {
  const rand = Math.random();
  if (rand < 0.20) return "answered";
  if (rand < 0.60) return "voicemail";
  if (rand < 0.95) return "no_answer";
  return "failed";
}

function getRetryMinutes(attemptCount: number, backoffMinutes: number[]): number {
  const idx = Math.min(attemptCount - 1, backoffMinutes.length - 1);
  return backoffMinutes[idx] || 30;
}

function getLocalMinutesSinceMidnight(tz: string): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  return hour * 60 + minute;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cycleStartedAt = new Date().toISOString();
  let lockAcquired = false;
  const errors: string[] = [];

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { business_id, campaign_id } = await req.json();

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: "business_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── PHASE 1: Acquire engine lock ──
    const { data: existingLock } = await supabase
      .from("dialer_engine_locks")
      .select("*")
      .eq("business_id", business_id)
      .maybeSingle();

    if (existingLock && new Date(existingLock.locked_until) > new Date()) {
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired: false, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: ["engine_locked"] });
      return new Response(
        JSON.stringify({ success: false, reason: "engine_locked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lockUntil = new Date(Date.now() + 10_000).toISOString();
    if (existingLock) {
      await supabase
        .from("dialer_engine_locks")
        .update({ locked_until: lockUntil, locked_by: "predictive-engine", updated_at: new Date().toISOString() })
        .eq("business_id", business_id);
    } else {
      await supabase
        .from("dialer_engine_locks")
        .insert({ business_id, locked_until: lockUntil, locked_by: "predictive-engine" });
    }
    lockAcquired = true;

    // ── Fetch settings ──
    const { data: settings } = await supabase
      .from("dialer_settings")
      .select("*")
      .eq("business_id", business_id)
      .maybeSingle();

    const predictiveMultiplier = settings?.predictive_multiplier || 5;
    const maxConcurrent = settings?.max_concurrent_dials || 10;
    const maxAttemptsPerDay = settings?.max_attempts_per_day || 3;
    const backoffMinutes: number[] = settings?.retry_backoff_minutes || [15, 60, 240];
    const tz = settings?.business_timezone || "America/New_York";
    const startMin = settings?.business_hours_start_min ?? 540;
    const endMin = settings?.business_hours_end_min ?? 1080;
    const maxCallsPerMinute = settings?.max_calls_per_minute ?? 30;
    const maxSimultaneousDials = settings?.max_simultaneous_dials ?? 10;
    const connectRateTarget = settings?.connect_rate_target ?? 0.18;

    // ── Business hours check ──
    const nowMin = getLocalMinutesSinceMidnight(tz);
    if (nowMin < startMin || nowMin > endMin) {
      await releaseLock(supabase, business_id);
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: ["outside_business_hours"] });
      return new Response(
        JSON.stringify({ success: false, reason: "outside_business_hours", nowMin, window: `${startMin}-${endMin}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Auto-transition wrap_up → available ──
    const { data: wrapUpAgents } = await supabase
      .from("dialer_agent_availability")
      .select("*")
      .eq("business_id", business_id)
      .eq("status", "wrap_up");

    if (wrapUpAgents) {
      for (const agent of wrapUpAgents) {
        const wrapSeconds = agent.wrap_up_seconds || 20;
        const endedAt = agent.last_call_ended_at ? new Date(agent.last_call_ended_at).getTime() : 0;
        if (Date.now() - endedAt > wrapSeconds * 1000) {
          await supabase
            .from("dialer_agent_availability")
            .update({ status: "available", updated_at: new Date().toISOString() })
            .eq("id", agent.id);
        }
      }
    }

    // ── Count available agents ──
    const { data: availableAgents } = await supabase
      .from("dialer_agent_availability")
      .select("*")
      .eq("business_id", business_id)
      .eq("status", "available");

    const agentCount = availableAgents?.length || 0;

    if (agentCount === 0) {
      await releaseLock(supabase, business_id);
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: ["no_agents_available"] });
      return new Response(
        JSON.stringify({ success: false, reason: "no_agents_available", dialed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Count currently dialing ──
    const { count: currentlyDialing } = await supabase
      .from("outbound_call_queue")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business_id)
      .eq("status", "dialing");

    // ── Predictive throttle: calculate slots ──
    // required_dials = active_agents / connect_rate_target (capped by settings)
    const predictiveDials = Math.ceil(agentCount / connectRateTarget);
    const idealDials = Math.min(
      predictiveDials,
      Math.ceil(agentCount * predictiveMultiplier),
      maxConcurrent,
      maxSimultaneousDials,
      maxCallsPerMinute // per-cycle cap approximation
    );
    const slotsAvailable = Math.max(0, idealDials - (currentlyDialing || 0));

    if (slotsAvailable <= 0) {
      await releaseLock(supabase, business_id);
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: [] });
      return new Response(
        JSON.stringify({ success: true, reason: "at_capacity", dialed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Atomic queue claiming via RPC (DNC-safe) ──
    const { data: claimedItems, error: claimErr } = await supabase.rpc("claim_queue_items", {
      p_business_id: business_id,
      p_campaign_id: campaign_id || null,
      p_limit_count: slotsAvailable,
      p_max_attempts: maxAttemptsPerDay,
    });

    if (claimErr) {
      errors.push(`claim_queue_items: ${claimErr.message}`);
      await releaseLock(supabase, business_id);
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors });
      return new Response(
        JSON.stringify({ error: "Failed to claim queue items", details: claimErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!claimedItems || claimedItems.length === 0) {
      await releaseLock(supabase, business_id);
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: [] });
      return new Response(
        JSON.stringify({ success: true, reason: "queue_empty", dialed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Process each claimed item ──
    const outcomeCounts: Record<string, number> = { answered: 0, voicemail: 0, no_answer: 0, failed: 0, bridged: 0, answered_no_agent: 0 };
    let agentsClaimed = 0;
    const results: Array<{ id: string; outcome: string; session_id?: string }> = [];

    for (const item of claimedItems) {
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 100));

      const outcome = simulateOutcome();

      if (outcome === "answered") {
        // Transition dialing → answered via state machine
        const { error: transErr } = await supabase.functions.invoke("dialer-state-transition", {
          body: { queue_item_id: item.id, new_status: "answered" },
        });
        if (transErr) {
          errors.push(`transition answered ${item.id}: ${transErr.message}`);
          outcomeCounts.failed++;
          results.push({ id: item.id, outcome: "transition_error" });
          continue;
        }

        // Set answered_at
        await supabase.from("outbound_call_queue").update({ answered_at: new Date().toISOString() }).eq("id", item.id);

        // Atomic agent claiming via RPC (concurrency-safe)
        const { data: agentRows, error: agentErr } = await supabase.rpc("claim_available_agent", {
          p_business_id: business_id,
        });

        if (agentErr || !agentRows || agentRows.length === 0) {
          outcomeCounts.answered_no_agent++;
          results.push({ id: item.id, outcome: "answered_no_agent" });
          continue;
        }

        const agent = agentRows[0];
        agentsClaimed++;

        // Create live_call_session BEFORE bridging (session integrity)
        const { data: session, error: sessionErr } = await supabase
          .from("live_call_sessions")
          .insert({
            business_id: item.business_id,
            store_id: item.store_id,
            queue_item_id: item.id,
            contact_name: item.contact_name,
            phone_number: item.phone_number,
            rep_user_id: agent.user_id,
            provider: "simulation",
            connected_at: new Date().toISOString(),
            outcome: null,
            campaign_id: item.campaign_id,
          })
          .select("id")
          .single();

        if (sessionErr || !session) {
          errors.push(`session_create ${item.id}: ${sessionErr?.message || "unknown"}`);
          // Undo agent claim
          await supabase.from("dialer_agent_availability").update({
            status: "available", active_calls_count: Math.max((agent.active_calls_count || 1) - 1, 0), updated_at: new Date().toISOString(),
          }).eq("id", agent.id);
          outcomeCounts.failed++;
          results.push({ id: item.id, outcome: "session_create_error" });
          continue;
        }

        // Transition answered → bridged via state machine
        const { error: bridgeErr } = await supabase.functions.invoke("dialer-state-transition", {
          body: { queue_item_id: item.id, new_status: "bridged", agent_id: agent.user_id },
        });

        if (bridgeErr) {
          errors.push(`transition bridged ${item.id}: ${bridgeErr.message}`);
          // Cleanup: end session and undo agent
          await supabase.from("live_call_sessions").update({ ended_at: new Date().toISOString(), outcome: "bridge_failed" }).eq("id", session.id);
          await supabase.from("dialer_agent_availability").update({
            status: "available", active_calls_count: Math.max((agent.active_calls_count || 1) - 1, 0), updated_at: new Date().toISOString(),
          }).eq("id", agent.id);
          outcomeCounts.failed++;
          results.push({ id: item.id, outcome: "bridge_error" });
          continue;
        }

        outcomeCounts.bridged++;
        results.push({ id: item.id, outcome: "bridged", session_id: session.id });
      } else {
        // voicemail, no_answer, failed — transition via state machine
        const { error: transErr } = await supabase.functions.invoke("dialer-state-transition", {
          body: { queue_item_id: item.id, new_status: outcome },
        });

        if (transErr) {
          errors.push(`transition ${outcome} ${item.id}: ${transErr.message}`);
        }

        // Clear claim fields on non-answered outcomes
        await supabase.from("outbound_call_queue").update({
          claimed_by_user_id: null,
          claimed_at: null,
          claim_expires_at: null,
          claim_token: null,
        }).eq("id", item.id);

        // Exponential backoff for no_answer
        if (outcome === "no_answer") {
          const retryMin = getRetryMinutes(item.attempt_count || 1, backoffMinutes);
          await supabase.from("outbound_call_queue").update({
            next_retry_at: new Date(Date.now() + retryMin * 60 * 1000).toISOString(),
          }).eq("id", item.id);
        }

        outcomeCounts[outcome]++;
        results.push({ id: item.id, outcome });
      }
    }

    // ── Update campaign stats ──
    if (campaign_id) {
      const { data: campaign } = await supabase
        .from("dialer_campaigns")
        .select("completed_calls, answered_calls, voicemail_count, failed_calls")
        .eq("id", campaign_id)
        .single();

      if (campaign) {
        await supabase.from("dialer_campaigns").update({
          completed_calls: (campaign.completed_calls || 0) + claimedItems.length,
          answered_calls: (campaign.answered_calls || 0) + outcomeCounts.bridged + outcomeCounts.answered_no_agent,
          voicemail_count: (campaign.voicemail_count || 0) + outcomeCounts.voicemail,
          failed_calls: (campaign.failed_calls || 0) + outcomeCounts.no_answer + outcomeCounts.failed,
          updated_at: new Date().toISOString(),
        }).eq("id", campaign_id);
      }
    }

    // ── Release lock ──
    await releaseLock(supabase, business_id);

    // ── Log cycle ──
    await logCycle(supabase, {
      business_id,
      campaign_id,
      cycleStartedAt,
      lockAcquired,
      claimed: claimedItems.length,
      outcomes: outcomeCounts,
      agentsClaimed,
      errors,
    });

    return new Response(
      JSON.stringify({
        success: true,
        dialed: claimedItems.length,
        agents_available: agentCount,
        agents_claimed: agentsClaimed,
        ideal_dials: idealDials,
        predictive_target: predictiveDials,
        connect_rate_target: connectRateTarget,
        outcomes: outcomeCounts,
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function releaseLock(supabase: any, businessId: string) {
  await supabase
    .from("dialer_engine_locks")
    .update({ locked_until: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("business_id", businessId);
}

async function logCycle(supabase: any, params: {
  business_id: string;
  campaign_id?: string;
  cycleStartedAt: string;
  lockAcquired: boolean;
  claimed: number;
  outcomes: Record<string, number>;
  agentsClaimed: number;
  errors: string[];
}) {
  await supabase.from("dialer_engine_cycle_logs").insert({
    business_id: params.business_id,
    campaign_id: params.campaign_id || null,
    started_at: params.cycleStartedAt,
    ended_at: new Date().toISOString(),
    lock_acquired: params.lockAcquired,
    claimed_count: params.claimed,
    outcomes: params.outcomes,
    agents_claimed: params.agentsClaimed,
    errors: params.errors,
  });
}
