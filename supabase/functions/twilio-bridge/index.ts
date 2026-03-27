import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TWILIO ↔ ELEVENLABS BRIDGE WEBHOOK
 * 
 * Returns TwiML that:
 * 1. Plays a TTS greeting via Polly.Joanna
 * 2. Pauses 3 seconds
 * 3. Connects to ElevenLabs Conversational AI via <Connect><Stream>
 * 
 * Query params:
 *   - agent_id (optional, falls back to ELEVENLABS_AGENT_ID env var)
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id") || Deno.env.get("ELEVENLABS_AGENT_ID") || "";

    if (!agentId) {
      console.error("[twilio-bridge] No agent_id provided and ELEVENLABS_AGENT_ID not set");
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">An internal configuration error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`;
      return new Response(errorTwiml, {
        headers: { "Content-Type": "text/xml", ...corsHeaders },
      });
    }

    console.log(`[twilio-bridge] Serving TwiML for agent_id=${agentId}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please hold while we connect you to our agent.</Say>
  <Pause length="3"/>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/twiml?agent_id=${agentId}"/>
  </Connect>
</Response>`;

    return new Response(twiml, {
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("[twilio-bridge] Error:", error);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">A connection error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`;
    return new Response(fallback, {
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    });
  }
});
