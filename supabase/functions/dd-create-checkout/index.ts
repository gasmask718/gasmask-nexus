// Dynasty Direct — Stripe Checkout creator.
// Key-ready: requires STRIPE_SECRET_KEY. Stripe Tax automatically enabled.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY not configured yet", key_ready: false }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { order_id, customer_email } = await req.json();
    if (!order_id) throw new Error("order_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: order, error: oErr } = await supabase
      .from("marketplace_orders")
      .select("id, total, subtotal, shipping_cost, tax_amount, customer_email, payment_status")
      .eq("id", order_id)
      .single();
    if (oErr || !order) throw new Error("Order not found");
    if (order.payment_status === "paid") {
      return new Response(JSON.stringify({ error: "Order already paid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FIX: correct column names (qty, price_each) + join product_name
    const { data: items } = await supabase
      .from("marketplace_order_items")
      .select("qty, price_each, product:products_all(product_name)")
      .eq("order_id", order_id);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const lineItems = (items ?? []).map((it: any) => ({
      price_data: {
        currency: "usd",
        product_data: { name: it.product?.product_name ?? "Dynasty Direct item" },
        unit_amount: Math.round(Number(it.price_each) * 100),
        tax_behavior: "exclusive" as const,
      },
      quantity: it.qty ?? 1,
    }));

    if (Number(order.shipping_cost) > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Shipping" },
          unit_amount: Math.round(Number(order.shipping_cost) * 100),
          tax_behavior: "exclusive" as const,
        },
        quantity: 1,
      });
    }

    if (lineItems.length === 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: `Dynasty Direct Order ${order.id.slice(0, 8)}` },
          unit_amount: Math.round(Number(order.total) * 100),
          tax_behavior: "exclusive" as const,
        },
        quantity: 1,
      });
    }

    const origin = req.headers.get("origin") || "https://gasmask-os-nexus.lovable.app";
    const email = customer_email || order.customer_email || undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: email,
      automatic_tax: { enabled: true },
      success_url: `${origin}/order/${order.id}?paid=true`,
      cancel_url: `${origin}/order/${order.id}?cancelled=true`,
      metadata: { order_id: order.id, source: "dynasty_direct" },
    });

    await supabase
      .from("marketplace_orders")
      .update({ stripe_payment_intent_id: session.id })
      .eq("id", order.id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[dd-create-checkout]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
