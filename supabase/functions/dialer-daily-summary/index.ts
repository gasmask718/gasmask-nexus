import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * DIALER DAILY SUMMARY
 * Runs nightly to aggregate daily dialer metrics into dialer_daily_metrics.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date(Date.now() - 86400000).toISOString().split("T")[0]; // yesterday

    // Get all businesses with dialer activity
    const { data: businesses } = await supabase
      .from("call_cost_events")
      .select("business_id")
      .gte("created_at", `${targetDate}T00:00:00Z`)
      .lt("created_at", `${targetDate}T23:59:59Z`);

    const uniqueBusinessIds = [...new Set((businesses || []).map((b: any) => b.business_id).filter(Boolean))];

    const results: any[] = [];

    for (const businessId of uniqueBusinessIds) {
      const dayStart = `${targetDate}T00:00:00Z`;
      const dayEnd = `${targetDate}T23:59:59Z`;

      // Total dials (cost events = completed calls)
      const { data: costEvents } = await supabase
        .from("call_cost_events")
        .select("estimated_cost, duration_seconds, billable_minutes")
        .eq("business_id", businessId)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd);

      const totalDials = costEvents?.length || 0;
      const totalCost = (costEvents || []).reduce((s: number, e: any) => s + (Number(e.estimated_cost) || 0), 0);
      const totalDuration = (costEvents || []).reduce((s: number, e: any) => s + (Number(e.duration_seconds) || 0), 0);

      // Connects (sessions with outcome)
      const { count: totalConnects } = await supabase
        .from("live_call_sessions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("connected_at", dayStart)
        .lt("connected_at", dayEnd)
        .not("outcome", "is", null);

      // Revenue
      const { data: revenueEvents } = await supabase
        .from("call_revenue_events")
        .select("amount")
        .eq("business_id", businessId)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd);

      const totalRevenue = (revenueEvents || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

      // New DNCs today
      const { count: newDnc } = await supabase
        .from("dialer_opt_out_events")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd);

      // Avg answer rate from store profiles updated today
      const { data: profiles } = await supabase
        .from("store_answer_profile")
        .select("answer_rate")
        .eq("business_id", businessId)
        .gte("updated_at", dayStart);

      const avgAnswerRate = profiles && profiles.length > 0
        ? profiles.reduce((s: number, p: any) => s + (Number(p.answer_rate) || 0), 0) / profiles.length
        : 0;

      const netProfit = totalRevenue - totalCost;

      // Upsert daily metrics
      const { error } = await supabase
        .from("dialer_daily_metrics")
        .upsert({
          business_id: businessId,
          metric_date: targetDate,
          total_dials: totalDials,
          total_connects: totalConnects || 0,
          total_revenue: totalRevenue,
          total_cost: totalCost,
          net_profit: netProfit,
          new_dnc_count: newDnc || 0,
          avg_answer_rate: avgAnswerRate,
          avg_call_duration_seconds: totalDials > 0 ? totalDuration / totalDials : 0,
        }, { onConflict: "business_id,metric_date" });

      results.push({ businessId, totalDials, totalCost, totalRevenue, netProfit, error: error?.message });
    }

    return new Response(
      JSON.stringify({ success: true, date: targetDate, businesses_processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Daily summary error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
