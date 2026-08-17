// Dynasty Direct — primary Stripe webhook (non-Connect events).
// Verifies signature, marks orders paid, handles express-pay PaymentIntent
// lifecycle, releases inventory on cancel/failure, and fires the
// order-confirmation email. Event-id idempotent via dd_webhook_events.
//
// Connect/split events live in dd-stripe-connect-webhook; that function keys
// off pi.metadata.order_id and will fire its split engine for both hosted
// (checkout.session.completed → PaymentIntent) and express orders identically.
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

  const stripeKey =
    Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("DD_STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: "Stripe keys not configured", key_ready: false }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("No signature", { status: 400, headers: corsHeaders });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[dd-webhook] signature verify failed", err.message);
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency: insert event id; on conflict bail out.
  const { error: idemErr } = await supabase.from("dd_webhook_events").insert({
    event_id: event.id,
    source: "dd-stripe-webhook",
    type: event.type,
  });
  if (idemErr) {
    // Unique violation → already processed.
    console.log(`[dd-webhook] duplicate event ${event.id} (${event.type}) — skipped`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // CHECK 3: only promote to paid when Stripe confirms payment.
        if (session.payment_status !== "paid") {
          console.log(
            `[dd-webhook] checkout.session.completed ignored — payment_status=${session.payment_status}`,
          );
          break;
        }
        await markOrderPaid(
          supabase,
          session.metadata?.order_id,
          (session.payment_intent as string) || session.id,
          session.customer_details?.email ?? null,
          (session.amount_total ?? 0) / 100,
        );
        // Pull risk + 3DS from the underlying charge.
        if (session.payment_intent) {
          await captureRiskFromPaymentIntent(stripe, supabase, session.payment_intent as string, session.metadata?.order_id);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markOrderPaid(
          supabase,
          pi.metadata?.order_id,
          pi.id,
          pi.receipt_email ?? null,
          (pi.amount_received ?? pi.amount ?? 0) / 100,
        );
        await captureRiskFromPaymentIntent(stripe, supabase, pi.id, pi.metadata?.order_id);
        break;
      }
      case "payment_intent.canceled":
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await releaseOrderReserves(supabase, pi.metadata?.order_id, event.type);
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(stripe, supabase, dispute);
        break;
      }
      case "charge.dispute.updated":
      case "charge.dispute.closed":
      case "charge.dispute.funds_withdrawn":
      case "charge.dispute.funds_reinstated": {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeUpdated(supabase, dispute);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[dd-webhook] handler error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function markOrderPaid(
  supabase: any,
  orderId: string | undefined | null,
  paymentRef: string,
  fallbackEmail: string | null,
  amountTotal: number,
) {
  if (!orderId) return;
  const { data: existing } = await supabase
    .from("marketplace_orders")
    .select("payment_status, customer_email, user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!existing) return;
  if (existing.payment_status === "paid") return;

  const updatePayload: Record<string, unknown> = {
    payment_status: "paid",
    fulfillment_status: "processing",
    stripe_payment_intent_id: paymentRef,
  };
  // Backfill customer_email if missing — required for guest-order public lookup.
  if (!existing.customer_email && fallbackEmail) {
    updatePayload.customer_email = fallbackEmail;
  }
  // The customer has already paid. Losing this write leaves a paid order
  // reading "pending" forever, so fail the request and let Stripe retry — the
  // `payment_status === "paid"` guard above makes the replay a no-op.
  const { error: paidErr } = await supabase
    .from("marketplace_orders")
    .update(updatePayload)
    .eq("id", orderId);
  if (paidErr) {
    console.error(`[dd-webhook] order ${orderId} not marked paid:`, paidErr.message);
    throw new Error(`mark order paid failed: ${paidErr.message}`);
  }

  // Decrement inventory for each line item via RPC. Best-effort: log failures
  // but do not block payment processing.
  const { data: items } = await supabase
    .from("marketplace_order_items")
    .select("product_id, qty")
    .eq("order_id", orderId);
  for (const it of items ?? []) {
    if (!it.product_id || !it.qty) continue;
    const { error: decErr } = await supabase.rpc("dd_decrement_inventory", {
      p_product_id: it.product_id,
      p_quantity: it.qty,
      p_order_id: orderId,
      p_reason: "sale",
    });
    if (decErr) console.error(`[dd-webhook] inventory decrement failed ${it.product_id}:`, decErr.message);
  }

  // Fire-and-forget grabba bridge sync.
  supabase.functions
    .invoke("dd-grabba-bridge", { body: { order_id: orderId } })
    .catch((e: any) => console.error("[dd-webhook] grabba bridge failed", e?.message));

  // Fire-and-forget customer 'confirmed' notification (SMS + email)
  supabase.functions
    .invoke("dd-notify-customer-order-update", {
      body: { order_id: orderId, event_type: "confirmed" },
    })
    .catch((e: any) => console.error("[dd-webhook] customer notify failed", e?.message));

  const email = existing.customer_email || fallbackEmail;
  if (email) {
    await supabase.functions
      .invoke("dd-send-email", {
        body: {
          template: "order-confirmation",
          to: email,
          data: { order_id: orderId, amount_total: amountTotal },
        },
      })
      .catch((e: any) => console.error("[dd-webhook] email failed", e));
  }
  // Loyalty points (gated by dd_config.loyalty_enabled). Non-blocking.
  try {
    const { data: cfg } = await supabase
      .from("dd_config")
      .select("loyalty_enabled")
      .limit(1)
      .maybeSingle();
    if (cfg?.loyalty_enabled !== false && existing.user_id && amountTotal > 0) {
      await supabase
        .rpc("dd_earn_loyalty_points", {
          p_user_id: existing.user_id,
          p_order_id: orderId,
          p_order_total: amountTotal,
        })
        .catch((e: any) => console.error("[dd-webhook] loyalty earn failed", e?.message));
    }
  } catch (e: any) {
    console.error("[dd-webhook] loyalty gate failed", e?.message);
  }

  // Referral qualification (store-to-store program). Non-blocking.
  try {
    const { data: ordRow } = await supabase
      .from("marketplace_orders")
      .select("ordering_store_id")
      .eq("id", orderId)
      .maybeSingle();
    const storeAcct = (ordRow as { ordering_store_id?: string | null } | null)?.ordering_store_id ?? null;
    if (storeAcct) {
      const { data: qres } = await supabase.rpc("dd_qualify_store_referral", {
        p_store_account_id: storeAcct,
        p_order_id: orderId,
      });
      const result = qres as { qualified?: boolean; referrer_user_id?: string | null } | null;
      if (result?.qualified && result.referrer_user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", result.referrer_user_id)
          .maybeSingle();
        const phone = (prof as { phone?: string | null } | null)?.phone ?? null;
        const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
        const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
        const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";
        if (phone && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
          const { data: refStore } = await supabase
            .from("store_accounts")
            .select("business_name")
            .eq("id", storeAcct)
            .maybeSingle();
          const name = (refStore as { business_name?: string } | null)?.business_name ?? "Your referred store";
          const msg = `🎉 Your referral earned you $50 in store credit!\n${name} just placed their first order.\nCredit added to your account.`;
          const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: msg }),
          }).catch((e) => console.error("[dd-webhook] referral sms failed", e?.message));
        }
      }
    }
  } catch (e: any) {
    console.error("[dd-webhook] referral qualify failed", e?.message);
  }

  // Partner-campaign earnings (ambassador ↔ wholesaler revenue share).
  try {
    const { data: ordCamp } = await supabase
      .from("marketplace_orders")
      .select("id, total, campaign_id, campaign_wholesaler_id")
      .eq("id", orderId)
      .maybeSingle();
    const oc = ordCamp as {
      id: string;
      total: number | null;
      campaign_id: string | null;
      campaign_wholesaler_id: string | null;
    } | null;
    if (oc?.campaign_id) {
      const { data: camp } = await supabase
        .from("dd_campaigns")
        .select("id, name, ambassador_id, commission_override_pct, partner_wholesaler_link_id, total_orders, total_revenue, total_commission")
        .eq("id", oc.campaign_id)
        .maybeSingle();
      const c = camp as any;
      if (c) {
        let sharePct: number | null = c.commission_override_pct ?? null;
        let linkRow: any = null;
        if (c.partner_wholesaler_link_id) {
          const { data: link } = await supabase
            .from("dd_partner_wholesaler_links")
            .select("id, revenue_share_pct, ambassador_id, total_orders, total_revenue_generated, total_earned")
            .eq("id", c.partner_wholesaler_link_id)
            .maybeSingle();
          linkRow = link;
          if (sharePct == null && link?.revenue_share_pct != null) {
            sharePct = Number(link.revenue_share_pct);
          }
        }
        const pct = Number(sharePct ?? 10);
        const revenue = Number(oc.total ?? 0);
        const commission = Math.round(revenue * pct) / 100;

        // ── PER-ITEM ATTRIBUTION ──────────────────────────────────────
        // Orders can split across several campaign-set wholesalers, so
        // commission is attributed per line item to the wholesaler that
        // actually fulfills it (marketplace_order_items.wholesaler_id) —
        // never to the old scalar campaign_wholesaler_id.
        const { data: itemRows } = await supabase
          .from("marketplace_order_items")
          .select("id, wholesaler_id, qty, price_each")
          .eq("order_id", orderId);
        const oItems = (itemRows ?? []) as Array<{
          id: string;
          wholesaler_id: string | null;
          qty: number | null;
          price_each: number | null;
        }>;
        const itemsSubtotal = oItems.reduce(
          (s, i) => s + Number(i.price_each ?? 0) * Number(i.qty ?? 0),
          0,
        );

        if (oItems.length > 0 && itemsSubtotal > 0) {
          // Legacy wholesalers-table id (FK on wholesaler_id) resolved from the
          // fulfilling profile where a mapping exists; profile id is always kept.
          const profileIds = Array.from(
            new Set(oItems.map((i) => i.wholesaler_id).filter(Boolean)),
          ) as string[];
          const legacyByProfile = new Map<string, string | null>();
          if (profileIds.length > 0) {
            const { data: profs } = await supabase
              .from("wholesaler_profiles")
              .select("id, company_name")
              .in("id", profileIds);
            for (const pr of (profs ?? []) as any[]) {
              const { data: legacy } = await supabase
                .from("wholesalers")
                .select("id")
                .eq("name", pr.company_name ?? "")
                .maybeSingle();
              legacyByProfile.set(pr.id, (legacy as any)?.id ?? null);
            }
          }

          let allocated = 0;
          const rows = oItems.map((it, idx) => {
            const lineRevenue = Number(it.price_each ?? 0) * Number(it.qty ?? 0);
            // Allocate the order-level commission proportionally by line
            // revenue; last line absorbs the rounding remainder.
            let lineCommission =
              Math.round(commission * (lineRevenue / itemsSubtotal) * 100) / 100;
            if (idx === oItems.length - 1) {
              lineCommission = Math.round((commission - allocated) * 100) / 100;
            }
            allocated = Math.round((allocated + lineCommission) * 100) / 100;
            return {
              ambassador_id: c.ambassador_id ?? linkRow?.ambassador_id ?? null,
              wholesaler_id: it.wholesaler_id
                ? legacyByProfile.get(it.wholesaler_id) ?? null
                : null,
              wholesaler_profile_id: it.wholesaler_id ?? null,
              order_item_id: it.id,
              campaign_id: c.id,
              order_id: orderId,
              order_revenue: lineRevenue,
              commission_pct: pct,
              commission_amount: lineCommission,
              status: "pending",
            };
          });
          // A lost earnings row means a partner is silently never paid. It is
          // logged, not thrown: replaying this event would re-insert the
          // commission (there is no dedup key here) and overpay instead.
          const { error: earnErr } = await supabase.from("dd_partner_earnings").insert(rows);
          if (earnErr) {
            console.error(
              `[dd-webhook] COMMISSION LOST order=${orderId} campaign=${c.id}:`,
              earnErr.message,
            );
          }
        } else {
          // No line items resolvable — keep the legacy order-level record.
          const { error: earnErr } = await supabase.from("dd_partner_earnings").insert({
            ambassador_id: c.ambassador_id ?? linkRow?.ambassador_id ?? null,
            wholesaler_id: oc.campaign_wholesaler_id ?? null,
            campaign_id: c.id,
            order_id: orderId,
            order_revenue: revenue,
            commission_pct: pct,
            commission_amount: commission,
            status: "pending",
          });
          if (earnErr) {
            console.error(
              `[dd-webhook] COMMISSION LOST (legacy path) order=${orderId} campaign=${c.id}:`,
              earnErr.message,
            );
          }
        }

        await supabase
          .from("dd_campaigns")
          .update({
            total_orders: (c.total_orders ?? 0) + 1,
            total_revenue: Number(c.total_revenue ?? 0) + revenue,
            total_commission: Number(c.total_commission ?? 0) + commission,
          })
          .eq("id", c.id);

        if (linkRow?.id) {
          await supabase
            .from("dd_partner_wholesaler_links")
            .update({
              total_orders: (linkRow.total_orders ?? 0) + 1,
              total_revenue_generated: Number(linkRow.total_revenue_generated ?? 0) + revenue,
              total_earned: Number(linkRow.total_earned ?? 0) + commission,
            })
            .eq("id", linkRow.id);
        }

        // SMS the ambassador (best-effort)
        try {
          const ambId = c.ambassador_id ?? linkRow?.ambassador_id ?? null;
          if (ambId) {
            const { data: amb } = await supabase
              .from("ambassadors")
              .select("user_id, name")
              .eq("id", ambId)
              .maybeSingle();
            const ambUid = (amb as any)?.user_id ?? null;
            let phone: string | null = null;
            if (ambUid) {
              const { data: prof } = await supabase
                .from("profiles")
                .select("phone")
                .eq("id", ambUid)
                .maybeSingle();
              phone = (prof as any)?.phone ?? null;
            }
            const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";

            const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
            const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";
            if (phone && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
              const totalEarned = Number(linkRow?.total_earned ?? 0) + commission;
              const msg = `💰 Campaign sale!\n${c.name} generated $${revenue.toFixed(2)}\nYou earned: $${commission.toFixed(2)}\nTotal earned: $${totalEarned.toFixed(2)}`;
              const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
                method: "POST",
                headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: msg }),
              }).catch((e) => console.error("[dd-webhook] partner sms failed", e?.message));
            }
          }
        } catch (e: any) {
          console.error("[dd-webhook] partner sms block failed", e?.message);
        }
      }
    }
  } catch (e: any) {
    console.error("[dd-webhook] partner earnings failed", e?.message);
  }

  console.log(`[dd-webhook] order ${orderId} marked paid`);


  // Fire customer "confirmed" notification (non-blocking).
  try {
    await supabase.functions.invoke("dd-notify-customer-order-update", {
      body: { order_id: orderId, event_type: "confirmed" },
    });
  } catch (err: any) {
    console.error("[dd-webhook] confirmed notification failed:", err?.message);
  }
}

