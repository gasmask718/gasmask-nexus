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
    const { action, ...params } = await req.json();

    // ── 1. Analyze Competitor Weaknesses ──
    if (action === "analyze-weaknesses") {
      const { competitor_id } = params;
      if (!competitor_id) return json({ ok: false, error: "competitor_id required" }, 400);

      const { data: comp } = await supabase
        .from("brandaro_competitors")
        .select("*")
        .eq("id", competitor_id)
        .single();

      if (!comp) return json({ ok: false, error: "Competitor not found" }, 404);

      // AI weakness extraction
      const weaknesses = extractWeaknesses(comp);

      for (const w of weaknesses) {
        await supabase.from("brandaro_competitor_weaknesses").insert({
          competitor_id,
          weakness_type: w.type,
          description: w.description,
          exploitability_score: w.score,
          exploit_strategy: w.strategy,
          source: "ai_analysis",
        });
      }

      return json({ ok: true, weaknesses_found: weaknesses.length, weaknesses });
    }

    // ── 2. Generate Undercut Offers ──
    if (action === "generate-undercut") {
      const { competitor_id } = params;
      if (!competitor_id) return json({ ok: false, error: "competitor_id required" }, 400);

      const { data: comp } = await supabase
        .from("brandaro_competitors")
        .select("*")
        .eq("id", competitor_id)
        .single();

      const { data: weaknesses } = await supabase
        .from("brandaro_competitor_weaknesses")
        .select("*")
        .eq("competitor_id", competitor_id)
        .order("exploitability_score", { ascending: false })
        .limit(5);

      if (!comp) return json({ ok: false, error: "Competitor not found" }, 404);

      const offers = generateUndercutOffers(comp, weaknesses || []);

      for (const o of offers) {
        await supabase.from("brandaro_undercut_offers").insert({
          competitor_id,
          competitor_offer: o.competitor_offer,
          brandaro_counter_offer: o.counter_offer,
          strategy: o.strategy,
          discount_pct: o.discount_pct,
          urgency_trigger: o.urgency,
        });
      }

      return json({ ok: true, offers_generated: offers.length, offers });
    }

    // ── 3. Capture Demand (log a competitor conversion) ──
    if (action === "capture-demand") {
      const { competitor_id, lead_id, capture_method, competitor_mentioned, original_objection, reposition_strategy, outcome, revenue_captured } = params;

      await supabase.from("brandaro_competitor_captures").insert({
        competitor_id, lead_id, capture_method,
        competitor_mentioned: competitor_mentioned || false,
        original_objection, reposition_strategy,
        outcome: outcome || "pending",
        revenue_captured: revenue_captured || 0,
      });

      // Update undercut offer usage if applicable
      if (reposition_strategy) {
        const { data: offer } = await supabase
          .from("brandaro_undercut_offers")
          .select("id, times_used, conversion_rate")
          .eq("competitor_id", competitor_id)
          .eq("strategy", reposition_strategy)
          .limit(1)
          .single();

        if (offer) {
          const newUsed = (offer.times_used || 0) + 1;
          const wonDelta = outcome === "won" ? 1 : 0;
          const newRate = ((offer.conversion_rate || 0) * (offer.times_used || 0) + wonDelta * 100) / newUsed;
          await supabase.from("brandaro_undercut_offers").update({
            times_used: newUsed,
            conversion_rate: Math.round(newRate * 10) / 10,
          }).eq("id", offer.id);
        }
      }

      return json({ ok: true });
    }

    // ── 4. Market Share Snapshot ──
    if (action === "snapshot-market-share") {
      const { data: competitors } = await supabase
        .from("brandaro_competitors")
        .select("id, name, territory_id")
        .eq("is_active", true);

      if (!competitors?.length) return json({ ok: true, message: "No competitors tracked" });

      const period = new Date().toISOString().slice(0, 7); // YYYY-MM

      for (const comp of competitors) {
        const { count: captures } = await supabase
          .from("brandaro_competitor_captures")
          .select("id", { count: "exact", head: true })
          .eq("competitor_id", comp.id)
          .eq("outcome", "won");

        const { count: totalCaptures } = await supabase
          .from("brandaro_competitor_captures")
          .select("id", { count: "exact", head: true })
          .eq("competitor_id", comp.id);

        const { data: revData } = await supabase
          .from("brandaro_competitor_captures")
          .select("revenue_captured")
          .eq("competitor_id", comp.id)
          .eq("outcome", "won");

        const totalRev = (revData || []).reduce((s: number, r: any) => s + Number(r.revenue_captured || 0), 0);
        const winRate = totalCaptures ? Math.round(((captures || 0) / totalCaptures) * 100) : 0;

        await supabase.from("brandaro_market_share").upsert({
          competitor_id: comp.id,
          territory_id: comp.territory_id,
          period,
          brandaro_leads: captures || 0,
          win_rate: winRate,
          revenue_captured: totalRev,
          market_share_pct: Math.min(winRate, 100),
        }, { onConflict: "id" });
      }

      return json({ ok: true, competitors_tracked: competitors.length });
    }

    // ── 5. Dashboard ──
    if (action === "get-dashboard") {
      const { data: competitors } = await supabase
        .from("brandaro_competitors")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const { data: weaknesses } = await supabase
        .from("brandaro_competitor_weaknesses")
        .select("*")
        .order("exploitability_score", { ascending: false })
        .limit(20);

      const { data: captures } = await supabase
        .from("brandaro_competitor_captures")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: offers } = await supabase
        .from("brandaro_undercut_offers")
        .select("*")
        .eq("is_active", true)
        .order("conversion_rate", { ascending: false });

      const { data: marketShare } = await supabase
        .from("brandaro_market_share")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      // Aggregate stats
      const totalCaptured = (captures || []).filter((c: any) => c.outcome === "won").length;
      const totalRevenue = (captures || []).reduce((s: number, c: any) => s + (c.outcome === "won" ? Number(c.revenue_captured || 0) : 0), 0);
      const avgWinRate = marketShare?.length
        ? Math.round((marketShare || []).reduce((s: number, m: any) => s + Number(m.win_rate || 0), 0) / marketShare.length)
        : 0;

      return json({
        ok: true,
        stats: { totalCompetitors: competitors?.length || 0, totalCaptured, totalRevenue, avgWinRate },
        competitors, weaknesses, captures, offers, marketShare,
      });
    }

    // ── 6. Full Cycle ──
    if (action === "full-cycle") {
      const { data: competitors } = await supabase
        .from("brandaro_competitors")
        .select("id")
        .eq("is_active", true);

      let analyzed = 0, offersGen = 0;
      for (const c of (competitors || [])) {
        const weaknesses = extractWeaknesses(c);
        for (const w of weaknesses) {
          await supabase.from("brandaro_competitor_weaknesses").insert({
            competitor_id: c.id, weakness_type: w.type,
            description: w.description, exploitability_score: w.score,
            exploit_strategy: w.strategy, source: "ai_cycle",
          });
        }
        analyzed++;

        const offers = generateUndercutOffers(c, weaknesses as any);
        for (const o of offers) {
          await supabase.from("brandaro_undercut_offers").insert({
            competitor_id: c.id, competitor_offer: o.competitor_offer,
            brandaro_counter_offer: o.counter_offer, strategy: o.strategy,
            discount_pct: o.discount_pct, urgency_trigger: o.urgency,
          });
        }
        offersGen += offers.length;
      }

      return json({ ok: true, analyzed, offersGen });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("Competitor takeover error:", e);
    return json({ ok: false, error: e.message }, 500);
  }
});

