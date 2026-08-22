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
import { buildSmsTemplate } from "../_shared/smsTemplates.ts";
import { voicemailTwiml } from "../_shared/voicemailTwiml.ts";
import { canonicalUrl } from "../_shared/dialer.ts";
import { sendSms } from "../_shared/sendSms.ts";

const EMPTY = `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;

const RECOVERY_MESSAGE = buildSmsTemplate("gasmask_missed_call_callback", {});

const MISSED_STATUSES = new Set(["no-answer", "busy", "failed", "canceled"]);

// Outbound SMS routes through send-sms (suppression, idempotency,
// outbound_messages audit row). A legal STOP on the caller blocks the
// text-back — that is correct — and the blocked outcome is logged to
// communication_logs as `missed_call_recovery_suppressed` so a human can
// return the call by voice instead (an SMS STOP does not block calls).

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

  // vm=1 → we are the tail of the gasmask-inbound-voice flow: the AI agent was
  // the fallback and it didn't pick up either, so take a voicemail before hanging up.
  const wantsVoicemail = url.searchParams.get("vm") === "1" && MISSED_STATUSES.has(dialStatus);
  const cu = new URL(canonicalUrl(req));
  const vmBase = `${cu.protocol}//${cu.host}/functions/v1`;
  const vmTail = wantsVoicemail
    ? voicemailTwiml(vmBase, "Sorry we missed you. Please leave a message after the tone and we will call you right back.")
    : "";

  // Always end the call gracefully — only side-effects on missed
  const respond = (extra = vmTail) => new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${extra}</Response>`, { headers: xmlHeaders });

  if (business !== "gasmask") return respond();
  if (!MISSED_STATUSES.has(dialStatus)) return respond();
  if (!caller || !businessNumber) return respond();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Suppression is enforced at the send-sms chokepoint (dnc_list +
  // opt_out_events + legal STOP, last-10 normalized) — no local pre-check,
  // so there is exactly one gate and one audit trail.

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

  // Match store (if known)
  let storeId: string | null = null;
  try {
    const last10 = caller.replace(/\D/g, "").slice(-10);
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .ilike("phone", `%${last10}`)
      .limit(1)
      .maybeSingle();
    storeId = store?.id ?? null;
  } catch (e) {
    console.error("[gasmask-missed-call] store match failed", (e as Error).message);
  }

  const callSid = params.CallSid || "";
  const result = await sendSms({
    to: caller,
    from: businessNumber, // sender parity: text back from the number they called
    body: RECOVERY_MESSAGE,
    sendClass: "conversational",
    idempotencyKey: `gasmask-missed-${callSid || `${caller}-${new Date().toISOString().slice(0, 13)}`}`,
    skipCooldown: true, // one missed call = one recovery text
    purpose: "gasmask_missed_call_recovery",
    storeId,
    metadata: { dial_status: dialStatus, business_number: businessNumber, business },
  });

  if (result.success) {
    console.log(`[gasmask-missed-call] ✅ recovery SMS sent sid=${result.providerMessageId}`);
    try {
      await supabase.from("communication_logs").insert({
        store_id: storeId,
        contact_id: null,
        channel: "sms",
        direction: "outbound",
        message_content: RECOVERY_MESSAGE,
        sender_phone: businessNumber,
        recipient_phone: caller,
        twilio_sid: result.providerMessageId,
        summary: "GasMask missed-call auto-text-back",
        delivery_status: "queued",
        performed_by: "system",
        outcome: "missed_call_recovery",
      });
    } catch (e) {
      console.error("[gasmask-missed-call] log insert failed:", (e as Error).message);
    }
  } else if (result.blocked) {
    // Caller asked not to be texted. Honour it — but do NOT let the missed
    // call vanish: log a named outcome so a human can ring back (a voice
    // callback is not blocked by an SMS STOP).
    console.log(`[gasmask-missed-call] recovery SMS SUPPRESSED for ${caller}: ${result.errorMessage}`);
    try {
      await supabase.from("communication_logs").insert({
        store_id: storeId,
        contact_id: null,
        channel: "sms",
        direction: "outbound",
        message_content: RECOVERY_MESSAGE,
        sender_phone: businessNumber,
        recipient_phone: caller,
        twilio_sid: null,
        summary: "GasMask missed-call auto-text-back SUPPRESSED",
        delivery_status: "blocked",
        performed_by: "system",
        outcome: "missed_call_recovery_suppressed",
      });
    } catch (e) {
      console.error("[gasmask-missed-call] suppressed-outcome log failed:", (e as Error).message);
    }
  } else {
    console.error(`[gasmask-missed-call] SMS send failed: ${result.status} ${result.errorMessage}`);
  }

  return respond();
});
