import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── INSTRUMENTATION UTILITIES ──

interface StepResult {
  rows_affected: number;
  output: any;
}

async function createIntelligenceRun(
  supabase: any,
  businessId: string,
  runMode: string
): Promise<string | null> {
  try {
    const { data: run, error } = await supabase
      .from("dialer_intelligence_runs")
      .insert({
        business_id: businessId,
        run_mode: runMode,
        started_at: new Date().toISOString(),
        overall_status: "ok",
      })
      .select("id")
      .single();

    if (error || !run) {
      console.error("Failed to create intelligence run:", error?.message);
      return null;
    }
    return run.id;
  } catch (e) {
    console.error("Intelligence run creation exception:", e);
    return null;
  }
}

async function runStep({
  supabase,
  runId,
  stepName,
  rpcName,
  executor,
}: {
  supabase: any;
  runId: string | null;
  stepName: string;
  rpcName: string;
  executor: () => Promise<StepResult>;
}): Promise<any> {
  const startedAt = new Date();
  let stepId: string | null = null;

  // Insert initial step record
  if (runId) {
    try {
      const { data: step } = await supabase
        .from("dialer_intelligence_run_steps")
        .insert({
          run_id: runId,
          step_name: stepName,
          rpc_name: rpcName,
          status: "skipped",
          started_at: startedAt.toISOString(),
        })
        .select("id")
        .single();
      stepId = step?.id || null;
    } catch (e) {
      console.error(`Failed to insert step record for ${stepName}:`, e);
    }
  }

  try {
    const result = await executor();
    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const rowsAffected = result?.rows_affected ?? 0;
    const status = rowsAffected > 0 ? "ok" : "warn";

    if (stepId) {
      await supabase
        .from("dialer_intelligence_run_steps")
        .update({
          status,
          ended_at: endedAt.toISOString(),
          duration_ms: durationMs,
          rows_affected: rowsAffected,
          output_json: result?.output ?? null,
          error_message: rowsAffected === 0 ? "No impact detected" : null,
        })
        .eq("id", stepId);
    }

    return result?.output ?? null;
  } catch (err: any) {
    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();

    if (stepId) {
      await supabase
        .from("dialer_intelligence_run_steps")
        .update({
          status: "error",
          ended_at: endedAt.toISOString(),
          duration_ms: durationMs,
          rows_affected: 0,
          error_message: String(err?.message || err),
        })
        .eq("id", stepId);
    }

    console.error(`Step ${stepName} failed:`, err);
    return null;
  }
}

