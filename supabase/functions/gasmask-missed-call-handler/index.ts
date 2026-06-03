/**
 * GASMASK MISSED-CALL HANDLER
 *
 * Fired as the `action` callback of the inbound <Dial> in twilio-inbound-call.
 * Twilio POSTs DialCallStatus when the dial leg ends. If the call was NOT
 * answered (no-answer / busy / failed / canceled) AND the business is GasMask,
 * we automatically send an SMS recovery message from the verified business
 * number to the caller.
 *
 * (Equivalent to call-center-missed-call-recovery, extended to GasMask.)
 *
 * Returns an empty <Response> TwiML so the call ends cleanly.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, readForm, verifyTwilio, xmlHeaders } from "../_shared/dialer.ts";

const EMPTY = `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;

const RECOVERY_MESSAGE =
  "Hey, this is GasMask — sorry we just missed your call. Reply here and we'll get right back to you. Reply STOP to opt out.";

const MISSED_STATUSES = new Set(["no-answer", "busy", "failed", "canceled"]);

async function sendTwilioSms(opts: { from: string; to: string; body: string }) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) throw new Error("twilio_credentials_missing");
  const auth = btoa(`${sid}:${token}`);
  const params = new URLSearchParams({ To: opts.to, From: opts.from, Body: opts.body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`twilio_${res.status}_${json?.message || "send_failed"}`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);

  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[gasmask-missed-call-handler] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const business = (url.searchParams.get("business") || "").toLowerCase();
  const fromQp = url.searchParams.get("from") || "";
  const toQp = url.searchParams.get("to") || "";

  const dialStatus = (params.DialCallStatus || "").toLowerCase();
  const caller = params.From || fromQp; // original caller
  const businessNumber = params.To || toQp; // our verified number

  console.log(`[gasmask-missed-call] biz=${business} status=${dialStatus} caller=${caller} biz_num=${businessNumber}`);

  // Always end the call gracefully — only side-effects on missed
  const respond = (extra = "") => new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${extra}</Response>`, { headers: xmlHeaders });

  if (business !== "gasmask") return respond();
  if (!MISSED_STATUSES.has(dialStatus)) return respond();
  if (!caller || !businessNumber) return respond();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Respect opt-outs
  try {
    const { data: optOut } = await supabase
      .from("opt_out_events")
      .select("phone_number")
      .eq("phone_number", caller)
      .maybeSingle();
    if (optOut) {
      console.log(`[gasmask-missed-call] caller ${caller} is opted out — skipping SMS`);
      return respond();
    }
  } catch (e) {
    console.error("[gasmask-missed-call] opt-out check failed", (e as Error).message);
  }

  // De-dupe: don't send if we already auto-texted this caller in the last 6h
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("communication_logs")
      .select("id")
      .eq("recipient_phone", caller)
      .eq("summary", "GasMask missed-call auto-text-back")
      .gte("created_at", sixHoursAgo)
      .limit(1)
      .maybeSingle();
    if (recent) {
      console.log(`[gasmask-missed-call] already recovered ${caller} within 6h — skipping`);
      return respond();
    }
  } catch (e) {
    console.error("[gasmask-missed-call] dedupe check failed", (e as Error).message);
  }

  try {
    const sent = await sendTwilioSms({ from: businessNumber, to: caller, body: RECOVERY_MESSAGE });
    console.log(`[gasmask-missed-call] ✅ recovery SMS sent sid=${sent.sid}`);

    // Match store (if known)
    const last10 = caller.replace(/\D/g, "").slice(-10);
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .ilike("phone", `%${last10}`)
      .limit(1)
      .maybeSingle();

    await supabase.from("communication_logs").insert({
      store_id: store?.id ?? null,
      contact_id: null,
      channel: "sms",
      direction: "outbound",
      message_content: RECOVERY_MESSAGE,
      sender_phone: businessNumber,
      recipient_phone: caller,
      twilio_sid: sent.sid,
      summary: "GasMask missed-call auto-text-back",
      delivery_status: "queued",
      performed_by: "system",
      outcome: "missed_call_recovery",
    });
  } catch (e) {
    console.error("[gasmask-missed-call] SMS send failed:", (e as Error).message);
  }

  return respond();
});
