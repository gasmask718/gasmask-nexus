import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyTwilio } from "../_shared/dialer.ts";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Twilio sends form-encoded POST data
    const formData = await req.formData();
    const sigParams: Record<string, string> = {};
    formData.forEach((v, k) => (sigParams[k] = String(v)));

    // ── Signature verification (Twilio signs this with the Account auth
    //     token even though the call originates from the browser SDK). ──
    const v = verifyTwilio(req, sigParams);
    if (!v.ok) {
      console.error(`[twilio-voice-twiml] signature invalid: ${v.reason}`);
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const to = formData.get("To")?.toString() || "";
    const rawFrom = formData.get("From")?.toString() || "";
    const isTestCall = formData.get("test_call")?.toString() === "true";
    
    // For callerId: ALWAYS use TWILIO_PHONE_NUMBER for PSTN calls.
    // The browser SDK sends the client identity as "From", which is NOT
    // a valid callerId for outbound PSTN <Dial>.
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER") || "";
    
    // CRITICAL: Never use a client: identity as callerId — it causes one-way audio
    const callerId = (twilioPhoneNumber && twilioPhoneNumber.startsWith("+")) 
      ? twilioPhoneNumber 
      : (rawFrom.startsWith("+") ? rawFrom : "");

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

    // If no valid callerId, omit the attribute so Twilio uses default
    const callerIdAttr = callerId ? `callerId="${callerId}"` : "";
    
    if (!callerId) {
      console.warn("⚠️ No valid callerId found — Twilio will use account default. Set TWILIO_PHONE_NUMBER secret.");
    }

    // Build status callback URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const projectId = supabaseUrl.replace("https://", "").split(".")[0];
    const statusCallbackUrl = `https://${projectId}.supabase.co/functions/v1/twilio-call-status`;

    // Recording consent gate on the callee. Fails closed.
    const consentClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { attr: recAttr, decision: recDecision } = await recordAttrFor(consentClient, to, {
      mode: "record-from-answer-dual",
    });
    console.log(`[twilio-voice-twiml] recording=${recAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);

    // ── TEST CALL: Direct PSTN dial, no AI/agent routing ──
    if (isTestCall) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial ${callerIdAttr}${recAttr}
        statusCallbackEvent="initiated ringing answered completed"
        statusCallback="${statusCallbackUrl}"
        statusCallbackMethod="POST">
    <Number>${to}</Number>
  </Dial>
</Response>`;
      console.log(JSON.stringify({
        verification: "PSTN_DIAL",
        to,
        callerId,
        test_call: true,
        isE164: /^\+\d{10,15}$/.test(to),
        caller_valid: callerId.startsWith("+"),
      }));
      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml", "X-Call-Mode": "PSTN_TEST", ...corsHeaders },
      });
    }

    // ── NORMAL ROUTING ──
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial ${callerIdAttr}${recAttr}
        statusCallbackEvent="initiated ringing answered completed"
        statusCallback="${statusCallbackUrl}"
        statusCallbackMethod="POST">
    <Number>${to}</Number>
  </Dial>
</Response>`;

    console.log(JSON.stringify({
      verification: "PSTN_DIAL",
      to,
      callerId,
      test_call: false,
      isE164: /^\+\d{10,15}$/.test(to),
      caller_valid: callerId.startsWith("+"),
    }));

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml", "X-Call-Mode": "ROUTED", ...corsHeaders },
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
