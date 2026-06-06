// DD Sprint 5 — Splits + Dispute webhook (separate from dd-stripe-webhook to
// keep current key-paid flow untouched). Handles:
//   payment_intent.succeeded → compute split per fulfillment, transfer to
//     each supplier, withhold rolling reserve, write dd_split_ledger and
//     dd_reserve_ledger rows.
//   charge.dispute.created → freeze splits, reverse supplier transfer,
//     assemble + (optionally) submit evidence kit, mark order disputed.
//   charge.dispute.closed → on loss, run clawback waterfall: current
//     balance → reserve → next payouts (recorded as recovery_steps).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret =
    Deno.env.get("DD_STRIPE_CONNECT_WEBHOOK_SECRET") ?? Deno.env.get("DD_STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: "Stripe Connect keys not configured", key_ready: false }),
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
    console.error("[dd-stripe-connect-webhook] sig verify failed", err.message);
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await processSplits(stripe, supabase, pi);
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(stripe, supabase, dispute, event);
        break;
      }
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeClosed(stripe, supabase, dispute, event);
        break;
      }
      case "account.updated": {
        const acct = event.data.object as Stripe.Account;
        await supabase
          .from("wholesaler_profiles")
          .update({
            stripe_payouts_enabled: !!acct.payouts_enabled,
            stripe_charges_enabled: !!acct.charges_enabled,
            stripe_connect_updated_at: new Date().toISOString(),
          })
          .eq("stripe_connect_id", acct.id);
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[dd-stripe-connect-webhook] error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ────────────────────────────────────────────────────────────────────────
// SPLIT ENGINE
// ────────────────────────────────────────────────────────────────────────
async function processSplits(
  stripe: Stripe,
  supabase: any,
  pi: Stripe.PaymentIntent,
) {
  const orderId = pi.metadata?.order_id;
  if (!orderId) return;

  const chargeId =
    typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge?.id ?? null;

  // Idempotency: skip if any ledger row already exists for this order
  const { data: existing } = await supabase
    .from("dd_split_ledger")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: fulfillments } = await supabase
    .from("marketplace_fulfillments")
    .select("id, wholesaler_id, items_snapshot")
    .eq("order_id", orderId);

  if (!fulfillments || fulfillments.length === 0) return;

  const cfg = await getConfig(supabase);

  for (const f of fulfillments) {
    const items = Array.isArray(f.items_snapshot) ? f.items_snapshot : [];
    let grossCents = 0;
    let weightedMargin = 0;
    let weightedQty = 0;

    for (const it of items) {
      const lineCents = Math.round(Number(it.price_each || 0) * Number(it.qty || 0) * 100);
      grossCents += lineCents;
      let m = cfg.default_margin_pct;
      if (it.product_id) {
        const { data: ovr } = await supabase
          .from("dd_product_margin_overrides")
          .select("margin_pct")
          .eq("product_id", it.product_id)
          .maybeSingle();
        if (ovr?.margin_pct != null) m = Number(ovr.margin_pct);
      }
      weightedMargin += m * lineCents;
      weightedQty += lineCents;
    }

    const { data: ws } = await supabase
      .from("wholesaler_profiles")
      .select("id, stripe_connect_id, stripe_payouts_enabled, margin_pct_override, reserve_pct")
      .eq("id", f.wholesaler_id)
      .maybeSingle();

    const marginPct = ws?.margin_pct_override != null
      ? Number(ws.margin_pct_override)
      : (weightedQty > 0 ? weightedMargin / weightedQty : cfg.default_margin_pct);
    const reservePct = Number(ws?.reserve_pct ?? cfg.default_reserve_pct);

    // Stripe fee allocated proportionally
    const stripeFeeCents = await getStripeFeeCents(stripe, chargeId, grossCents, pi.amount ?? 0);

    const ddMarginCents = Math.round(grossCents * (marginPct / 100));
    const netCents = Math.max(0, grossCents - stripeFeeCents - ddMarginCents);
    const reserveHeldCents = Math.round(netCents * (reservePct / 100));
    const supplierTransferCents = Math.max(0, netCents - reserveHeldCents);

    let transferId: string | null = null;
    let status: string = "pending";
    let notes: string | null = null;

    if (ws?.stripe_connect_id && ws.stripe_payouts_enabled && supplierTransferCents > 0) {
      try {
        const transfer = await stripe.transfers.create(
          {
            amount: supplierTransferCents,
            currency: "usd",
            destination: ws.stripe_connect_id,
            transfer_group: `order_${orderId}`,
            source_transaction: chargeId ?? undefined,
            metadata: {
              dd_fulfillment_id: f.id,
              dd_order_id: orderId,
              dd_wholesaler_id: ws.id,
            },
          },
          { idempotencyKey: `dd_transfer_${f.id}` },
        );
        transferId = transfer.id;
        status = "transferred";
      } catch (e: any) {
        console.error("[dd-stripe-connect-webhook] transfer failed", e.message);
        status = "transfer_failed";
        notes = e.message;
      }
    } else {
      status = "pending";
      notes = !ws?.stripe_connect_id
        ? "wholesaler not connected"
        : !ws.stripe_payouts_enabled
          ? "payouts not enabled"
          : "zero transfer";
    }

    await supabase.from("dd_split_ledger").insert({
      order_id: orderId,
      fulfillment_id: f.id,
      wholesaler_id: f.wholesaler_id,
      gross_amount_cents: grossCents,
      stripe_fee_cents: stripeFeeCents,
      dd_margin_cents: ddMarginCents,
      supplier_transfer_cents: supplierTransferCents,
      reserve_held_cents: reserveHeldCents,
      margin_pct_applied: marginPct,
      reserve_pct_applied: reservePct,
      stripe_transfer_id: transferId,
      stripe_charge_id: chargeId,
      status,
      notes,
    });

    if (reserveHeldCents > 0) {
      const releaseAt = new Date(Date.now() + cfg.reserve_hold_days * 86400_000);
      await supabase.from("dd_reserve_ledger").insert({
        wholesaler_id: f.wholesaler_id,
        order_id: orderId,
        fulfillment_id: f.id,
        amount_cents: reserveHeldCents,
        release_at: releaseAt.toISOString(),
        status: "held",
      });
    }
  }
}

