import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00Z`;

    // Run all queries in parallel
    const [
      bookingsRes, partnersRes, confirmRes, experiencesRes, revenueRes,
      ttBookingsToday, ttRevenueToday, ttActiveDrivers, ttPendingAssignments, ttAvgRating,
    ] = await Promise.all([
      sb.from("tt_bookings").select("id", { count: "exact", head: true }).in("status", ["confirmed", "in_progress"]),
      sb.from("tt_partners").select("id", { count: "exact", head: true }).eq("status", "active"),
      sb.from("tt_confirmation_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("tt_experiences").select("title").eq("featured", true).limit(1).maybeSingle(),
      sb.from("tt_bookings").select("total_price").gte("created_at", todayStart),
      // TopTier-specific
      sb.from("tt_bookings").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      sb.from("tt_bookings").select("total_price").eq("payment_status", "paid").gte("created_at", todayStart),
      sb.from("tt_drivers").select("id", { count: "exact", head: true }).in("status", ["available", "on_assignment"]),
      sb.from("tt_bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed").is("driver_id", null),
      sb.from("tt_customer_reviews").select("rating"),
    ]);

    const revenueToday = (revenueRes.data ?? []).reduce(
      (sum: number, b: any) => sum + (Number(b.total_price) || 0), 0
    );

    const ttRevenue = (ttRevenueToday.data ?? []).reduce(
      (sum: number, b: any) => sum + (Number(b.total_price) || 0), 0
    );

    const ttRatingData = ttAvgRating.data ?? [];
    const ttRating = ttRatingData.length > 0
      ? (ttRatingData.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / ttRatingData.length).toFixed(1)
      : null;

    const payload = {
      revenue_today: revenueToday,
      active_bookings: bookingsRes.count ?? 0,
      pending_confirmations: confirmRes.count ?? 0,
      active_partners: partnersRes.count ?? 0,
      top_service: experiencesRes.data?.title ?? "—",
      top_alert: null,
      toptier: {
        bookings_today: ttBookingsToday.count ?? 0,
        revenue_today: ttRevenue,
        active_drivers: ttActiveDrivers.count ?? 0,
        pending_assignments: ttPendingAssignments.count ?? 0,
        avg_rating: ttRating,
      },
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("get-os-metrics error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
