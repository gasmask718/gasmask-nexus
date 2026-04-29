// Public TwiML endpoint that handles the recipient's DTMF / speech response.
// Confirmed -> redirects to twilio-bridge-to-bland (Bland AI agent).
// Negative  -> polite hangup, queue row 'declined'.
// No input  -> reprompt once, then 'no_input' + hangup.
//
// Hardened (2026-04-29):
//  - Twilio signature validation
//  - Idempotent event logging via dedupe key (call_sid|event|attempt)

import {
  corsHeaders,
  xmlHeaders,
  escapeXml,
  svc,
  verifyTwilio,
  readForm,
  logEvent,
} from "../_shared/dialer.ts";

const POSITIVE = ["yes", "yeah", "yep", "sure", "okay", "ok", "interested", "ready", "please", "go ahead"];
const NEGATIVE = ["no", "nope", "stop", "remove", "do not", "don't", "not interested", "decline"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const fail = (msg = "An error occurred. Goodbye.") =>
    new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escapeXml(msg)}</Say><Hangup/></Response>`,
      { headers: xmlHeaders },
    );

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = svc();

    const url = new URL(req.url);
    const campaign_id = url.searchParams.get("campaign_id");
    const queue_item_id = url.searchParams.get("queue_item_id");
    const lead_id = url.searchParams.get("lead_id");
    const agent_type = url.searchParams.get("agent_type") || "sales-outreach";
    const bland_agent_id = url.searchParams.get("bland_agent_id") || "";
    const call_session_id = url.searchParams.get("call_session_id");
    const attempt = parseInt(url.searchParams.get("attempt") || "1", 10);

    const params = await readForm(req);
    const auth = verifyTwilio(req, params);
    if (!auth.ok) {
      await logEvent({
        supabase, campaign_id, queue_item_id, call_session_id,
        call_sid: params["CallSid"] || null,
        event_type: "confirm.unauthorized", source: "twilio", severity: "warning",
        payload: { reason: auth.reason },
      });
      return fail("Unauthorized request.");
    }

    const digits = (params["Digits"] || "").trim();
    const speech = (params["SpeechResult"] || "").toLowerCase().trim();
    const callSid = params["CallSid"] || "";
    const confidence = params["Confidence"] ? parseFloat(params["Confidence"]) : null;

    const isPositive = digits === "1" || POSITIVE.some((w) => speech.includes(w));
    const isNegative = digits === "2" || NEGATIVE.some((w) => speech.includes(w));

    await logEvent({
      supabase, campaign_id, queue_item_id, call_session_id, call_sid: callSid,
      event_type: isPositive ? "confirm.accepted" : isNegative ? "confirm.declined" : "confirm.no_input",
      source: "twilio", severity: "info",
      payload: { digits, speech, confidence, attempt, method: digits ? "dtmf" : "speech" },
      dedupe_bucket: `attempt-${attempt}`,
    });

    if (callSid && (digits || speech)) {
      await supabase.from("live_call_transcripts").insert({
        call_sid: callSid,
        speaker: "caller",
        text: digits ? `[DTMF ${digits}]` : speech,
      });
    }

    // POSITIVE -> bridge to Bland
    if (isPositive) {
      if (queue_item_id) {
        await supabase
          .from("outbound_call_queue")
          .update({
            status: "bridging",
            confirmation_method: digits ? "dtmf" : "speech",
            confirmation_value: digits || speech,
            updated_at: new Date().toISOString(),
          })
          .eq("id", queue_item_id);
      }
      const ctx = new URLSearchParams({
        ...(campaign_id ? { campaign_id } : {}),
        ...(queue_item_id ? { queue_item_id } : {}),
        ...(lead_id ? { lead_id } : {}),
        agent_type,
        ...(bland_agent_id ? { bland_agent_id } : {}),
        ...(call_session_id ? { call_session_id } : {}),
      });
      const bridgeUrl = `${SUPABASE_URL}/functions/v1/twilio-bridge-to-bland?${ctx.toString()}`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Great. Connecting you now, please hold.</Say>
  <Redirect method="POST">${escapeXml(bridgeUrl)}</Redirect>
</Response>`;
      return new Response(twiml.trim(), { headers: xmlHeaders });
    }

    // NEGATIVE -> polite hangup
    if (isNegative) {
      if (queue_item_id) {
        await supabase
          .from("outbound_call_queue")
          .update({
            status: "declined",
            confirmation_method: digits ? "dtmf" : "speech",
            confirmation_value: digits || speech,
            ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", queue_item_id);
      }
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Understood. We will remove you from this list. Have a great day.</Say>
  <Hangup/>
</Response>`;
      return new Response(twiml.trim(), { headers: xmlHeaders });
    }

    // NO INPUT -> reprompt once, then give up
    if (attempt < 2) {
      const ctx = new URLSearchParams({
        ...(campaign_id ? { campaign_id } : {}),
        ...(queue_item_id ? { queue_item_id } : {}),
        ...(lead_id ? { lead_id } : {}),
        agent_type,
        ...(bland_agent_id ? { bland_agent_id } : {}),
        ...(call_session_id ? { call_session_id } : {}),
        attempt: String(attempt + 1),
      });
      const action = `${SUPABASE_URL}/functions/v1/twilio-campaign-confirm?${ctx.toString()}`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" numDigits="1" timeout="6" speechTimeout="auto"
          hints="yes,sure,okay,interested,one,two,no"
          action="${escapeXml(action)}" method="POST">
    <Say voice="Polly.Joanna">Sorry, I didn't catch that. Press 1 or say yes to continue, or press 2 to opt out.</Say>
  </Gather>
  <Say voice="Polly.Joanna">Goodbye.</Say>
  <Hangup/>
</Response>`;
      return new Response(twiml.trim(), { headers: xmlHeaders });
    }

    if (queue_item_id) {
      await supabase
        .from("outbound_call_queue")
        .update({
          status: "no_input",
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queue_item_id);
    }
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We did not receive a response. Goodbye.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml.trim(), { headers: xmlHeaders });
  } catch (err) {
    console.error("twilio-campaign-confirm error:", err);
    return fail();
  }
});
