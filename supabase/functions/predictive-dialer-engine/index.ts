import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simulated outcome distribution
function simulateOutcome(): "answered" | "voicemail" | "no_answer" | "failed" {
  const rand = Math.random();
  if (rand < 0.20) return "answered";     // 20%
  if (rand < 0.60) return "voicemail";    // 40%
  if (rand < 0.95) return "no_answer";    // 35%
  return "failed";                         // 5%
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // 1. Fetch settings
    const { data: settings } = await supabase
      .from("dialer_settings")
      .select("*")
      .eq("business_id", business_id)
      .maybeSingle();

    const predictiveMultiplier = settings?.predictive_multiplier || 5;
    const maxConcurrent = settings?.max_concurrent_dials || 10;
    const maxAttemptsPerDay = settings?.max_attempts_per_day || 3;

    // 2. Check business hours
    if (settings) {
      const now = new Date();
      const tz = settings.business_timezone || "America/New_York";
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const timeStr = formatter.format(now);
      const startTime = settings.business_hours_start || "09:00";
      const endTime = settings.business_hours_end || "18:00";

      if (timeStr < startTime || timeStr > endTime) {
        return new Response(
          JSON.stringify({
            success: false,
            reason: "outside_business_hours",
            current_time: timeStr,
            window: `${startTime}-${endTime}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Auto-transition agents from wrap_up → available
    const { data: wrapUpAgents } = await supabase
      .from("dialer_agent_availability")
      .select("*")
      .eq("business_id", business_id)
      .eq("status", "wrap_up");

    if (wrapUpAgents) {
      for (const agent of wrapUpAgents) {
        const wrapSeconds = agent.wrap_up_seconds || 20;
        const endedAt = agent.last_call_ended_at
          ? new Date(agent.last_call_ended_at).getTime()
          : 0;
        if (Date.now() - endedAt > wrapSeconds * 1000) {
          await supabase
            .from("dialer_agent_availability")
            .update({ status: "available", active_calls_count: 0, updated_at: new Date().toISOString() })
            .eq("id", agent.id);
        }
      }
    }

    // 4. Get available agents
    const { data: availableAgents } = await supabase
      .from("dialer_agent_availability")
      .select("*")
      .eq("business_id", business_id)
      .eq("status", "available");

    const agentCount = availableAgents?.length || 0;

    if (agentCount === 0) {
      return new Response(
        JSON.stringify({ success: false, reason: "no_agents_available", dialed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Count currently dialing
    const { count: currentlyDialing } = await supabase
      .from("outbound_call_queue")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business_id)
      .eq("status", "dialing");

    // 6. Calculate ideal dials
    const idealDials = Math.min(
      Math.ceil(agentCount * predictiveMultiplier),
      maxConcurrent
    );
    const slotsAvailable = Math.max(0, idealDials - (currentlyDialing || 0));

    if (slotsAvailable <= 0) {
      return new Response(
        JSON.stringify({ success: true, reason: "at_capacity", dialed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Fetch queued items (campaign-filtered if provided)
    let queueQuery = supabase
      .from("outbound_call_queue")
      .select("*")
      .eq("business_id", business_id)
      .eq("status", "queued")
      .lt("attempt_count", maxAttemptsPerDay)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(slotsAvailable);

    if (campaign_id) {
      queueQuery = queueQuery.eq("campaign_id", campaign_id);
    }

    const { data: queueItems } = await queueQuery;

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reason: "queue_empty", dialed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Process each queued item (simulation)
    const results: Array<{
      id: string;
      outcome: string;
      session_id?: string;
    }> = [];

    let agentPool = [...(availableAgents || [])];
    let agentIndex = 0;

    for (const item of queueItems) {
      // Transition: queued → dialing
      await supabase
        .from("outbound_call_queue")
        .update({
          status: "dialing",
          last_attempt_at: new Date().toISOString(),
          attempt_count: (item.attempt_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // Simulate delay (50-200ms)
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));

      // Simulate outcome
      const outcome = simulateOutcome();

      if (outcome === "answered") {
        // Transition: dialing → answered
        await supabase
          .from("outbound_call_queue")
          .update({ status: "answered", updated_at: new Date().toISOString() })
          .eq("id", item.id);

        // Try to bridge to agent
        if (agentIndex < agentPool.length) {
          const agent = agentPool[agentIndex];
          agentIndex++;

          // Transition: answered → bridged
          await supabase
            .from("outbound_call_queue")
            .update({
              status: "bridged",
              assigned_agent_id: agent.user_id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          // Create live session
          const { data: session } = await supabase
            .from("live_call_sessions")
            .insert({
              business_id,
              store_id: item.store_id,
              queue_item_id: item.id,
              contact_name: item.contact_name,
              phone_number: item.phone_number,
              rep_user_id: agent.user_id,
              provider: "simulation",
              connected_at: new Date().toISOString(),
              outcome: "no_disposition",
              campaign_id: item.campaign_id,
            })
            .select("id")
            .single();

          // Set agent busy
          await supabase
            .from("dialer_agent_availability")
            .update({
              status: "busy",
              active_calls_count: 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", agent.id);

          results.push({ id: item.id, outcome: "bridged", session_id: session?.id });
        } else {
          // No agent available, stays answered for next cycle
          results.push({ id: item.id, outcome: "answered_no_agent" });
        }
      } else {
        // voicemail, no_answer, failed
        const updatePayload: Record<string, unknown> = {
          status: outcome,
          updated_at: new Date().toISOString(),
        };

        if (outcome === "no_answer") {
          updatePayload.next_retry_at = new Date(
            Date.now() + (settings?.retry_delay_minutes || 30) * 60 * 1000
          ).toISOString();
        }

        await supabase
          .from("outbound_call_queue")
          .update(updatePayload)
          .eq("id", item.id);

        results.push({ id: item.id, outcome });
      }
    }

    // 9. Update campaign stats if applicable
    if (campaign_id) {
      const answered = results.filter((r) => r.outcome === "bridged" || r.outcome === "answered_no_agent").length;
      const voicemail = results.filter((r) => r.outcome === "voicemail").length;
      const failed = results.filter((r) => r.outcome === "no_answer" || r.outcome === "failed").length;

      // Use raw increment via RPC or just fetch+update
      const { data: campaign } = await supabase
        .from("dialer_campaigns")
        .select("completed_calls, answered_calls, voicemail_count, failed_calls")
        .eq("id", campaign_id)
        .single();

      if (campaign) {
        await supabase
          .from("dialer_campaigns")
          .update({
            completed_calls: (campaign.completed_calls || 0) + results.length,
            answered_calls: (campaign.answered_calls || 0) + answered,
            voicemail_count: (campaign.voicemail_count || 0) + voicemail,
            failed_calls: (campaign.failed_calls || 0) + failed,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dialed: queueItems.length,
        agents_available: agentCount,
        ideal_dials: idealDials,
        results,
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
