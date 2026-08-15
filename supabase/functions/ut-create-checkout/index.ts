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

    // Fetch the order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("ut_orders")
      .select("*")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Order not found");
    if (order.payment_status === "paid") throw new Error("Order already paid");

    // Fetch customer info if available
    let customerEmail: string | undefined;
    let customerName = "Event Customer";
    if (order.customer_id) {
      const { data: customer } = await supabaseAdmin
        .from("ut_customers")
        .select("name, email")
        .eq("id", order.customer_id)
        .single();
      if (customer) {
        customerEmail = customer.email || undefined;
        customerName = customer.name || customerName;
      }
    }

    // Fetch event info for description
    let eventDesc = "Unforgettable Times Event Package";
    if (order.event_request_id) {
      const { data: event } = await supabaseAdmin
        .from("ut_event_requests")
        .select("event_type, customer_name, location_city")
        .eq("id", order.event_request_id)
        .single();
      if (event) {
        eventDesc = `${event.event_type?.replace(/_/g, " ")} event for ${event.customer_name}${event.location_city ? ` in ${event.location_city}` : ""}`;
      }
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    let customerId: string | undefined;
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const totalCents = Math.round((order.total_price || 0) * 100);
    if (totalCents <= 0) throw new Error("Order total must be greater than 0");

    const origin = req.headers.get("origin") || "https://gasmask-os-nexus.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `UT Order ${order.order_number}`,
              description: eventDesc,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        order_id: order.id,
        order_number: order.order_number || "",
        customer_name: customerName,
      },
      success_url: `${origin}/os/unforgettable/events?payment=success&order_id=${order.id}`,
      cancel_url: `${origin}/os/unforgettable/events?payment=cancelled&order_id=${order.id}`,
    });

    // Store checkout session ID on the order
    await supabaseAdmin
      .from("ut_orders")
      .update({
        stripe_checkout_session_id: session.id,
        payment_status: "checkout_started",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Full detail goes to the log; the response body stays short so a stack
    // never leaves the function.
    console.error("ut-create-checkout error:", errText(error));
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
