const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REGISTERED_FUNCTIONS = [
  "twilio-voice-token",
  "twilio-outbound-call",
  "twilio-status-webhook",
  "twilio-voice-twiml",
  "twilio-elevenlabs-bridge",
  "health-check",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("FUNCTION ONLINE:", {
    name: "health-check",
    project: Deno.env.get("SUPABASE_URL"),
    time: new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      project_ref: Deno.env.get("SUPABASE_URL")?.match(/\/\/([^.]+)/)?.[1] || "unknown",
      functions: REGISTERED_FUNCTIONS,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