async function getStripeFeeCents(
  stripe: Stripe,
  chargeId: string | null,
  fulfillmentGross: number,
  orderGross: number,
): Promise<number> {
  if (!chargeId || orderGross <= 0) return 0;
  try {
    const charge = await stripe.charges.retrieve(chargeId, {
      expand: ["balance_transaction"],
    });
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
    const totalFee = bt?.fee ?? 0;
    return Math.round((totalFee * fulfillmentGross) / orderGross);
  } catch {
    return 0;
  }
}

async function getConfig(supabase: any) {
  const { data } = await supabase
    .from("dd_config")
    .select("default_margin_pct, default_reserve_pct, reserve_hold_days, dispute_auto_submit")
    .eq("id", true)
    .maybeSingle();
  return {
    default_margin_pct: Number(data?.default_margin_pct ?? 15),
    default_reserve_pct: Number(data?.default_reserve_pct ?? 8),
    reserve_hold_days: Number(data?.reserve_hold_days ?? 45),
    dispute_auto_submit: !!data?.dispute_auto_submit,
  };
}

// ────────────────────────────────────────────────────────────────────────
// DISPUTE HANDLERS
// ────────────────────────────────────────────────────────────────────────
async function handleDisputeCreated(
  stripe: Stripe,
  supabase: any,
  dispute: Stripe.Dispute,
  event: Stripe.Event,
) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return;

  // Find the order via the split ledger or PI metadata
  let orderId: string | null = null;
  let splitRows: any[] = [];
  const { data: rows } = await supabase
    .from("dd_split_ledger")
    .select("*")
    .eq("stripe_charge_id", chargeId);
  if (rows && rows.length) {
    splitRows = rows;
    orderId = rows[0].order_id;
  } else {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      orderId = (charge.metadata?.order_id as string) ||
        (typeof charge.payment_intent === "string"
          ? (await stripe.paymentIntents.retrieve(charge.payment_intent)).metadata?.order_id ?? null
          : null);
    } catch {}
  }

  await supabase.from("marketplace_orders").update({
    dispute_status: dispute.status,
    dispute_reason: dispute.reason,
    dispute_opened_at: new Date().toISOString(),
  }).eq("id", orderId);

  // Freeze pending reserve releases for affected suppliers; reverse the
  // supplier transfer share.
  for (const row of splitRows) {
    await supabase
      .from("dd_reserve_ledger")
      .update({ status: "clawed_back", notes: `frozen by dispute ${dispute.id}` })
      .eq("fulfillment_id", row.fulfillment_id)
      .eq("status", "held");

    let reversedId: string | null = null;
    if (row.stripe_transfer_id) {
      try {
        const reversal = await stripe.transfers.createReversal(
          row.stripe_transfer_id,
          {
            amount: row.supplier_transfer_cents,
            metadata: { dispute_id: dispute.id, dd_order_id: row.order_id },
          },
          { idempotencyKey: `dd_dispute_rev_${row.id}` },
        );
        reversedId = reversal.id;
      } catch (e: any) {
        console.error("[dispute] reversal failed", e.message);
      }
    }
    await supabase.from("dd_split_ledger").update({
      status: "disputed",
      notes: `dispute ${dispute.id}; reversal ${reversedId ?? "none"}`,
    }).eq("id", row.id);
  }

  // Evidence kit assembly
  let evidence: any = {};
  if (orderId) {
    const { data: kit } = await supabase
      .from("dd_evidence_kit")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    const { data: fs } = await supabase
      .from("marketplace_fulfillments")
      .select("id, tracking_number, carrier, easypost_shipment_id, status, updated_at")
      .eq("order_id", orderId);
    evidence = {
      checkout_session_id: kit?.checkout_session_id,
      ip_address: kit?.ip_address,
      user_agent: kit?.user_agent,
      accepted_terms_at: kit?.accepted_terms_at,
      line_items: kit?.line_items_snapshot,
      fulfillments: fs,
      tracking_snapshot: kit?.tracking_snapshot,
    };
  }

  await supabase.from("dd_dispute_events").upsert(
    {
      stripe_dispute_id: dispute.id,
      stripe_charge_id: chargeId,
      order_id: orderId,
      wholesaler_id: splitRows[0]?.wholesaler_id ?? null,
      status: dispute.status,
      reason: dispute.reason,
      amount_cents: dispute.amount,
      reversed_transfer_id: splitRows[0]?.stripe_transfer_id ?? null,
      evidence_payload: evidence,
      raw_event: event as any,
    },
    { onConflict: "stripe_dispute_id" },
  );

  // Optional auto-submit
  const cfg = await getConfig(supabase);
  if (cfg.dispute_auto_submit) {
    try {
      await stripe.disputes.update(dispute.id, {
        evidence: {
          customer_communication: JSON.stringify(evidence).slice(0, 9000),
          shipping_tracking_number: evidence.fulfillments?.[0]?.tracking_number ?? undefined,
          shipping_carrier: evidence.fulfillments?.[0]?.carrier ?? undefined,
          customer_purchase_ip: evidence.ip_address ?? undefined,
        },
        submit: true,
      });
      await supabase.from("dd_dispute_events").update({
        evidence_submitted_at: new Date().toISOString(),
      }).eq("stripe_dispute_id", dispute.id);
    } catch (e: any) {
      console.error("[dispute] auto-submit failed", e.message);
    }
  }
}

