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

    // Stripe retries a non-2xx for days. So: only fail the request for a write
    // that a retry could actually repair. Never 5xx over a cosmetic write.
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        // Update all bookings with this payment intent. Idempotent — a Stripe
        // replay re-runs the same update, which is exactly the repair we want.
        const { error: confirmErr } = await supabase
          .from("ut_bookings")
          .update({ status: "confirmed" })
          .eq("stripe_payment_intent_id", pi.id);
        if (confirmErr) {
          console.error("ut-stripe-webhook confirm booking failed:", errText(confirmErr));
          throw new Error(`booking confirm write failed: ${errText(confirmErr)}`);
        }

        // Trigger booking confirmations
        const { data: bookings } = await supabase.from("ut_bookings").select("id").eq("stripe_payment_intent_id", pi.id);
        for (const b of bookings || []) {
          // Fire-and-forget confirmation + invoice
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ut-send-booking-confirmation`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ booking_id: b.id })
          }).catch((e) => console.error("ut-stripe-webhook confirmation dispatch failed:", errText(e)));
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ut-generate-invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ booking_id: b.id })
          }).catch((e) => console.error("ut-stripe-webhook invoice dispatch failed:", errText(e)));
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        // Idempotent and retryable: a booking left `pending` blocks inventory.
        const { error: cancelErr } = await supabase
          .from("ut_bookings")
          .update({ status: "cancelled", cancellation_reason: "Payment failed" })
          .eq("stripe_payment_intent_id", pi.id);
        if (cancelErr) {
          console.error("ut-stripe-webhook cancel booking failed:", errText(cancelErr));
          throw new Error(`booking cancel write failed: ${errText(cancelErr)}`);
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        // Cosmetic and self-healing — the next account.updated corrects it.
        // Retrying the whole event for a verified flag is disproportionate.
        if (account.id) {
          const { error: vendorErr } = await supabase
            .from("ut_vendors")
            .update({ verified: account.charges_enabled || false })
            .eq("stripe_connect_id", account.id);
          if (vendorErr) console.error("ut-stripe-webhook vendor verify update failed:", errText(vendorErr));
        }
        break;
      }
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        if (transfer.metadata?.booking_id) {
          // Only record linking a transfer to a booking; no second source.
          const { error: transferErr } = await supabase
            .from("ut_bookings")
            .update({ stripe_transfer_id: transfer.id })
            .eq("id", transfer.metadata.booking_id);
          if (transferErr) {
            console.error("ut-stripe-webhook transfer link failed:", errText(transferErr));
            throw new Error(`transfer link write failed: ${errText(transferErr)}`);
          }
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
