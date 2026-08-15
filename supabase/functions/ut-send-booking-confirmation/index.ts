import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { sendEmail } from "../_shared/sendEmail.ts";
import { errText } from "../_shared/errText.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) return new Response(JSON.stringify({ error: "booking_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch booking with vendor and customer
    const { data: booking } = await supabase.from("ut_bookings").select("*, ut_vendors(business_name, owner_id)").eq("id", booking_id).single();
    if (!booking) throw new Error("Booking not found");

    const { data: customer } = await supabase.from("ut_profiles").select("*").eq("id", booking.customer_id).single();
    const { data: vendor } = await supabase.from("ut_profiles").select("*").eq("id", booking.ut_vendors?.owner_id).single();

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;padding:20px;text-align:center;">
          <h1 style="color:#e94560;margin:0;">Unforgettable Times</h1>
        </div>
        <div style="padding:20px;background:#f5f5f5;">
          <h2>Booking Confirmed! 🎉</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;font-weight:bold;">Vendor</td><td style="padding:8px;">${booking.ut_vendors?.business_name}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${booking.event_date || "TBD"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Guests</td><td style="padding:8px;">${booking.guest_count || "N/A"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Total</td><td style="padding:8px;">$${booking.total_amount}</td></tr>
          </table>
          <div style="text-align:center;margin-top:20px;">
            <a href="https://unforgettabletimes.com/bookings/${booking.id}" style="background:#e94560;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;">View Booking</a>
          </div>
        </div>
        <div style="padding:10px;text-align:center;font-size:12px;color:#999;"><a href="#" style="color:#999;">Unsubscribe</a></div>
      </div>
    `;

    // Email to customer
    if (customer?.email) {
      await sendEmail({
        from: "Unforgettable Times <Sales@brandarodigital.com>",
        to: [customer.email],
        subject: "Your booking is confirmed!",
        html: emailHtml,
      });
    }

    // Email to vendor
    if (vendor?.email) {
      await sendEmail({
        from: "Unforgettable Times <Sales@brandarodigital.com>",
        to: [vendor.email],
        subject: `New confirmed booking: ${booking.event_date}`,
        html: emailHtml,
      });
    }

    // SMS to customer via Twilio connector gateway
    if (customer?.phone) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
      const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER");
      if (LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_PHONE) {
        await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": TWILIO_API_KEY, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: customer.phone, From: TWILIO_PHONE, Body: (await import("../_shared/smsTemplates.ts")).buildSmsTemplate("booking_confirmed_generic", { service_name: "booking", vendor_name: booking.ut_vendors?.business_name || "vendor", date: booking.event_date, total: booking.total_amount }) })
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("send-booking-confirmation error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
