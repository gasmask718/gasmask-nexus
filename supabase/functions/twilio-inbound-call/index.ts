/**
 * TWILIO INBOUND CALL HANDLER — Bland AI Bridge
 *
 * Returns the TwiML needed to connect a Twilio inbound call to a Bland AI agent.
 *
 * Routing:
 *   1. Look up the called number (To) in a phone → Bland inbound DID map
 *      (per-business overrides set via env vars).
 *   2. Fall back to BLAND_INBOUND_NUMBER (the global Bland AI inbound DID).
 *   3. Dial that DID; on no-answer/failure, play a polite message and hang up.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

    // ── Multi-business phone → Bland inbound DID mapping ──
    // Each business can have its own dedicated Bland AI inbound number.
    // If no business-specific override is set, fall back to BLAND_INBOUND_NUMBER.
    const phoneMap: Record<string, string> = {};
    const mapping: [string | undefined, string | undefined][] = [
      [Deno.env.get("GASMASK_PHONE_NUMBER"), Deno.env.get("GASMASK_BLAND_INBOUND_NUMBER")],
      [Deno.env.get("UT_PHONE_NUMBER"), Deno.env.get("UT_BLAND_INBOUND_NUMBER")],
      [Deno.env.get("RE_PHONE_NUMBER"), Deno.env.get("RE_BLAND_INBOUND_NUMBER")],
      [Deno.env.get("SF_PHONE_NUMBER"), Deno.env.get("SF_BLAND_INBOUND_NUMBER")],
      [Deno.env.get("TT_PHONE_NUMBER"), Deno.env.get("TT_BLAND_INBOUND_NUMBER")],
      [Deno.env.get("BRANDARO_PHONE_NUMBER"), Deno.env.get("BRANDARO_BLAND_INBOUND_NUMBER")],
      [Deno.env.get("ICLEAN_PHONE_NUMBER"), Deno.env.get("ICLEAN_BLAND_INBOUND_NUMBER")],
    ];
    for (const [phone, did] of mapping) {
      if (phone && did) phoneMap[phone] = did;
    }

    const last10 = to.replace(/\D/g, "").slice(-10);
    let blandDid = phoneMap[to] || "";
    if (!blandDid) {
      for (const [phone, did] of Object.entries(phoneMap)) {
        if (phone.replace(/\D/g, "").slice(-10) === last10) {
          blandDid = did;
          break;
        }
      }
    }
    if (!blandDid) {
      blandDid = Deno.env.get("BLAND_INBOUND_NUMBER") || "";
    }

    if (!blandDid) {
      console.error(`❌ No Bland AI inbound DID configured for ${to}`);
      return twiml(
        `<Say voice="alice">We're sorry, this line is not yet configured. Please try again later.</Say><Hangup/>`,
      );
    }

    console.log(`🤖 Bridging inbound to Bland AI DID ${blandDid}`);

    // Fire-and-forget log to dc_call_logs
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
          agent_id: blandDid,
        }),
      }).catch((e) => console.error("Call log error:", e));
    }

    // Bridge the Twilio leg into Bland AI's inbound DID.
    return twiml(`
  <Dial answerOnBridge="true" timeout="20">
    <Number>${escapeXml(blandDid)}</Number>
  </Dial>
  <Say voice="alice">We were unable to connect your call. Please try again later.</Say>
  <Hangup/>`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Inbound call error:", msg);
    return twiml(`<Say voice="alice">A system error occurred. Please try again.</Say><Hangup/>`);
  }
});

function twiml(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}\n</Response>`,
    { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
  );
}
