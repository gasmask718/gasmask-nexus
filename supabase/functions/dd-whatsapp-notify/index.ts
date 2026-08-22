import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { legalStopBlocked } from "../_shared/twilioSend.ts";
import { smsContentHash } from "../_shared/sendSms.ts";
// Dynasty Direct — Send a WhatsApp message via Twilio.
// Non-blocking: returns success: false instead of throwing when Twilio is unconfigured.
//
// Stays on the direct Twilio call (send-sms/twilioSend are SMS-shaped and
// would mangle the `whatsapp:` prefix), but carries the rest of the standard:
// legal STOP gate (below), a deterministic idempotency key checked against
// outbound_messages before sending, and an outbound_messages audit row for
// every outcome — sent, failed, blocked.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeWhatsApp(input: string): string {
  const raw = input.trim();
  if (raw.startsWith("whatsapp:")) return raw;
  const digits = raw.replace(/[^\d+]/g, "");
  const withPlus = digits.startsWith("+") ? digits : `+${digits}`;
  return `whatsapp:${withPlus}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to_whatsapp, message, wholesaler_id } = await req.json();
    if (!to_whatsapp || !message) {
      return json({ success: false, error: "to_whatsapp and message required" }, 400);
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from =
      Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886"; // sandbox default

    if (!sid || !token) {
      console.warn("[dd-whatsapp-notify] Twilio not configured");
      return json({ success: false, warning: "twilio_not_configured", wholesaler_id });
    }

    const to = normalizeWhatsApp(String(to_whatsapp));

    // Different channel, same handset. twilioSend is SMS-shaped (it normalizes
    // to E.164 and would mangle the `whatsapp:` prefix), so this one stays on
    // the direct call — but the one cross-class rule still applies: a STOP on
    // the number revokes consent for WhatsApp too.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stop = await legalStopBlocked(supabase, String(to_whatsapp));

    // Idempotency + audit trail (the halves send-sms normally owns). One key
    // per wholesaler per message-body per day; a retry of the same send is a
    // no-op, a genuinely new message is not.
    const dayBucket = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `dd-wa-${wholesaler_id ?? "none"}-${dayBucket}-${
      await smsContentHash(`${to}|${String(message)}`)
    }`;
    const last10 = String(to_whatsapp).replace(/\D/g, "").slice(-10) || null;
    const audit = async (row: Record<string, unknown>) => {
      try {
        await supabase.from("outbound_messages").insert({
          idempotency_key: idempotencyKey,
          to_number: to,
          message_body: String(message).slice(0, 4000),
          provider: "twilio",
          send_class: "transactional",
          phone_last10: last10,
          metadata: { channel: "whatsapp", wholesaler_id: wholesaler_id ?? null, source: "dd-whatsapp-notify" },
          ...row,
        });
      } catch (e) {
        console.error("[dd-whatsapp-notify] audit insert failed:", (e as Error).message);
      }
    };

    if (stop.blocked) {
      console.warn(`[dd-whatsapp-notify] blocked: ${stop.reason}`);
      await audit({
        status: "blocked",
        error_code: "legal_stop",
        error_message: `Suppressed (legal_stop): ${stop.reason}`,
      });
      return json({ success: false, blocked: true, reason: stop.reason, wholesaler_id });
    }

    // Dedupe: same key already sent → don't re-send.
    try {
      const { data: prior } = await supabase
        .from("outbound_messages")
        .select("id, status")
        .eq("idempotency_key", idempotencyKey)
        .in("status", ["sent", "queued", "delivered"])
        .limit(1)
        .maybeSingle();
      if (prior) {
        console.log(`[dd-whatsapp-notify] deduped key=${idempotencyKey}`);
        return json({ success: true, deduped: true, to, wholesaler_id });
      }
    } catch (e) {
      console.error("[dd-whatsapp-notify] dedupe check failed:", (e as Error).message);
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: String(message) }),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      console.error("[dd-whatsapp-notify] Twilio error", res.status, text);
      await audit({ status: "failed", error_code: String(res.status), error_message: text.slice(0, 500) });
      return json({ success: false, error: text, status: res.status, wholesaler_id });
    }
    let waSid: string | null = null;
    try { waSid = JSON.parse(text)?.sid ?? null; } catch { /* keep null */ }
    await audit({ status: "sent", provider_message_id: waSid, sent_at: new Date().toISOString() });
    return json({ success: true, to, wholesaler_id });
  } catch (e) {
    console.error("[dd-whatsapp-notify] fatal", e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});
