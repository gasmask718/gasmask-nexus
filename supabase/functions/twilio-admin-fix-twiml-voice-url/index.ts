import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const projectId = SUPABASE_URL.replace("https://", "").split(".")[0];

    const url = new URL(req.url);
    const appSid = url.searchParams.get("sid") || Deno.env.get("TWILIO_TWIML_APP_SID") || "";
    const target = url.searchParams.get("target") || "twilio-voice-twiml";
    const voiceUrl = `https://${projectId}.supabase.co/functions/v1/${target}`;

    if (!appSid.startsWith("AP")) {
      return new Response(JSON.stringify({ error: "invalid_sid", appSid }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = "Basic " + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

    // GET current
    const before = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Applications/${appSid}.json`,
      { headers: { Authorization: auth } }
    ).then(r => r.json());

    // POST update
    const body = new URLSearchParams({
      VoiceUrl: voiceUrl,
      VoiceMethod: "POST",
    });
    const updated = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Applications/${appSid}.json`,
      { method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body }
    );
    const updatedJson = await updated.json();

    return new Response(JSON.stringify({
      ok: updated.ok,
      status: updated.status,
      appSid,
      before: { voice_url: before.voice_url, voice_method: before.voice_method, friendly_name: before.friendly_name },
      after: { voice_url: updatedJson.voice_url, voice_method: updatedJson.voice_method },
      requested_voice_url: voiceUrl,
    }, null, 2), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
