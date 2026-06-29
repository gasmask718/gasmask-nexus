// Dynasty Direct — primary Stripe webhook (non-Connect events).
// Verifies signature, marks orders paid, handles express-pay PaymentIntent
// lifecycle, releases inventory on cancel/failure, and fires the
// order-confirmation email. Event-id idempotent via dd_webhook_events.
//
// Connect/split events live in dd-stripe-connect-webhook; that function keys
// off pi.metadata.order_id and will fire its split engine for both hosted
// (checkout.session.completed → PaymentIntent) and express orders identically.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey =
    Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("DD_STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: "Stripe keys not configured", key_ready: false }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("No signature", { status: 400, headers: corsHeaders });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[dd-webhook] signature verify failed", err.message);
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency: insert event id; on conflict bail out.
  const { error: idemErr } = await supabase.from("dd_webhook_events").insert({
    event_id: event.id,
    source: "dd-stripe-webhook",
    type: event.type,
  });
  if (idemErr) {
    // Unique violation → already processed.
    console.log(`[dd-webhook] duplicate event ${event.id} (${event.type}) — skipped`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderPaid(
          supabase,
          session.metadata?.order_id,
          (session.payment_intent as string) || session.id,
          session.customer_details?.email ?? null,
          (session.amount_total ?? 0) / 100,
        );
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markOrderPaid(
          supabase,
          pi.metadata?.order_id,
          pi.id,
          pi.receipt_email ?? null,
          (pi.amount_received ?? pi.amount ?? 0) / 100,
        );
        break;
      }
      case "payment_intent.canceled":
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await releaseOrderReserves(supabase, pi.metadata?.order_id, event.type);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[dd-webhook] handler error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function markOrderPaid(
  supabase: any,
  orderId: string | undefined | null,
  paymentRef: string,
  fallbackEmail: string | null,
  amountTotal: number,
) {
  if (!orderId) return;
  const { data: existing } = await supabase
    .from("marketplace_orders")
    .select("payment_status, customer_email")
    .eq("id", orderId)
    .maybeSingle();
  if (!existing) return;
  if (existing.payment_status === "paid") return;

  const updatePayload: Record<string, unknown> = {
    payment_status: "paid",
    fulfillment_status: "processing",
    stripe_payment_intent_id: paymentRef,
  };
  // Backfill customer_email if missing — required for guest-order public lookup.
  if (!existing.customer_email && fallbackEmail) {
    updatePayload.customer_email = fallbackEmail;
  }
  await supabase.from("marketplace_orders").update(updatePayload).eq("id", orderId);

  // Decrement inventory for each line item via RPC. Best-effort: log failures
  // but do not block payment processing.
  const { data: items } = await supabase
    .from("marketplace_order_items")
    .select("product_id, qty")
    .eq("order_id", orderId);
  for (const it of items ?? []) {
    if (!it.product_id || !it.qty) continue;
    const { error: decErr } = await supabase.rpc("dd_decrement_inventory", {
      p_product_id: it.product_id,
      p_quantity: it.qty,
      p_order_id: orderId,
      p_reason: "sale",
    });
    if (decErr) console.error(`[dd-webhook] inventory decrement failed ${it.product_id}:`, decErr.message);
  }

  // Fire-and-forget grabba bridge sync.
  supabase.functions
    .invoke("dd-grabba-bridge", { body: { order_id: orderId } })
    .catch((e: any) => console.error("[dd-webhook] grabba bridge failed", e?.message));

  const email = existing.customer_email || fallbackEmail;
  if (email) {
    await supabase.functions
      .invoke("dd-send-email", {
        body: {
          template: "order-confirmation",
          to: email,
          data: { order_id: orderId, amount_total: amountTotal },
        },
      })
      .catch((e: any) => console.error("[dd-webhook] email failed", e));
  }
  console.log(`[dd-webhook] order ${orderId} marked paid`);
}

async function releaseOrderReserves(
  supabase: any,
  orderId: string | undefined | null,
  reason: string,
) {
  if (!orderId) return;
  const { data: items } = await supabase
    .from("marketplace_order_items")
    .select("product_id, wholesaler_id, qty")
    .eq("order_id", orderId);
  for (const it of items ?? []) {
    if (!it.product_id || !it.wholesaler_id || !it.qty) continue;
    await supabase
      .rpc("release_marketplace_inventory", {
        p_product_id: it.product_id,
        p_wholesaler_id: it.wholesaler_id,
        p_qty: it.qty,
      })
      .catch((e: any) => console.error("[dd-webhook] release failed", e?.message));
  }
  await supabase
    .from("marketplace_orders")
    .update({
      payment_status: "failed",
      fulfillment_status: "cancelled",
      notes: `auto-cancelled: ${reason}`,
    })
    .eq("id", orderId)
    .neq("payment_status", "paid");
  console.log(`[dd-webhook] order ${orderId} reserves released (${reason})`);
}
