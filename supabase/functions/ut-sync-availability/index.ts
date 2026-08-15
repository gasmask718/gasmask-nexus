import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { vendor_id } = await req.json();
    if (!vendor_id) return new Response(JSON.stringify({ error: "vendor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get confirmed booking dates
    const { data: bookings } = await supabase.from("ut_bookings").select("event_date").eq("vendor_id", vendor_id).in("status", ["confirmed", "pending"]);

    // Get manually blocked dates
    const { data: blocked } = await supabase.from("ut_vendor_blocked_dates").select("blocked_date").eq("vendor_id", vendor_id);

    const bookedDates = (bookings || []).map(b => b.event_date).filter(Boolean);
    const blockedDates = (blocked || []).map(b => b.blocked_date).filter(Boolean);
    const allUnavailable = [...new Set([...bookedDates, ...blockedDates])].sort();

    return new Response(JSON.stringify({ vendor_id, unavailable_dates: allUnavailable, booked_count: bookedDates.length, blocked_count: blockedDates.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("sync-availability error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
