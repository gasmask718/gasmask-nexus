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
import { buildSmsTemplate } from "../_shared/smsTemplates.ts";
import { resolveNumberBrand } from "../_shared/inboundNumberBrand.ts";

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

  // ── SYNTHETIC PROBE SHORT-CIRCUIT ──
  // comms-health-monitor sends signed probes with MessageSid prefixed "SMhealth"
  // and From=+15005550006 (Twilio magic test number). ACK without any
  // side effects: no opt_out write, no confirmation SMS. Prevents the
  // every-20-min "You've been unsubscribed" leak.
  if (MessageSid.startsWith("SMhealth") && From === "+15005550006") {
    console.log(`[twilio-sms-webhook] synthetic probe ack sid=${MessageSid}`);
    return new Response(
      JSON.stringify({ success: true, synthetic: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const sb = svc();

  // Resolve the owning brand from the To number. NEVER let
  // communication_logs.business_id fall through to its GasMask default.
  const numberBrand = await resolveNumberBrand(sb, To, "twilio-sms-webhook");
  console.log(`[twilio-sms-webhook] to=${To} brand=${numberBrand.brand ?? "UNKNOWN"} business_id=${numberBrand.business_id ?? "NULL"}`);


  // STOP keyword
  if (STOP_RE.test(Body)) {
    const { data: cid } = await sb.rpc("handle_sms_opt_out", {
      p_phone: From,
      p_method: "STOP_keyword",
    });
    // Association left to autolink_communication_log() (conversation-first).
    await sb.from("communication_logs").insert({
      store_id: null,
      contact_id: null,

      channel: "sms",
      direction: "inbound",
      message_content: Body,
      sender_phone: From,
      recipient_phone: To,
      twilio_sid: MessageSid,
      business_id: numberBrand.business_id,
      brand: numberBrand.brand,
      source_business: numberBrand.source_business,
      summary: "Customer opted out (STOP)",
      delivery_status: "received",
    });

    try {
      await sendOperatorSms({
        to: From,
        body: buildSmsTemplate("stop_acknowledgment", { brand: "GasMask" }),
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
      contact_id: contact?.id ?? null, // no FK on communication_logs.contact_id
      channel: "sms",
      direction: "inbound",
      message_content: Body,
      sender_phone: From,
      recipient_phone: To,
      twilio_sid: MessageSid,
      business_id: numberBrand.business_id,
      brand: numberBrand.brand,
      source_business: numberBrand.source_business,
      summary: "Customer opted in (START)",
      delivery_status: "received",
    });

    try {
      await sendOperatorSms({
        to: From,
        body: buildSmsTemplate("start_acknowledgment", {}),
      });
    } catch (e) {
      console.error("[twilio-sms-webhook] START confirmation failed", (e as Error).message);
    }
    return new Response(EMPTY_TWIML, { headers: xmlHeaders });
  }

  // ── NUMBER VERIFICATION — confirm contact if recent verification text is pending ──
  // Runs for ALL inbound numbers, regardless of which Twilio number received the YES.
  try {
    const body_lower_v = Body.trim().toLowerCase();
    const isYes = /^(y|yes|yep|yeah|yup|ok|okay|sure|confirmed|got it|gotit|saved|👍)\b/.test(body_lower_v);
    if (isYes) {
      const last10 = (From || "").replace(/\D/g, "").slice(-10);
      if (last10.length === 10) {
        const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: pendingVerif } = await sb
          .from("store_contacts")
          .select("id, name, store_id")
          .ilike("phone", `%${last10}`)
          .in("number_verification_status", ["sent", "delivered"])
          .gte("number_verification_sent_at", sinceIso)
          .order("number_verification_sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingVerif) {
          await sb.from("store_contacts").update({
            number_verification_status: "confirmed",
            number_verification_confirmed_at: new Date().toISOString(),
            verified_at: new Date().toISOString(),
          }).eq("id", pendingVerif.id);
          console.log(`[twilio-sms-webhook][VERIFY] ✅ Contact ${pendingVerif.id} (${pendingVerif.name}) CONFIRMED via YES from ${From} to ${To}`);

          await sb.from("communication_logs").insert({
            store_id: pendingVerif.store_id ?? null,
            contact_id: pendingVerif.id, // store_contacts.id — no FK on communication_logs.contact_id
            channel: "sms",
            direction: "inbound",
            summary: `Number verification CONFIRMED by ${pendingVerif.name}`,
            message_content: Body.trim(),
            sender_phone: From,
            recipient_phone: To,
            twilio_sid: MessageSid,
            business_id: numberBrand.business_id,
            brand: numberBrand.brand,
            source_business: numberBrand.source_business,
            delivery_status: "received",
            outcome: "verification_confirmed",
          });
        }
      }
    }
  } catch (vErr) {
    console.error("[twilio-sms-webhook][VERIFY] error:", (vErr as Error).message);
  }

  // ── ACCOUNT ASSOCIATION ──
  // Deliberately NOT resolved here. public.autolink_communication_log()
  // is the single reusable rule for every inbound message:
  //   1. reply → the exact store/contact of the most recent outbound message
  //      to this number (conversation context wins, always)
  //   2. otherwise a single matching contact
  //   3. multiple stores on the same number → left unmatched + flagged.
  // A first-match `.limit(1)` lookup here would silently override that and
  // move a reply onto the wrong store.
  const store_id: string | null = null;
  const contact_id: string | null = null;

  const summary = Body.slice(0, 80) || "Inbound message";

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
    business_id: numberBrand.business_id,
    brand: numberBrand.brand,
    source_business: numberBrand.source_business,
    summary,
    delivery_status: "received",
  });


  if (insertErr) {
    console.error("[twilio-sms-webhook] insert failed", insertErr.message);
  }

  return new Response(EMPTY_TWIML, { headers: xmlHeaders });
});
