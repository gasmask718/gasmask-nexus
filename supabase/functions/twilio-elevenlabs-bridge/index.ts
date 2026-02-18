import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * TWILIO ↔ ELEVENLABS BRIDGE
 *
 * Twilio hits this URL when an outbound call connects.
 * This function:
 *  1. Reads the agent_id from the query string
 *  2. Parses From / To from Twilio's form-encoded POST body
 *  3. Calls ElevenLabs Register Call API
 *  4. Returns the TwiML that ElevenLabs provides back to Twilio
 *
 * The TwiML instructs Twilio to open a WebSocket media stream
 * to ElevenLabs so the AI agent speaks directly on the phone call.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id");

    if (!agentId) {
      console.error("❌ Missing agent_id query parameter");
      // Return TwiML that says an error occurred
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, the AI agent could not be connected. Missing agent configuration.</Say><Hangup/></Response>`,
        { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } },
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY not configured");
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, the AI agent could not be connected. Missing API key.</Say><Hangup/></Response>`,
        { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } },
      );
    }

    // Parse Twilio form-encoded body
    const formData = await req.formData();
    const fromNumber = formData.get("From")?.toString() || "";
    const toNumber = formData.get("To")?.toString() || "";
    const callSid = formData.get("CallSid")?.toString() || "";

    console.log(`🔗 Bridge: CallSid=${callSid}, From=${fromNumber}, To=${toNumber}, AgentId=${agentId}`);

    // Call ElevenLabs Register Call API
    const registerResponse = await fetch(
      "https://api.elevenlabs.io/v1/convai/twilio/register-call",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: agentId,
          from_number: fromNumber,
          to_number: toNumber,
          direction: "outbound",
        }),
      },
    );

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error(`❌ ElevenLabs Register Call failed (${registerResponse.status}):`, errorText);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, the AI agent could not be connected. Please try again later.</Say><Hangup/></Response>`,
        { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } },
      );
    }

    // ElevenLabs returns TwiML XML directly
    const twiml = await registerResponse.text();
    console.log(`✅ ElevenLabs returned TwiML (${twiml.length} bytes)`);

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Bridge error:", msg);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred connecting the AI agent.</Say><Hangup/></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } },
    );
  }
};

serve(handler);
