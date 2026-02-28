import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * TWILIO VOICE TWIML HANDLER
 * 
 * This is the Voice URL for the TwiML App. When the browser Voice SDK
 * initiates an outbound call, Twilio hits this URL to get TwiML instructions
 * for how to route the call.
 * 
 * It reads the destination phone number from the request and returns
 * a <Dial> TwiML to connect the browser leg to the PSTN number.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Twilio sends form-encoded POST data
    const formData = await req.formData();
    const to = formData.get("To")?.toString() || "";
    const rawFrom = formData.get("From")?.toString() || "";
    const isTestCall = formData.get("test_call")?.toString() === "true";
    
    // For callerId: ALWAYS use TWILIO_PHONE_NUMBER for PSTN calls.
    // The browser SDK sends the client identity as "From", which is NOT
    // a valid callerId for outbound PSTN <Dial>.
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
    const callerId = twilioPhoneNumber || rawFrom;

    console.log(JSON.stringify({
      mode: isTestCall ? "PSTN_TEST" : "ROUTED",
      to,
      callerId,
      rawFrom,
    }));

    if (!to) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>No destination number was provided.</Say>
  <Hangup/>
</Response>`;
      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml", ...corsHeaders },
      });
    }

    // Build status callback URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const projectId = supabaseUrl.replace("https://", "").split(".")[0];
    const statusCallbackUrl = `https://${projectId}.supabase.co/functions/v1/twilio-call-status`;

    // ── TEST CALL: Direct PSTN dial, no AI/agent routing ──
    if (isTestCall) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" record="record-from-answer-dual"
        statusCallbackEvent="initiated ringing answered completed"
        statusCallback="${statusCallbackUrl}"
        statusCallbackMethod="POST">
    <Number>${to}</Number>
  </Dial>
</Response>`;
      console.log(`✅ PSTN TEST TwiML generated for call to ${to}`);
      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml", ...corsHeaders },
      });
    }

    // ── NORMAL ROUTING ──
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" record="record-from-answer-dual"
        statusCallbackEvent="initiated ringing answered completed"
        statusCallback="${statusCallbackUrl}"
        statusCallbackMethod="POST">
    <Number>${to}</Number>
  </Dial>
</Response>`;

    console.log(`✅ TwiML generated for call to ${to}`);

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ TwiML handler error:", msg);

    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred connecting your call.</Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      status: 200,
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    });
  }
});
