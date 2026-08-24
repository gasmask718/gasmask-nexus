// DD Sprint 5 — Daily cron: release MATURED and ADMIN-APPROVED payout rows
// as Stripe transfers to the wholesaler's Connect account. Idempotent per row.
//
// MANUAL APPROVAL GATE (deliberate, 2026-08-24): a row only moves money when
// approved_at IS NOT NULL. dd_write_order_split writes every payout row with
// approval_required = true, so the first real money movement always has a
// human behind it. Flip a wholesaler to automatic only after the owner has
// watched a real order settle correctly.
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

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const singleId = typeof body.reserve_id === "string" ? body.reserve_id : null;

  let q = supabase
    .from("dd_reserve_ledger")
    .select("id, wholesaler_id, order_id, fulfillment_id, amount_cents, kind, approved_at")
    .eq("status", "held")
    .not("approved_at", "is", null)
    .lte("release_at", new Date().toISOString())
    .limit(500);
  if (singleId) q = supabase
    .from("dd_reserve_ledger")
    .select("id, wholesaler_id, order_id, fulfillment_id, amount_cents, kind, approved_at")
    .eq("id", singleId)
    .eq("status", "held")
    .not("approved_at", "is", null);

  const { data: due, error: dueErr } = await q;
  if (dueErr) {
    return new Response(JSON.stringify({ error: dueErr.message, released: 0 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let released = 0;
  let skipped_unapproved_or_not_due = 0;
  const errors: any[] = [];

  for (const r of due ?? []) {
    const { data: ws } = await supabase
      .from("wholesaler_profiles")
      .select("stripe_connect_id, stripe_payouts_enabled")
      .eq("id", r.wholesaler_id)
      .maybeSingle();
    if (!ws?.stripe_connect_id || !ws.stripe_payouts_enabled) {
      skipped_unapproved_or_not_due++;
      continue;
    }
    try {
      const t = await stripe.transfers.create(
        {
          amount: r.amount_cents,
          currency: "usd",
          destination: ws.stripe_connect_id,
          transfer_group: r.order_id ? `order_${r.order_id}` : undefined,
          metadata: { dd_reserve_id: r.id, dd_order_id: r.order_id ?? "", kind: r.kind ?? "" },
        },
        { idempotencyKey: `dd_reserve_release_${r.id}` },
      );
      await supabase.from("dd_reserve_ledger").update({
        status: "released",
        released_at: new Date().toISOString(),
        released_transfer_id: t.id,
      }).eq("id", r.id);

      if (r.fulfillment_id) {
        const { data: sl } = await supabase
          .from("dd_split_ledger")
          .select("id, reserve_released_cents")
          .eq("fulfillment_id", r.fulfillment_id)
          .maybeSingle();
        if (sl) {
          await supabase.from("dd_split_ledger").update({
            reserve_released_cents: (sl.reserve_released_cents ?? 0) + r.amount_cents,
            stripe_transfer_id: t.id,
            status: "released",
            updated_at: new Date().toISOString(),
          }).eq("id", sl.id);
        }
      }
      released++;
    } catch (e: any) {
      console.error("[dd-release-reserves] failed", r.id, e.message);
      errors.push({ id: r.id, error: e.message });
    }
  }

  return new Response(
    JSON.stringify({ released, skipped: skipped_unapproved_or_not_due, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
