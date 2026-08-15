import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { sendEmail } from "../_shared/sendEmail.ts";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) return new Response(JSON.stringify({ error: "booking_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: booking } = await supabase.from("ut_bookings").select("*, ut_vendors(id, business_name)").eq("id", booking_id).single();
    if (!booking) throw new Error("Booking not found");

    const { data: customer } = await supabase.from("ut_profiles").select("email, full_name").eq("id", booking.customer_id).single();
    if (!customer?.email) throw new Error("Customer email not found");

    await sendEmail({
      from: "Unforgettable Times <Sales@brandarodigital.com>",
      to: [customer.email],
      subject: `How was your experience with ${booking.ut_vendors?.business_name}?`,
      html: `
        <div style="font-family:Arial;max-width:600px;margin:0 auto;">
          <div style="background:#1a1a2e;padding:20px;text-align:center;"><h1 style="color:#e94560;">Unforgettable Times</h1></div>
          <div style="padding:20px;background:#f5f5f5;">
            <h2>Tell us about your experience!</h2>
            <p>Hi ${customer.full_name || "there"},</p>
            <p>Your event with <strong>${booking.ut_vendors?.business_name}</strong> on ${booking.event_date} has wrapped up. We'd love to hear how it went!</p>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://unforgettabletimes.com/vendors/${booking.ut_vendors?.id}?review=true" style="background:#e94560;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;">Leave a Review</a>
            </div>
          </div>
          <div style="padding:10px;text-align:center;font-size:12px;color:#999;"><a href="#" style="color:#999;">Unsubscribe</a></div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("send-review-request error:", errText(error));
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
