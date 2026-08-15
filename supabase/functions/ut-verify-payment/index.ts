import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { errText } from "../_shared/errText.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("ut_orders")
      .select("*")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Order not found");
    if (order.payment_status === "paid") {
      return new Response(JSON.stringify({ status: "already_paid", order }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.stripe_checkout_session_id) {
      throw new Error("No checkout session found for this order");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);

    if (session.payment_status === "paid") {
      const now = new Date().toISOString();

      // Order first, then the payment row. This function is polled and
      // early-returns on payment_status === 'paid', so failing here is safe:
      // the next poll repairs it. Returning {status:"paid"} over a failed
      // write is what made the client and the row disagree.
      const { error: orderUpdateErr } = await supabaseAdmin
        .from("ut_orders")
        .update({
          payment_status: "paid",
          order_status: "confirmed",
          stripe_payment_intent_id: session.payment_intent as string,
          paid_at: now,
          updated_at: now,
        })
        .eq("id", order.id);
      if (orderUpdateErr) throw new Error(`order paid-status write failed: ${errText(orderUpdateErr)}`);

      // Payment record — the row the revenue surface reads. Written only after
      // the order commits, so a retry hits the already_paid early return above
      // rather than double-inserting.
      const { error: paymentInsertErr } = await supabaseAdmin.from("ut_payments").insert({
        order_id: order.id,
        stripe_payment_intent_id: session.payment_intent as string,
        stripe_checkout_session_id: session.id,
        amount: (session.amount_total || 0) / 100,
        currency: session.currency || "usd",
        status: "completed",
        payment_method: "stripe_checkout",
        metadata: {
          customer_email: session.customer_details?.email,
          customer_name: session.customer_details?.name,
        },
      });
      if (paymentInsertErr) throw new Error(`payment record write failed for order ${order.id}: ${errText(paymentInsertErr)}`);

      // Derived state — the order is the truth. Log, do not fail.
      if (order.event_request_id) {
        const { error: reqErr } = await supabaseAdmin
          .from("ut_event_requests")
          .update({ status: "paid", updated_at: now })
          .eq("id", order.event_request_id);
        if (reqErr) console.error("ut-verify-payment event request status update failed:", errText(reqErr));
      }

      return new Response(JSON.stringify({ status: "paid", order_id: order.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: session.payment_status, order_id: order.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Full detail goes to the log; the response body stays short so a stack
    // never leaves the function.
    console.error("ut-verify-payment error:", errText(error));
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
