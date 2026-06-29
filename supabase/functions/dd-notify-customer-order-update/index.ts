// Dynasty Direct — customer order-status notifications (SMS + Email)
// Triggered on: confirmed, processing, shipped, delivered
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventType = "confirmed" | "processing" | "shipped" | "delivered";

interface Payload {
  order_id: string;
  event_type: EventType;
  tracking_number?: string;
  carrier?: string;
  tracking_url?: string;
}

const FRONTEND_BASE_URL = Deno.env.get("FRONTEND_BASE_URL") ?? "https://dynastydirect.com";

function buildSms(p: Payload, ref: string): string {
  switch (p.event_type) {
    case "confirmed":
      return `✅ Order confirmed! #${ref} from Dynasty Direct. We're preparing your items.`;
    case "processing":
      return `📦 Your order #${ref} is being prepared by our supplier and will ship within 1-2 business days.`;
    case "shipped":
      return `🚚 Your order #${ref} has shipped!${p.carrier ? ` Carrier: ${p.carrier}` : ""}${p.tracking_number ? ` Tracking: ${p.tracking_number}` : ""}${p.tracking_url ? ` Track: ${p.tracking_url}` : ""}`;
    case "delivered":
      return `📬 Your Dynasty Direct order #${ref} has been delivered! How was it? Leave a review: ${FRONTEND_BASE_URL}/orders/${p.order_id}/review`;
  }
}

function buildSubject(p: Payload, ref: string): string {
  switch (p.event_type) {
    case "confirmed": return `Order Confirmed — #${ref}`;
    case "processing": return `Order Processing — #${ref}`;
    case "shipped": return `Your Order Shipped — Track It Here`;
    case "delivered": return `Order Delivered — How Was It?`;
  }
}

function buildHtml(p: Payload, ref: string, name: string): string {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const trackBtn = p.event_type === "shipped" && p.tracking_url
    ? `<p style="margin:24px 0;"><a href="${p.tracking_url}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">Track Your Order</a></p>`
    : "";
  const body: Record<EventType, string> = {
    confirmed: `${greeting}<br/><br/>Your order <strong>#${ref}</strong> has been confirmed. We're getting it ready.`,
    processing: `${greeting}<br/><br/>Your order <strong>#${ref}</strong> is being prepared and will ship within 1-2 business days.`,
    shipped: `${greeting}<br/><br/>Great news! Your order <strong>#${ref}</strong> has shipped.${p.carrier ? `<br/><strong>Carrier:</strong> ${p.carrier}` : ""}${p.tracking_number ? `<br/><strong>Tracking:</strong> ${p.tracking_number}` : ""}${trackBtn}`,
    delivered: `${greeting}<br/><br/>Your order <strong>#${ref}</strong> has been delivered. We'd love your feedback — <a href="${FRONTEND_BASE_URL}/orders/${p.order_id}/review">leave a review</a>.`,
  };
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff;color:#111;padding:24px;max-width:600px;margin:0 auto;">
    <h1 style="font-size:20px;margin:0 0 16px;">Dynasty Direct</h1>
    <div style="font-size:14px;line-height:1.6;">${body[p.event_type]}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
    <p style="font-size:12px;color:#888;">Dynasty Direct · Order #${ref}</p>
  </body></html>`;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!sid || !token || !from) {
    console.warn("[dd-notify-customer] Twilio not configured — SMS skipped");
    return false;
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) {
      console.error("[dd-notify-customer] SMS failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[dd-notify-customer] SMS error", e);
    return false;
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!key || !lovableKey) {
    console.warn("[dd-notify-customer] Resend/Lovable key missing — email skipped");
    return false;
  }
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": key,
      },
      body: JSON.stringify({
        from: "Dynasty Direct <orders@dynastydirect.com>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[dd-notify-customer] Email failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[dd-notify-customer] Email error", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.order_id || !payload.event_type) {
    return new Response(JSON.stringify({ error: "order_id and event_type required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: order, error: orderErr } = await supabase
    .from("marketplace_orders")
    .select("id, user_id, customer_email, customer_phone, notification_log")
    .eq("id", payload.order_id)
    .maybeSingle();

  if (orderErr || !order) {
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let phone: string | null = order.customer_phone ?? null;
  let email: string | null = order.customer_email ?? null;
  let fullName = "";

  if (order.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, email, full_name, name")
      .eq("id", order.user_id)
      .maybeSingle();
    if (profile) {
      phone = phone ?? (profile as any).phone ?? null;
      email = email ?? (profile as any).email ?? null;
      fullName = (profile as any).full_name ?? (profile as any).name ?? "";
    }
  }

  const ref = payload.order_id.slice(0, 8).toUpperCase();
  const smsBody = buildSms(payload, ref);
  const subject = buildSubject(payload, ref);
  const html = buildHtml(payload, ref, fullName);

  const channels: string[] = [];
  let sms_sent = false;
  let email_sent = false;

  if (phone) {
    sms_sent = await sendSms(phone, smsBody);
    if (sms_sent) channels.push("sms");
  }
  if (email) {
    email_sent = await sendEmail(email, subject, html);
    if (email_sent) channels.push("email");
  }

  const log = Array.isArray(order.notification_log) ? order.notification_log : [];
  log.push({
    type: payload.event_type,
    sent_at: new Date().toISOString(),
    channels,
    tracking_number: payload.tracking_number ?? null,
    carrier: payload.carrier ?? null,
  });

  await supabase
    .from("marketplace_orders")
    .update({
      notification_log: log,
      customer_notified_at: new Date().toISOString(),
      last_notification_type: payload.event_type,
    })
    .eq("id", payload.order_id);

  return new Response(JSON.stringify({ success: true, sms_sent, email_sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
