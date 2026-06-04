// Dynasty Direct — Stripe webhook.
// Verifies signature, marks order paid, fires order-confirmation email.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
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

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("[dd-webhook] signature verify failed", err.message);
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (!orderId) return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });

      const { data: existing } = await supabase
        .from("marketplace_orders")
        .select("payment_status, customer_email")
        .eq("id", orderId)
        .single();
      if (existing?.payment_status === "paid") {
        return new Response(JSON.stringify({ received: true, already_paid: true }), { headers: corsHeaders });
      }

      await supabase
        .from("marketplace_orders")
        .update({
          payment_status: "paid",
          fulfillment_status: "processing",
          stripe_payment_intent_id: (session.payment_intent as string) || session.id,
        })
        .eq("id", orderId);

      const email = existing?.customer_email || session.customer_details?.email;
      if (email) {
        await supabase.functions
          .invoke("dd-send-email", {
            body: {
              template: "order-confirmation",
              to: email,
              data: { order_id: orderId, amount_total: (session.amount_total ?? 0) / 100 },
            },
          })
          .catch((e) => console.error("[dd-webhook] email failed", e));
      }
      console.log(`[dd-webhook] order ${orderId} marked paid`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[dd-webhook] error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
