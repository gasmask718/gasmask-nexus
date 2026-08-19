// supabase/functions/send-invoice-sms/index.ts
// Shortens a Stripe checkout URL via TinyURL and sends it to the customer
// via Twilio SMS. Logs every send (success or failure) to communication_logs.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSms as sendCanonicalSms } from "../_shared/sendSms.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Payload {
  checkout_url: string;
  customer_phone: string;
  customer_name?: string;
  invoice_id?: string;        // marketplace_orders.id (or whatever you key on)
  invoice_number?: string;    // human-friendly label for the SMS
  business_id?: string;
  brand?: string;
}

function toE164(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return /^\+\d{8,15}$/.test(trimmed) ? trimmed : null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// Branded short link via our own short_links table → /p/:code redirect.
// Falls back to TinyURL, then to the long URL. Always returns the shortest
// working URL we can produce.
async function shortenUrl(
  longUrl: string,
  admin: ReturnType<typeof createClient>,
  invoiceId?: string,
): Promise<string> {
  // 1) DB-backed branded short link (preferred — survives TinyURL outages)
  try {
    const { data: code, error } = await admin.rpc("create_short_link", {
      p_url: longUrl,
      p_purpose: "invoice_payment",
      p_invoice_id: invoiceId ?? null,
    });
    if (!error && code) {
      const base = (Deno.env.get("PUBLIC_APP_URL") || "https://gasmask-os-nexus.lovable.app").replace(/\/$/, "");
      const branded = `${base}/p/${code}`;
      // Try TinyURL on top of the branded URL for maximum compactness;
      // if that fails, the branded URL is already short enough for SMS.
      try {
        const res = await fetch(
          `https://tinyurl.com/api-create.php?url=${encodeURIComponent(branded)}`,
          { method: "GET" },
        );
        if (res.ok) {
          const text = (await res.text()).trim();
          if (text.startsWith("http") && text.length < branded.length) return text;
        }
      } catch { /* keep branded */ }
      return branded;
    }
  } catch (e) {
    console.error("create_short_link failed", e);
  }

  // 2) TinyURL directly on the Stripe URL
  try {
    const res = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
      { method: "GET" },
    );
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith("http") && text.length < longUrl.length) return text;
    }
  } catch { /* fall through */ }

  // 3) Give up — return the original
  return longUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ---- Auth: require a logged-in user ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json(401, { error: "Unauthorized" });
    const userId = claims.claims.sub as string;

    // ---- Validate input ----
    const body = (await req.json().catch(() => null)) as Payload | null;
    if (!body) return json(400, { error: "Invalid JSON body" });

    const { checkout_url, customer_phone, customer_name, invoice_id, invoice_number, business_id, brand } = body;

    if (!checkout_url || !/^https:\/\/(checkout\.stripe\.com|billing\.stripe\.com|buy\.stripe\.com)/.test(checkout_url)) {
      return json(400, { error: "checkout_url must be a valid Stripe URL" });
    }
    const to = toE164(customer_phone || "");
    if (!to) return json(400, { error: "customer_phone is missing or not a valid phone number" });

    // ---- Twilio creds ----
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER");
    if (!sid || !authToken || !from) {
      return json(500, { error: "Twilio credentials are not configured" });
    }
    if (!sid.startsWith("AC")) {
      return json(500, { error: "TWILIO_ACCOUNT_SID must start with 'AC'" });
    }

    // ---- Service-role admin client (used by shortener + logger) ----
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- Shorten + compose ----
    const shortUrl = await shortenUrl(checkout_url, admin, invoice_id);
    const greeting = customer_name?.trim() ? `Hi ${customer_name.trim()}` : "Hello";
    const label = invoice_number ? ` ${invoice_number}` : "";
    const message = `${greeting}, here's your invoice${label}: ${shortUrl}`;

    // ---- Send via Twilio (Group C, transactional) ----
    // The destination is the number supplied with the invoice itself, not a
    // profile lookup, so consent travels with the transaction.
    const sent = await sendCanonicalSms({
      to,
      body: message,
      sendClass: "transactional",
      purpose: "invoice_sms",
      idempotencyKey: `invoice-sms-${invoice_id ?? shortUrl}-${to}`,
      from,
      skipCooldown: true,
      metadata: { invoice_id: invoice_id ?? null, business_id: business_id ?? null },
    });
    const twilioRes = { ok: sent.success };
    const twilioData = { sid: sent.providerMessageId, message: sent.errorMessage };
    // ---- Log to communication_logs via service role (bypass RLS) ----

    await admin.from("communication_logs").insert({
      channel: "sms",
      direction: "outbound",
      summary: twilioRes.ok ? `Invoice SMS sent${label}` : `Invoice SMS failed${label}`,
      message_content: message,
      full_message: message,
      recipient_phone: to,
      sender_phone: from,
      delivery_status: twilioRes.ok ? "sent" : "failed",
      twilio_sid: twilioData?.sid ?? null,
      outcome: twilioRes.ok ? "delivered_to_carrier" : (twilioData?.message ?? "twilio_error"),
      performed_by: "system",
      created_by: userId,
      business_id: business_id ?? null,
      brand: brand ?? null,
    });

    // ---- Stamp the invoice/order if we know its id ----
    if (invoice_id && twilioRes.ok) {
      await admin
        .from("marketplace_orders")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", invoice_id);
    }

    if (!twilioRes.ok) {
      // A legal STOP is a refusal, not a Twilio rejection — say which it was.
      return json(sent.blocked ? 409 : 502, {
        error: sent.blocked ? "Recipient has opted out of SMS" : "Twilio rejected the message",
        twilio_status: sent.status,
        twilio_message: sent.errorMessage,
        twilio_code: sent.errorCode,
        blocked: sent.blocked,
      });
    }


    return json(200, {
      success: true,
      short_url: shortUrl,
      sms_sid: twilioData.sid,
      to,
      message,
    });
  } catch (err) {
    console.error("send-invoice-sms error", err);
    return json(500, { error: (err as Error).message || "Unknown error" });
  }
});
