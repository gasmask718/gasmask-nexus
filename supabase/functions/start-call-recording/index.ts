import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { call_sid } = await req.json();
    if (!call_sid) throw new Error("call_sid required");

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const recordingCallback = `${supabaseUrl}/functions/v1/twilio-recording-callback`;

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call_sid}/Recordings.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          RecordingChannels: "dual",
          RecordingStatusCallback: recordingCallback,
          RecordingStatusCallbackEvent: "completed",
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twilio recording failed: ${err}`);
    }

    const data = await res.json();
    console.log(`🎙️ Recording started: ${data.sid} for call ${call_sid}`);

    return new Response(JSON.stringify({ success: true, recording_sid: data.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("start-call-recording error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
