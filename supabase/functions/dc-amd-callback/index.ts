import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid")?.toString() || "";
    const answeredBy = formData.get("AnsweredBy")?.toString() || "";

    console.log(`📞 AMD Callback: CallSid=${callSid}, AnsweredBy=${answeredBy}`);

    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // If voicemail/machine detected → hang up immediately
    if (
      answeredBy === "machine_start" ||
      answeredBy === "machine_end_beep" ||
      answeredBy === "machine_end_silence" ||
      answeredBy === "fax"
    ) {
      console.log(`🤖 Machine detected (${answeredBy}) — hanging up call ${callSid}`);

      // Hang up the call
      if (TWILIO_SID && TWILIO_TOKEN) {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls/${callSid}.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ Status: "completed" }),
          }
        );
      }

      // Update call log as voicemail
      if (SUPABASE_URL && SUPABASE_KEY) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/dc_call_logs?call_sid=eq.${callSid}`,
          {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              status: "voicemail",
              answered_by: answeredBy,
              outcome: "voicemail_skipped",
            }),
          }
        );
      }
    } else if (answeredBy === "human") {
      console.log(`👤 Human detected — letting AI speak on call ${callSid}`);

      // Update call log
      if (SUPABASE_URL && SUPABASE_KEY) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/dc_call_logs?call_sid=eq.${callSid}`,
          {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              status: "answered",
              answered_by: "human",
            }),
          }
        );
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("dc-amd-callback error:", err);
    return new Response("Error", { status: 500 });
  }
});
