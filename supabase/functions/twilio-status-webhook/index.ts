/**
 * Twilio "yes/no" gather webhook — confirms intent, then bridges to Bland AI.
 *
 * On positive confirmation, the Twilio call leg is dialed into the Bland AI
 * inbound DID. ElevenLabs is no longer used.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { readForm, verifyTwilio } from "../_shared/dialer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SEC-018: this endpoint bridges a live call to a paid AI agent on "yes".
    // An unsigned POST is a free way to make us dial out, so require the signature.
    const params = await readForm(req);
    const v = verifyTwilio(req, params);
    if (!v.ok) {
      console.error("[twilio-status-webhook] rejected unsigned request:", v.reason);
      return new Response(
        JSON.stringify({ error: "invalid_twilio_signature", reason: v.reason }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const formData = { get: (k: string) => params[k] ?? null };
    const digits = formData.get("Digits")?.toString() || "";
    const speechResult = formData.get("SpeechResult")?.toString().toLowerCase() || "";

    const isConfirmed =
      digits === "1" ||
      speechResult.includes("yes") ||
      speechResult.includes("yeah") ||
      speechResult.includes("sure") ||
      speechResult.includes("ready");

    let twiml = "";

    if (isConfirmed) {
      const blandDid = Deno.env.get("BLAND_INBOUND_NUMBER") || "";
      if (!blandDid) {
        twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Configuration error. No agent available.</Say><Hangup/></Response>`;
      } else {
        twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial answerOnBridge="true" timeout="20"><Number>${blandDid}</Number></Dial><Hangup/></Response>`;
      }
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Okay, we will cancel this request. Have a great day.</Say><Hangup/></Response>`;
    }

    return new Response(twiml.trim(), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    console.error("twilio-status-webhook error:", error);
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">An error occurred. Goodbye.</Say><Hangup/></Response>`;
    return new Response(fallbackTwiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
  }
});
