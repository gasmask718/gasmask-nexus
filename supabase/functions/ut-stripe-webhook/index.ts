import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) throw new Error("Stripe keys not configured");

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("No signature", { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        // Update all bookings with this payment intent
        await supabase.from("ut_bookings").update({ status: "confirmed" }).eq("stripe_payment_intent_id", pi.id);

        // Trigger booking confirmations
        const { data: bookings } = await supabase.from("ut_bookings").select("id").eq("stripe_payment_intent_id", pi.id);
        for (const b of bookings || []) {
          // Fire-and-forget confirmation + invoice
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ut-send-booking-confirmation`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ booking_id: b.id })
          }).catch(console.error);
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ut-generate-invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ booking_id: b.id })
          }).catch(console.error);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await supabase.from("ut_bookings").update({ status: "cancelled", cancellation_reason: "Payment failed" }).eq("stripe_payment_intent_id", pi.id);
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        // Update vendor Stripe Connect status
        if (account.id) {
          await supabase.from("ut_vendors").update({ verified: account.charges_enabled || false }).eq("stripe_connect_id", account.id);
        }
        break;
      }
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        if (transfer.metadata?.booking_id) {
          await supabase.from("ut_bookings").update({ stripe_transfer_id: transfer.id }).eq("id", transfer.metadata.booking_id);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("stripe-webhook error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
