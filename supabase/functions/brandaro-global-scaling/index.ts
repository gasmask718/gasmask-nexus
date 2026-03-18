import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, payload } = await req.json();

    // ── ACTION: Get Global Dashboard ──
    if (action === "get-dashboard") {
      const [territories, performance, suggestions, recentActions] = await Promise.all([
        supabase.from("brandaro_territories").select("*").order("created_at", { ascending: false }),
        supabase.from("brandaro_territory_performance").select("*").order("computed_at", { ascending: false }).limit(50),
        supabase.from("brandaro_expansion_suggestions").select("*").eq("status", "pending").order("similarity_score", { ascending: false }).limit(10),
        supabase.from("brandaro_scaling_log").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      const terrs = territories.data || [];
      const perfs = performance.data || [];

      // Aggregate global stats
      const activeCount = terrs.filter((t: any) => t.status === "active" || t.status === "scaling").length;
      const totalRevenue = perfs.reduce((s: number, p: any) => s + Number(p.revenue || 0), 0);
      const avgROI = perfs.length ? perfs.reduce((s: number, p: any) => s + Number(p.roi || 0), 0) / perfs.length : 0;
      const totalLeads = perfs.reduce((s: number, p: any) => s + Number(p.leads_generated || 0), 0);

      // Per-territory summary
      const territoryMap: Record<string, any> = {};
      for (const t of terrs) {
        const tPerfs = perfs.filter((p: any) => p.territory_id === t.id);
        const latestPerf = tPerfs[0] || {};
        territoryMap[t.id] = {
          ...t,
          latest_revenue: Number(latestPerf.revenue || 0),
          latest_roi: Number(latestPerf.roi || 0),
          latest_conversion: Number(latestPerf.conversion_rate || 0),
          latest_leads: Number(latestPerf.leads_generated || 0),
        };
      }

      return new Response(JSON.stringify({
        territories: Object.values(territoryMap),
        global: { activeCount, totalRevenue, avgROI, totalLeads, totalTerritories: terrs.length },
        suggestions: suggestions.data || [],
        recentActions: recentActions.data || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: Launch New Territory ──
    if (action === "launch-territory") {
      const { name, city, state, region, cloneFrom } = payload || {};
      if (!name || !city) throw new Error("name and city required");

      const { data: territory, error } = await supabase.from("brandaro_territories").insert({
        name, city, state, region,
        status: "testing",
        cloned_from: cloneFrom || null,
        launched_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;

      // If cloning from existing territory, log duplication
      if (cloneFrom) {
        const components = ["funnels", "ai_personalities", "scripts", "automation_rules", "followup_sequences", "pricing_strategies"];
        await supabase.from("brandaro_market_duplications").insert({
          source_territory_id: cloneFrom,
          target_territory_id: territory.id,
          components_cloned: components,
          status: "completed",
          completed_at: new Date().toISOString(),
        });

        // Copy localization from source
        const { data: source } = await supabase.from("brandaro_territories").select("localization_profile").eq("id", cloneFrom).single();
        if (source?.localization_profile) {
          await supabase.from("brandaro_territories").update({
            localization_profile: { ...source.localization_profile, market: city }
          }).eq("id", territory.id);
        }
      }

      await supabase.from("brandaro_scaling_log").insert({
        territory_id: territory.id,
        action_type: "territory_launched",
        details: { name, city, state, cloneFrom },
        result: "success",
      });

      return new Response(JSON.stringify({ success: true, territory }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: Evaluate & Scale Territories ──
    if (action === "evaluate-territories") {
      const { data: terrs } = await supabase.from("brandaro_territories").select("*").in("status", ["testing", "active", "scaling"]);
      const { data: perfs } = await supabase.from("brandaro_territory_performance").select("*").order("computed_at", { ascending: false });

      const actions: any[] = [];
      for (const t of (terrs || [])) {
        const tPerfs = (perfs || []).filter((p: any) => p.territory_id === t.id);
        if (tPerfs.length === 0) continue;

        const latestROI = Number(tPerfs[0].roi || 0);
        const latestConv = Number(tPerfs[0].conversion_rate || 0);

        // Promote testing → active
        if (t.status === "testing" && latestROI > 50 && latestConv > 5) {
          await supabase.from("brandaro_territories").update({ status: "active" }).eq("id", t.id);
          actions.push({ territory: t.name, action: "promoted_to_active", roi: latestROI });
        }
        // Promote active → scaling
        if (t.status === "active" && latestROI > 150 && latestConv > 15) {
          await supabase.from("brandaro_territories").update({ status: "scaling" }).eq("id", t.id);
          actions.push({ territory: t.name, action: "promoted_to_scaling", roi: latestROI });
        }
        // Pause underperformers
        if ((t.status === "active" || t.status === "scaling") && latestROI < -30) {
          await supabase.from("brandaro_territories").update({ status: "paused" }).eq("id", t.id);
          actions.push({ territory: t.name, action: "paused_underperformer", roi: latestROI });
        }
      }

      // Log actions
      for (const a of actions) {
        await supabase.from("brandaro_scaling_log").insert({
          action_type: a.action,
          details: a,
          result: "auto",
        });
      }

      return new Response(JSON.stringify({ actions }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: Suggest Expansion ──
    if (action === "suggest-expansion") {
      const { data: topTerritories } = await supabase.from("brandaro_territories").select("*").in("status", ["active", "scaling"]);
      const { data: perfs } = await supabase.from("brandaro_territory_performance").select("*").order("computed_at", { ascending: false });

      // Find top-performing territories and suggest similar markets
      const marketSuggestions: Record<string, string[]> = {
        "New York": ["Newark NJ", "Philadelphia PA", "Hartford CT"],
        "Miami": ["Fort Lauderdale FL", "Tampa FL", "Orlando FL"],
        "Atlanta": ["Charlotte NC", "Nashville TN", "Birmingham AL"],
        "Los Angeles": ["San Diego CA", "Phoenix AZ", "Las Vegas NV"],
        "Chicago": ["Milwaukee WI", "Detroit MI", "Indianapolis IN"],
        "Dallas": ["Houston TX", "Austin TX", "San Antonio TX"],
      };

      const suggestions: any[] = [];
      for (const t of (topTerritories || [])) {
        const tPerfs = (perfs || []).filter((p: any) => p.territory_id === t.id);
        const roi = tPerfs.length ? Number(tPerfs[0].roi || 0) : 0;
        if (roi < 50) continue;

        const nearby = marketSuggestions[t.city] || [];
        for (const market of nearby) {
          const [city, state] = market.split(" ");
          // Check if already exists
          const { data: existing } = await supabase.from("brandaro_expansion_suggestions").select("id").eq("suggested_city", city.trim());
          if ((existing || []).length > 0) continue;

          suggestions.push({
            suggested_city: city.trim(),
            suggested_state: state || null,
            reason: `Similar market to high-performing ${t.city} (ROI: ${roi.toFixed(0)}%)`,
            similarity_score: Math.max(0, 100 - Math.abs(roi - 100)),
            similar_to_territory_id: t.id,
          });
        }
      }

      if (suggestions.length > 0) {
        await supabase.from("brandaro_expansion_suggestions").insert(suggestions);
      }

      return new Response(JSON.stringify({ suggestions: suggestions.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: Full Cycle ──
    if (action === "full-cycle") {
      const evalRes = await fetch(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
        body: JSON.stringify({ action: "evaluate-territories" }),
      });
      const evalData = await evalRes.json();

      const suggestRes = await fetch(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
        body: JSON.stringify({ action: "suggest-expansion" }),
      });
      const suggestData = await suggestRes.json();

      return new Response(JSON.stringify({
        evaluation: evalData,
        suggestions: suggestData,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
