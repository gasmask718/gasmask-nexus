import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isSuppressed } from "../_shared/dnc.ts";

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
    const DEFAULT_CALLER_ID = "+19298225712";

    // Parse form data from Twilio
    let to = "";
    let callLogId = "";
    let fromCallerId = "";

    if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      to = (formData.get("To") as string) || "";
      callLogId = (formData.get("callLogId") as string) || "";
      // Prefer custom CallerId param (browser SDK passes user-selected number).
      // "From" is overwritten by Twilio to "client:identity" for browser SDK calls,
      // so we cannot rely on it as caller-ID source.
      fromCallerId =
        (formData.get("CallerId") as string) ||
        (formData.get("callerId") as string) ||
        (formData.get("From") as string) ||
        "";

      if (!to.startsWith("+")) {
        to = (formData.get("phone") as string) || to;
      }
    } else {
      const url = new URL(req.url);
      to = url.searchParams.get("To") || url.searchParams.get("phone") || "";
      callLogId = url.searchParams.get("callLogId") || "";
      fromCallerId =
        url.searchParams.get("CallerId") ||
        url.searchParams.get("callerId") ||
        url.searchParams.get("From") ||
        "";
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

    // ================== SUPPRESSION ENFORCEMENT (the real gate) ==================
    // This is the last server-controlled point before a real phone rings, so the
    // suppression check belongs HERE, not in va-power-dialer. va-power-dialer
    // returns JSON the browser is trusted to honour; a modified client, a stale
    // tab, or a replayed TwiML App request skips it entirely and lands straight
    // on this endpoint. Twilio will not dial anything we do not put in the TwiML.
    //
    // Fails CLOSED: isSuppressed() returns blocked on lookup error, and a
    // missing service-role key means we cannot check, so we refuse the dial.
    {
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      let blocked = true;
      let reason = "suppression_check_unavailable";
      if (SERVICE_ROLE_KEY) {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        const result = await isSuppressed(admin, to);
        blocked = result.blocked;
        reason = result.reason || "suppressed";
        if (blocked && callLogId) {
          try {
            await admin
              .from("va_call_logs")
              .update({ call_status: "dnc_skipped", disposition: "dnc" })
              .eq("id", callLogId);
          } catch (_) { /* logging must not unblock the gate */ }
        }
      }
      if (blocked) {
        console.warn(`[brandaro-call-twiml] BLOCKED dial to ${to} — ${reason}`);
        const blockedTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This number is on the do not call list. The call cannot be placed.</Say>
  <Hangup/>
</Response>`;
        return new Response(blockedTwiml, {
          headers: { "Content-Type": "text/xml", ...corsHeaders },
        });
      }
    }

    // Use VA-selected From number when it's valid E.164 AND owned by us
    // (verified against dc_phone_numbers). Twilio silently rewrites callerId
    // to the account default if the value is not a verified/owned number.
    let callerId = DEFAULT_CALLER_ID;
    if (/^\+\d{8,16}$/.test(fromCallerId)) {
      try {
        const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SERVICE_ROLE_KEY) {
          const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
          const { data: owned } = await admin
            .from("dc_phone_numbers")
            .select("phone_number")
            .eq("phone_number", fromCallerId)
            .eq("is_active", true)
            .maybeSingle();
          if (owned) callerId = fromCallerId;
          else console.warn(`[brandaro-call-twiml] CallerId ${fromCallerId} not in dc_phone_numbers, using default`);
        } else {
          callerId = fromCallerId;
        }
      } catch (e) {
        console.warn(`[brandaro-call-twiml] Whitelist check failed, trusting requested CallerId:`, e);
        callerId = fromCallerId;
      }
    }
    console.log(`[brandaro-call-twiml] Dialing ${to} from ${callerId} (requested=${fromCallerId || "n/a"}), callLogId=${callLogId}`);

    const safeCallLogId = encodeURIComponent(callLogId || "");
    const statusBase = `${SUPABASE_URL}/functions/v1/brandaro-call-status?callLogId=${safeCallLogId}`;
    // XML attribute values MUST escape & as &amp; — unescaped & makes Twilio
    // reject the TwiML with "an application error has occurred".
    const recordingCb = `${statusBase}&amp;event=recording`;
    const actionCb = `${statusBase}&amp;event=dial-complete`;
    const numberCb = `${statusBase}&amp;event=number-status`;

    // Recording consent gate: fail closed. We only record when the callee's
    // jurisdiction is known AND one-party. See _shared/recordingConsent.ts.
    const consentClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { attr: recAttr, decision: recDecision } = await recordAttrFor(consentClient, to, {
      mode: "record-from-answer-dual",
    });
    const recCbAttrs = recAttr
      ? ` recordingStatusCallback="${recordingCb}" recordingStatusCallbackMethod="POST"`
      : "";
    console.log(
      `[brandaro-call-twiml] recording=${recAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`,
    );

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}"${recAttr}${recCbAttrs} timeout="30"
    action="${actionCb}"
    method="POST">
    <Number statusCallback="${numberCb}"
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
