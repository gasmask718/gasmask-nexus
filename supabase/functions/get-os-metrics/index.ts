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

    // Run queries in parallel
    const [bookingsRes, partnersRes, confirmRes, experiencesRes, revenueRes] =
      await Promise.all([
        sb
          .from("tt_bookings")
          .select("id", { count: "exact", head: true })
          .in("status", ["confirmed", "in_progress"]),
        sb
          .from("tt_partners")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        sb
          .from("tt_confirmation_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        sb
          .from("tt_experiences")
          .select("title")
          .eq("featured", true)
          .limit(1)
          .maybeSingle(),
        sb
          .from("tt_bookings")
          .select("total_price")
          .gte("created_at", `${today}T00:00:00Z`),
      ]);

    const revenueToday = (revenueRes.data ?? []).reduce(
      (sum: number, b: any) => sum + (Number(b.total_price) || 0),
      0
    );

    const payload = {
      revenue_today: revenueToday,
      active_bookings: bookingsRes.count ?? 0,
      pending_confirmations: confirmRes.count ?? 0,
      active_partners: partnersRes.count ?? 0,
      top_service: experiencesRes.data?.title ?? "—",
      top_alert: null,
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
