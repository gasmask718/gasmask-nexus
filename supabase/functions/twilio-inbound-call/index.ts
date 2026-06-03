/**
 * TWILIO INBOUND CALL HANDLER (also the dc-inbound-call handler)
 *
 * Returns TwiML to bridge a Twilio inbound call to its assigned AI agent.
 *
 * Resolution order (TABLE-DRIVEN — same principle as outbound):
 *   1. Look up the To-number in v_phone_directory → (business, assigned_agent_id)
 *   2. If assigned_agent_id present, route to that Bland AI inbound DID
 *   3. Otherwise fall back to per-business BLAND_INBOUND_NUMBER env var
 *   4. Otherwise fall back to global BLAND_INBOUND_NUMBER
 *
 * The <Dial action=...> callback fires gasmask-missed-call-handler so
 * unanswered GasMask calls automatically receive an SMS recovery message.
 *
 * Twilio signature is verified (TWILIO_WEBHOOK_AUTH_TOKEN). Set
 * DIALER_SKIP_TWILIO_VERIFY=true to bypass during local debugging.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, readForm, verifyTwilio, canonicalUrl, escapeXml } from "../_shared/dialer.ts";

const ENV_FALLBACK_DID: Record<string, string | undefined> = {
  gasmask: "GASMASK_BLAND_INBOUND_NUMBER",
  unforgettable_times: "UT_BLAND_INBOUND_NUMBER",
  real_estate: "RE_BLAND_INBOUND_NUMBER",
  surplus_funds: "SF_BLAND_INBOUND_NUMBER",
  top_tier: "TT_BLAND_INBOUND_NUMBER",
  brandaro: "BRANDARO_BLAND_INBOUND_NUMBER",
  iclean: "ICLEAN_BLAND_INBOUND_NUMBER",
};

function twiml(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}\n</Response>`,
    { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);

  // ── Signature verification ──
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[twilio-inbound-call] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const callSid = params.CallSid || "";
  const from = params.From || "";
  const to = params.To || "";

  console.log(`📞 Inbound: SID=${callSid}, From=${from}, To=${to}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── DIRECTORY LOOKUP (table-driven) ──
  const last10 = to.replace(/\D/g, "").slice(-10);
  let business: string | null = null;
  let assignedAgentId: string | null = null;

  // Exact match first
  let { data: dirRow } = await supabase
    .from("v_phone_directory")
    .select("business, assigned_agent_id, is_active")
    .eq("phone_e164", to)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  // Fallback: match by last-10
  if (!dirRow && last10) {
    const { data: rows } = await supabase
      .from("v_phone_directory")
      .select("business, assigned_agent_id, phone_e164, is_active")
      .eq("is_active", true)
      .ilike("phone_e164", `%${last10}`)
      .limit(1);
    dirRow = rows?.[0] || null;
  }

  if (dirRow) {
    business = dirRow.business || null;
    assignedAgentId = dirRow.assigned_agent_id || null;
  }

  // ── Resolve Bland DID ──
  let blandDid = assignedAgentId || "";
  let source = assignedAgentId ? "directory" : "";

  if (!blandDid && business) {
    const envKey = ENV_FALLBACK_DID[business];
    if (envKey) {
      blandDid = Deno.env.get(envKey) || "";
      if (blandDid) source = `env:${envKey}`;
    }
  }
  if (!blandDid) {
    blandDid = Deno.env.get("BLAND_INBOUND_NUMBER") || "";
    if (blandDid) source = "env:BLAND_INBOUND_NUMBER";
  }

  console.log(`[twilio-inbound-call] resolved business=${business} agent=${blandDid} source=${source}`);

  if (!blandDid) {
    console.error(`❌ No inbound DID configured for ${to} (business=${business})`);
    return twiml(`<Say voice="alice">We're sorry, this line is not yet configured. Please try again later.</Say><Hangup/>`);
  }

  // Fire-and-forget log
  supabase.from("dc_call_logs").insert({
    call_sid: callSid,
    from_number: from,
    to_number: to,
    direction: "inbound",
    status: "answered",
    agent_id: blandDid,
    business: business,
  }).then(({ error }) => { if (error) console.error("Call log error:", error.message); });

  // ── Build action callback URL for missed-call recovery ──
  const u = new URL(canonicalUrl(req));
  const supaUrl = `${u.protocol}//${u.host}`;
  const actionUrl = `${supaUrl}/functions/v1/gasmask-missed-call-handler?business=${encodeURIComponent(business || "")}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return twiml(`
  <Dial answerOnBridge="true" timeout="20"
        action="${escapeXml(actionUrl)}" method="POST">
    <Number>${escapeXml(blandDid)}</Number>
  </Dial>
  <Say voice="alice">We were unable to connect your call. Please try again later.</Say>
  <Hangup/>`);
});