// ── Helpers ──

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractWeaknesses(comp: any) {
  const weaknesses: any[] = [];
  const pricing = comp.pricing || {};

  if (pricing.min && pricing.min > 1000) {
    weaknesses.push({
      type: "high_pricing", description: `Pricing starts at $${pricing.min} — above market average`,
      score: 85, strategy: "Offer competitive entry-level pricing with same deliverables",
    });
  }

  if (!comp.guarantees || comp.guarantees.length === 0) {
    weaknesses.push({
      type: "no_guarantee", description: "No money-back or performance guarantee offered",
      score: 90, strategy: "Lead with Brandaro's strong guarantee to reduce buyer risk",
    });
  }

  if (comp.weaknesses?.includes("slow_response")) {
    weaknesses.push({
      type: "slow_response", description: "Known for slow response times and poor follow-up",
      score: 95, strategy: "Emphasize Brandaro's instant AI response and 24/7 availability",
    });
  }

  if (comp.weaknesses?.includes("no_followup")) {
    weaknesses.push({
      type: "no_followup", description: "Competitor doesn't follow up after initial contact",
      score: 88, strategy: "Highlight automated multi-touch follow-up sequences",
    });
  }

  if (comp.weaknesses?.includes("poor_closing")) {
    weaknesses.push({
      type: "poor_closing", description: "Weak closing process — leads fall through",
      score: 80, strategy: "Showcase AI closing psychology and conversion rates",
    });
  }

  // Always add a generic positioning weakness
  if (weaknesses.length === 0) {
    weaknesses.push({
      type: "generic_positioning", description: "Standard market positioning without differentiation",
      score: 60, strategy: "Position Brandaro's AI-powered approach as next-generation",
    });
  }

  return weaknesses;
}

function generateUndercutOffers(comp: any, weaknesses: any[]) {
  const offers: any[] = [];
  const topWeakness = weaknesses[0];

  offers.push({
    competitor_offer: `${comp.name || "Competitor"}'s standard package`,
    counter_offer: "Same deliverables + AI optimization + performance guarantee at competitive price",
    strategy: "value_stack",
    discount_pct: 0,
    urgency: "First 10 clients get lifetime rate lock",
  });

  if (topWeakness?.weakness_type === "high_pricing") {
    offers.push({
      competitor_offer: `${comp.name}'s premium pricing`,
      counter_offer: "Match deliverables at 20% below their price point with faster turnaround",
      strategy: "price_undercut",
      discount_pct: 20,
      urgency: "Price match guarantee expires in 48 hours",
    });
  }

  if (topWeakness?.weakness_type === "no_guarantee") {
    offers.push({
      competitor_offer: `${comp.name}'s no-guarantee service`,
      counter_offer: "Full service with 30-day money-back guarantee + performance metrics dashboard",
      strategy: "risk_reversal",
      discount_pct: 0,
      urgency: "Limited spots available this month",
    });
  }

  offers.push({
    competitor_offer: `Switching from ${comp.name || "competitor"}`,
    counter_offer: "Free migration + 1 month free + dedicated onboarding specialist",
    strategy: "switching_incentive",
    discount_pct: 100,
    urgency: "Switching bonus available for this quarter only",
  });

  return offers;
}
