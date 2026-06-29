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
        break;
      }
      case "payment_intent.canceled":
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await releaseOrderReserves(supabase, pi.metadata?.order_id, event.type);
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
  await supabase.from("marketplace_orders").update(updatePayload).eq("id", orderId);

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

        await supabase.from("dd_partner_earnings").insert({
          ambassador_id: c.ambassador_id ?? linkRow?.ambassador_id ?? null,
          wholesaler_id: oc.campaign_wholesaler_id ?? null,
          campaign_id: c.id,
          order_id: orderId,
          order_revenue: revenue,
          commission_pct: pct,
          commission_amount: commission,
          status: "pending",
        });

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
