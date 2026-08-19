// Dynasty Direct — daily auto-reorder runner.
// pg_cron triggers this once a day at 8am EST (13:00 UTC).
// For every active subscription whose next_order_date <= today:
//   1. Create a marketplace_orders + items rows priced from products_all
//      (flash-sale aware), reusing the saved card_on_file payment method.
//   2. Charge a Stripe PaymentIntent off-session against the user's default
//      payment method. On success, bump next_order_date by the cadence.
//      On failure, pause the subscription + send recovery SMS.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendSms as sendCanonicalSms } from "../_shared/sendSms.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUBLIC_ORIGIN = Deno.env.get("PUBLIC_SITE_ORIGIN") ?? "https://dynastydirect.com";

const CADENCE_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Group C (transactional). Auto-reorder receipts and payment-failure notices
// are consequences of the customer's own subscription.
async function sendSms(to: string, body: string, idemKey: string) {
  if (!to) return;
  const res = await sendCanonicalSms({
    to,
    body,
    sendClass: "transactional",
    purpose: "dd_subscription",
    idempotencyKey: `dd-sub-${idemKey}`,
    skipCooldown: true,
  });
  if (!res.success) {
    console.warn(`[dd-subscription-fulfillment] sms ${res.status}: ${res.errorMessage ?? res.status}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;

  let body: any = {};
  try { body = await req.json(); } catch { /* cron-triggered */ }
  const dryRun: boolean = !!body?.dry_run;

  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error: dueErr } = await supabase
    .from("dd_subscriptions")
    .select("*")
    .eq("status", "active")
    .lte("next_order_date", today);

  if (dueErr) return json({ error: dueErr.message }, 500);
  if (!due?.length) return json({ ok: true, processed: 0, due: 0 });

  const results: any[] = [];

  for (const sub of due) {
    const items: any[] = Array.isArray(sub.items) ? sub.items : [];
    if (items.length === 0) {
      results.push({ id: sub.id, skipped: "no_items" });
      continue;
    }

    try {
      // Price each item from products_all (flash-sale aware).
      const productIds = items.map((i) => i.product_id).filter(Boolean);
      const { data: prodRows } = await supabase
        .from("products_all")
        .select("id, product_name, retail_price, status")
        .in("id", productIds);
      const byId = new Map((prodRows ?? []).map((p: any) => [p.id, p]));

      const orderItems: any[] = [];
      let subtotalCents = 0;

      for (const it of items) {
        const p: any = byId.get(it.product_id);
        if (!p || p.status !== "active") throw new Error(`unavailable:${it.product_id}`);
        let unitCents = Math.round(Number(p.retail_price ?? 0) * 100);
        if (unitCents <= 0) throw new Error(`bad_price:${it.product_id}`);
        const { data: fs } = await supabase.rpc("dd_active_flash_sale_for_product", { p_product_id: it.product_id });
        const fsRow: any = Array.isArray(fs) ? fs[0] : fs;
        if (fsRow?.discount_pct) {
          unitCents = Math.max(0, Math.round(unitCents * (1 - Number(fsRow.discount_pct) / 100)));
        }
        const qty = Math.max(1, Number(it.qty ?? 1));
        subtotalCents += unitCents * qty;
        orderItems.push({ product_id: it.product_id, qty, price_each: unitCents / 100, product_name: p.product_name });
      }

      if (dryRun) {
        results.push({ id: sub.id, dry_run: true, subtotal: subtotalCents / 100, items: orderItems.length });
        continue;
      }

      // Create pending marketplace_order
      const { data: orderRow, error: oErr } = await supabase
        .from("marketplace_orders")
        .insert({
          user_id: sub.user_id,
          ordering_store_id: sub.store_account_id,
          order_type: "subscription",
          payment_status: "pending",
          fulfillment_status: "pending",
          subtotal: subtotalCents / 100,
          shipping_cost: 0,
          tax_amount: 0,
          total: subtotalCents / 100,
          shipping_address: sub.shipping_address ?? null,
          notes: `Auto-reorder: ${sub.name ?? "Subscription"}`,
        })
        .select("id")
        .single();
      if (oErr || !orderRow) throw oErr ?? new Error("order_insert_failed");
      const orderId = orderRow.id as string;

      await supabase.from("marketplace_order_items").insert(
        orderItems.map((oi) => ({
          order_id: orderId,
          product_id: oi.product_id,
          qty: oi.qty,
          price_each: oi.price_each,
        })),
      );

      // Charge via Stripe (off-session, default payment method).
      let chargeOk = false;
      let failMsg = "";
      if (stripe) {
        try {
          // Resolve Stripe customer by user email
          const { data: userRes } = await supabase.auth.admin.getUserById(sub.user_id);
          const email = userRes?.user?.email;
          if (!email) throw new Error("no_email");
          const customers = await stripe.customers.list({ email, limit: 1 });
          if (customers.data.length === 0) throw new Error("no_stripe_customer");
          const customerId = customers.data[0].id;
          const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
          if (pms.data.length === 0) throw new Error("no_payment_method");
          const intent = await stripe.paymentIntents.create({
            amount: subtotalCents,
            currency: "usd",
            customer: customerId,
            payment_method: pms.data[0].id,
            off_session: true,
            confirm: true,
            metadata: { order_id: orderId, source: "dd_subscription", subscription_id: sub.id },
          });
          await supabase.from("marketplace_orders").update({ stripe_payment_intent_id: intent.id }).eq("id", orderId);
          chargeOk = intent.status === "succeeded" || intent.status === "processing" || intent.status === "requires_capture";
          if (!chargeOk) failMsg = `intent_${intent.status}`;
        } catch (e: any) {
          failMsg = e?.message ?? "stripe_error";
        }
      } else {
        failMsg = "stripe_not_configured";
      }

      if (chargeOk) {
        const days = CADENCE_DAYS[sub.frequency] ?? 30;
        const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + days);
        await supabase.from("dd_subscriptions").update({
          last_order_id: orderId,
          last_order_date: today,
          orders_placed: (sub.orders_placed ?? 0) + 1,
          next_order_date: nextDate.toISOString().slice(0, 10),
          total_estimate: subtotalCents / 100,
          failure_reason: null,
        }).eq("id", sub.id);

        // Notify
        const { data: userRes2 } = await supabase.auth.admin.getUserById(sub.user_id);
        const phone = (userRes2?.user?.phone as string) || null;
        if (phone) {
          await sendSms(phone, `🔄 Auto-reorder placed! Your ${sub.name ?? "subscription"} order for $${(subtotalCents/100).toFixed(2)} is in. Order #${orderId.slice(0,8)}. View: ${PUBLIC_ORIGIN}/order/${orderId}`, `reorder-${orderId}`);
        }
        results.push({ id: sub.id, ok: true, order_id: orderId, amount: subtotalCents / 100 });
      } else {
        await supabase.from("dd_subscriptions").update({
          status: "paused",
          failure_reason: failMsg,
        }).eq("id", sub.id);
        await supabase.from("marketplace_orders").update({ payment_status: "failed" }).eq("id", orderId);
        const { data: userRes2 } = await supabase.auth.admin.getUserById(sub.user_id);
        const phone = (userRes2?.user?.phone as string) || null;
        if (phone) {
          await sendSms(phone, `⚠️ Auto-reorder failed (${failMsg}). Update your payment to resume: ${PUBLIC_ORIGIN}/store/dashboard`, `reorder-fail-${sub.id}-${new Date().toISOString().slice(0, 10)}`);
        }
        results.push({ id: sub.id, ok: false, order_id: orderId, reason: failMsg });
      }
    } catch (e: any) {
      await supabase.from("dd_subscriptions").update({
        status: "paused",
        failure_reason: e?.message ?? "unknown",
      }).eq("id", sub.id);
      results.push({ id: sub.id, ok: false, reason: e?.message });
    }
  }

  return json({ ok: true, processed: results.length, results });
});
