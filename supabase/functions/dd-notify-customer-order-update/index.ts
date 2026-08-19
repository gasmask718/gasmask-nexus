// Dynasty Direct — customer order status notifier (SMS + email).
// Invoked by dd-stripe-webhook (confirmed), dd-grabba-bridge (processing),
// DDPurchaseOrders (shipped), and DDOrderDetail manual panel (any event).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendSms as sendCanonicalSms } from "../_shared/sendSms.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventType = "confirmed" | "processing" | "shipped" | "delivered";

interface Body {
  order_id: string;
  event_type: EventType;
  tracking_number?: string;
  carrier?: string;
  tracking_url?: string;
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildTrackingUrl(carrier: string | undefined, tracking: string | undefined): string {
  if (!carrier || !tracking) return "#";
  const map: Record<string, string> = {
    UPS: `https://www.ups.com/track?tracknum=${tracking}`,
    FedEx: `https://www.fedex.com/tracking?trackingnum=${tracking}`,
    USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`,
    DHL: `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${tracking}`,
    Amazon: `https://track.amazon.com/tracking/${tracking}`,
  };
  return map[carrier] ?? "#";
}

// Group C (transactional). Order-status updates are customer-initiated by the
// purchase, so they are not marketing-suppressed — but a legal STOP is
// absolute, and the shared module is the only place that rule is written.
async function sendSms(to: string, body: string, idemSuffix: string): Promise<boolean> {
  const res = await sendCanonicalSms({
    to,
    body,
    sendClass: "transactional",
    purpose: "dd_order_update",
    idempotencyKey: `dd-order-update-${idemSuffix}`,
    skipCooldown: true,
  });
  if (res.blocked) {
    console.warn(`[dd-notify] sms suppressed: ${res.status}`);
    return false;
  }
  if (!res.success) console.error(`[dd-notify] sms failed: ${res.errorMessage}`);
  return res.success;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.warn("[dd-notify] RESEND_API_KEY missing — skipping email");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Dynasty Direct <orders@dynastydirect.com>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[dd-notify] resend failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("[dd-notify] email threw", e?.message);
    return false;
  }
}

const SHELL = (inner: string) => `
<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#111;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
<div style="background:#0a0a0a;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px;">Dynasty Direct</div>
<div style="background:#fff;padding:22px;border-radius:0 0 10px 10px;line-height:1.55;font-size:15px;">${inner}</div>
<div style="text-align:center;font-size:11px;color:#888;margin-top:14px;">© Dynasty Direct</div>
</div></body></html>`;

