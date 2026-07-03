// Dynasty Clipper Nation — pay out a clipper's approved earnings via Stripe Connect transfer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_PAYOUT_CENTS = 5000; // $50

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const clipper_id: string | undefined = body.clipper_id;
    const amount_cents: number | undefined = body.amount_cents;

    if (!clipper_id) throw new Error("clipper_id required");
    if (typeof amount_cents !== "number" || !Number.isFinite(amount_cents)) {
      throw new Error("amount_cents required (number)");
    }
    if (amount_cents < MIN_PAYOUT_CENTS) {
      throw new Error(`Minimum payout is $${MIN_PAYOUT_CENTS / 100}`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // 1. Load clipper
    const { data: clipper, error: cErr } = await (supabase as any)
      .from("clipper_accounts")
      .select("id, stripe_connect_id, stripe_connect_onboarded")
      .eq("id", clipper_id)
      .maybeSingle();

    if (cErr || !clipper) throw new Error("Clipper not found");
    if (!clipper.stripe_connect_id) throw new Error("Clipper has not connected Stripe");
    if (!clipper.stripe_connect_onboarded) throw new Error("Clipper Stripe onboarding not complete");

    // 2. Verify balance
    const { data: earnings, error: eErr } = await (supabase as any)
      .from("clipper_earnings")
      .select("amount")
      .eq("clipper_id", clipper_id)
      .eq("status", "approved");

    if (eErr) throw eErr;
    const balanceDollars = (earnings ?? []).reduce(
      (s: number, r: any) => s + Number(r.amount || 0),
      0,
    );
    const balanceCents = Math.round(balanceDollars * 100);

    if (amount_cents > balanceCents) {
      throw new Error(
        `Insufficient balance. Available: $${(balanceCents / 100).toFixed(2)}`,
      );
    }

    // 3. Stripe transfer
    const transfer = await stripe.transfers.create({
      amount: amount_cents,
      currency: "usd",
      destination: clipper.stripe_connect_id,
      metadata: {
        clipper_id,
        platform: "dynasty_clipper_nation",
      },
    });

    // 4. Record payout
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const { error: pErr } = await (supabase as any).from("clipper_payouts").insert({
      clipper_id,
      amount: amount_cents / 100,
      stripe_transfer_id: transfer.id,
      period_start: monthStart,
      period_end: today,
      status: "paid",
      paid_at: now.toISOString(),
    });
    if (pErr) throw pErr;

    // 5. Mark earnings as paid
    const { error: uErr } = await (supabase as any)
      .from("clipper_earnings")
      .update({ status: "paid" })
      .eq("clipper_id", clipper_id)
      .eq("status", "approved");
    if (uErr) throw uErr;

    return new Response(
      JSON.stringify({ success: true, transfer_id: transfer.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[clipper-payout] error", e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message) }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
