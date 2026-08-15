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

    let refundIssued = false;
    if (refundPercent > 0) {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: Math.round(refundAmount * 100),
      });
      refundIssued = true;
    }

    // Update booking. The refund above is irreversible — money has already left
    // the account by this line.
    const { error: bookingUpdateErr } = await supabase.from("ut_bookings").update({
      status: "cancelled",
      cancellation_reason: reason || refundReason,
      refund_amount: refundAmount,
    }).eq("id", booking_id);

    if (bookingUpdateErr) {
      console.error("ut-process-refund booking update failed after refund issued:", errText(bookingUpdateErr));
      // WHY THIS IS A 200 AND NOT A 5xx — read before "fixing" it.
      //
      // If refundIssued is true, Stripe has already moved the money. A 5xx here
      // reads to every caller (and to any retry wrapper, queue, or impatient
      // human clicking again) as "the refund did not happen", and the retry
      // would call stripe.refunds.create a second time on the same intent —
      // a genuine double refund. The failed write is a bookkeeping problem;
      // a retry turns it into a cash problem.
      //
      // So the response is deliberately 200 with refund_issued: true and
      // record_updated: false. It is not success. It means: the money is gone,
      // the booking row is stale, do NOT call this again — a human must patch
      // the row. Only the no-refund case (refundIssued === false) is safe to
      // fail hard, because there is nothing to double.
      if (!refundIssued) {
        throw new Error(`booking update failed, no refund was issued: ${errText(bookingUpdateErr)}`);
      }
      return new Response(JSON.stringify({
        success: false,
        needs_manual_repair: true,
        refund_issued: true,
        record_updated: false,
        booking_id,
        refund_amount: refundAmount,
        refund_percent: refundPercent,
        error: `Refund of $${refundAmount} was issued at Stripe but the booking record could not be updated. Do not retry — retrying would issue a second refund. Patch booking ${booking_id} manually. Cause: ${errText(bookingUpdateErr)}`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Notify vendor — never allowed to fail a completed refund.
    try {
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
    } catch (emailErr) {
      console.error("ut-process-refund vendor notification failed (refund stands):", errText(emailErr));
    }

    return new Response(JSON.stringify({ success: true, refund_issued: refundIssued, record_updated: true, refund_amount: refundAmount, refund_percent: refundPercent, reason: refundReason }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("process-refund error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
