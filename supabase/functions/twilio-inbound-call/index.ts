/**
 * TWILIO INBOUND CALL HANDLER — Clean ElevenLabs Bridge
 * 
 * Returns ONLY the TwiML needed to connect Twilio → ElevenLabs.
 * No time checks. No forwarding. No after-hours logic. No fallback routing.
 * 
 * Multi-business routing: matches the called number to the correct
 * ElevenLabs agent ID via environment variables.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid")?.toString() || "";
    const from = formData.get("From")?.toString() || "";
    const to = formData.get("To")?.toString() || "";

    console.log(`📞 Inbound: SID=${callSid}, From=${from}, To=${to}`);

    const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_API_KEY") || "";

    if (!ELEVENLABS_KEY) {
      console.error("❌ ELEVENLABS_API_KEY not configured");
      return twiml(`<Say voice="alice">System configuration error. Please try again later.</Say><Hangup/>`);
    }

    // ── Multi-business phone → agent mapping ──
    const phoneAgentMap: Record<string, string> = {};

    const mapping: [string | undefined, string | undefined][] = [
      [Deno.env.get("GASMASK_PHONE_NUMBER"), Deno.env.get("DC_INBOUND_AGENT_ID")],
      [Deno.env.get("UT_PHONE_NUMBER"), Deno.env.get("UT_CONCIERGE_AGENT_ID")],
      [Deno.env.get("RE_PHONE_NUMBER"), Deno.env.get("RE_QUALIFIER_AGENT_ID")],
      [Deno.env.get("SF_PHONE_NUMBER"), Deno.env.get("SF_CLIENT_AGENT_ID")],
      [Deno.env.get("TT_PHONE_NUMBER"), Deno.env.get("TT_CONCIERGE_AGENT_ID")],
      [Deno.env.get("BRANDARO_PHONE_NUMBER"), Deno.env.get("BRANDARO_SALES_AGENT_ID")],
      [Deno.env.get("ICLEAN_PHONE_NUMBER"), Deno.env.get("ICLEAN_BOOKING_AGENT_ID")],
    ];

    for (const [phone, agent] of mapping) {
      if (phone && agent) phoneAgentMap[phone] = agent;
    }

    // Resolve agent: match by full number, then by last 10 digits, then default
    const last10 = to.replace(/\D/g, "").slice(-10);
    let agentId = phoneAgentMap[to] || "";

    if (!agentId) {
      for (const [phone, agent] of Object.entries(phoneAgentMap)) {
        if (phone.replace(/\D/g, "").slice(-10) === last10) {
          agentId = agent;
          break;
        }
      }
    }

    // Final fallback: use DC_INBOUND_AGENT_ID
    if (!agentId) {
      agentId = Deno.env.get("DC_INBOUND_AGENT_ID") || "";
    }

    if (!agentId) {
      console.error(`❌ No agent ID resolved for number: ${to}`);
      return twiml(`<Say voice="alice">We're sorry, this line is not yet configured. Please try again later.</Say><Hangup/>`);
    }

    console.log(`🤖 Routing to agent ${agentId}`);

    // Log to dc_call_logs (fire and forget)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SUPABASE_URL && SUPABASE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/dc_call_logs`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          call_sid: callSid,
          from_number: from,
          to_number: to,
          direction: "inbound",
          status: "answered",
          agent_id: agentId,
        }),
      }).catch((e) => console.error("Call log error:", e));
    }

    // Return clean TwiML — ElevenLabs Conversational AI bridge
    return twiml(`
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}">
      <Parameter name="xi-api-key" value="${ELEVENLABS_KEY}"/>
      <Parameter name="call_sid" value="${callSid}"/>
      <Parameter name="caller_number" value="${from}"/>
    </Stream>
  </Connect>`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Inbound call error:", msg);
    return twiml(`<Say voice="alice">A system error occurred. Please try again.</Say><Hangup/>`);
  }
});

function twiml(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}\n</Response>`,
    { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
  );
}