async function finalizeRun(
  supabase: any,
  runId: string | null,
  snapshotBefore: any,
  snapshotAfter: any,
  inventorySeedResult: any
) {
  if (!runId) return;

  try {
    // Compute deltas
    const queueBefore = snapshotBefore?.queue || { count: 0, avg_priority: 0, max_priority: 0 };
    const queueAfter = snapshotAfter?.queue || { count: 0, avg_priority: 0, max_priority: 0 };
    const campBefore = snapshotBefore?.campaign || { count: 0, avg_weight: 1, max_weight: 1 };
    const campAfter = snapshotAfter?.campaign || { count: 0, avg_weight: 1, max_weight: 1 };
    const routeBefore = snapshotBefore?.routing || { top_rep_share: 0 };
    const routeAfter = snapshotAfter?.routing || { top_rep_share: 0 };

    await supabase.from("dialer_intelligence_deltas").insert({
      run_id: runId,
      queue_priority_rows_changed: Math.abs(
        Number(queueAfter.count || 0) - Number(queueBefore.count || 0)
      ),
      queue_priority_avg_delta: Number(
        (Number(queueAfter.avg_priority || 0) - Number(queueBefore.avg_priority || 0)).toFixed(2)
      ),
      queue_priority_max_delta: Number(
        (Number(queueAfter.max_priority || 0) - Number(queueBefore.max_priority || 0)).toFixed(2)
      ),
      campaign_weights_changed: Math.abs(
        Number(campAfter.count || 0) - Number(campBefore.count || 0)
      ),
      campaign_weight_avg_delta: Number(
        (Number(campAfter.avg_weight || 0) - Number(campBefore.avg_weight || 0)).toFixed(3)
      ),
      inventory_seed_inserted: inventorySeedResult?.inserted_count ?? 0,
      inventory_seed_updated: inventorySeedResult?.updated_count ?? 0,
      inventory_seed_blocked: inventorySeedResult?.blocked_count ?? 0,
      agent_routing_top_rep_share: Number(routeAfter.top_rep_share || 0),
      notes: {
        queue_before: queueBefore,
        queue_after: queueAfter,
        campaign_before: campBefore,
        campaign_after: campAfter,
        routing_before: routeBefore,
        routing_after: routeAfter,
      },
    });

    // Compute overall status from steps
    const { data: steps } = await supabase
      .from("dialer_intelligence_run_steps")
      .select("status")
      .eq("run_id", runId);

    let overallStatus = "ok";
    if (steps?.some((s: any) => s.status === "error")) {
      overallStatus = "error";
    } else if (steps?.some((s: any) => s.status === "warn")) {
      overallStatus = "warn";
    }

    await supabase
      .from("dialer_intelligence_runs")
      .update({
        overall_status: overallStatus,
        ended_at: new Date().toISOString(),
      })
      .eq("id", runId);
  } catch (e) {
    console.error("Failed to finalize intelligence run:", e);
    // Still close the run
    await supabase
      .from("dialer_intelligence_runs")
      .update({
        overall_status: "error",
        ended_at: new Date().toISOString(),
        notes: `Finalization error: ${String(e)}`,
      })
      .eq("id", runId);
  }
}

async function captureSnapshot(supabase: any, businessId: string) {
  const [queueRes, campaignRes, routingRes] = await Promise.all([
    supabase.rpc("snapshot_queue_summary", { p_business_id: businessId }),
    supabase.rpc("snapshot_campaign_summary", { p_business_id: businessId }),
    supabase.rpc("snapshot_agent_distribution", { p_business_id: businessId }),
  ]);

  return {
    queue: queueRes.data || { count: 0, avg_priority: 0, max_priority: 0 },
    campaign: campaignRes.data || { count: 0, avg_weight: 1, max_weight: 1 },
    routing: routingRes.data || { total_attempts: 0, top_rep_calls: 0, top_rep_share: 0 },
  };
}

// ── ORIGINAL UTILITIES ──

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

function getCurrentHour(tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  return parseInt(parts.find(p => p.type === "hour")?.value || "12");
}

