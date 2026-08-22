// tt-release-expired-auths
// Cron-driven sweeper for the auth-then-capture flow (slingshot/jetski/helicopter).
//
// For every booking still holding a Stripe PaymentIntent authorization where either
//   (a) auth_expires_at has passed, OR
//   (b) every dispatch attached to the booking has been declined,
// cancel the PaymentIntent (release the hold), mark the booking 'unavailable',
// and SMS the customer that no provider was available and their card was not charged.
//
// Also surfaces "stale" holds (>5 days old, still 'hold_placed') as internal alerts
// so ops captures or releases before Stripe's ~7-day auth limit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms } from "../_shared/sendSms.ts";
import { recordDispatchSuppressed } from "../_shared/dispatchOutcome.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function cancelPI(stripeKey: string, pi: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const json: any = await res.json().catch(() => ({}));
    if (res.ok && (json.status === "canceled" || json.status === "requires_payment_method")) {
      return { ok: true, status: json.status };
    }
    // Already canceled or already captured — treat as terminal so we can move on.
    if (json?.error?.code === "payment_intent_unexpected_state") {
      return { ok: true, status: json?.error?.payment_intent?.status };
    }
    return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// Group C (transactional): "no provider found, card not charged" notice to
// the booking's own customer, sent to the number captured on that booking.
// Routes through send-sms (suppression + idempotency + outbound_messages row).
async function smsCustomer(supabase: any, bk: any, body: string, idemKey: string) {
  if (!bk.client_phone) return { skipped: true, blocked: false };
  const res = await sendSms({
    to: bk.client_phone,
    body,
    sendClass: "transactional",
    purpose: "tt_auth_released",
    idempotencyKey: idemKey,
    from: Deno.env.get("TT_PHONE_NUMBER"),
    skipCooldown: true,
    metadata: { booking_reference: bk.booking_reference },
  });
  if (res.blocked) {
    // Suppression-skipped, made visible — not an alert, a queryable row.
    await recordDispatchSuppressed(supabase, {
      bookingId: bk.id,
      bookingReference: bk.booking_reference,
      recipientPhone: bk.client_phone,
      recipientName: "customer",
      sendClass: "transactional",
      reason: res.errorMessage || res.status,
    });
  } else if (!res.success) {
    console.error("[tt-release-expired-auths] customer SMS failed:", res.status, res.errorMessage);
  }
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const summary = { released: 0, skipped: 0, errored: 0, stale_alerted: 0, customer_sms_blocked: 0 };

  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Candidates for release: hold_placed AND auth_expires_at past.
    const nowIso = new Date().toISOString();
    const { data: expired } = await supabase
      .from("tt_bookings")
      .select("id, booking_reference, stripe_payment_intent_id, client_phone, service_name, scheduled_at, auth_expires_at")
      .eq("payment_hold_status", "hold_placed")
      .lt("auth_expires_at", nowIso)
      .limit(200);

    for (const bk of (expired ?? [])) {
      if (!bk.stripe_payment_intent_id) { summary.skipped++; continue; }
      const r = await cancelPI(stripeKey, bk.stripe_payment_intent_id);
      if (!r.ok) {
        summary.errored++;
        await supabase.from("tt_notifications_log").insert({
          booking_id: bk.id, type: "auth_release_failed", channel: "internal",
          recipient: "admin", status: "sent",
          message: `Auth release FAILED for ${bk.booking_reference} (PI ${bk.stripe_payment_intent_id}): ${r.error}`,
        });
        continue;
      }
      await supabase.from("tt_bookings").update({
        status: "unavailable",
        payment_status: "released",
        payment_hold_status: "released",
      }).eq("id", bk.id);
      await supabase.from("tt_notifications_log").insert({
        booking_id: bk.id, type: "auth_released", channel: "internal",
        recipient: "system", status: "sent",
        message: `Released auth for ${bk.booking_reference} (PI ${bk.stripe_payment_intent_id}) — no partner accepted within window.`,
      });
      if (bk.client_phone) {
        const smsRes: any = await smsCustomer(
          supabase,
          bk,
          `TopTier: We couldn't confirm a provider for your ${bk.service_name || "booking"} ${bk.scheduled_at ? "on " + new Date(bk.scheduled_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : ""}. Your card was not charged. Ref ${bk.booking_reference}.`,
          `tt-auth-release-${bk.id}`,
        );
        if (smsRes?.blocked) summary.customer_sms_blocked++;
      }
      summary.released++;
    }

    // 2. Candidates by "all-declined" (window may not be over but everyone said no).
    // Best-effort: pull bookings still held whose every dispatch_request row is in declined/expired/cancelled.
    const { data: stillHeld } = await supabase
      .from("tt_bookings")
      .select("id, booking_reference, stripe_payment_intent_id, client_phone, service_name, scheduled_at")
      .eq("payment_hold_status", "hold_placed")
      .limit(200);

    for (const bk of (stillHeld ?? [])) {
      if (!bk.stripe_payment_intent_id) continue;
      const { data: drs } = await supabase
        .from("tt_dispatch_requests")
        .select("status")
        .eq("booking_id", bk.id);
      if (!drs || drs.length === 0) continue;
      const allDead = drs.every((d: any) => ["declined", "expired", "cancelled", "canceled"].includes(d.status));
      if (!allDead) continue;
      const r = await cancelPI(stripeKey, bk.stripe_payment_intent_id);
      if (!r.ok) { summary.errored++; continue; }
      await supabase.from("tt_bookings").update({
        status: "unavailable",
        payment_status: "released",
        payment_hold_status: "released",
      }).eq("id", bk.id);
      await supabase.from("tt_notifications_log").insert({
        booking_id: bk.id, type: "auth_released_all_declined", channel: "internal",
        recipient: "system", status: "sent",
        message: `Released auth for ${bk.booking_reference} — all partners declined.`,
      });
      if (bk.client_phone) {
        const smsRes: any = await smsCustomer(
          supabase,
          bk,
          `TopTier: We couldn't secure a provider for ${bk.booking_reference}. Your card was not charged.`,
          `tt-auth-release-declined-${bk.id}`,
        );
        if (smsRes?.blocked) summary.customer_sms_blocked++;
      }
      summary.released++;
    }

    // 3. Stale-hold warnings (>5 days, Stripe auths die at ~7).
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60_000).toISOString();
    const { data: stale } = await supabase
      .from("tt_bookings")
      .select("id, booking_reference, stripe_payment_intent_id, created_at")
      .eq("payment_hold_status", "hold_placed")
      .lt("created_at", fiveDaysAgo)
      .limit(100);
    for (const bk of (stale ?? [])) {
      // dedupe: only alert once per day per booking
      const { data: existing } = await supabase
        .from("tt_notifications_log")
        .select("id")
        .eq("booking_id", bk.id)
        .eq("type", "auth_stale_warning")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
        .limit(1);
      if (existing && existing.length > 0) continue;
      await supabase.from("tt_notifications_log").insert({
        booking_id: bk.id, type: "auth_stale_warning", channel: "internal",
        recipient: "admin", status: "sent",
        message: `Stripe auth on ${bk.booking_reference} (PI ${bk.stripe_payment_intent_id}) is >5 days old — capture or release within 48h before Stripe expires it.`,
      });
      summary.stale_alerted++;
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("tt-release-expired-auths error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err), summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
