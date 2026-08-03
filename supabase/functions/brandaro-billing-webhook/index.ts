import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { syncClientMRR } from "../_shared/brandaroClient.ts";
import { recordRevenue } from "../_shared/brandaroRevenue.ts";

/**
 * brandaro-billing-webhook
 *
 * Public (verify_jwt = false). Stripe calls this directly.
 *
 * This is the ONGOING half of recurring revenue. brandaro-start-hosting-subscription
 * only ever fires once (at activation), so it can represent month 1 and nothing else.
 * This endpoint records months 2..N and keeps subscription status honest.
 *
 * Events handled:
 *   invoice.payment_succeeded      -> one ledger row per paid invoice (keyed on invoice id)
 *   invoice.payment_failed         -> mark subscription past_due, resync MRR
 *   customer.subscription.updated  -> sync status, next_billing_at, resync MRR
 *   customer.subscription.deleted  -> mark cancelled, resync MRR (run-rate drops)
 *
 * Contract (same as demo-stripe-webhook): ONLY signature failure returns non-200.
 * Everything after verification is best-effort so Stripe is never put into a retry loop
 * by our own downstream failures.
 *
 * This is a SEPARATE Stripe endpoint from demo-stripe-webhook and uses its own
 * signing secret (BRANDARO_BILLING_WEBHOOK_SECRET / _TEST), falling back to the
 * shared STRIPE_WEBHOOK_SECRET.
 */

