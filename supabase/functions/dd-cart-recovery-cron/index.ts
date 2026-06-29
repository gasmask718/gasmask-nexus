// dd-cart-recovery-cron — hourly job that emails (1h+) and SMSes (24h+)
// shoppers who abandoned their Dynasty Direct cart.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";

async function emailFor(admin: ReturnType<typeof createClient>, cart: any): Promise<string | null> {
  if (cart.email) return cart.email as string;
  if (!cart.user_id) return null;
  const { data } = await admin.from("profiles").select("email").eq("id", cart.user_id).maybeSingle();
  return (data as { email?: string } | null)?.email ?? null;
}

async function phoneFor(admin: ReturnType<typeof createClient>, cart: any): Promise<string | null> {
  if (!cart.user_id) return null;
  const { data } = await admin.from("profiles").select("phone").eq("id", cart.user_id).maybeSingle();
  return (data as { phone?: string } | null)?.phone ?? null;
}

async function sendTwilio(to: string, body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    return { ok: false, error: "twilio_not_configured" };
  }
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const emailRes: any[] = [];
  const smsRes: any[] = [];

  // 1. Email pass — abandoned >= 1h, no email sent yet.
  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: needEmail } = await admin
    .from("dd_abandoned_carts")
    .select("*")
    .is("recovered_at", null)
    .is("recovery_email_sent_at", null)
    .lt("created_at", oneHourAgo)
    .limit(50);

  for (const cart of (needEmail ?? []) as any[]) {
    const to = await emailFor(admin, cart);
    if (!to) { emailRes.push({ id: cart.id, skipped: "no_email" }); continue; }

    const { error } = await admin.from("email_jobs").insert({
      template: "abandoned_cart",
      recipient_email: to,
      user_id: cart.user_id ?? null,
      scheduled_for: new Date().toISOString(),
      idempotency_key: `abandoned_cart:${cart.id}`,
      payload: {
        cart_id: cart.id,
        cart_items: cart.cart_data,
        cart_total: cart.cart_total,
        item_count: cart.item_count,
        recovery_url: `/cart?recover=${cart.id}`,
        discount_code: "COMEBACK10",
      },
    });

    if (error) { emailRes.push({ id: cart.id, error: error.message }); continue; }
    await admin
      .from("dd_abandoned_carts")
      .update({ recovery_email_sent_at: new Date().toISOString() })
      .eq("id", cart.id);
    emailRes.push({ id: cart.id, queued: to });
  }

  // 2. SMS pass — email sent >= 24h ago, still not recovered, no SMS yet.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: needSms } = await admin
    .from("dd_abandoned_carts")
    .select("*")
    .is("recovered_at", null)
    .is("recovery_sms_sent_at", null)
    .not("recovery_email_sent_at", "is", null)
    .lt("recovery_email_sent_at", dayAgo)
    .limit(50);

  for (const cart of (needSms ?? []) as any[]) {
    const phone = await phoneFor(admin, cart);
    if (!phone) { smsRes.push({ id: cart.id, skipped: "no_phone" }); continue; }

    const msg = `👋 You left items in your Dynasty Direct cart!\n\n${cart.item_count} item(s) worth $${Number(cart.cart_total).toFixed(2)} are waiting for you.\n\nUse code COMEBACK10 for 10% off when you checkout:\ndynastydirect.com/cart`;
    const r = await sendTwilio(phone, msg);
    if (!r.ok) { smsRes.push({ id: cart.id, error: (r as any).error ?? "twilio_failed" }); continue; }
    await admin
      .from("dd_abandoned_carts")
      .update({ recovery_sms_sent_at: new Date().toISOString() })
      .eq("id", cart.id);
    smsRes.push({ id: cart.id, sent: phone });
  }

  return new Response(
    JSON.stringify({ success: true, emails: emailRes.length, sms: smsRes.length, emailRes, smsRes }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
