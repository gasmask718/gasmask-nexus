import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TWILIO ↔ BLAND AI BRIDGE WEBHOOK
 *
 * Returns TwiML that bridges the Twilio call leg into a Bland AI inbound DID.
 * Bland AI handles the conversation; ElevenLabs is no longer used.
 *
 * Required env: BLAND_INBOUND_NUMBER (E.164 Bland AI inbound number)
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const blandDid = Deno.env.get("BLAND_INBOUND_NUMBER") || "";

    if (!blandDid) {
      console.error("[twilio-bridge] BLAND_INBOUND_NUMBER not configured");
      return xml(
        `<Say voice="Polly.Joanna">An internal configuration error occurred. Please try again later.</Say><Hangup/>`,
      );
    }

    console.log(`[twilio-bridge] Bridging to Bland AI DID ${blandDid}`);

    return xml(
      `<Say voice="Polly.Joanna">Please hold while we connect you to our agent.</Say>
  <Dial answerOnBridge="true" timeout="20"><Number>${blandDid}</Number></Dial>
  <Say voice="Polly.Joanna">We were unable to connect your call. Please try again later.</Say>
  <Hangup/>`,
    );
  } catch (error: unknown) {
    console.error("[twilio-bridge] Error:", error);
    return xml(`<Say voice="Polly.Joanna">A connection error occurred. Please try again later.</Say><Hangup/>`);
  }
});

function xml(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}\n</Response>`,
    { headers: { "Content-Type": "text/xml", ...corsHeaders } },
  );
}
