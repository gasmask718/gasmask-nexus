// Dynasty Direct — admin-initiated refund + order cancellation.
// Refunds the Stripe charge associated with the order's PaymentIntent and
// flips the order to a cancelled, non-fraud state.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey =
      Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "stripe_key_not_configured" }, 503);

    const { order_id, reason } = await req.json().catch(() => ({}));
    if (!order_id) return json({ error: "order_id required" }, 400);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: oErr } = await supabase
      .from("marketplace_orders")
      .select("id, stripe_payment_intent_id, payment_status, total, customer_email")
      .eq("id", order_id)
      .maybeSingle();
    if (oErr || !order) return json({ error: "order_not_found" }, 404);

    let refundId: string | null = null;
    const piId = order.stripe_payment_intent_id;
    if (piId && order.payment_status === "paid") {
      const refund = await stripe.refunds.create({
        payment_intent: piId.startsWith("pi_") ? piId : undefined,
        // If we stored a Checkout Session id (cs_...) instead of a PI, resolve it.
        ...(!piId.startsWith("pi_") && piId.startsWith("cs_")
          ? await (async () => {
              const session = await stripe.checkout.sessions.retrieve(piId);
              return { payment_intent: session.payment_intent as string };
            })()
          : {}),
        reason: "requested_by_customer",
        metadata: { order_id, dd_reason: reason ?? "fraud_review_cancelled" },
      });
      refundId = refund.id;
    }

    // ── money has moved ────────────────────────────────────────────────────
    // If this write is lost the order still reads "paid" and an admin can
    // refund a second time, so the failure has to be visible — but it must not
    // 500, because a retry of this endpoint would issue another refund.
    const { error: markErr } = await supabase
      .from("marketplace_orders")
      .update({
        payment_status: "refunded",
        fulfillment_status: "cancelled",
        fraud_review_flag: false,
        notes: `Refunded by admin: ${reason ?? "fraud_review_cancelled"}`,
      })
      .eq("id", order_id);
    if (markErr) {
      console.error(
        `[dd-refund-order] REFUND ISSUED (${refundId}) but order ${order_id} not marked refunded:`,
        markErr.message,
      );
      return json({
        success: true,
        refund_id: refundId,
        bookkeeping_error: `Refund succeeded but the order was not marked refunded (${markErr.message}). Do not refund again — fix the record manually.`,
      });
    }

    return json({ success: true, refund_id: refundId });
  } catch (err: any) {
    console.error("[dd-refund-order]", err);
    return json({ error: err?.message ?? "refund_failed" }, 500);
  }
});
