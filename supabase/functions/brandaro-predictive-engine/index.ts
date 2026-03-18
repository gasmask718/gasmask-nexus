import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── CONVERSION PROBABILITY ENGINE ──
function calculateProbability(lead: any, perf: any, nicheData: any): { probability: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};
  let score = 0;

  // Base factors from lead data
  if (lead.website_status === "no_website") { factors.no_website = 15; score += 15; }
  if ((lead.review_count || 0) >= 20) { factors.high_reviews = 12; score += 12; }
  else if ((lead.review_count || 0) >= 5) { factors.some_reviews = 6; score += 6; }
  if ((lead.rating || 0) >= 4.0) { factors.good_rating = 8; score += 8; }

  // Service industry boost
  const highConvertIndustries = ["plumber", "electrician", "hvac", "landscaping", "cleaning", "roofing", "painting", "contractor", "handyman", "pest control", "auto repair", "dental", "salon"];
  if (highConvertIndustries.some(s => (lead.industry || "").toLowerCase().includes(s))) {
    factors.service_industry = 10; score += 10;
  }

  // Behavioral signals from lead performance
  if (perf) {
    if (perf.sms_replied) { factors.sms_replied = 20; score += 20; }
    if (perf.call_picked_up) { factors.call_answered = 25; score += 25; }
    if (perf.interested) { factors.expressed_interest = 30; score += 30; }
    if (perf.response_time_seconds && perf.response_time_seconds < 300) {
      factors.fast_responder = 15; score += 15;
    } else if (perf.response_time_seconds && perf.response_time_seconds < 1800) {
      factors.moderate_responder = 8; score += 8;
    }
    // Existing lead score contribution
    if ((perf.lead_score || 0) > 50) { factors.high_lead_score = 10; score += 10; }
  }

  // Niche performance boost
  if (nicheData && nicheData.is_hot_niche) {
    factors.hot_niche = 12; score += 12;
  } else if (nicheData && nicheData.conversion_rate > 10) {
    factors.proven_niche = 8; score += 8;
  }

  const probability = Math.min(score, 100);
  return { probability, factors };
}

function getPriorityTier(probability: number): string {
  if (probability >= 70) return "high";
  if (probability >= 40) return "medium";
  return "low";
}

function getActionStrategy(probability: number): string {
  if (probability >= 70) return "immediate_call";
  if (probability >= 40) return "sms_then_call";
  return "slow_nurture";
}