function buildMessages(
  evt: EventType,
  orderRef: string,
  totalPrice: number,
  carrier?: string,
  trackingNumber?: string,
  trackingUrl?: string,
) {
  const base = "https://dynastydirect.com";
  const viewUrl = `${base}/account/orders/${orderRef}`;
  const tUrl = trackingUrl && trackingUrl !== "#" ? trackingUrl : buildTrackingUrl(carrier, trackingNumber);
  const btn = (label: string, url: string) =>
    `<a href="${url}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin-top:14px;">${label}</a>`;
  switch (evt) {
    case "confirmed":
      return {
        sms: `✅ Order confirmed! #${orderRef} from Dynasty Direct. We're preparing your items and will ship within 1-2 business days.`,
        subject: `Order Confirmed — #${orderRef}`,
        html: SHELL(`
          <h2 style="margin:0 0 10px;">Your order is confirmed! 🎉</h2>
          <p>Thank you for ordering from Dynasty Direct.</p>
          <p><b>Order #${orderRef}</b><br/>Total: $${totalPrice.toFixed(2)}<br/>Placed: ${new Date().toLocaleDateString()}</p>
          <p>We'll notify you the moment it ships.</p>
          ${btn("View Order", viewUrl)}
        `),
      };
    case "processing":
      return {
        sms: `📦 Your order #${orderRef} is being prepared by our supplier and will ship within 1-2 days. We'll text you when it's on the way!`,
        subject: `Order Processing — #${orderRef}`,
        html: SHELL(`
          <h2 style="margin:0 0 10px;">Your order is being prepared 📦</h2>
          <p>Order <b>#${orderRef}</b> has been routed to our supplier and will ship within 1-2 business days.</p>
          ${btn("View Order", viewUrl)}
        `),
      };
    case "shipped":
      return {
        sms: `🚚 Your order #${orderRef} has shipped!${carrier ? ` Carrier: ${carrier}` : ""}${trackingNumber ? ` Tracking: ${trackingNumber}` : ""}${tUrl !== "#" ? ` Track: ${tUrl}` : ""}`,
        subject: `Your Order Shipped — Track It Now`,
        html: SHELL(`
          <h2 style="margin:0 0 10px;">Your order is on the way! 🚚</h2>
          <p>Order <b>#${orderRef}</b> just left our supplier.</p>
          ${carrier ? `<p><b>Carrier:</b> ${carrier}<br/><b>Tracking #:</b> ${trackingNumber ?? "—"}</p>` : ""}
          <p>Estimated delivery: 3-5 business days.</p>
          ${btn("Track Your Package →", tUrl)}
        `),
      };
    case "delivered":
      return {
        sms: `📬 Your Dynasty Direct order #${orderRef} has been delivered! Enjoy your products 🎉 Leave a review: ${base}/products`,
        subject: `Order Delivered — How Was It?`,
        html: SHELL(`
          <h2 style="margin:0 0 10px;">Your order arrived! 📬</h2>
          <p>Order <b>#${orderRef}</b> was delivered. We hope you love it.</p>
          <p>How was your experience?</p>
          <p style="font-size:22px;letter-spacing:6px;">
            <a href="${base}/products" style="text-decoration:none;">⭐⭐⭐⭐⭐</a>
          </p>
          ${btn("Leave a Review →", `${base}/products`)}
        `),
      };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { order_id, event_type } = body;
  if (!order_id || !["confirmed", "processing", "shipped", "delivered"].includes(event_type)) {
    return json({ error: "order_id and valid event_type required" }, 400);
  }

  const { data: order, error: orderErr } = await supabase
    .from("marketplace_orders")
    .select("id, user_id, total_price, notification_log")
    .eq("id", order_id)
    .maybeSingle();
  if (orderErr || !order) return json({ error: "order not found" }, 404);

  // Customer email via auth admin lookup, phone via profiles.
  let customerEmail: string | null = null;
  let customerPhone: string | null = null;
  if (order.user_id) {
    const { data: u } = await supabase.auth.admin.getUserById(order.user_id);
    customerEmail = u?.user?.email ?? null;
    const { data: prof } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", order.user_id)
      .maybeSingle();
    customerPhone = (prof as any)?.phone ?? null;
  }

  const orderRef = String(order.id).slice(0, 8).toUpperCase();
  const trackingUrl = body.tracking_url ?? buildTrackingUrl(body.carrier, body.tracking_number);
  const msg = buildMessages(
    event_type,
    orderRef,
    Number(order.total_price ?? 0),
    body.carrier,
    body.tracking_number,
    trackingUrl,
  );

  let smsSent = false;
  let emailSent = false;
  if (customerPhone) smsSent = await sendSms(customerPhone, msg.sms, `${order.id}-${event_type}`);
  if (customerEmail) emailSent = await sendEmail(customerEmail, msg.subject, msg.html);

  const log = Array.isArray(order.notification_log) ? (order.notification_log as any[]) : [];
  const entry = {
    type: event_type,
    sent_at: new Date().toISOString(),
    channels: [smsSent ? "sms" : null, emailSent ? "email" : null].filter(Boolean),
    tracking_number: body.tracking_number ?? null,
    carrier: body.carrier ?? null,
  };
  await supabase
    .from("marketplace_orders")
    .update({
      notification_log: [...log, entry],
      customer_notified_at: new Date().toISOString(),
      last_notification_type: event_type,
    })
    .eq("id", order_id);

  return json({
    success: true,
    event_type,
    sms_sent: smsSent,
    email_sent: emailSent,
    order_ref: orderRef,
  });
});
