import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...params } = await req.json();

    // ── analyze-competitors ──
    if (action === "analyze-competitors") {
      const { competitor_name, pricing_model, offer_structure, guarantees, positioning, strengths, weaknesses } = params;

      // Upsert competitor
      const { data: existing } = await supabase
        .from("brandaro_competitor_intel")
        .select("id")
        .eq("competitor_name", competitor_name)
        .maybeSingle();

      if (existing) {
        await supabase.from("brandaro_competitor_intel").update({
          pricing_model, offer_structure, guarantees, positioning,
          strengths: strengths || [], weaknesses: weaknesses || [],
          last_updated: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("brandaro_competitor_intel").insert({
          competitor_name, pricing_model, offer_structure, guarantees, positioning,
          strengths: strengths || [], weaknesses: weaknesses || [],
        });
      }

      // Auto-generate positioning gaps
      const { data: allCompetitors } = await supabase
        .from("brandaro_competitor_intel")
        .select("weaknesses")
        .order("last_updated", { ascending: false });

      const allWeaknesses: Record<string, number> = {};
      for (const c of allCompetitors || []) {
        const ws = Array.isArray(c.weaknesses) ? c.weaknesses : [];
        for (const w of ws) {
          const key = typeof w === "string" ? w : String(w);
          allWeaknesses[key] = (allWeaknesses[key] || 0) + 1;
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        exploitable_gaps: Object.entries(allWeaknesses)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([gap, count]) => ({ gap, competitors_weak: count })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── optimize-offers ──
    if (action === "optimize-offers") {
      const { data: offers } = await supabase
        .from("brandaro_offer_variants")
        .select("*")
        .order("revenue_generated", { ascending: false });

      if (!offers || offers.length === 0) {
        return new Response(JSON.stringify({ ok: true, message: "No offers to optimize" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const promoted: string[] = [];
      const killed: string[] = [];

      for (const offer of offers) {
        // Promote winners: conversion >= 15% and revenue > 0
        if (offer.status === "testing" && offer.conversion_rate >= 15 && offer.revenue_generated > 0) {
          await supabase.from("brandaro_offer_variants").update({
            status: "winning", updated_at: new Date().toISOString(),
          }).eq("id", offer.id);
          promoted.push(offer.offer_name);
        }
        // Kill losers: conversion < 5% after sufficient exposure
        if (offer.status === "testing" && offer.conversion_rate < 5 && offer.conversion_rate > 0) {
          await supabase.from("brandaro_offer_variants").update({
            status: "losing", updated_at: new Date().toISOString(),
          }).eq("id", offer.id);
          killed.push(offer.offer_name);
        }
      }

      return new Response(JSON.stringify({ ok: true, promoted, killed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── run-pricing-test ──
    if (action === "run-pricing-test") {
      const { base_price, test_price, segment } = params;

      const { data, error } = await supabase.from("brandaro_pricing_tests").insert({
        base_price, test_price, segment, test_status: "running",
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, test: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── evaluate-pricing-tests ──
    if (action === "evaluate-pricing-tests") {
      const { data: tests } = await supabase
        .from("brandaro_pricing_tests")
        .select("*")
        .eq("test_status", "running");

      const results: any[] = [];
      for (const test of tests || []) {
        // Revenue per lead at test price vs base
        const testRPL = test.revenue_per_lead || 0;
        const baseRPL = test.base_price * (test.conversion_rate || 0) / 100;

        let verdict: string;
        if (testRPL > baseRPL * 1.1) {
          verdict = "winner";
        } else if (testRPL < baseRPL * 0.9) {
          verdict = "loser";
        } else {
          verdict = "inconclusive";
        }

        await supabase.from("brandaro_pricing_tests").update({
          test_status: verdict, updated_at: new Date().toISOString(),
        }).eq("id", test.id);

        results.push({ id: test.id, test_price: test.test_price, base_price: test.base_price, verdict });
      }

      return new Response(JSON.stringify({ ok: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── update-positioning ──
    if (action === "update-positioning") {
      const { positioning_angle, headline, script_variant } = params;

      const { data, error } = await supabase.from("brandaro_positioning_tests").insert({
        positioning_angle, headline, script_variant,
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, test: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── get-domination-dashboard ──
    if (action === "get-domination-dashboard") {
      const [competitorsRes, offersRes, pricingRes, positioningRes] = await Promise.all([
        supabase.from("brandaro_competitor_intel").select("*").order("last_updated", { ascending: false }),
        supabase.from("brandaro_offer_variants").select("*").order("revenue_generated", { ascending: false }),
        supabase.from("brandaro_pricing_tests").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("brandaro_positioning_tests").select("*").order("win_rate", { ascending: false }),
      ]);

      const winningOffers = (offersRes.data || []).filter((o: any) => o.status === "winning");
      const activeTests = (pricingRes.data || []).filter((t: any) => t.test_status === "running");

      return new Response(JSON.stringify({
        competitors: competitorsRes.data || [],
        offers: offersRes.data || [],
        winning_offers: winningOffers,
        pricing_tests: pricingRes.data || [],
        active_pricing_tests: activeTests.length,
        positioning: positioningRes.data || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("market-domination error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
