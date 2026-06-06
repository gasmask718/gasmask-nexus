// DD Sprint 5 — Daily cron: release matured rolling reserves as transfers.
// Idempotent per reserve row.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "key_not_ready", released: 0 }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: due } = await supabase
    .from("dd_reserve_ledger")
    .select("id, wholesaler_id, order_id, amount_cents")
    .eq("status", "held")
    .lte("release_at", new Date().toISOString())
    .limit(500);

  let released = 0;
  const errors: any[] = [];

  for (const r of due ?? []) {
    const { data: ws } = await supabase
      .from("wholesaler_profiles")
      .select("stripe_connect_id, stripe_payouts_enabled")
      .eq("id", r.wholesaler_id)
      .maybeSingle();
    if (!ws?.stripe_connect_id || !ws.stripe_payouts_enabled) continue;
    try {
      const t = await stripe.transfers.create(
        {
          amount: r.amount_cents,
          currency: "usd",
          destination: ws.stripe_connect_id,
          transfer_group: r.order_id ? `order_${r.order_id}` : undefined,
          metadata: { dd_reserve_id: r.id, dd_order_id: r.order_id ?? "" },
        },
        { idempotencyKey: `dd_reserve_release_${r.id}` },
      );
      await supabase.from("dd_reserve_ledger").update({
        status: "released",
        released_at: new Date().toISOString(),
        released_transfer_id: t.id,
      }).eq("id", r.id);
      await supabase.from("dd_split_ledger").update({
        reserve_released_cents: r.amount_cents,
        updated_at: new Date().toISOString(),
      }).eq("fulfillment_id", (await supabase.from("dd_reserve_ledger").select("fulfillment_id").eq("id", r.id).maybeSingle()).data?.fulfillment_id);
      released++;
    } catch (e: any) {
      console.error("[dd-release-reserves] failed", r.id, e.message);
      errors.push({ id: r.id, error: e.message });
    }
  }

  return new Response(JSON.stringify({ released, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