async function releaseOrderReserves(
  supabase: any,
  orderId: string | undefined | null,
  reason: string,
) {
  if (!orderId) return;
  const { data: items } = await supabase
    .from("marketplace_order_items")
    .select("product_id, wholesaler_id, qty")
    .eq("order_id", orderId);
  for (const it of items ?? []) {
    if (!it.product_id || !it.wholesaler_id || !it.qty) continue;
    await supabase
      .rpc("release_marketplace_inventory", {
        p_product_id: it.product_id,
        p_wholesaler_id: it.wholesaler_id,
        p_qty: it.qty,
      })
      .catch((e: any) => console.error("[dd-webhook] release failed", e?.message));
  }
  await supabase
    .from("marketplace_orders")
    .update({
      payment_status: "failed",
      fulfillment_status: "cancelled",
      notes: `auto-cancelled: ${reason}`,
    })
    .eq("id", orderId)
    .neq("payment_status", "paid");
  console.log(`[dd-webhook] order ${orderId} reserves released (${reason})`);
}

// ────────────────────────────────────────────────────────────────────
// 3DS / Stripe Radar risk capture + dispute handling
// ────────────────────────────────────────────────────────────────────

async function sendSmsToAdmin(body: string) {
  const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";
  const ADMIN_PHONE = Deno.env.get("DD_ADMIN_PHONE") ?? Deno.env.get("DAVID_PHONE") ?? "";
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !ADMIN_PHONE) return;
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_FROM, Body: body }),
  }).catch((e) => console.error("[dd-webhook] admin sms failed", e?.message));
}

