import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_SAMPLE_OFFER = 20;
const MIN_SAMPLE_KILL = 30;
const WIN_THRESHOLD = 0.15;
const KILL_THRESHOLD = 0.05;
const RPL_WIN_MARGIN = 1.1;
const RPL_LOSE_MARGIN = 0.9;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, request_id, ...params } = body;

    // ── IDEMPOTENCY CHECK ──
    if (request_id) {
      const { data: existing } = await supabase
        .from("brandaro_system_decisions")
        .select("*")
        .eq("request_id", request_id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({
          ok: true,
          idempotent: true,
          previous_result: existing.output_snapshot,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Helper: log decision
    const logDecision = async (type: string, reason: string, actionTaken: string, impact: number, output: any) => {
      if (!request_id) return;
      await supabase.from("brandaro_system_decisions").insert({
        request_id,
        decision_type: type,
        decision_reason: reason,
        action_taken: actionTaken,
        impact_score: impact,
        input_snapshot: params,
        output_snapshot: output,
      });
    };

    // ── analyze-competitors ── (with auto-offer generation)
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

      // Aggregate weaknesses across all competitors
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

      const exploitableGaps = Object.entries(allWeaknesses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([gap, count]) => ({ gap, competitors_weak: count }));

      // AUTO-OFFER GENERATION: Create offers from gaps if they don't exist
      const autoOffers: string[] = [];
      for (const { gap } of exploitableGaps) {
        const offerName = `Exploit: ${gap}`;
        const { data: existingOffer } = await supabase
          .from("brandaro_offer_variants")
          .select("id")
          .eq("offer_name", offerName)
          .maybeSingle();

        if (!existingOffer) {
          await supabase.from("brandaro_offer_variants").insert({
            offer_name: offerName,
            headline: `Fix what competitors fail at: ${gap}`,
            pricing: 497,
            status: "testing",
            sample_size: 0,
            exposure_count: 0,
            conversion_count: 0,
          });
          autoOffers.push(offerName);
        }
      }

      const result = { ok: true, exploitable_gaps: exploitableGaps, auto_offers_created: autoOffers };
      await logDecision("competitor_analysis", `Analyzed ${competitor_name}`, `Upserted intel, generated ${autoOffers.length} auto-offers`, autoOffers.length * 10, result);

      return new Response(JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── optimize-offers (SAFE — sample size gated) ──
    if (action === "optimize-offers") {
      const { data: offers } = await supabase
        .from("brandaro_offer_variants")
        .select("*")
        .in("status", ["testing", "active"])
        .order("revenue_generated", { ascending: false });

      if (!offers || offers.length === 0) {
        const result = { ok: true, message: "No offers to optimize", promoted: [], killed: [], skipped: [] };
        await logDecision("offer_optimization", "No testable offers", "no_action", 0, result);
        return new Response(JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const promoted: string[] = [];
      const killed: string[] = [];
      const skipped: string[] = [];

      for (const offer of offers) {
        const sampleSize = offer.sample_size || 0;
        const exposures = offer.exposure_count || 0;
        const conversions = offer.conversion_count || 0;
        const convRate = exposures > 0 ? conversions / exposures : 0;

        // SAFETY: Skip if insufficient data
        if (sampleSize < MIN_SAMPLE_OFFER) {
          skipped.push(`${offer.offer_name} (n=${sampleSize})`);
          continue;
        }

        // Promote winners
        if (convRate >= WIN_THRESHOLD && (offer.revenue_generated || 0) > 0) {
          await supabase.from("brandaro_offer_variants").update({
            status: "winning",
            conversion_rate: Math.round(convRate * 10000) / 100,
            updated_at: new Date().toISOString(),
          }).eq("id", offer.id);
          promoted.push(offer.offer_name);
        }
        // Kill losers (need higher sample)
        else if (convRate < KILL_THRESHOLD && sampleSize >= MIN_SAMPLE_KILL) {
          await supabase.from("brandaro_offer_variants").update({
            status: "losing",
            conversion_rate: Math.round(convRate * 10000) / 100,
            updated_at: new Date().toISOString(),
          }).eq("id", offer.id);
          killed.push(offer.offer_name);
        }
      }

      const result = { ok: true, promoted, killed, skipped };
      await logDecision("offer_optimization", `Evaluated ${offers.length} offers`, `Promoted ${promoted.length}, killed ${killed.length}, skipped ${skipped.length}`, (promoted.length * 20) + (killed.length * 5), result);

      return new Response(JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── track-offer-exposure ── (increment exposure)
    if (action === "track-offer-exposure") {
      const { offer_variant_id } = params;
      if (!offer_variant_id) throw new Error("offer_variant_id required");

      const { data: offer } = await supabase
        .from("brandaro_offer_variants")
        .select("exposure_count")
        .eq("id", offer_variant_id)
        .single();

      if (offer) {
        await supabase.from("brandaro_offer_variants").update({
          exposure_count: (offer.exposure_count || 0) + 1,
          sample_size: (offer.exposure_count || 0) + 1,
        }).eq("id", offer_variant_id);
      }

      return new Response(JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── track-offer-conversion ── (increment conversion + revenue)
    if (action === "track-offer-conversion") {
      const { offer_variant_id, revenue } = params;
      if (!offer_variant_id) throw new Error("offer_variant_id required");

      const { data: offer } = await supabase
        .from("brandaro_offer_variants")
        .select("conversion_count, revenue_generated, exposure_count")
        .eq("id", offer_variant_id)
        .single();

      if (offer) {
        const newConversions = (offer.conversion_count || 0) + 1;
        const newRevenue = (offer.revenue_generated || 0) + (revenue || 0);
        const newRate = (offer.exposure_count || 1) > 0
          ? Math.round((newConversions / (offer.exposure_count || 1)) * 10000) / 100
          : 0;

        await supabase.from("brandaro_offer_variants").update({
          conversion_count: newConversions,
          revenue_generated: newRevenue,
          conversion_rate: newRate,
          updated_at: new Date().toISOString(),
        }).eq("id", offer_variant_id);
      }

      return new Response(JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── run-pricing-test ──
    if (action === "run-pricing-test") {
      const { base_price, test_price, segment } = params;

      const { data, error } = await supabase.from("brandaro_pricing_tests").insert({
        base_price, test_price, segment, test_status: "running",
        exposure_count: 0, conversion_count: 0,
      }).select().single();

      if (error) throw error;
      await logDecision("pricing_test_start", `Testing $${base_price} → $${test_price}`, "created_test", 5, data);

      return new Response(JSON.stringify({ ok: true, test: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── evaluate-pricing-tests (SAFE — real RPL calculation) ──
    if (action === "evaluate-pricing-tests") {
      const { data: tests } = await supabase
        .from("brandaro_pricing_tests")
        .select("*")
        .eq("test_status", "running");

      const results: any[] = [];
      for (const test of tests || []) {
        const exposures = test.exposure_count || 0;
        const conversions = test.conversion_count || 0;

        // SAFETY: Need minimum sample
        if (exposures < MIN_SAMPLE_OFFER) {
          results.push({ id: test.id, verdict: "insufficient_data", sample: exposures });
          continue;
        }

        const testConvRate = exposures > 0 ? conversions / exposures : 0;
        const testRPL = test.test_price * testConvRate;
        const baseConvRate = test.conversion_rate ? test.conversion_rate / 100 : testConvRate;
        const baseRPL = test.base_price * baseConvRate;

        let verdict: string;
        if (testRPL > baseRPL * RPL_WIN_MARGIN) {
          verdict = "winner";
        } else if (testRPL < baseRPL * RPL_LOSE_MARGIN) {
          verdict = "loser";
        } else {
          verdict = "inconclusive";
        }

        await supabase.from("brandaro_pricing_tests").update({
          test_status: verdict,
          conversion_rate: Math.round(testConvRate * 10000) / 100,
          revenue_per_lead: Math.round(testRPL * 100) / 100,
          updated_at: new Date().toISOString(),
        }).eq("id", test.id);

        results.push({ id: test.id, test_price: test.test_price, base_price: test.base_price, verdict, testRPL, baseRPL });
      }

      const resultPayload = { ok: true, results };
      await logDecision("pricing_evaluation", `Evaluated ${results.length} tests`, `${results.filter(r => r.verdict === "winner").length} winners`, results.length * 5, resultPayload);

      return new Response(JSON.stringify(resultPayload),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── get-winning-script ── (dynamic script injection for calls)
    if (action === "get-winning-script") {
      const { data: winningOffer } = await supabase
        .from("brandaro_offer_variants")
        .select("*")
        .eq("status", "winning")
        .order("conversion_rate", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: winningPosition } = await supabase
        .from("brandaro_positioning_tests")
        .select("*")
        .order("win_rate", { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(JSON.stringify({
        ok: true,
        offer: winningOffer || null,
        positioning: winningPosition || null,
        script_inject: {
          headline: winningOffer?.headline || winningPosition?.headline || null,
          pricing: winningOffer?.pricing || null,
          value_props: winningOffer?.value_props || [],
          urgency: winningOffer?.urgency_trigger || null,
          guarantee: winningOffer?.guarantee || null,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      const [competitorsRes, offersRes, pricingRes, positioningRes, decisionsRes] = await Promise.all([
        supabase.from("brandaro_competitor_intel").select("*").order("last_updated", { ascending: false }),
        supabase.from("brandaro_offer_variants").select("*").order("revenue_generated", { ascending: false }),
        supabase.from("brandaro_pricing_tests").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("brandaro_positioning_tests").select("*").order("win_rate", { ascending: false }),
        supabase.from("brandaro_system_decisions").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      const allOffers = offersRes.data || [];
      const winningOffers = allOffers.filter((o: any) => o.status === "winning");
      const activeTests = (pricingRes.data || []).filter((t: any) => t.test_status === "running");

      return new Response(JSON.stringify({
        competitors: competitorsRes.data || [],
        offers: allOffers,
        winning_offers: winningOffers,
        pricing_tests: pricingRes.data || [],
        active_pricing_tests: activeTests.length,
        positioning: positioningRes.data || [],
        decisions: decisionsRes.data || [],
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
