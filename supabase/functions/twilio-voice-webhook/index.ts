// Inbound voice webhook from Twilio.
// Pre-creates a communication_logs row, then returns TwiML that records the call
// and forwards to Bland AI (via SIP endpoint OR forwarding number).
// verify_jwt = false (configured in supabase/config.toml)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  xmlHeaders,
  escapeXml,
  readForm,
  verifyTwilio,
} from "../_shared/dialer.ts";
import { TWILIO_SHARED_NUMBER } from "../_shared/twilio-operator.ts";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const params = await readForm(req);
  const From = params.From || "";
  const To = params.To || TWILIO_SHARED_NUMBER;
  const CallSid = params.CallSid || "";

  console.log(`[twilio-voice-webhook] inbound call from=${From} sid=${CallSid}`);

  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[twilio-voice-webhook] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const sb = svc();

  // Lookup store_contact by normalized last-10 digits (handles non-E.164 storage)
  const fromLast10 = (From || "").replace(/\D/g, "").slice(-10);
  let contact: { id: string; store_id: string } | null = null;
  if (fromLast10.length === 10) {
    const { data: c } = await sb
      .from("store_contacts")
      .select("id, store_id")
      .ilike("phone", `%${fromLast10}`)
      .limit(1)
      .maybeSingle();
    contact = c as any;
  }

  let store_id: string | null = contact?.store_id ?? null;
  // store_contacts.id is NOT FK-compatible with communication_logs.contact_id (which references `people`)
  let contact_id: string | null = null;

  if (!store_id && fromLast10.length === 10) {
    const { data: store } = await sb
      .from("stores")
      .select("id")
      .ilike("phone", `%${fromLast10}`)
      .limit(1)
      .maybeSingle();
    store_id = store?.id ?? null;
  }

  // Pre-create log row
  const { data: log } = await sb
    .from("communication_logs")
    .insert({
      store_id,
      contact_id,
      channel: "call",
      direction: "inbound",
      operator_id: null,
      bland_ai_handled: true,
      sender_phone: From,
      recipient_phone: To,
      twilio_sid: CallSid,
      summary: store_id ? "Inbound call → Bland AI" : "Inbound call from unknown → Bland AI",
      delivery_status: "in_progress",
      follow_up_required: !store_id,
    })
    .select("id")
    .single();

  const logId = log?.id || "";
  const projectRef = (Deno.env.get("SUPABASE_URL") || "").match(/https:\/\/([^.]+)/)?.[1] || "";
  const recordingCallback = `https://${projectRef}.supabase.co/functions/v1/twilio-recording-webhook?log_id=${logId}`;

  const blandSip = Deno.env.get("BLAND_AI_SIP_ENDPOINT");
  const blandPhone = Deno.env.get("BLAND_AI_INBOUND_NUMBER");

  let dialBody = "";
  if (blandSip) {
    dialBody = `<Sip>${escapeXml(blandSip)}</Sip>`;
  } else if (blandPhone) {
    dialBody = `<Number>${escapeXml(blandPhone)}</Number>`;
  } else {
    // No Bland endpoint configured → fall back to a polite message
    console.warn("[twilio-voice-webhook] No BLAND_AI_SIP_ENDPOINT or BLAND_AI_INBOUND_NUMBER configured");
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for calling. This call may be recorded. Please hold while we connect you.</Say>
  <Pause length="2"/>
  <Say voice="Polly.Joanna">We are unable to connect your call at this time. Please try again later.</Say>
  <Hangup/>
</Response>`;
    return new Response(fallback, { headers: xmlHeaders });
  }

  // Recording consent gate: fail closed on unknown jurisdiction or all-party state.
  const { attr: recAttr, decision: recDecision } = await recordAttrFor(supabase, From, {
    mode: "record-from-answer-dual",
    callbackUrl: recordingCallback,
  });
  console.log(`[twilio-voice-webhook] recording=${recAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${recAttr ? "This call may be recorded for quality and training. " : ""}Please hold.</Say>
  <Dial${recAttr}>
    ${dialBody}
  </Dial>
</Response>`;

  return new Response(twiml, { headers: xmlHeaders });
});
