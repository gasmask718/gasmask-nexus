import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const DYNASTY_OS_API_KEY = Deno.env.get("DYNASTY_OS_API_KEY");
    if (!DYNASTY_OS_API_KEY || !authHeader || authHeader !== `Bearer ${DYNASTY_OS_API_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const vendor_id = url.searchParams.get("vendor_id");
    if (!vendor_id) return new Response(JSON.stringify({ error: "vendor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("dynasty_os_api_logs").insert({ endpoint: "get-vendor-summary", method: "GET" });

    const { data: vendor } = await supabase.from("ut_vendors").select("*").eq("id", vendor_id).single();
    if (!vendor) return new Response(JSON.stringify({ error: "Vendor not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: bookings } = await supabase.from("ut_bookings").select("total_amount, platform_fee").eq("vendor_id", vendor_id).eq("status", "confirmed");
    const totalRevenue = (bookings || []).reduce((sum, b) => sum + (b.total_amount || 0), 0);

    return new Response(JSON.stringify({ ...vendor, booking_count: bookings?.length || 0, total_revenue_generated: totalRevenue }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("get-vendor-summary error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
