import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    // 1. Check if agent is active
    const { data: config } = await supabase
      .from("brandaro_scout_config")
      .select("*")
      .limit(1)
      .single();

    if (!config?.is_active) {
      return new Response(
        JSON.stringify({ status: "inactive", message: "Scout agent is paused" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check minimum time between runs (skip check if manual trigger)
    const body = await req.json().catch(() => ({}));
    const isManual = body?.manual === true;

    if (!isManual && config.last_run_at) {
      const hoursSinceLastRun =
        (Date.now() - new Date(config.last_run_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRun < config.min_hours_between_runs) {
        return new Response(
          JSON.stringify({
            status: "too_soon",
            next_run_in: Math.round(config.min_hours_between_runs - hoursSinceLastRun) + " hours",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2. Create run log
    const { data: run } = await supabase
      .from("brandaro_scout_runs")
      .insert({ status: "running" })
      .select()
      .single();

    const runId = run!.id;

    // 3. Get memory — what has been searched
    const { data: memory } = await supabase
      .from("brandaro_scout_memory")
      .select("industry, city, state, leads_imported, success_rate, searched_at")
      .order("searched_at", { ascending: false })
      .limit(500);

    // 4. Get current lead counts by industry
    const { data: leadStats } = await supabase
      .from("brandaro_qualified_leads")
      .select("industry");

    const industryCounts: Record<string, number> = {};
    (leadStats || []).forEach((l: any) => {
      const ind = (l.industry || "unknown").toLowerCase();
      industryCounts[ind] = (industryCounts[ind] || 0) + 1;
    });

    // 5. Ask AI what to search next
    const systemPrompt = `You are an autonomous lead discovery agent for Brandaro Digital, a company that sells websites to small businesses with no online presence.

Your job is to decide which industries and cities to search next to find the most no-website small businesses.

STRATEGY:
- Focus on service businesses: cleaning, moving, painting, landscaping, handyman, auto detailing, carpet cleaning, junk removal, pressure washing, HVAC, roofing, plumbing, electrical, flooring, pool service, window cleaning, tree service, appliance repair, locksmith
- These businesses are least likely to have websites
- Prioritize cities in the target states
- Avoid chains and franchises
- Mix large cities with smaller suburbs
- If a search returned 0 leads, try a different industry in that city
- If a search returned 5+ leads, try more industries in that same city

Return ONLY a valid JSON array of exactly ${config.searches_per_run} search decisions. No explanation. No preamble. Just the JSON array.

Format:
[{"industry":"cleaning service","city":"Brooklyn","state":"NY","reason":"one sentence why"}]`;

    const userPrompt = `Current date: ${new Date().toISOString()}

ALREADY SEARCHED (do not repeat these):
${(memory || []).map((m: any) => `${m.industry} in ${m.city}, ${m.state} (${m.leads_imported} leads imported)`).join("\n") || "Nothing searched yet"}

CURRENT LEAD INVENTORY by industry:
${Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).map(([ind, count]) => `${ind}: ${count} leads`).join("\n") || "No leads yet"}

TARGET INDUSTRIES: ${((config.target_industries as string[]) || []).join(", ")}
TARGET STATES: ${((config.target_states as string[]) || []).join(", ")}
AGENT MODE: ${config.mode}

Based on this data, decide the next ${config.searches_per_run} searches to run. Prioritize industries with few leads. Never repeat a city+industry combination from the searched list.`;

    let searches: Array<{ industry: string; city: string; state: string; reason: string }> = [];

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!aiRes.ok) throw new Error(`AI gateway error: ${aiRes.status}`);

      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || "[]";
      // Extract JSON from possible markdown fences
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      searches = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (aiErr: any) {
      console.error("[SCOUT] AI decision failed, using fallback:", aiErr.message);
      // Fallback searches
      const fallbackCities = [
        { city: "Brooklyn", state: "NY" },
        { city: "Bronx", state: "NY" },
        { city: "Newark", state: "NJ" },
        { city: "Miami", state: "FL" },
        { city: "Houston", state: "TX" },
      ];
      const fallbackIndustries = ["cleaning service", "moving company", "painting contractor", "landscaping", "plumber"];
      searches = fallbackCities.slice(0, config.searches_per_run).map((c, i) => ({
        ...c,
        industry: fallbackIndustries[i % fallbackIndustries.length],
        reason: "fallback",
      }));
    }

    console.log(`[SCOUT] Decided ${searches.length} searches`);

    // 6. Execute each search
    let totalImported = 0;
    let searchesCompleted = 0;
    const decisions: any[] = [];

    for (const search of searches) {
      try {
        console.log(`[SCOUT] Searching: ${search.industry} in ${search.city}, ${search.state}`);

        // Check memory to avoid duplicates
        const { data: existing } = await supabase
          .from("brandaro_scout_memory")
          .select("id")
          .ilike("industry", search.industry)
          .ilike("city", search.city)
          .ilike("state", search.state)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[SCOUT] Skipping ${search.industry} in ${search.city} — already searched`);
          decisions.push({ ...search, status: "skipped", reason: "already searched" });
          continue;
        }

        // Create discovery job
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

        // Run discovery
        const { error: fnErr } = await supabase.functions.invoke("brandaro-lead-discovery", {
          body: {
            job_id: job!.id,
            city: search.city,
            state: search.state,
            industry: search.industry,
            radius_meters: 40000,
          },
        });

        if (fnErr) throw fnErr;

        // Poll for completion (max 3 min)
        let imported = 0;
        let found = 0;
        let jobDone = false;

        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise((r) => setTimeout(r, 3000));
          const { data: jd } = await supabase
            .from("brandaro_discovery_jobs")
            .select("*")
            .eq("id", job!.id)
            .single();

          if (jd?.status === "completed" || jd?.status === "failed") {
            imported = jd?.imported_count || 0;
            found = jd?.total_found || 0;
            jobDone = true;
            break;
          }
        }

        if (!jobDone) {
          imported = 0;
          found = 0;
        }

        // Save to memory
        await supabase.from("brandaro_scout_memory").insert({
          industry: search.industry.toLowerCase(),
          city: search.city,
          state: search.state,
          leads_found: found,
          leads_imported: imported,
          success_rate: found > 0 ? Math.round((imported / found) * 100) : 0,
          worth_revisiting: imported >= 5,
          revisit_after:
            imported >= 5 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
          notes: search.reason,
        });

        totalImported += imported;
        searchesCompleted++;
        decisions.push({ ...search, imported, found, status: "completed" });

        console.log(`[SCOUT] ${search.city} ${search.industry}: ${imported} imported`);

        // Delay between searches
        await new Promise((r) => setTimeout(r, 1500));
      } catch (searchErr: any) {
        console.error(`[SCOUT] Search failed:`, searchErr.message);
        decisions.push({ ...search, status: "failed", error: searchErr.message });
      }
    }

    // 7. Update run log
    await supabase
      .from("brandaro_scout_runs")
      .update({
        completed_at: new Date().toISOString(),
        searches_attempted: searches.length,
        searches_completed: searchesCompleted,
        total_imported: totalImported,
        decisions,
        status: "completed",
      })
      .eq("id", runId);

    // 8. Update config stats
    await supabase
      .from("brandaro_scout_config")
      .update({
        last_run_at: new Date().toISOString(),
        total_searches: (config.total_searches || 0) + searchesCompleted,
        total_leads_imported: (config.total_leads_imported || 0) + totalImported,
      })
      .eq("id", config.id);

    console.log(`[SCOUT] Run complete. ${totalImported} leads imported across ${searchesCompleted} searches`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        searches_completed: searchesCompleted,
        total_imported: totalImported,
        decisions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[SCOUT] Fatal error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