// ── BEST CONTACT TIME ANALYSIS ──
function analyzeBestContactTime(actions: any[]): { hour: number | null; day: number | null } {
  const successActions = actions.filter((a: any) => a.status === "success");
  if (successActions.length < 3) return { hour: null, day: null };

  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<number, number> = {};

  for (const a of successActions) {
    const d = new Date(a.executed_at || a.created_at);
    const h = d.getHours();
    const day = d.getDay();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }

  const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  const bestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    hour: bestHour ? Number(bestHour[0]) : null,
    day: bestDay ? Number(bestDay[0]) : null,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, dry_run } = await req.json();

    if (dry_run) {
      return new Response(JSON.stringify({ status: "ok", engine: "brandaro-predictive-engine" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: SCORE ALL LEADS ──
    if (action === "score_leads") {
      // Get all active leads
      const { data: leads } = await supabase
        .from("brandaro_qualified_leads")
        .select("id, business_name, phone_number, industry, website_status, review_count, rating, lead_status")
        .not("lead_status", "in", "(sold,not_interested,do_not_call,wrong_number)")
        .limit(500);

      if (!leads || leads.length === 0) {
        return new Response(JSON.stringify({ success: true, scored: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Batch fetch performance data
      const leadIds = leads.map((l: any) => l.id);
      const { data: perfData } = await supabase
        .from("brandaro_lead_performance")
        .select("*")
        .in("lead_id", leadIds);
      const perfMap = new Map((perfData || []).map((p: any) => [p.lead_id, p]));

      // Fetch niche data
      const { data: nicheData } = await supabase.from("brandaro_niche_performance").select("*");
      const nicheMap = new Map((nicheData || []).map((n: any) => [n.industry?.toLowerCase(), n]));

      // Fetch recent successful actions for timing analysis
      const { data: recentActions } = await supabase
        .from("brandaro_auto_actions")
        .select("action_type, status, executed_at, created_at")
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(200);

      const { hour: bestHour, day: bestDay } = analyzeBestContactTime(recentActions || []);

      let scored = 0;
      const predictions: any[] = [];

      for (const lead of leads) {
        const perf = perfMap.get(lead.id);
        const niche = nicheMap.get((lead.industry || "").toLowerCase());
        const { probability, factors } = calculateProbability(lead, perf, niche);
        const tier = getPriorityTier(probability);
        const strategy = getActionStrategy(probability);

        predictions.push({
          lead_id: lead.id,
          conversion_probability: probability,
          priority_tier: tier,
          action_strategy: strategy,
          scoring_factors: factors,
          best_contact_hour: bestHour,
          best_contact_day: bestDay,
          predicted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        scored++;
      }

      // Upsert all predictions
      for (const pred of predictions) {
        const { data: existing } = await supabase
          .from("brandaro_conversion_predictions")
          .select("id")
          .eq("lead_id", pred.lead_id)
          .maybeSingle();

        if (existing) {
          await supabase.from("brandaro_conversion_predictions")
            .update(pred)
            .eq("id", existing.id);
        } else {
          await supabase.from("brandaro_conversion_predictions").insert(pred);
        }
      }

      console.log(`[PREDICTIVE] Scored ${scored} leads`);

      return new Response(JSON.stringify({
        success: true,
        scored,
        distribution: {
          high: predictions.filter(p => p.priority_tier === "high").length,
          medium: predictions.filter(p => p.priority_tier === "medium").length,
          low: predictions.filter(p => p.priority_tier === "low").length,
        },
        best_contact: { hour: bestHour, day: bestDay },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: UPDATE NICHE PERFORMANCE ──
    if (action === "update_niches") {
      const { data: leads } = await supabase
        .from("brandaro_qualified_leads")
        .select("id, industry")
        .not("industry", "is", null)
        .limit(1000);

      const { data: perfData } = await supabase.from("brandaro_lead_performance").select("*");
      const perfMap = new Map((perfData || []).map((p: any) => [p.lead_id, p]));

      const { data: revenueData } = await supabase.from("brandaro_revenue_tracking").select("*");

      // Aggregate by industry
      const nicheAgg: Record<string, any> = {};

      for (const lead of (leads || [])) {
        const industry = (lead.industry || "unknown").toLowerCase();
        if (!nicheAgg[industry]) {
          nicheAgg[industry] = { total: 0, contacted: 0, replied: 0, converted: 0, revenue: 0 };
        }
        nicheAgg[industry].total++;
        const perf = perfMap.get(lead.id);
        if (perf) {
          if (perf.sms_sent > 0 || perf.call_picked_up) nicheAgg[industry].contacted++;
          if (perf.sms_replied) nicheAgg[industry].replied++;
          if (perf.converted) nicheAgg[industry].converted++;
        }
        const rev = (revenueData || []).filter((r: any) => r.lead_id === lead.id);
        nicheAgg[industry].revenue += rev.reduce((s: number, r: any) => s + Number(r.revenue_amount || 0), 0);
      }

      let updated = 0;
      for (const [industry, agg] of Object.entries(nicheAgg)) {
        const convRate = agg.total > 0 ? Math.round((agg.converted / agg.total) * 10000) / 100 : 0;
        const rpl = agg.total > 0 ? Math.round((agg.revenue / agg.total) * 100) / 100 : 0;
        const isHot = convRate > 15 && agg.total >= 10;

        const row = {
          industry,
          total_leads: agg.total,
          total_contacted: agg.contacted,
          total_replied: agg.replied,
          total_converted: agg.converted,
          total_revenue: agg.revenue,
          conversion_rate: convRate,
          revenue_per_lead: rpl,
          is_hot_niche: isHot,
          updated_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from("brandaro_niche_performance")
          .select("id")
          .eq("industry", industry)
          .maybeSingle();

        if (existing) {
          await supabase.from("brandaro_niche_performance").update(row).eq("id", existing.id);
        } else {
          await supabase.from("brandaro_niche_performance").insert(row);
        }
        updated++;
      }

      return new Response(JSON.stringify({ success: true, niches_updated: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: RECORD REVENUE ──
    if (action === "record_revenue") {
      const { lead_id, amount, script_variant, industry, campaign } = await req.json().catch(() => ({}));
      // Re-parse since we already consumed
      if (!lead_id || !amount) throw new Error("lead_id and amount required");

      await supabase.from("brandaro_revenue_tracking").insert({
        lead_id,
        revenue_amount: amount,
        attributed_script_variant: script_variant,
        attributed_industry: industry,
        attributed_campaign: campaign,
      });

      // Mark lead as converted in performance
      await supabase.from("brandaro_lead_performance")
        .update({ converted: true, updated_at: new Date().toISOString() })
        .eq("lead_id", lead_id);

      // Update prediction outcome
      await supabase.from("brandaro_conversion_predictions")
        .update({ outcome: "converted", acted_on: true, updated_at: new Date().toISOString() })
        .eq("lead_id", lead_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: GET PRIORITY QUEUE ──
    if (action === "get_priority_queue") {
      const { data: predictions } = await supabase
        .from("brandaro_conversion_predictions")
        .select("*, brandaro_qualified_leads(business_name, phone_number, industry, city, state, lead_status)")
        .eq("acted_on", false)
        .order("conversion_probability", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ success: true, queue: predictions || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    console.error("[PREDICTIVE] Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
