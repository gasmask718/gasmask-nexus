import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * CALL LIVE HANDOFF
 *
 * Called by the ElevenLabs agent (as a server tool) when interest keywords
 * are detected during an AI call.  Uses the Twilio REST API to redirect
 * the active call leg to a <Dial> TwiML that connects the caller to a
 * live mobile number.
 *
 * Expected JSON body (from ElevenLabs tool or direct POST):
 *   { call_sid, handoff_number?, reason? }
 *
 * Also serves as a TwiML endpoint:  Twilio will GET/POST this URL after
 * the redirect and we return the <Dial> TwiML.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Default handoff number – overridable per-call
const DEFAULT_HANDOFF_NUMBER = Deno.env.get("LIVE_HANDOFF_NUMBER") || "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ── TwiML mode: Twilio redirects here after we update the call ──
    if (url.searchParams.has("twiml")) {
      const handoffNumber =
        url.searchParams.get("number") || DEFAULT_HANDOFF_NUMBER;
      const callSid = url.searchParams.get("call_sid") || "";

      if (!handoffNumber) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, no live agent number is configured.</Say><Hangup/></Response>`,
          { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } },
        );
      }

      console.log(
        `📞 Handoff TwiML: dialling ${handoffNumber} for CallSid=${callSid}`,
      );

      // Log handoff event
      await logHandoff(callSid, handoffNumber, "twiml_served");

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please hold while I connect you to a live representative.</Say>
  <Dial callerId="+18555551234" timeout="30" action="${url.origin}/functions/v1/call-live-handoff?post_dial=1&amp;call_sid=${encodeURIComponent(callSid)}">
    <Number>${handoffNumber}</Number>
  </Dial>
  <Say>Sorry, the representative is unavailable at this time. Goodbye.</Say>
  <Hangup/>
</Response>`;

      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml", ...corsHeaders },
      });
    }

    // ── Post-dial status (Twilio action callback) ──
    if (url.searchParams.has("post_dial")) {
      const callSid = url.searchParams.get("call_sid") || "";
      const formData = await req.formData();
      const dialStatus = formData.get("DialCallStatus")?.toString() || "unknown";
      console.log(`📞 Post-dial status for ${callSid}: ${dialStatus}`);
      await logHandoff(callSid, "", `post_dial_${dialStatus}`);

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for your time. Goodbye.</Say><Hangup/></Response>`,
        { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } },
      );
    }

    // ── API mode: redirect an active Twilio call ──
    const body = await req.json();
    const {
      call_sid,
      handoff_number,
      reason,
    }: { call_sid: string; handoff_number?: string; reason?: string } = body;

    if (!call_sid) {
      return new Response(
        JSON.stringify({ error: "call_sid is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const targetNumber = handoff_number || DEFAULT_HANDOFF_NUMBER;
    if (!targetNumber) {
      return new Response(
        JSON.stringify({ error: "No handoff number provided or configured" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error("❌ Missing Twilio credentials");
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Build the TwiML URL that Twilio will fetch after the redirect
    const projectId = Deno.env.get("SUPABASE_URL")?.replace("https://", "").split(".")[0] || "";
    const twimlUrl =
      `https://${projectId}.supabase.co/functions/v1/call-live-handoff?twiml=1&number=${encodeURIComponent(targetNumber)}&call_sid=${encodeURIComponent(call_sid)}`;

    console.log(`🔀 Redirecting CallSid=${call_sid} → ${targetNumber} (reason: ${reason || "interest detected"})`);

    // Use Twilio REST API to redirect the active call
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call_sid}.json`;
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const redirectRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Url: twimlUrl, Method: "POST" }).toString(),
    });

    if (!redirectRes.ok) {
      const errText = await redirectRes.text();
      console.error(`❌ Twilio redirect failed (${redirectRes.status}):`, errText);
      return new Response(
        JSON.stringify({ error: "Twilio redirect failed", details: errText }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    await redirectRes.text(); // consume body

    // Log the handoff trigger
    await logHandoff(call_sid, targetNumber, "redirect_initiated", reason);

    return new Response(
      JSON.stringify({ success: true, call_sid, handoff_number: targetNumber }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Handoff error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});

/** Persist handoff event to manual_call_logs */
async function logHandoff(
  callSid: string,
  handoffNumber: string,
  event: string,
  reason?: string,
) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Update existing call log with handoff info
    const { error } = await supabase
      .from("manual_call_logs")
      .update({
        handoff_triggered_at: new Date().toISOString(),
        notes: `[HANDOFF ${event}] ${reason || "Interest detected"} → ${handoffNumber}`,
      })
      .eq("twilio_call_sid", callSid);

    if (error) {
      console.error("❌ Failed to log handoff:", error.message);
    } else {
      console.log(`🧾 Handoff logged for CallSid=${callSid}`);
    }
  } catch (e: unknown) {
    console.error("❌ logHandoff error:", e instanceof Error ? e.message : String(e));
  }
}
