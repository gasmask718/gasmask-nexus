import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Brandaro TwiML endpoint — called by Twilio when a browser SDK call is placed.
 * Returns TwiML to dial the target number with recording enabled.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const DEFAULT_CALLER_ID = "+19292623850";

    // Parse form data from Twilio
    let to = "";
    let callLogId = "";
    let fromCallerId = "";

    if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      to = (formData.get("To") as string) || "";
      callLogId = (formData.get("callLogId") as string) || "";
      fromCallerId = (formData.get("From") as string) || "";

      // If To is not a phone number, check custom params
      if (!to.startsWith("+")) {
        to = (formData.get("phone") as string) || to;
      }
    } else {
      const url = new URL(req.url);
      to = url.searchParams.get("To") || url.searchParams.get("phone") || "";
      callLogId = url.searchParams.get("callLogId") || "";
      fromCallerId = url.searchParams.get("From") || "";
    }

    if (!to || !to.startsWith("+")) {
      console.error("[brandaro-call-twiml] Invalid To number:", to);
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Invalid phone number provided.</Say>
  <Hangup/>
</Response>`;
      return new Response(errorTwiml, {
        headers: { "Content-Type": "text/xml", ...corsHeaders },
      });
    }

    // Use VA-selected From number when valid E.164, else fall back to default.
    // Twilio's browser SDK auto-prefixes "client:" to identity-style From values
    // — only honor numeric +E.164 strings as caller-ID.
    const callerId = /^\+\d{8,16}$/.test(fromCallerId) ? fromCallerId : DEFAULT_CALLER_ID;
    console.log(`[brandaro-call-twiml] Dialing ${to} from ${callerId} (requested=${fromCallerId || "n/a"}), callLogId=${callLogId}`);

    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/brandaro-call-status?callLogId=${callLogId}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" record="record-from-answer-dual" timeout="30"
    recordingStatusCallback="${SUPABASE_URL}/functions/v1/brandaro-call-status?callLogId=${callLogId}&event=recording"
    recordingStatusCallbackMethod="POST"
    action="${SUPABASE_URL}/functions/v1/brandaro-call-status?callLogId=${callLogId}&event=dial-complete"
    method="POST">
    <Number statusCallback="${statusCallbackUrl}&event=number-status"
      statusCallbackEvent="initiated ringing answered completed"
      statusCallbackMethod="POST">${to}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("[brandaro-call-twiml] Error:", error);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again.</Say>
  <Hangup/>
</Response>`;
    return new Response(fallback, {
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    });
  }
});
