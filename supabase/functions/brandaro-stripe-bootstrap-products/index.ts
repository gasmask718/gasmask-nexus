import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * brandaro-stripe-bootstrap-products
 *
 * One-off / idempotent setup helper. Creates the three Brandaro website tiers
 * as Stripe products + one-time prices in the requested mode, then records the
 * resulting product/price IDs in public.brandaro_stripe_config so runtime code
 * never needs a secret slot per price.
 *
 * INPUT: { mode?: "test" | "live" }   (default: "test")
 * Live mode requires STRIPE_SECRET_KEY; test mode requires STRIPE_SECRET_KEY_TEST.
 *
 * Idempotent: if a config row for (mode, tier) already has a price_id, it is
 * reused and nothing new is created in Stripe.
 */

const TIERS = [
  { tier: "starter", name: "Brandaro Website — Starter", amount_cents: 49900 },
  { tier: "pro", name: "Brandaro Website — Pro", amount_cents: 99900 },
  { tier: "custom", name: "Brandaro Website — Custom", amount_cents: 249900 },
] as const;

// Step 16: a SINGLE flat monthly hosting price shared by every tier.
export const HOSTING = {
  tier: "hosting",
  name: "Brandaro Hosting & Maintenance",
  amount_cents: 9900,
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "live" ? "live" : "test";

    const key = mode === "live"
      ? Deno.env.get("STRIPE_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY_TEST");
    if (!key) return json({ error: `Missing Stripe secret key for ${mode} mode` }, 500);
    if (mode === "test" && !key.startsWith("sk_test_")) {
      return json({ error: "STRIPE_SECRET_KEY_TEST is not a test-mode key (expected sk_test_)" }, 500);
    }

    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: existingRows, error: readErr } = await supabase
      .from("brandaro_stripe_config")
      .select("tier, product_id, price_id, amount_cents")
      .eq("mode", mode);
    if (readErr) return json({ error: `Config read failed: ${readErr.message}` }, 500);

    const existing = new Map((existingRows ?? []).map((r: any) => [r.tier, r]));
    const results: Record<string, unknown>[] = [];

    for (const t of TIERS) {
      const prior = existing.get(t.tier);
      if (prior?.price_id && prior?.amount_cents === t.amount_cents) {
        results.push({ tier: t.tier, status: "reused", price_id: prior.price_id });
        continue;
      }

      const product = prior?.product_id
        ? await stripe.products.retrieve(prior.product_id)
        : await stripe.products.create({
            name: t.name,
            description: `Brandaro custom website build — ${t.tier} tier`,
            metadata: { brandaro_tier: t.tier, mode },
          });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: t.amount_cents,
        currency: "usd",
        metadata: { brandaro_tier: t.tier, mode },
      });

      const { error: upErr } = await supabase
        .from("brandaro_stripe_config")
        .upsert(
          {
            mode,
            tier: t.tier,
            product_id: product.id,
            price_id: price.id,
            amount_cents: t.amount_cents,
            currency: "usd",
          },
          { onConflict: "mode,tier" },
        );
      if (upErr) return json({ error: `Config write failed for ${t.tier}: ${upErr.message}` }, 500);

      results.push({ tier: t.tier, status: "created", product_id: product.id, price_id: price.id });
    }

    // --- recurring hosting price (Step 16) -------------------------------
    // ONE flat rate for all tiers ($99/mo), stored as a single config row
    // under tier "hosting". Same idempotency rule as the one-time prices.
    const priorHosting = existing.get(HOSTING.tier);
    if (priorHosting?.price_id && priorHosting?.amount_cents === HOSTING.amount_cents) {
      results.push({ tier: HOSTING.tier, status: "reused", price_id: priorHosting.price_id });
    } else {
      const hostingProduct = priorHosting?.product_id
        ? await stripe.products.retrieve(priorHosting.product_id)
        : await stripe.products.create({
            name: HOSTING.name,
            description: "Brandaro monthly website hosting & maintenance",
            metadata: { brandaro_tier: HOSTING.tier, mode },
          });

      const hostingPrice = await stripe.prices.create({
        product: hostingProduct.id,
        unit_amount: HOSTING.amount_cents,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { brandaro_tier: HOSTING.tier, mode },
      });

      const { error: hostErr } = await supabase
        .from("brandaro_stripe_config")
        .upsert(
          {
            mode,
            tier: HOSTING.tier,
            product_id: hostingProduct.id,
            price_id: hostingPrice.id,
            amount_cents: HOSTING.amount_cents,
            currency: "usd",
          },
          { onConflict: "mode,tier" },
        );
      if (hostErr) return json({ error: `Config write failed for hosting: ${hostErr.message}` }, 500);

      results.push({
        tier: HOSTING.tier,
        status: "created",
        product_id: hostingProduct.id,
        price_id: hostingPrice.id,
      });
    }

    return json({ mode, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[brandaro-stripe-bootstrap-products]", message);
    return json({ error: message }, 500);
  }
});
