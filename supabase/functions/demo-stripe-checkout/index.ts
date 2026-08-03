import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * demo-stripe-checkout
 *
 * Public (verify_jwt = false) — called when a PROSPECT clicks "Get This Site"
 * on their generated demo page. Not logged in.
 *
 * INPUT:  { demo_id, tier, customer_email?, customer_name? }
 * OUTPUT: { checkout_url }
 *
 * NOTE: separate from brandaro-create-checkout / brandaro-create-payment-link,
 * which serve the rep-driven pipeline close. Do not merge them.
 */

const VALID_TIERS = ["starter", "pro", "custom"] as const;


/**
 * Mode resolution (SAFE BY DEFAULT):
 *   1. explicit body.mode ("test" | "live")
 *   2. env STRIPE_MODE ("live" to go live)
 *   3. fallback → "test"
 * Nothing charges a real card unless mode resolves to "live".
 */
function resolveMode(bodyMode: unknown): "test" | "live" {
  if (bodyMode === "live" || bodyMode === "test") return bodyMode;
  return Deno.env.get("STRIPE_MODE") === "live" ? "live" : "test";
}


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const demo_id = typeof body.demo_id === "string" ? body.demo_id.trim() : "";
    const tier = typeof body.tier === "string" ? body.tier.trim().toLowerCase() : "";
    const customer_email =
      typeof body.customer_email === "string" && body.customer_email.includes("@")
        ? body.customer_email.trim()
        : undefined;
    const customer_name =
      typeof body.customer_name === "string" ? body.customer_name.trim() : undefined;

    // --- validation ---------------------------------------------------
    if (!demo_id) {
      return json({ error: "demo_id is required" }, 400);
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(demo_id)) {
      return json({ error: "demo_id must be a valid UUID" }, 400);
    }
    if (!VALID_TIERS.includes(tier as any)) {
      return json(
        { error: `tier must be one of: starter, pro, custom (received: ${tier || "none"})` },
        400,
      );
    }

    const mode = resolveMode(body.mode);
    const stripeKey = mode === "live"
      ? Deno.env.get("STRIPE_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY_TEST");
    if (!stripeKey) {
      return json({ error: `Stripe key not configured for ${mode} mode` }, 500);
    }
    if (mode === "test" && !stripeKey.startsWith("sk_test_")) {
      return json({ error: "Test mode requires a sk_test_ key" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Price IDs are stored per (mode, tier) in brandaro_stripe_config.
    const { data: priceRow } = await supabase
      .from("brandaro_stripe_config")
      .select("price_id")
      .eq("mode", mode)
      .eq("tier", tier)
      .maybeSingle();

    const priceId = priceRow?.price_id;

    if (!priceId) {
      console.error(`[demo-stripe-checkout] no price_id for ${mode}/${tier}`);
      return json({ error: `Pricing not configured for tier "${tier}" in ${mode} mode` }, 500);
    }

    // --- look up the demo ----------------------------------------------


    const { data: demo, error: demoError } = await supabase
      .from("brandaro_demo_sites")
      .select("id, business_name, demo_url, generation_status, paid_at")
      .eq("id", demo_id)
      .maybeSingle();

    if (demoError) {
      console.error("[demo-stripe-checkout] demo lookup failed", demoError);
      return json({ error: "Failed to look up demo" }, 500);
    }
    if (!demo) {
      return json({ error: `No demo found for demo_id ${demo_id}` }, 400);
    }
    if (!demo.business_name) {
      return json({ error: "Demo is incomplete (no business_name)" }, 400);
    }
    if (demo.generation_status === "failed") {
      return json({ error: "This demo did not generate successfully" }, 400);
    }
    if (demo.paid_at) {
      return json({ error: "This demo has already been purchased" }, 400);
    }

    // --- create checkout session ---------------------------------------
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const successUrl =
      `https://brandarodigital.com/thanks?demo_id=${encodeURIComponent(demo_id)}` +
      `&session={CHECKOUT_SESSION_ID}`;
    const cancelUrl = demo.demo_url || "https://brandarodigital.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email,
      metadata: {
        demo_id,
        tier,
        business_name: demo.business_name,
        stripe_mode: mode,
        ...(customer_name ? { customer_name } : {}),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log(
      `[demo-stripe-checkout] mode=${mode} demo=${demo_id} tier=${tier} session=${session.id}`,
    );

    return json({ checkout_url: session.url, mode });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[demo-stripe-checkout] error", message);
    return json({ error: message }, 500);
  }
});
