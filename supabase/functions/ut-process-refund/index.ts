import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import Stripe from "https://esm.sh/stripe@14.14.0";
import { sendEmail } from "../_shared/sendEmail.ts";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id, reason } = await req.json();
    if (!booking_id) return new Response(JSON.stringify({ error: "booking_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: booking } = await supabase.from("ut_bookings").select("*, ut_vendors(business_name, owner_id)").eq("id", booking_id).single();
    if (!booking) throw new Error("Booking not found");
    if (!booking.stripe_payment_intent_id) throw new Error("No payment intent found");

    // Calculate refund based on timing
    const eventDate = new Date(booking.event_date);
    const now = new Date();
    const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundPercent = 0;
    let refundReason = "";
    if (hoursUntilEvent >= 48) {
      refundPercent = 100;
      refundReason = "Full refund — cancelled 48+ hours before event";
    } else if (hoursUntilEvent > 0) {
      refundPercent = 50;
      refundReason = "50% refund — cancelled under 48 hours before event";
    } else {
      refundPercent = 0;
      refundReason = "No refund — event has already passed (no-show)";
    }

    const refundAmount = Math.round((booking.total_amount || 0) * (refundPercent / 100) * 100) / 100;

    if (refundPercent > 0) {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: Math.round(refundAmount * 100),
      });
    }

    // Update booking
    await supabase.from("ut_bookings").update({
      status: "cancelled",
      cancellation_reason: reason || refundReason,
      refund_amount: refundAmount,
    }).eq("id", booking_id);

    // Notify vendor
    if (booking.ut_vendors?.owner_id) {
      const { data: vendorProfile } = await supabase.from("ut_profiles").select("email").eq("id", booking.ut_vendors.owner_id).single();
      if (vendorProfile?.email) {
        await sendEmail({
          from: "Unforgettable Times <Sales@brandarodigital.com>",
          to: [vendorProfile.email],
          subject: `Booking cancelled for ${booking.event_date}`,
          html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a1a2e;padding:20px;text-align:center;"><h1 style="color:#e94560;">Unforgettable Times</h1></div><div style="padding:20px;background:#f5f5f5;"><h2>Booking Cancelled</h2><p><strong>Date:</strong> ${booking.event_date}</p><p><strong>Reason:</strong> ${reason || "Customer requested"}</p><p><strong>Refund:</strong> $${refundAmount} (${refundPercent}%)</p></div></div>`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, refund_amount: refundAmount, refund_percent: refundPercent, reason: refundReason }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("process-refund error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
