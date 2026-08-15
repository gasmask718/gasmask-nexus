import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Validate Dynasty OS API key
    const authHeader = req.headers.get("Authorization");
    const DYNASTY_OS_API_KEY = Deno.env.get("DYNASTY_OS_API_KEY");
    if (!DYNASTY_OS_API_KEY) throw new Error("DYNASTY_OS_API_KEY not configured");
    if (!authHeader || authHeader !== `Bearer ${DYNASTY_OS_API_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Log API call
    await supabase.from("dynasty_os_api_logs").insert({ endpoint: "get-platform-metrics", method: "GET" });

    const [vendorsRes, bookingsRes, revenueRes, ambassadorsRes, monthRevenueRes, categoriesRes, quotesRes] = await Promise.all([
      supabase.from("ut_vendors").select("id", { count: "exact" }).eq("status", "active"),
      supabase.from("ut_bookings").select("id", { count: "exact" }),
      supabase.from("ut_bookings").select("platform_fee").eq("status", "confirmed"),
      supabase.from("ut_pub_ambassadors").select("id", { count: "exact" }),
      supabase.from("ut_bookings").select("platform_fee").eq("status", "confirmed").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from("ut_vendors").select("vendor_type").eq("status", "active"),
      supabase.from("ut_quote_requests").select("id", { count: "exact" }),
    ]);

    const totalRevenue = (revenueRes.data || []).reduce((sum, b) => sum + (b.platform_fee || 0), 0);
    const monthRevenue = (monthRevenueRes.data || []).reduce((sum, b) => sum + (b.platform_fee || 0), 0);

    const categoryCounts: Record<string, number> = {};
    (categoriesRes.data || []).forEach(v => {
      categoryCounts[v.vendor_type] = (categoryCounts[v.vendor_type] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));

    const confirmedBookings = (bookingsRes.data || []).length;
    const totalQuotes = quotesRes.count || 0;
    const conversionRate = totalQuotes > 0 ? Math.round((confirmedBookings / totalQuotes) * 10000) / 100 : 0;

    return new Response(JSON.stringify({
      total_vendors: vendorsRes.count || 0,
      total_bookings: bookingsRes.count || 0,
      total_revenue: totalRevenue,
      total_ambassadors: ambassadorsRes.count || 0,
      this_month_revenue: monthRevenue,
      top_vendor_categories: topCategories,
      conversion_rate: conversionRate,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("get-platform-metrics error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