async function captureRiskFromPaymentIntent(
  stripe: Stripe,
  supabase: any,
  paymentIntentId: string,
  orderId: string | undefined | null,
) {
  if (!orderId) return;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    if (!charge) return;
    const riskLevel = (charge.outcome?.risk_level as string | undefined) ?? null;
    const riskScore = (charge.outcome?.risk_score as number | undefined) ?? null;
    const threeDS =
      (charge.payment_method_details as any)?.card?.three_d_secure?.authenticated ?? false;
    const flag = riskLevel === "elevated" || riskLevel === "highest";

    await supabase
      .from("marketplace_orders")
      .update({
        stripe_risk_level: riskLevel,
        stripe_risk_score: riskScore,
        three_ds_authenticated: !!threeDS,
        fraud_review_flag: flag,
      })
      .eq("id", orderId);

    if (flag) {
      const { data: ord } = await supabase
        .from("marketplace_orders")
        .select("id, total, customer_email")
        .eq("id", orderId)
        .maybeSingle();
      const ref = String(orderId).slice(0, 8);
      const total = Number((ord as any)?.total ?? 0).toFixed(2);
      const email = (ord as any)?.customer_email ?? "—";
      await sendSmsToAdmin(
        `⚠️ High risk order flagged!\nOrder #${ref}\nAmount: $${total}\nRisk: ${riskLevel} (${riskScore ?? "?"}/100)\nCustomer: ${email}\nReview: /dynasty-direct/orders/${orderId}\n\nStripe may have already blocked this. Check your Stripe dashboard.`,
      );
    }
  } catch (e: any) {
    console.error("[dd-webhook] capture risk failed", e?.message);
  }
}