// ── MAIN ENGINE ──

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

    // ── INTELLIGENCE: Create run + capture before snapshot ──
    const runMode = "live";
    const runId = await createIntelligenceRun(supabase, business_id, runMode);
    let snapshotBefore: any = null;
    let inventorySeedResult: any = null;

    try {
      snapshotBefore = await captureSnapshot(supabase, business_id);
    } catch (e) {
      console.error("Before snapshot failed:", e);
      snapshotBefore = { queue: {}, campaign: {}, routing: {} };
    }

    // ── PHASE 1: Acquire engine lock ──
    const { data: existingLock } = await supabase
      .from("dialer_engine_locks")
      .select("*")
      .eq("business_id", business_id)
      .maybeSingle();

    if (existingLock && new Date(existingLock.locked_until) > new Date()) {
      await finalizeRun(supabase, runId, snapshotBefore, snapshotBefore, null);
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
    const staticConnectRate = settings?.connect_rate_target ?? 0.18;
    const telephonyMode = settings?.telephony_mode || "simulation";
    const twilioEnabled = settings?.twilio_enabled || false;
    const useDynamicConnectRate = settings?.use_dynamic_connect_rate || false;
    const autoProfitProtection = settings?.auto_profit_protection || false;

    // ── Business hours check ──
    const nowMin = getLocalMinutesSinceMidnight(tz);
    if (nowMin < startMin || nowMin > endMin) {
      await releaseLock(supabase, business_id);
      await finalizeRun(supabase, runId, snapshotBefore, snapshotBefore, null);
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: ["outside_business_hours"] });
      return new Response(
        JSON.stringify({ success: false, reason: "outside_business_hours", nowMin, window: `${startMin}-${endMin}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Global limits check (cost/call kill switch) ──
    const { data: globalLimits } = await supabase
      .from("dialer_global_limits")
      .select("*")
      .eq("business_id", business_id)
      .maybeSingle();

    if (globalLimits?.auto_pause_on_limit) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: todayCalls } = await supabase
        .from("call_cost_events")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business_id)
        .gte("created_at", todayStart.toISOString());

      const { data: todayCostData } = await supabase
        .from("call_cost_events")
        .select("estimated_cost")
        .eq("business_id", business_id)
        .gte("created_at", todayStart.toISOString());

      const todayCost = (todayCostData || []).reduce((sum: number, e: any) => sum + (Number(e.estimated_cost) || 0), 0);

      const hourStart = new Date(Date.now() - 3600_000);
      const { count: hourCalls } = await supabase
        .from("call_cost_events")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business_id)
        .gte("created_at", hourStart.toISOString());

      let pauseReason: string | null = null;
      if (globalLimits.max_daily_calls && (todayCalls || 0) >= globalLimits.max_daily_calls) {
        pauseReason = `daily_call_limit_${todayCalls}/${globalLimits.max_daily_calls}`;
      } else if (globalLimits.max_daily_cost && todayCost >= globalLimits.max_daily_cost) {
        pauseReason = `daily_cost_limit_$${todayCost.toFixed(2)}/$${globalLimits.max_daily_cost}`;
      } else if (globalLimits.max_hourly_calls && (hourCalls || 0) >= globalLimits.max_hourly_calls) {
        pauseReason = `hourly_call_limit_${hourCalls}/${globalLimits.max_hourly_calls}`;
      }

      if (pauseReason) {
        await supabase.from("dialer_global_limits").update({
          paused_at: new Date().toISOString(),
          paused_reason: pauseReason,
          updated_at: new Date().toISOString(),
        }).eq("business_id", business_id);

        await releaseLock(supabase, business_id);
        await finalizeRun(supabase, runId, snapshotBefore, snapshotBefore, null);
        await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: [pauseReason] });
        return new Response(
          JSON.stringify({ success: false, reason: "global_limit_exceeded", pause_reason: pauseReason }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── AUTO-PROFIT PROTECTION ──
      if (autoProfitProtection) {
        const { data: todayRevenueData } = await supabase
          .from("call_revenue_events")
          .select("amount")
          .eq("business_id", business_id)
          .gte("created_at", todayStart.toISOString());

        const todayRevenue = (todayRevenueData || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
        const todayNetProfit = todayRevenue - todayCost;
        const profitThreshold = settings?.profit_throttle_threshold ?? 0;

        if (todayNetProfit < profitThreshold && (todayCalls || 0) > 30) {
          errors.push(`profit_throttle: net=$${todayNetProfit.toFixed(2)}, reducing volume 50%`);
        }

        const negativeDaysToCheck = settings?.negative_profit_days_to_pause || 3;
        const { data: recentDays } = await supabase
          .from("dialer_daily_metrics")
          .select("net_profit")
          .eq("business_id", business_id)
          .order("metric_date", { ascending: false })
          .limit(negativeDaysToCheck);

        if (recentDays && recentDays.length >= negativeDaysToCheck) {
          const allNegative = recentDays.every((d: any) => Number(d.net_profit) < 0);
          if (allNegative) {
            const { data: allCampaigns } = await supabase
              .from("v_campaign_optimization" as any)
              .select("campaign_id, net_profit")
              .eq("business_id", business_id)
              .order("net_profit", { ascending: false });

            if (allCampaigns && allCampaigns.length > 2) {
              const toPause = allCampaigns.slice(2).map((c: any) => c.campaign_id);
              for (const cid of toPause) {
                await supabase.from("dialer_campaigns").update({
                  auto_paused: true,
                  auto_pause_reason: `${negativeDaysToCheck}_consecutive_negative_profit_days`,
                  updated_at: new Date().toISOString(),
                }).eq("id", cid);
              }
              errors.push(`auto_paused_${toPause.length}_underperforming_campaigns`);
            }
          }
        }
      }
    }

    // ── INTELLIGENCE STEPS (ALL WRAPPED) ──
    const refreshInterval = settings?.predictive_score_refresh_interval || 10;
    const usePredictiveTargeting = settings?.use_predictive_targeting || false;
    const useRepStoreMatching = settings?.use_rep_store_matching || false;
    const useTimeRevenueBias = settings?.use_time_revenue_bias || false;

    const shouldRefresh = Math.random() < (1 / refreshInterval);

    if (shouldRefresh) {
      // Step 1: Store priority calculation
      await runStep({
        supabase,
        runId,
        stepName: "Store Priority Calculation",
        rpcName: "calculate_store_priority",
        executor: async () => {
          const { data, error } = await supabase.rpc("calculate_store_priority", { p_business_id: business_id });
          if (error) throw error;
          return { rows_affected: data ? 1 : 0, output: data };
        },
      });

      // Step 2: Rep efficiency calculation
      await runStep({
        supabase,
        runId,
        stepName: "Rep Efficiency Calculation",
        rpcName: "calculate_rep_efficiency",
        executor: async () => {
          const { data, error } = await supabase.rpc("calculate_rep_efficiency", { p_business_id: business_id });
          if (error) throw error;
          return { rows_affected: data ? 1 : 0, output: data };
        },
      });

      // Step 3: Predictive profit scoring
      if (usePredictiveTargeting) {
        await runStep({
          supabase,
          runId,
          stepName: "Profit Scoring",
          rpcName: "calculate_predictive_profit_score",
          executor: async () => {
            const { data, error } = await supabase.rpc("calculate_predictive_profit_score", { p_business_id: business_id });
            if (error) throw error;
            const rowsAffected = typeof data === "object" && data !== null
              ? (data.stores_scored || data.rows_affected || 0)
              : (data ? 1 : 0);
            return { rows_affected: rowsAffected, output: data };
          },
        });
      }

      // Step 4: Campaign weight auto-adjustment
      await runStep({
        supabase,
        runId,
        stepName: "Campaign Weight Adjustment",
        rpcName: "auto_adjust_campaign_weights",
        executor: async () => {
          const { data, error } = await supabase.rpc("auto_adjust_campaign_weights", { p_business_id: business_id });
          if (error) throw error;
          const rowsAffected = typeof data === "object" && data !== null
            ? (data.updated_campaigns_count || 0)
            : 0;
          return { rows_affected: rowsAffected, output: data };
        },
      });
    }

    // Step 5: Time-revenue bias (hour boost)
    if (useTimeRevenueBias) {
      await runStep({
        supabase,
        runId,
        stepName: "Hour Priority Boost",
        rpcName: "boost_queue_priority_for_hour",
        executor: async () => {
          const currentHourForBias = getCurrentHour(tz);
          const { data: hourRevData } = await supabase
            .from("store_hourly_revenue_stats")
            .select("store_id, revenue_per_attempt")
            .eq("business_id", business_id)
            .eq("hour_of_day", currentHourForBias)
            .gt("revenue_per_attempt", 0);

          let totalBoosted = 0;
          if (hourRevData && hourRevData.length > 0) {
            for (const hr of hourRevData) {
              const { error } = await supabase.rpc("boost_queue_priority_for_hour", {
                p_store_id: hr.store_id,
                p_business_id: business_id,
                p_boost: Number(hr.revenue_per_attempt) * 5,
              });
              if (!error) totalBoosted++;
            }
          }
          return {
            rows_affected: totalBoosted,
            output: { stores_checked: hourRevData?.length || 0, boosted: totalBoosted },
          };
        },
      });
    }

    // Step 6: Inventory seeding (if applicable)
    inventorySeedResult = await runStep({
      supabase,
      runId,
      stepName: "Inventory Queue Seeding",
      rpcName: "seed_outbound_queue_from_inventory",
      executor: async () => {
        const { data, error } = await supabase.rpc("seed_outbound_queue_from_inventory", {
          p_business_id: business_id,
          p_mode: "commit",
        });
        if (error) throw error;
        const inserted = typeof data === "object" && data !== null ? (data.inserted_count || 0) : 0;
        return { rows_affected: inserted, output: data };
      },
    });

    // ── Dynamic connect rate ──
    let connectRateTarget = staticConnectRate;
    if (useDynamicConnectRate) {
      const { data: rollingRate } = await supabase.rpc("get_rolling_connect_rate", {
        p_business_id: business_id,
        p_window: 100,
      });
      if (rollingRate && Number(rollingRate) > 0) {
        connectRateTarget = Number(rollingRate);
      }
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
      const snapshotAfter = await captureSnapshot(supabase, business_id).catch(() => snapshotBefore);
      await finalizeRun(supabase, runId, snapshotBefore, snapshotAfter, inventorySeedResult);
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

    // ── Predictive throttle with dynamic connect rate ──
    const predictiveDials = Math.ceil(agentCount / connectRateTarget);
    let idealDials = Math.min(
      predictiveDials,
      Math.ceil(agentCount * predictiveMultiplier),
      maxConcurrent,
      maxSimultaneousDials,
      maxCallsPerMinute
    );

    const isProfitThrottled = errors.some(e => e.includes("profit_throttle"));
    if (isProfitThrottled) {
      idealDials = Math.max(1, Math.floor(idealDials * 0.5));
    }

    const slotsAvailable = Math.max(0, idealDials - (currentlyDialing || 0));

    if (slotsAvailable <= 0) {
      await releaseLock(supabase, business_id);
      const snapshotAfter = await captureSnapshot(supabase, business_id).catch(() => snapshotBefore);
      await finalizeRun(supabase, runId, snapshotBefore, snapshotAfter, inventorySeedResult);
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: [] });
      return new Response(
        JSON.stringify({ success: true, reason: "at_capacity", dialed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Campaign auto-pause check ──
    let effectiveCampaignId = campaign_id;
    if (campaign_id) {
      const { data: campCheck } = await supabase
        .from("dialer_campaigns")
        .select("auto_paused")
        .eq("id", campaign_id)
        .maybeSingle();
      if (campCheck?.auto_paused) {
        await releaseLock(supabase, business_id);
        const snapshotAfter = await captureSnapshot(supabase, business_id).catch(() => snapshotBefore);
        await finalizeRun(supabase, runId, snapshotBefore, snapshotAfter, inventorySeedResult);
        await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: ["campaign_auto_paused"] });
        return new Response(
          JSON.stringify({ success: false, reason: "campaign_auto_paused" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Atomic queue claiming ──
    const { data: claimedItems, error: claimErr } = await supabase.rpc("claim_queue_items", {
      p_business_id: business_id,
      p_campaign_id: effectiveCampaignId || null,
      p_limit_count: slotsAvailable,
      p_max_attempts: maxAttemptsPerDay,
    });

    if (claimErr) {
      errors.push(`claim_queue_items: ${claimErr.message}`);
      await releaseLock(supabase, business_id);
      const snapshotAfter = await captureSnapshot(supabase, business_id).catch(() => snapshotBefore);
      await finalizeRun(supabase, runId, snapshotBefore, snapshotAfter, inventorySeedResult);
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors });
      return new Response(
        JSON.stringify({ error: "Failed to claim queue items", details: claimErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!claimedItems || claimedItems.length === 0) {
      await releaseLock(supabase, business_id);
      const snapshotAfter = await captureSnapshot(supabase, business_id).catch(() => snapshotBefore);
      await finalizeRun(supabase, runId, snapshotBefore, snapshotAfter, inventorySeedResult);
      await logCycle(supabase, { business_id, campaign_id, cycleStartedAt, lockAcquired, claimed: 0, outcomes: {}, agentsClaimed: 0, errors: [] });
      return new Response(
        JSON.stringify({ success: true, reason: "queue_empty", dialed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Process each claimed item ──
    const outcomeCounts: Record<string, number> = { answered: 0, voicemail: 0, no_answer: 0, failed: 0, bridged: 0, answered_no_agent: 0 };
    let agentsClaimed = 0;
    const results: Array<{ id: string; outcome: string; session_id?: string; call_sid?: string }> = [];

    const isLive = telephonyMode === "live" && twilioEnabled;

    for (const item of claimedItems) {
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 100));

      // ── LIVE MODE: Dispatch to Twilio ──
      if (isLive) {
        try {
          const { data: callResult, error: callErr } = await supabase.functions.invoke("twilio-outbound-call", {
            body: { queue_item_id: item.id, business_id: item.business_id },
          });

          if (callErr || callResult?.error) {
            errors.push(`twilio_call ${item.id}: ${callErr?.message || callResult?.error}`);
            outcomeCounts.failed++;
            results.push({ id: item.id, outcome: "twilio_error" });
            await supabase.from("outbound_call_queue").update({
              status: "queued",
              claimed_by_user_id: null, claimed_at: null,
              claim_expires_at: null, claim_token: null,
            }).eq("id", item.id);
          } else {
            outcomeCounts.answered++;
            results.push({ id: item.id, outcome: "twilio_initiated", call_sid: callResult?.call_sid });
          }
        } catch (e) {
          errors.push(`twilio_exception ${item.id}: ${String(e)}`);
          outcomeCounts.failed++;
          results.push({ id: item.id, outcome: "twilio_exception" });
        }
        continue;
      }

      // ── SIMULATION MODE ──
      const outcome = simulateOutcome();

      if (outcome === "answered") {
        const { error: transErr } = await supabase.functions.invoke("dialer-state-transition", {
          body: { queue_item_id: item.id, new_status: "answered" },
        });
        if (transErr) {
          errors.push(`transition answered ${item.id}: ${transErr.message}`);
          outcomeCounts.failed++;
          results.push({ id: item.id, outcome: "transition_error" });
          continue;
        }

        await supabase.from("outbound_call_queue").update({ answered_at: new Date().toISOString() }).eq("id", item.id);

        // ── INSTRUMENTED: Agent claiming logged as step ──
        const agentResult = await runStep({
          supabase,
          runId,
          stepName: `Agent Claim (item ${item.id.slice(0, 8)})`,
          rpcName: "claim_available_agent",
          executor: async () => {
            const { data: agentRows, error: agentErr } = await supabase.rpc("claim_available_agent", {
              p_business_id: business_id,
            });
            if (agentErr) throw agentErr;
            return {
              rows_affected: agentRows?.length || 0,
              output: agentRows?.[0] || null,
            };
          },
        });

        if (!agentResult) {
          outcomeCounts.answered_no_agent++;
          results.push({ id: item.id, outcome: "answered_no_agent" });
          continue;
        }

        const agent = agentResult;
        agentsClaimed++;

        // ── Rep-Store Matching (instrumented) ──
        let assignedRepId = agent.user_id;
        if (useRepStoreMatching && item.store_id) {
          const bestRepResult = await runStep({
            supabase,
            runId,
            stepName: `Best Rep Match (store ${(item.store_id || "").slice(0, 8)})`,
            rpcName: "get_best_rep_for_store",
            executor: async () => {
              const { data: bestRep, error } = await supabase.rpc("get_best_rep_for_store", {
                p_store_id: item.store_id,
                p_business_id: business_id,
              });
              if (error) throw error;
              return {
                rows_affected: bestRep ? 1 : 0,
                output: bestRep,
              };
            },
          });
          if (bestRepResult) {
            assignedRepId = bestRepResult;
          }
        }

        const { data: session, error: sessionErr } = await supabase
          .from("live_call_sessions")
          .insert({
            business_id: item.business_id,
            store_id: item.store_id,
            queue_item_id: item.id,
            contact_name: item.contact_name,
            phone_number: item.phone_number,
            rep_user_id: assignedRepId,
            provider: "simulation",
            connected_at: new Date().toISOString(),
            outcome: null,
            campaign_id: item.campaign_id,
          })
          .select("id")
          .single();

        if (sessionErr || !session) {
          errors.push(`session_create ${item.id}: ${sessionErr?.message || "unknown"}`);
          await supabase.from("dialer_agent_availability").update({
            status: "available", active_calls_count: Math.max((agent.active_calls_count || 1) - 1, 0), updated_at: new Date().toISOString(),
          }).eq("id", agent.id);
          outcomeCounts.failed++;
          results.push({ id: item.id, outcome: "session_create_error" });
          continue;
        }

        const { error: bridgeErr } = await supabase.functions.invoke("dialer-state-transition", {
          body: { queue_item_id: item.id, new_status: "bridged", agent_id: agent.user_id },
        });

        if (bridgeErr) {
          errors.push(`transition bridged ${item.id}: ${bridgeErr.message}`);
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
        const { error: transErr } = await supabase.functions.invoke("dialer-state-transition", {
          body: { queue_item_id: item.id, new_status: outcome },
        });

        if (transErr) {
          errors.push(`transition ${outcome} ${item.id}: ${transErr.message}`);
        }

        await supabase.from("outbound_call_queue").update({
          claimed_by_user_id: null, claimed_at: null,
          claim_expires_at: null, claim_token: null,
        }).eq("id", item.id);

        if (outcome === "no_answer") {
          const retryMin = getRetryMinutes(item.attempt_count || 1, backoffMinutes);
          await supabase.from("outbound_call_queue").update({
            next_retry_at: new Date(Date.now() + retryMin * 60 * 1000).toISOString(),
          }).eq("id", item.id);
        }

        // ── Update store hourly answer stats ──
        if (item.store_id) {
          const currentHour = getCurrentHour(tz);
          const { data: existingStat } = await supabase
            .from("store_hourly_answer_stats")
            .select("id, attempts, answers")
            .eq("store_id", item.store_id)
            .eq("hour_of_day", currentHour)
            .maybeSingle();

          if (existingStat) {
            await supabase.from("store_hourly_answer_stats").update({
              attempts: (existingStat.attempts || 0) + 1,
              answers: outcome === "answered" ? (existingStat.answers || 0) + 1 : existingStat.answers,
              answer_rate: ((existingStat.answers || 0) + (outcome === "answered" ? 1 : 0)) / ((existingStat.attempts || 0) + 1),
              updated_at: new Date().toISOString(),
            }).eq("id", existingStat.id);
          } else {
            await supabase.from("store_hourly_answer_stats").insert({
              store_id: item.store_id,
              business_id: item.business_id,
              hour_of_day: currentHour,
              attempts: 1,
              answers: outcome === "answered" ? 1 : 0,
              answer_rate: outcome === "answered" ? 1 : 0,
            });
          }
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

    // ── INTELLIGENCE: After snapshot + finalize run ──
    let snapshotAfter: any;
    try {
      snapshotAfter = await captureSnapshot(supabase, business_id);
    } catch {
      snapshotAfter = snapshotBefore;
    }
    await finalizeRun(supabase, runId, snapshotBefore, snapshotAfter, inventorySeedResult);

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
        intelligence_run_id: runId,
        dialed: claimedItems.length,
        agents_available: agentCount,
        agents_claimed: agentsClaimed,
        ideal_dials: idealDials,
        predictive_target: predictiveDials,
        connect_rate_target: connectRateTarget,
        dynamic_connect_rate: useDynamicConnectRate,
        profit_throttled: isProfitThrottled,
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
