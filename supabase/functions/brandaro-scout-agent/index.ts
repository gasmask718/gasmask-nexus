import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cost estimates per operation
const COSTS = {
  ai_decision_per_call: 0.008,
  ai_scoring_per_lead: 0.001,
  google_places_per_search: 0.004,
  get total_per_search() {
    return this.google_places_per_search + this.ai_scoring_per_lead * 8;
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    // 1. Load config
    const { data: config } = await supabase.from("brandaro_scout_config").select("*").limit(1).single();
    if (!config) throw new Error("No scout config found");

    // 2. Reset daily/monthly spend counters if needed
    const today = new Date().toISOString().split("T")[0];
    const thisMonth = new Date().toISOString().substring(0, 7);

    let dailySpend = config.daily_spend_today || 0;
    let monthlySpend = config.monthly_spend_this_month || 0;

    if (config.spend_reset_date !== today) {
      dailySpend = 0;
      await supabase.from("brandaro_scout_config").update({ daily_spend_today: 0, spend_reset_date: today }).eq("id", config.id);
    }

    const configMonth = config.monthly_reset_date?.substring(0, 7);
    if (configMonth !== thisMonth) {
      monthlySpend = 0;
      await supabase.from("brandaro_scout_config").update({ monthly_spend_this_month: 0, monthly_reset_date: today }).eq("id", config.id);
    }

    // 3. BUDGET GATE
    const dailyLimit = config.daily_spend_limit || 2.0;
    const monthlyLimit = config.monthly_spend_limit || 20.0;

    if (dailySpend >= dailyLimit) {
      return new Response(
        JSON.stringify({ status: "budget_limit", message: "Daily spend limit reached", daily_spent: dailySpend, daily_limit: dailyLimit }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (monthlySpend >= monthlyLimit) {
      return new Response(
        JSON.stringify({ status: "monthly_limit", message: "Monthly spend limit reached", monthly_spent: monthlySpend, monthly_limit: monthlyLimit }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check active & timing
    if (!config.is_active) {
      return new Response(JSON.stringify({ status: "inactive", message: "Scout agent is paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.clone().json().catch(() => ({}));
    const isManual = body?.manual === true;

    if (!isManual && config.last_run_at) {
      const hoursSince = (Date.now() - new Date(config.last_run_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince < config.min_hours_between_runs) {
        return new Response(
          JSON.stringify({ status: "too_soon", next_run_in_hours: Math.round(config.min_hours_between_runs - hoursSince) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Calculate affordable searches
    const remainingBudget = Math.min(dailyLimit - dailySpend, monthlyLimit - monthlySpend);
    const aiDecisionCost = COSTS.ai_decision_per_call;
    const budgetAfterDecision = remainingBudget - aiDecisionCost;
    const maxAffordable = Math.floor(budgetAfterDecision / COSTS.total_per_search);
    const searchesThisRun = Math.min(config.searches_per_run || 10, maxAffordable, 20);

    if (searchesThisRun <= 0) {
      return new Response(
        JSON.stringify({ status: "insufficient_budget", remaining_budget: remainingBudget }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SCOUT] Budget OK. Running ${searchesThisRun} searches.`);

    // 6. Create run log
    const { data: run } = await supabase.from("brandaro_scout_runs").insert({ status: "running" }).select().single();
    const runId = run!.id;
    let runCost = aiDecisionCost;

    await supabase.from("brandaro_scout_spend_log").insert({
      run_id: runId,
      action: "ai_decision",
      cost: aiDecisionCost,
      cumulative_today: dailySpend + aiDecisionCost,
      cumulative_month: monthlySpend + aiDecisionCost,
    });

    // 7. Get memory
    const { data: memory } = await supabase
      .from("brandaro_scout_memory")
      .select("industry, city, state, leads_imported, success_rate")
      .order("searched_at", { ascending: false })
      .limit(500);

    // 8. Get lead stats
    const { data: leadStats } = await supabase.from("brandaro_qualified_leads").select("industry");
    const industryCounts: Record<string, number> = {};
    (leadStats || []).forEach((l: any) => {
      const ind = (l.industry || "unknown").toLowerCase();
      industryCounts[ind] = (industryCounts[ind] || 0) + 1;
    });

    // 9. Ask AI what to search
    const systemPrompt = `You are an autonomous lead discovery agent for Brandaro Digital. We sell websites to small businesses with no online presence.

Pick the BEST city+industry combinations to search Google Places for businesses without websites.

TARGET: Service businesses most likely to have NO website:
- house cleaning, carpet cleaning, window cleaning, pressure washing
- moving company, junk removal, hauling service
- painting contractor, handyman, landscaping, tree service
- auto detailing, mobile mechanic
- locksmith, appliance repair
- roofing, flooring, HVAC (smaller companies only)

AVOID: chains, franchises, large established companies

PRIORITIZE:
- Industries where we have fewer leads
- New cities not yet searched
- Smaller suburbs often have more no-website businesses

Return ONLY a valid JSON array. No text before or after. Exactly ${searchesThisRun} items.
[{"industry":"...","city":"...","state":"...","reason":"..."}]`;

    const userPrompt = `ALREADY SEARCHED (skip these):
${(memory || []).slice(0, 200).map((m: any) => `${m.industry}|${m.city}|${m.state}(${m.leads_imported})`).join("\n") || "None yet"}

LEAD COUNTS BY INDUSTRY:
${Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([i, c]) => `${i}: ${c}`).join("\n") || "No leads yet"}

TARGET INDUSTRIES: ${((config.target_industries as string[]) || []).join(", ")}
TARGET STATES: ${((config.target_states as string[]) || []).join(", ")}
BUDGET LEFT TODAY: $${(dailyLimit - dailySpend).toFixed(2)}

Give me ${searchesThisRun} searches now.`;

    let searches: Array<{ industry: string; city: string; state: string; reason: string }> = [];

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!aiRes.ok) throw new Error(`AI gateway: ${aiRes.status}`);
      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || "[]";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      searches = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (aiErr: any) {
      console.error("[SCOUT] AI failed, using fallback:", aiErr.message);
      const fb = [
        { city: "Brooklyn", state: "NY" },
        { city: "Newark", state: "NJ" },
        { city: "Miami", state: "FL" },
        { city: "Houston", state: "TX" },
        { city: "Atlanta", state: "GA" },
      ];
      const fbInd = ["cleaning service", "moving company", "painting contractor", "landscaping", "plumber"];
      searches = fb.slice(0, searchesThisRun).map((c, i) => ({ ...c, industry: fbInd[i % fbInd.length], reason: "fallback" }));
    }

    // 10. Execute searches with per-search budget check
    let totalImported = 0;
    let searchesCompleted = 0;
    const decisions: any[] = [];
    let currentDailySpend = dailySpend + aiDecisionCost;
    let currentMonthlySpend = monthlySpend + aiDecisionCost;

    for (const search of searches) {
      if (currentDailySpend >= dailyLimit || currentMonthlySpend >= monthlyLimit) {
        decisions.push({ ...search, status: "skipped_budget" });
        continue;
      }

      try {
        // Duplicate check
        const { data: existing } = await supabase
          .from("brandaro_scout_memory")
          .select("id")
          .ilike("industry", search.industry)
          .ilike("city", search.city)
          .ilike("state", search.state)
          .limit(1);

        if (existing && existing.length > 0) {
          decisions.push({ ...search, status: "skipped_duplicate" });
          continue;
        }

        console.log(`[SCOUT] Running: ${search.industry} in ${search.city}, ${search.state}`);

        const { data: job, error: jobErr } = await supabase
          .from("brandaro_discovery_jobs")
          .insert({
            search_query: `${search.industry} in ${search.city}`,
            city: search.city,
            state: search.state,
            industry: search.industry,
            radius_meters: 40000,
            status: "queued",
          })
          .select()
          .single();

        if (jobErr) throw jobErr;

        const { error: fnErr } = await supabase.functions.invoke("brandaro-lead-discovery", {
          body: { job_id: job!.id, city: search.city, state: search.state, industry: search.industry, radius_meters: 40000 },
        });

        if (fnErr) throw fnErr;

        // Poll for completion
        let imported = 0;
        let found = 0;
        let jobDone = false;
        for (let a = 0; a < 60; a++) {
          await new Promise((r) => setTimeout(r, 3000));
          const { data: jd } = await supabase.from("brandaro_discovery_jobs").select("*").eq("id", job!.id).single();
          if (jd?.status === "completed" || jd?.status === "failed") {
            imported = jd?.imported_count || 0;
            found = jd?.total_found || 0;
            jobDone = true;
            break;
          }
        }

        const searchCost = COSTS.google_places_per_search + imported * COSTS.ai_scoring_per_lead;
        currentDailySpend += searchCost;
        currentMonthlySpend += searchCost;
        runCost += searchCost;

        await supabase.from("brandaro_scout_spend_log").insert({
          run_id: runId,
          action: `search_${search.city}_${search.industry}`.substring(0, 100),
          cost: searchCost,
          cumulative_today: currentDailySpend,
          cumulative_month: currentMonthlySpend,
        });

        await supabase.from("brandaro_scout_memory").insert({
          industry: search.industry.toLowerCase(),
          city: search.city,
          state: search.state,
          leads_found: found,
          leads_imported: imported,
          success_rate: found > 0 ? Math.round((imported / found) * 100) : 0,
          worth_revisiting: imported >= 3,
          revisit_after: imported >= 3 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
          notes: search.reason,
        });

        totalImported += imported;
        searchesCompleted++;
        decisions.push({ ...search, imported, found, cost: searchCost, status: "completed" });

        await new Promise((r) => setTimeout(r, 1500));
      } catch (err: any) {
        console.error(`[SCOUT] Search failed:`, err.message);
        decisions.push({ ...search, status: "failed", error: err.message });
      }
    }

    // 11. Final updates
    const budgetStopped = decisions.some((d) => d.status === "skipped_budget");
    await supabase
      .from("brandaro_scout_runs")
      .update({
        completed_at: new Date().toISOString(),
        searches_attempted: searches.length,
        searches_completed: searchesCompleted,
        total_imported: totalImported,
        estimated_cost: runCost,
        decisions,
        status: budgetStopped ? "stopped_budget" : "completed",
        stop_reason: budgetStopped ? "Budget limit reached mid-run" : null,
      })
      .eq("id", runId);

    await supabase
      .from("brandaro_scout_config")
      .update({
        last_run_at: new Date().toISOString(),
        total_searches: (config.total_searches || 0) + searchesCompleted,
        total_leads_imported: (config.total_leads_imported || 0) + totalImported,
        daily_spend_today: currentDailySpend,
        monthly_spend_this_month: currentMonthlySpend,
        total_spent_all_time: (config.total_spent_all_time || 0) + runCost,
      })
      .eq("id", config.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        searches_completed: searchesCompleted,
        total_imported: totalImported,
        run_cost: `$${runCost.toFixed(4)}`,
        daily_spent: `$${currentDailySpend.toFixed(4)}`,
        daily_limit: `$${dailyLimit}`,
        monthly_spent: `$${currentMonthlySpend.toFixed(4)}`,
        monthly_limit: `$${monthlyLimit}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[SCOUT] Fatal:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