async function handleDisputeClosed(
  stripe: Stripe,
  supabase: any,
  dispute: Stripe.Dispute,
  event: Stripe.Event,
) {
  const won = dispute.status === "won";
  const steps: any[] = [];

  if (won) {
    // Refund reserve clawback (return to held → release on schedule)
    const { data: reserves } = await supabase
      .from("dd_reserve_ledger")
      .select("id")
      .ilike("notes", `%${dispute.id}%`);
    for (const r of reserves || []) {
      await supabase.from("dd_reserve_ledger").update({ status: "held", notes: `restored: dispute ${dispute.id} won` }).eq("id", r.id);
      steps.push({ step: "reserve_restored", reserve_id: r.id });
    }
  } else if (dispute.status === "lost") {
    // Clawback waterfall: keep transfers reversed (already done at created),
    // mark reserves as clawed_back permanently, record next-payout debit.
    const { data: rows } = await supabase
      .from("dd_split_ledger")
      .select("id, wholesaler_id, fulfillment_id, supplier_transfer_cents, reserve_held_cents")
      .eq("stripe_charge_id", typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id);
    for (const r of rows || []) {
      steps.push({
        step: "transfer_reversal_confirmed",
        amount_cents: r.supplier_transfer_cents,
        wholesaler_id: r.wholesaler_id,
      });
      steps.push({
        step: "reserve_consumed",
        amount_cents: r.reserve_held_cents,
        wholesaler_id: r.wholesaler_id,
      });
      const remaining = dispute.amount - r.supplier_transfer_cents - r.reserve_held_cents;
      if (remaining > 0) {
        steps.push({
          step: "queue_next_payout_debit",
          amount_cents: remaining,
          wholesaler_id: r.wholesaler_id,
          note: "debit from next supplier payouts",
        });
      }
    }
  }

  await supabase.from("dd_dispute_events").update({
    status: dispute.status,
    recovery_steps: steps,
    raw_event: event as any,
    updated_at: new Date().toISOString(),
  }).eq("stripe_dispute_id", dispute.id);

  await supabase.from("marketplace_orders").update({
    dispute_status: dispute.status,
    dispute_resolved_at: new Date().toISOString(),
  }).eq("id", (await supabase.from("dd_dispute_events").select("order_id").eq("stripe_dispute_id", dispute.id).maybeSingle()).data?.order_id);
}