function ok(body: unknown = { received: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const HANDLED = new Set([
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

Deno.serve(async (req) => {
  // ---------- 1. Signature verification (the ONLY hard failure) ----------
  const liveSecret =
    Deno.env.get("BRANDARO_BILLING_WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const testSecret = Deno.env.get("BRANDARO_BILLING_WEBHOOK_SECRET_TEST");
  const liveKey = Deno.env.get("STRIPE_SECRET_KEY");
  const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  const candidates = [
    { mode: "live", secret: liveSecret, key: liveKey },
    { mode: "test", secret: testSecret, key: testKey },
  ].filter((c) => c.secret && c.key) as { mode: string; secret: string; key: string }[];

  if (candidates.length === 0) {
    console.error("[brandaro-billing-webhook] no signing secret / stripe key configured");
    return new Response(JSON.stringify({ error: "webhook not configured" }), { status: 500 });
  }
  if (!sig) {
    return new Response(JSON.stringify({ error: "missing stripe-signature" }), { status: 400 });
  }

  let event: Stripe.Event | null = null;
  let lastErr = "";
  for (const c of candidates) {
    try {
      const stripe = new Stripe(c.key, { apiVersion: "2025-08-27.basil" });
      event = await stripe.webhooks.constructEventAsync(raw, sig, c.secret);
      console.log(`[brandaro-billing-webhook] signature verified in ${c.mode} mode`);
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  if (!event) {
    console.error("[brandaro-billing-webhook] signature verification failed:", lastErr);
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    return ok({ received: true, ignored: event.type });
  }

  // ---------- everything below is best-effort; always return 200 ----------
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    /** Look up our subscription row from a Stripe subscription id. */
    async function loadSub(stripeSubId: string | null) {
      if (!stripeSubId) return null;
      const { data } = await admin
        .from("brandaro_subscriptions")
        .select("id, client_id, monthly_fee, service_type, tier, status")
        .eq("stripe_subscription_id", stripeSubId)
        .maybeSingle();
      return data;
    }

    // ================= invoice.payment_succeeded =================
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const amount = (invoice.amount_paid ?? 0) / 100;

      const stripeSubId =
        typeof (invoice as unknown as { subscription?: unknown }).subscription === "string"
          ? (invoice as unknown as { subscription: string }).subscription
          : ((invoice as unknown as { subscription?: { id?: string } }).subscription?.id ??
            (invoice.lines?.data?.[0] as unknown as { subscription?: string })?.subscription ??
            null);

      if (!stripeSubId) {
        // One-off invoices are not part of the recurring pipeline.
        return ok({ received: true, skipped: "no subscription on invoice" });
      }

      const sub = await loadSub(stripeSubId);
      if (!sub) {
        console.warn(
          `[brandaro-billing-webhook] no brandaro_subscriptions row for ${stripeSubId}; ledger skipped`,
        );
        return ok({ received: true, skipped: "unknown subscription" });
      }

      // Ledger row for this invoice. The activation path already used the first
      // invoice id as its reference, so month 1 dedupes here automatically.
      const revenueType =
        sub.service_type === "hosting" ? "hosting_monthly" : `${sub.service_type}_monthly`;

      let clientName: string | null = null;
      if (sub.client_id) {
        const { data: c } = await admin
          .from("brandaro_clients")
          .select("business_name, industry")
          .eq("id", sub.client_id)
          .maybeSingle();
        clientName = c?.business_name ?? null;
        var clientIndustry: string | null = c?.industry ?? null;
      }

      const res = await recordRevenue(admin, {
        amount,
        revenue_type: revenueType,
        stripe_reference: invoice.id!,
        source: "stripe_invoice",
        client_id: sub.client_id,
        subscription_id: sub.id,
        description: clientName ? `${clientName} — ${revenueType.replace(/_/g, " ")}` : revenueType,
        industry: typeof clientIndustry === "undefined" ? null : clientIndustry,
        occurred_at: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
      });

      // A successful payment clears past_due.
      const periodEnd = (invoice as unknown as { period_end?: number }).period_end ?? null;
      await admin
        .from("brandaro_subscriptions")
        .update({
          status: "active",
          next_billing_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      if (sub.client_id) await syncClientMRR(admin, sub.client_id);

      return ok({ received: true, recorded: res.recorded, duplicate: res.duplicate });
    }

    // ================= invoice.payment_failed =================
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubId =
        typeof (invoice as unknown as { subscription?: unknown }).subscription === "string"
          ? (invoice as unknown as { subscription: string }).subscription
          : null;
      const sub = await loadSub(stripeSubId);
      if (!sub) return ok({ received: true, skipped: "unknown subscription" });

      await admin
        .from("brandaro_subscriptions")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("id", sub.id);
      if (sub.client_id) await syncClientMRR(admin, sub.client_id);

      return ok({ received: true, marked: "past_due" });
    }

    // ============ customer.subscription.updated / deleted ============
    const stripeSub = event.data.object as Stripe.Subscription;
    const sub = await loadSub(stripeSub.id);
    if (!sub) return ok({ received: true, skipped: "unknown subscription" });

    // brandaro_subscriptions.status CHECK allows:
    // pending | active | paused | cancelled | past_due
    const statusMap: Record<string, string> = {
      active: "active",
      trialing: "active",
      past_due: "past_due",
      unpaid: "past_due",
      paused: "paused",
      canceled: "cancelled",
      incomplete: "pending",
      incomplete_expired: "cancelled",
    };
    const mapped =
      event.type === "customer.subscription.deleted"
        ? "cancelled"
        : (statusMap[stripeSub.status] ?? "pending");

    const periodEnd = (stripeSub as unknown as { current_period_end?: number }).current_period_end;

    await admin
      .from("brandaro_subscriptions")
      .update({
        status: mapped,
        cancelled_at: mapped === "cancelled" ? new Date().toISOString() : null,
        next_billing_at:
          mapped === "cancelled" || !periodEnd ? null : new Date(periodEnd * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    // Cancellation must drop the run-rate immediately.
    if (sub.client_id) await syncClientMRR(admin, sub.client_id);

    return ok({ received: true, status: mapped });
  } catch (err) {
    console.error(
      "[brandaro-billing-webhook] unhandled post-verification error:",
      err instanceof Error ? err.message : err,
    );
    return ok({ received: true, error_logged: true });
  }
});
