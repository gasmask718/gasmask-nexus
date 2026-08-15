import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import Stripe from "https://esm.sh/stripe@14.14.0";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { event_build_id, customer_id } = await req.json();
    if (!event_build_id || !customer_id) {
      return new Response(JSON.stringify({ error: "event_build_id and customer_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch event build
    const { data: build, error: buildErr } = await supabase.from("ut_event_builds").select("*").eq("id", event_build_id).single();
    if (buildErr || !build) throw new Error("Event build not found");

    const selectedItems = build.selected_items || [];
    if (selectedItems.length === 0) throw new Error("No items in event build");

    // Calculate totals
    let totalAmount = 0;
    for (const item of selectedItems) {
      totalAmount += item.price || 0;
    }
    const platformFee = Math.round(totalAmount * 0.15 * 100) / 100; // 15%
    const vendorPayout = Math.round((totalAmount - platformFee) * 100) / 100; // 85%

    // ORDERING HAZARD (see docs/architecture/known-issues-payment-intent-before-rows.md):
    // the PaymentIntent is created before any row exists, so every failure below
    // leaves an orphan intent. That is survivable (an uncaptured intent expires)
    // and strictly better than handing the browser a client_secret for bookings
    // that were never written — but the correct order is rows first, intent last.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // cents
      currency: "usd",
      metadata: { event_build_id, customer_id },
    });

    // Create event record. Nothing below is valid without it — a failure here
    // used to write every booking with a null event_id.
    const { data: event, error: eventErr } = await supabase.from("ut_pub_events").insert({
      customer_id,
      event_type: build.event_type,
      event_date: build.event_date,
      city: build.city,
      guest_count: build.guest_count,
      budget: totalAmount,
      status: "pending_payment",
    }).select().single();
    if (eventErr || !event) {
      throw new Error(`event record write failed (payment intent ${paymentIntent.id} left uncaptured): ${errText(eventErr)}`);
    }

    // Create booking records per vendor item. A partial list is worse than an
    // error: the caller cannot tell which items are missing.
    const bookingIds: string[] = [];
    for (const item of selectedItems) {
      const { data: booking, error: bookingErr } = await supabase.from("ut_bookings").insert({
        customer_id,
        vendor_id: item.vendor_id,
        event_id: event.id,
        event_date: build.event_date,
        guest_count: build.guest_count,
        status: "pending",
        total_amount: item.price,
        platform_fee: Math.round(item.price * 0.15 * 100) / 100,
        vendor_payout: Math.round(item.price * 0.85 * 100) / 100,
        stripe_payment_intent_id: paymentIntent.id,
      }).select().single();
      if (bookingErr || !booking) {
        throw new Error(`booking write failed for vendor ${item.vendor_id} (payment intent ${paymentIntent.id} left uncaptured): ${errText(bookingErr)}`);
      }
      bookingIds.push(booking.id);
    }

    // Best-effort: by here the intent and the rows exist and the caller needs
    // the client_secret. A stale build status is cheaper than losing it.
    const { error: buildStatusErr } = await supabase.from("ut_event_builds").update({ status: "payment_pending" }).eq("id", event_build_id);
    if (buildStatusErr) console.error("ut-process-booking-payment build status update failed:", errText(buildStatusErr));

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      booking_ids: bookingIds,
      total_amount: totalAmount,
      platform_fee: platformFee,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("process-booking-payment error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
