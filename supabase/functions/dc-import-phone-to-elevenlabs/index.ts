const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Import Twilio phone number into ElevenLabs and assign an agent.
 * 
 * POST body (optional):
 *   { "agent_id": "override_agent_id" }
 * 
 * Uses env vars:
 *   GASMASK_PHONE_NUMBER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *   ELEVENLABS_API_KEY, DC_INBOUND_AGENT_ID
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
    let PHONE_NUMBER = Deno.env.get("GASMASK_PHONE_NUMBER") || "";
    // Ensure E.164 format with + prefix
    if (PHONE_NUMBER && !PHONE_NUMBER.startsWith("+")) {
      PHONE_NUMBER = `+${PHONE_NUMBER}`;
    }
    const DEFAULT_AGENT = Deno.env.get("DC_INBOUND_AGENT_ID") || "";

    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!PHONE_NUMBER) {
      return new Response(JSON.stringify({ error: "GASMASK_PHONE_NUMBER not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!TWILIO_SID || !TWILIO_TOKEN) {
      return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure AC prefix
    const accountSid = TWILIO_SID.startsWith("AC") ? TWILIO_SID : `AC${TWILIO_SID.substring(2)}`;
    console.log(`DEBUG SID prefix: ${accountSid.substring(0, 4)}... len=${accountSid.length}, token len=${TWILIO_TOKEN.length}, phone=${PHONE_NUMBER}`);

    let body: Record<string, string> = {};
    try { body = await req.json(); } catch { /* no body is fine */ }
    const agentId = body.agent_id || DEFAULT_AGENT;

    // Step 1: Import phone number into ElevenLabs via Twilio integration
    console.log(`📞 Importing ${PHONE_NUMBER} into ElevenLabs...`);

    // ElevenLabs Twilio import requires sid/token at top level
    const importPayload: Record<string, unknown> = {
      phone_number: PHONE_NUMBER,
      provider: "twilio",
      sid: accountSid,
      token: TWILIO_TOKEN,
      label: "Dynasty Connect — Main Line",
    };

    const importResp = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers/create", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(importPayload),
    });

    const importData = await importResp.json();

    if (!importResp.ok) {
      // If number already exists, try to get existing
      if (importResp.status === 409 || JSON.stringify(importData).includes("already")) {
        console.log("📞 Phone number already imported, fetching existing...");
      } else {
        console.error("❌ ElevenLabs import failed:", importData);
        return new Response(JSON.stringify({
          error: "Failed to import phone number into ElevenLabs",
          details: importData,
        }), {
          status: importResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const phoneNumberId = importData?.phone_number_id || importData?.id;
    console.log(`✅ Phone imported: ${phoneNumberId || "already exists"}`);

    // Step 2: Assign agent to the phone number (if we have an agent ID)
    let assignResult = null;
    if (agentId && phoneNumberId) {
      console.log(`🤖 Assigning agent ${agentId} to phone ${phoneNumberId}...`);

      const assignResp = await fetch(
        `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}/agent`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agent_id: agentId }),
        }
      );

      assignResult = await assignResp.json();
      if (!assignResp.ok) {
        console.error("⚠️ Agent assignment failed:", assignResult);
      } else {
        console.log(`✅ Agent ${agentId} assigned to phone number`);
      }
    }

    // Step 3: List all phone numbers to verify
    const listResp = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });
    const phoneNumbers = await listResp.json();

    return new Response(JSON.stringify({
      success: true,
      imported: importData,
      phone_number_id: phoneNumberId,
      agent_assigned: agentId || null,
      assign_result: assignResult,
      all_phone_numbers: phoneNumbers,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("dc-import-phone-to-elevenlabs error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
