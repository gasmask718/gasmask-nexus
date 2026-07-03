// Dynasty Clipper Nation — record a confirmed conversion.
// POST /functions/v1/record-conversion
// { tracking_code, order_value, stripe_payment_id, brand }
//
// Matches the most recent click for the tracking code, calculates commission
// from the campaign's rate, updates the conversion row, inserts a
// clipper_earnings row (approved), and updates clipper_accounts.total_earnings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = await req.json().catch(() => ({}));
    const tracking_code: string | undefined = body.tracking_code;
    const order_value_raw = body.order_value;
    const stripe_payment_id: string | undefined = body.stripe_payment_id;
    const brand: string | undefined = body.brand;

    if (!tracking_code || typeof tracking_code !== "string") {
      return json(400, { error: "tracking_code required" });
    }
    if (!/^[a-f0-9]{4,64}$/i.test(tracking_code)) {
      return json(400, { error: "invalid tracking_code" });
    }
    const order_value = Number(order_value_raw);
    if (!Number.isFinite(order_value) || order_value <= 0) {
      return json(400, { error: "order_value must be a positive number" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Find the most recent matching click.
    const { data: convs, error: cErr } = await (supabase as any)
      .from("clipper_conversions")
      .select("id, clipper_id, campaign_id, tracking_link, converted_at")
      .ilike("tracking_link", `%/${tracking_code}`)
      .order("converted_at", { ascending: false })
      .limit(1);

    if (cErr) {
      console.error("[record-conversion] lookup error", cErr);
      return json(500, { error: cErr.message });
    }

    const conversion = convs?.[0];
    if (!conversion) return json(404, { error: "no matching click for tracking_code" });

    // 2. Fetch campaign commission rate.
    const { data: campaign, error: kErr } = await (supabase as any)
      .from("clipper_campaigns")
      .select("id, commission_rate")
      .eq("id", conversion.campaign_id)
      .maybeSingle();

    if (kErr || !campaign) return json(404, { error: "campaign not found" });

    const rate = Number(campaign.commission_rate ?? 0);
    const commission_amount = Math.round(order_value * (rate / 100) * 100) / 100;

    // 3. Update the conversion row.
    const { error: uErr } = await (supabase as any)
      .from("clipper_conversions")
      .update({
        order_value,
        commission_amount,
        stripe_payment_id: stripe_payment_id ?? null,
      })
      .eq("id", conversion.id);
    if (uErr) {
      console.error("[record-conversion] update error", uErr);
      return json(500, { error: uErr.message });
    }

    // 4. Insert earnings row.
    const { error: eErr } = await (supabase as any)
      .from("clipper_earnings")
      .insert({
        clipper_id: conversion.clipper_id,
        campaign_id: conversion.campaign_id,
        submission_id: null,
        earning_type: "conversion",
        amount: commission_amount,
        status: "approved",
      });
    if (eErr) {
      console.error("[record-conversion] earnings insert error", eErr);
      return json(500, { error: eErr.message });
    }

    // 5. Bump clipper_accounts.total_earnings.
    const { data: clipper } = await (supabase as any)
      .from("clipper_accounts")
      .select("total_earnings")
      .eq("id", conversion.clipper_id)
      .maybeSingle();

    const newTotal =
      Number(clipper?.total_earnings ?? 0) + commission_amount;

    const { error: pErr } = await (supabase as any)
      .from("clipper_accounts")
      .update({ total_earnings: newTotal })
      .eq("id", conversion.clipper_id);
    if (pErr) console.error("[record-conversion] account update error", pErr);

    return json(200, {
      success: true,
      amount: commission_amount,
      brand: brand ?? null,
    });
  } catch (e) {
    console.error("[record-conversion] fatal", e);
    return json(500, { error: String((e as Error).message) });
  }
});
