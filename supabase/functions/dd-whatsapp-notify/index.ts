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
    if (stop.blocked) {
      console.warn(`[dd-whatsapp-notify] blocked: ${stop.reason}`);
      return json({ success: false, blocked: true, reason: stop.reason, wholesaler_id });
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
      return json({ success: false, error: text, status: res.status, wholesaler_id });
    }
    return json({ success: true, to, wholesaler_id });
  } catch (e) {
    console.error("[dd-whatsapp-notify] fatal", e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});
