// Public TwiML endpoint that handles the recipient's DTMF / speech response.
// Confirmed -> redirects to twilio-bridge-to-bland (Bland AI agent).
// Negative  -> polite hangup, queue row 'declined'.
// No input  -> reprompt once, then 'no_input' + hangup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const xmlHeaders = { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" };

const POSITIVE = ["yes", "yeah", "yep", "sure", "okay", "ok", "interested", "ready", "please", "go ahead"];
const NEGATIVE = ["no", "nope", "stop", "remove", "do not", "don't", "not interested", "decline"];

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const url = new URL(req.url);
    const campaign_id = url.searchParams.get("campaign_id");
    const queue_item_id = url.searchParams.get("queue_item_id");
    const lead_id = url.searchParams.get("lead_id");
    const agent_type = url.searchParams.get("agent_type") || "sales-outreach";
    const bland_agent_id = url.searchParams.get("bland_agent_id") || "";
    const attempt = parseInt(url.searchParams.get("attempt") || "1", 10);

    const form = await req.formData();
    const digits = (form.get("Digits")?.toString() || "").trim();
    const speech = (form.get("SpeechResult")?.toString() || "").toLowerCase().trim();
    const callSid = form.get("CallSid")?.toString() || "";
    const confidenceStr = form.get("Confidence")?.toString();
    const confidence = confidenceStr ? parseFloat(confidenceStr) : null;

    const isPositive = digits === "1" || POSITIVE.some((w) => speech.includes(w));
    const isNegative = digits === "2" || NEGATIVE.some((w) => speech.includes(w));

    // Log this confirmation step
    await supabase.from("dialer_call_events").insert({
      campaign_id,
      queue_item_id,
      call_sid: callSid,
      event_type: isPositive ? "confirm.accepted" : isNegative ? "confirm.declined" : "confirm.no_input",
      source: "twilio",
      payload: { digits, speech, confidence, attempt },
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
    const fb = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">An error occurred. Goodbye.</Say><Hangup/></Response>`;
    return new Response(fb, { headers: xmlHeaders });
  }
});
