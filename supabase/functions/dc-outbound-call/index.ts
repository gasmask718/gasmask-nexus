import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to_number, lead_name, lead_id, agent_type, campaign_id } = await req.json();

    if (!to_number) {
      return new Response(JSON.stringify({ error: "to_number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!TWILIO_SID || !TWILIO_TOKEN) {
      return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the right agent ID based on type
    const agentMap: Record<string, string | undefined> = {
      sales: Deno.env.get("DC_SALES_AGENT_ID"),
      followup: Deno.env.get("DC_FOLLOWUP_AGENT_ID"),
      reactivation: Deno.env.get("DC_REACTIVATION_AGENT_ID"),
    };

    const agentId = agentMap[agent_type || "sales"] || agentMap.sales;

    if (!agentId) {
      return new Response(JSON.stringify({ error: "No agent ID configured for type: " + agent_type }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get DC phone number
    const dcNumber = Deno.env.get("DC_PHONE_NUMBER") || "+18484004179";

    // Build TwiML that connects to ElevenLabs conversational AI
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}">
      <Parameter name="xi-api-key" value="${ELEVENLABS_KEY}"/>
      <Parameter name="caller_name" value="${lead_name || "there"}"/>
      <Parameter name="lead_id" value="${lead_id || ""}"/>
    </Stream>
  </Connect>
</Response>`;

    // Make the outbound call via Twilio
    const form = new URLSearchParams({
      To: to_number,
      From: dcNumber,
      Twiml: twiml,
      StatusCallback: `${SUPABASE_URL}/functions/v1/twilio-status-webhook`,
      StatusCallbackMethod: "POST",
      StatusCallbackEvent: "initiated ringing answered completed",
      MachineDetection: "DetectMessageEnd",
      AsyncAmdStatusCallback: `${SUPABASE_URL}/functions/v1/dc-amd-callback`,
      AsyncAmdStatusCallbackMethod: "POST",
      Record: "true",
      RecordingStatusCallback: `${SUPABASE_URL}/functions/v1/twilio-recording-callback`,
      RecordingStatusCallbackMethod: "POST",
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      }
    );

    const call = await res.json();

    if (!res.ok) {
      console.error("Twilio call failed:", call);
      return new Response(JSON.stringify({ error: "Call failed", details: call }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the call attempt to dc_call_logs
    if (SUPABASE_URL && SUPABASE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/dc_call_logs`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          call_sid: call.sid,
          to_number,
          from_number: dcNumber,
          lead_id: lead_id || null,
          campaign_id: campaign_id || null,
          agent_id: agentId,
          agent_type: agent_type || "sales",
          direction: "outbound",
          status: "initiated",
          lead_name: lead_name || null,
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_sid: call.sid,
        status: call.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("dc-outbound-call error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
