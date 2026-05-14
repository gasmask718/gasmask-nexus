// Inbound SMS webhook from Twilio.
// - Verifies X-Twilio-Signature
// - Handles STOP/START keyword compliance (CTIA)
// - Routes inbound messages to per-store thread (orphan if unknown sender)
// verify_jwt = false (configured in supabase/config.toml)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  xmlHeaders,
  readForm,
  verifyTwilio,
} from "../_shared/dialer.ts";
import {
  sendOperatorSms,
  TWILIO_SHARED_NUMBER,
} from "../_shared/twilio-operator.ts";

const STOP_RE = /^\s*(STOP|UNSUBSCRIBE|QUIT|CANCEL|END)\s*$/i;
const START_RE = /^\s*(START|UNSTOP|SUBSCRIBE)\s*$/i;
const SKIP_VERIFY =
  (Deno.env.get("DIALER_SKIP_TWILIO_VERIFY") || "").toLowerCase() === "true";

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;

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
  const Body = params.Body || "";
  const MessageSid = params.MessageSid || "";

  console.log(`[twilio-sms-webhook] inbound from=${From} sid=${MessageSid} len=${Body.length}`);

  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[twilio-sms-webhook] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const sb = svc();

  // STOP keyword
  if (STOP_RE.test(Body)) {
    const { data: cid } = await sb.rpc("handle_sms_opt_out", {
      p_phone: From,
      p_method: "STOP_keyword",
    });
    const { data: contact } = await sb
      .from("store_contacts")
      .select("id, store_id")
      .eq("phone", From)
      .maybeSingle();

    await sb.from("communication_logs").insert({
      store_id: contact?.store_id ?? null,
      contact_id: null, // store_contacts.id is not FK-compatible with communication_logs.contact_id (people)
      channel: "sms",
      direction: "inbound",
      message_content: Body,
      sender_phone: From,
      recipient_phone: To,
      twilio_sid: MessageSid,
      summary: "Customer opted out (STOP)",
      delivery_status: "received",
    });

    try {
      await sendOperatorSms({
        to: From,
        body: "You've been unsubscribed from GasMask. Reply START to opt in again.",
      });
    } catch (e) {
      console.error("[twilio-sms-webhook] STOP confirmation failed", (e as Error).message);
    }
    return new Response(EMPTY_TWIML, { headers: xmlHeaders });
  }

  // START keyword
  if (START_RE.test(Body)) {
    await sb.rpc("handle_sms_opt_in", { p_phone: From });
    const { data: contact } = await sb
      .from("store_contacts")
      .select("id, store_id")
      .eq("phone", From)
      .maybeSingle();

    await sb.from("communication_logs").insert({
      store_id: contact?.store_id ?? null,
      contact_id: null, // store_contacts.id is not FK-compatible with communication_logs.contact_id (people)
      channel: "sms",
      direction: "inbound",
      message_content: Body,
      sender_phone: From,
      recipient_phone: To,
      twilio_sid: MessageSid,
      summary: "Customer opted in (START)",
      delivery_status: "received",
    });

    try {
      await sendOperatorSms({
        to: From,
        body: "You're resubscribed. Reply STOP to opt out.",
      });
    } catch (e) {
      console.error("[twilio-sms-webhook] START confirmation failed", (e as Error).message);
    }
    return new Response(EMPTY_TWIML, { headers: xmlHeaders });
  }

  // Lookup store_contact (must NOT be opted out)
  const { data: contact } = await sb
    .from("store_contacts")
    .select("id, store_id")
    .eq("phone", From)
    .eq("opted_out", false)
    .limit(1)
    .maybeSingle();

  let store_id: string | null = contact?.store_id ?? null;
  // store_contacts.id is NOT FK-compatible with communication_logs.contact_id (which references `people`)
  let contact_id: string | null = null;

  // Fallback: stores.phone
  if (!store_id) {
    const { data: store } = await sb
      .from("stores")
      .select("id")
      .eq("phone", From)
      .limit(1)
      .maybeSingle();
    store_id = store?.id ?? null;
  }

  const isOrphan = !store_id;
  const summary = isOrphan
    ? "Inbound from unknown number"
    : Body.slice(0, 80);

  const { error: insertErr } = await sb.from("communication_logs").insert({
    store_id,
    contact_id,
    channel: "sms",
    direction: "inbound",
    operator_id: null,
    bland_ai_handled: false,
    message_content: Body,
    sender_phone: From,
    recipient_phone: To,
    twilio_sid: MessageSid,
    summary,
    delivery_status: "received",
    follow_up_required: isOrphan,
  });

  if (insertErr) {
    console.error("[twilio-sms-webhook] insert failed", insertErr.message);
  }

  return new Response(EMPTY_TWIML, { headers: xmlHeaders });
});