async function handleDisputeCreated(stripe: Stripe, supabase: any, dispute: Stripe.Dispute) {
  try {
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    let orderId: string | null = null;
    let threeDS = false;
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId);
      orderId =
        (charge.metadata?.order_id as string | undefined) ??
        ((typeof charge.payment_intent === "string"
          ? (await stripe.paymentIntents.retrieve(charge.payment_intent)).metadata?.order_id
          : null) as string | null) ??
        null;
      threeDS =
        (charge.payment_method_details as any)?.card?.three_d_secure?.authenticated ?? false;
    }

    await supabase.from("dd_disputes").insert({
      order_id: orderId,
      stripe_dispute_id: dispute.id,
      stripe_charge_id: chargeId ?? null,
      amount: (dispute.amount ?? 0) / 100,
      currency: dispute.currency ?? "usd",
      reason: dispute.reason ?? null,
      status: dispute.status ?? null,
      evidence_due_by: dispute.evidence_details?.due_by
        ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
        : null,
      three_ds_authenticated: threeDS,
    });

    const ref = orderId ? String(orderId).slice(0, 8) : "unknown";
    const amount = ((dispute.amount ?? 0) / 100).toFixed(2);
    const due = dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString()
      : "n/a";
    await sendSmsToAdmin(
      `🚨 CHARGEBACK FILED!\nOrder #${ref}\nAmount: $${amount}\nReason: ${dispute.reason ?? "?"}\nDue by: ${due}\n\n${threeDS ? "3DS verified — bank is liable." : "Not 3DS verified — submit evidence in Stripe."}\n\ndashboard.stripe.com/disputes`,
    );
  } catch (e: any) {
    console.error("[dd-webhook] dispute create failed", e?.message);
  }
}

async function handleDisputeUpdated(supabase: any, dispute: Stripe.Dispute) {
  try {
    const resolved = ["won", "lost", "charge_refunded"].includes(dispute.status ?? "");
    await supabase
      .from("dd_disputes")
      .update({
        status: dispute.status ?? null,
        resolved_at: resolved ? new Date().toISOString() : null,
      })
      .eq("stripe_dispute_id", dispute.id);
  } catch (e: any) {
    console.error("[dd-webhook] dispute update failed", e?.message);
  }
}
