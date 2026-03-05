import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const digits = formData.get("Digits")?.toString() || "";
    const speechResult = formData.get("SpeechResult")?.toString().toLowerCase() || "";
    const callSid = formData.get("CallSid")?.toString() || "";

    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id");

    // Only proceed if they press 1 or say yes
    const isConfirmed =
      digits === "1" ||
      speechResult.includes("yes") ||
      speechResult.includes("yeah") ||
      speechResult.includes("sure") ||
      speechResult.includes("ready");

    let twiml = "";

    if (isConfirmed && agentId) {
      // 🔴 Removed the <Say> wrapper to remove TTS delay, jumping straight to Stream connection.
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Connect>
            <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}">
              <Parameter name="twilio_call_sid" value="${callSid}" />
            </Stream>
          </Connect>
        </Response>
      `;
    } else if (isConfirmed && !agentId) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Configuration error. No AI agent ID found.</Say><Hangup/></Response>`;
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Okay, we will cancel this request. Have a great day.</Say><Hangup/></Response>`;
    }

    return new Response(twiml.trim(), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    console.error("Gather Webhook Error:", error);
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">An error occurred. Goodbye.</Say><Hangup/></Response>`;
    return new Response(fallbackTwiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
  }
});
