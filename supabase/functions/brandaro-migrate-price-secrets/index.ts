import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * brandaro-migrate-price-secrets  (one-shot maintenance)
 *
 * Copies the legacy live-mode Stripe price IDs out of the secret slots
 * (STRIPE_PRICE_STARTER / _PRO / _CUSTOM) into brandaro_stripe_config so the
 * secret slots can be freed. Price IDs are not sensitive.
 *
 * Safe to re-run: upserts on (mode, tier).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const map: Record<string, string> = {
    starter: "STRIPE_PRICE_STARTER",
    pro: "STRIPE_PRICE_PRO",
    custom: "STRIPE_PRICE_CUSTOM",
  };

  const results: Record<string, string> = {};

  for (const [tier, envName] of Object.entries(map)) {
    const price_id = Deno.env.get(envName)?.trim();
    if (!price_id) {
      results[tier] = "missing-secret";
      continue;
    }
    if (!price_id.startsWith("price_")) {
      results[tier] = `unexpected-format:${price_id.slice(0, 6)}`;
      continue;
    }
    const { error } = await supabase
      .from("brandaro_stripe_config")
      .upsert({ mode: "live", tier, price_id }, { onConflict: "mode,tier" });
    results[tier] = error ? `error:${error.message}` : `ok:${price_id}`;
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
