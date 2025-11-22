import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    console.log("Analyzing expansion opportunities...");

    // Fetch all stores with their revenue data
    const { data: stores } = await supabaseClient
      .from("stores")
      .select("*, visit_logs(*)")
      .eq("status", "active");

    // Fetch all routes to understand coverage
    const { data: routes } = await supabaseClient
      .from("routes")
      .select("*, route_stops(*)");

    // Analyze current coverage by city/ZIP
    const cityStats: Record<string, { 
      stores: number; 
      visits: number; 
      avgRevenue: number;
      territory: string;
    }> = {};
    
    const zipStats: Record<string, { 
      stores: number; 
      visits: number; 
      city: string;
      state: string;
    }> = {};

    if (stores) {
      for (const store of stores) {
        const city = store.address_city || "Unknown";
        const zip = store.address_zip || "Unknown";
        const state = store.address_state || "Unknown";

        // City stats
        if (!cityStats[city]) {
          cityStats[city] = {
            stores: 0,
            visits: 0,
            avgRevenue: 0,
            territory: state,
          };
        }
        cityStats[city].stores++;
        cityStats[city].visits += store.visit_logs?.length || 0;

        // ZIP stats
        if (!zipStats[zip]) {
          zipStats[zip] = {
            stores: 0,
            visits: 0,
            city,
            state,
          };
        }
        zipStats[zip].stores++;
        zipStats[zip].visits += store.visit_logs?.length || 0;
      }
    }

    // Generate expansion scores
    const expansionScores = [];

    // City-level analysis
    for (const [city, stats] of Object.entries(cityStats)) {
      if (city === "Unknown") continue;

      let score = 0;

      // Factor 1: Current store density (more stores = proven market)
      if (stats.stores >= 10) score += 30;
      else if (stats.stores >= 5) score += 20;
      else if (stats.stores >= 2) score += 10;

      // Factor 2: Visit frequency (high engagement = good market)
      const avgVisitsPerStore = stats.visits / stats.stores;
      if (avgVisitsPerStore >= 10) score += 25;
      else if (avgVisitsPerStore >= 5) score += 15;
      else if (avgVisitsPerStore >= 2) score += 5;

      // Factor 3: Growth potential (fewer stores = more room to grow)
      if (stats.stores < 5) score += 20;
      else if (stats.stores < 10) score += 10;

      // Factor 4: Territory status
      if (stats.territory) score += 15;

      expansionScores.push({
        location_type: "city",
        location_name: city,
        state: stats.territory,
        score: Math.min(100, score),
        current_stores: stats.stores,
        avg_visits_per_store: Math.round(avgVisitsPerStore * 10) / 10,
        expected_roi: (score / 100) * 50000, // Simplified ROI calculation
        priority: score >= 70 ? 1 : score >= 50 ? 2 : 3,
        driver_capacity_needed: Math.ceil(stats.stores / 10),
        reasoning: score >= 70
          ? "High-performing market with strong growth potential"
          : score >= 50
          ? "Established market with moderate expansion opportunity"
          : "Emerging market - monitor before heavy investment",
        recommendations: {
          suggested_new_stores: Math.ceil(stats.stores * 0.3),
          suggested_drivers: Math.ceil(stats.stores / 15),
          launch_timeline: score >= 70 ? "immediate" : score >= 50 ? "next_quarter" : "future",
        },
      });
    }

    // ZIP-level analysis (top opportunities)
    const zipScores = [];
    for (const [zip, stats] of Object.entries(zipStats)) {
      if (zip === "Unknown" || stats.stores === 0) continue;

      let score = 0;

      // High visit frequency
      const avgVisitsPerStore = stats.visits / stats.stores;
      if (avgVisitsPerStore >= 8) score += 40;
      else if (avgVisitsPerStore >= 5) score += 25;
      else if (avgVisitsPerStore >= 3) score += 15;

      // Store density
      if (stats.stores >= 3) score += 30;
      else if (stats.stores >= 2) score += 20;
      else score += 10;

      // Growth opportunity
      if (stats.stores < 5) score += 30;

      zipScores.push({
        location_type: "zip",
        location_name: zip,
        city: stats.city,
        state: stats.state,
        score: Math.min(100, score),
        current_stores: stats.stores,
        avg_visits_per_store: Math.round(avgVisitsPerStore * 10) / 10,
        expected_roi: (score / 100) * 25000,
        priority: score >= 70 ? 1 : score >= 50 ? 2 : 3,
        driver_capacity_needed: 1,
        reasoning: score >= 70
          ? "Hot ZIP with proven demand - priority expansion"
          : score >= 50
          ? "Strong ZIP with good potential"
          : "Standard ZIP - monitor performance",
        recommendations: {
          suggested_new_stores: stats.stores < 3 ? 2 : 1,
          blitz_mission_pack: score >= 70,
        },
      });
    }

    // Sort by score
    expansionScores.sort((a, b) => b.score - a.score);
    zipScores.sort((a, b) => b.score - a.score);

    // Save top expansion scores to database
    const topScores = [
      ...expansionScores.slice(0, 5).map(s => ({
        location_type: s.location_type,
        location_name: s.location_name,
        state: s.state,
        score: s.score,
        expected_roi: s.expected_roi,
        priority: s.priority,
        driver_capacity_needed: s.driver_capacity_needed,
        reasoning: s.reasoning,
        recommendations: s.recommendations,
      })),
      ...zipScores.slice(0, 10).map(s => ({
        location_type: s.location_type,
        location_name: s.location_name,
        state: s.state,
        score: s.score,
        expected_roi: s.expected_roi,
        priority: s.priority,
        driver_capacity_needed: s.driver_capacity_needed,
        reasoning: s.reasoning,
        recommendations: s.recommendations,
      })),
    ];

    // Delete old scores and insert new ones
    await supabaseClient.from("expansion_scores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    if (topScores.length > 0) {
      await supabaseClient.from("expansion_scores").insert(topScores);
    }

    console.log(`Generated ${topScores.length} expansion recommendations`);

    return new Response(
      JSON.stringify({
        cities: expansionScores.slice(0, 5),
        zips: zipScores.slice(0, 10),
        summary: {
          total_cities_analyzed: Object.keys(cityStats).length,
          total_zips_analyzed: Object.keys(zipStats).length,
          high_priority_locations: topScores.filter((s) => s.priority === 1).length,
          total_stores: stores?.length || 0,
          analysis_date: new Date().toISOString(),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in expansion-ai:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});