// Bridges the live Twilio call to a Bland AI agent.
//
// Mode A (default, bridge_mode='bland_did' + BLAND_INBOUND_NUMBER set):
//   <Dial timeout="..." action="/twilio-bridge-fallback"> + <Number>{BLAND_INBOUND_NUMBER}</Number>
//   If Bland answers within timeout, the legs bridge.
//   If not, Twilio hits the action URL (twilio-bridge-fallback) which marks
//   failed_bridge, optionally requeues, and plays a polite "we'll call you back".
//
// Mode B (no BLAND_INBOUND_NUMBER OR bridge_mode='bland_api'):
//   Triggers a Bland API outbound call to the same recipient,
//   plays a brief "connecting you now" message, and hangs up the Twilio leg.
//
// Hardened (2026-04-29):
//  - <Dial timeout> + bridge fallback action URL
//  - Twilio signature validation
//  - Bland API failures requeue the lead per campaign config
//  - All paths logged into dialer_call_events with severity

import { recordAttrFor } from "../_shared/recordingConsent.ts";
import {
  corsHeaders,
  xmlHeaders,
  escapeXml,
  svc,
  verifyTwilio,
  readForm,
  logEvent,
  blandWebhookUrl,
} from "../_shared/dialer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const fail = (msg = "An error occurred. Goodbye.") =>
    new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escapeXml(msg)}</Say><Hangup/></Response>`,
      { headers: xmlHeaders },
    );

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY");
    const BLAND_INBOUND_NUMBER = Deno.env.get("BLAND_INBOUND_NUMBER");
    const supabase = svc();

    const url = new URL(req.url);
    const campaign_id = url.searchParams.get("campaign_id");
    const queue_item_id = url.searchParams.get("queue_item_id");
    const lead_id = url.searchParams.get("lead_id");
    const agent_type = url.searchParams.get("agent_type") || "sales-outreach";
    const bland_agent_id = url.searchParams.get("bland_agent_id") || "";
    const call_session_id = url.searchParams.get("call_session_id");

    const params = await readForm(req);
    const auth = verifyTwilio(req, params);
    if (!auth.ok) {
      await logEvent({
        supabase, campaign_id, queue_item_id, call_session_id,
        call_sid: params["CallSid"] || null,
        event_type: "bridge.unauthorized", source: "twilio", severity: "warning",
        payload: { reason: auth.reason },
      });
      return fail("Unauthorized request.");
    }

    const callSid = params["CallSid"] || "";
    const calledTo = params["To"] || "";

    // Load campaign bridge config + the script we want Bland to follow.
    let bridgeMode = "bland_did";
    let bridgeTimeout = 15;
    let campaignScript: string | null = null;
    if (campaign_id) {
      const { data: c } = await supabase
        .from("dialer_campaigns")
        .select("bridge_mode, bridge_timeout_seconds, initial_script")
        .eq("id", campaign_id)
        .maybeSingle();
      if ((c as any)?.bridge_mode) bridgeMode = (c as any).bridge_mode;
      if ((c as any)?.bridge_timeout_seconds) bridgeTimeout = (c as any).bridge_timeout_seconds;
      if ((c as any)?.initial_script) campaignScript = (c as any).initial_script;
    }

    const useDid = bridgeMode === "bland_did" && !!BLAND_INBOUND_NUMBER;

    if (queue_item_id) {
      await supabase
        .from("outbound_call_queue")
        .update({
          status: useDid ? "bridging" : "bridged",
          bridge_attempted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queue_item_id);
    }
    await logEvent({
      supabase, campaign_id, queue_item_id, call_session_id, call_sid: callSid,
      event_type: "bridge.start", source: "twilio", severity: "info",
      payload: { mode: useDid ? "bland_did" : "bland_api", bland_agent_id, agent_type, timeout: bridgeTimeout },
    });

    // ---- Mode A: dial Bland DID with timeout + fallback action ----
    if (useDid) {
      const ctx = new URLSearchParams({
        ...(campaign_id ? { campaign_id } : {}),
        ...(queue_item_id ? { queue_item_id } : {}),
        ...(lead_id ? { lead_id } : {}),
        ...(call_session_id ? { call_session_id } : {}),
        agent_type,
      });
      const fallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-bridge-fallback?${ctx.toString()}`;
      const recCb = `${SUPABASE_URL}/functions/v1/twilio-recording-callback?call_session_id=${call_session_id || ""}`;
      // Recording consent gate on the recipient. Fails closed.
      const { attr: recAttr, decision: recDecision } = await recordAttrFor(supabase, calledTo, {
        mode: "record-from-answer-dual",
        callbackUrl: recCb,
      });
      console.log(`[twilio-bridge-to-bland] recording=${recAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${bridgeTimeout}" answerOnBridge="true"
        action="${escapeXml(fallbackUrl)}" method="POST"
        ${recAttr}>
    <Number>${escapeXml(BLAND_INBOUND_NUMBER!)}</Number>
  </Dial>
</Response>`;
      return new Response(twiml.trim(), { headers: xmlHeaders });
    }

    // ---- Mode B: Bland API outbound to the same recipient ----
    if (!BLAND_API_KEY) {
      await logEvent({
        supabase, campaign_id, queue_item_id, call_session_id, call_sid: callSid,
        event_type: "bridge.misconfigured", source: "system", severity: "critical",
        payload: { reason: "BLAND_API_KEY missing and no BLAND_INBOUND_NUMBER" },
      });
      return fail("Bridge configuration missing. Goodbye.");
    }
    let phoneToCall = calledTo;
    if (!phoneToCall && lead_id) {
      const { data: lead } = await supabase
        .from("bland_leads").select("phone_number").eq("id", lead_id).maybeSingle();
      phoneToCall = (lead as any)?.phone_number || "";
    }
    if (!phoneToCall) {
      await logEvent({
        supabase, campaign_id, queue_item_id, call_session_id, call_sid: callSid,
        event_type: "bridge.no_phone", source: "system", severity: "error",
      });
      return fail("Could not connect. Goodbye.");
    }

    const blandWebhook = blandWebhookUrl(`${SUPABASE_URL}/functions/v1/bland-agent-webhook`);
    const blandUrl = bland_agent_id
      ? `https://api.bland.ai/v1/agents/${bland_agent_id}/calls`
      : "https://api.bland.ai/v1/calls";
    const blandPayload: Record<string, unknown> = bland_agent_id
      ? {
          phone_number: phoneToCall,
          webhook: blandWebhook,
          // Pass the campaign script as variables + first_sentence so the
          // pre-configured Bland agent opens with the SAME line Twilio's TTS
          // played. Keeps the conversation continuous after the bridge.
          ...(campaignScript ? { first_sentence: campaignScript } : {}),
          request_data: campaignScript ? { campaign_script: campaignScript, agent_type } : { agent_type },
          metadata: { lead_id, campaign_id, queue_item_id, agent_type, twilio_call_sid: callSid, call_session_id, campaign_script: campaignScript },
        }
      : {
          phone_number: phoneToCall,
          task: campaignScript || `You are an AI agent for the ${agent_type} workflow. Continue the conversation with the lead.`,
          ...(campaignScript ? { first_sentence: campaignScript } : {}),
          voice: "maya",
          webhook: blandWebhook,
          metadata: { lead_id, campaign_id, queue_item_id, agent_type, twilio_call_sid: callSid, call_session_id },
        };
    const r = await fetch(blandUrl, {
      method: "POST",
      headers: { authorization: BLAND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(blandPayload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Bland API error in bridge:", j);
      await logEvent({
        supabase, campaign_id, queue_item_id, call_session_id, call_sid: callSid,
        event_type: "bridge.bland_api_error", source: "bland", severity: "error",
        payload: { error: j, status: r.status },
      });
      // Requeue if configured
      await maybeRequeue(supabase, campaign_id, queue_item_id, "bland_api_error");
      return fail("We could not connect at this moment. We will try again shortly. Goodbye.");
    }

    if (queue_item_id) {
      await supabase
        .from("outbound_call_queue")
        .update({
          bland_call_id: (j as any).call_id || null,
          status: "in_ai_conversation",
          bridged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queue_item_id);
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you now. Please answer the next call from us right away.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml.trim(), { headers: xmlHeaders });
  } catch (err) {
    console.error("twilio-bridge-to-bland error:", err);
    return fail();
  }
});

async function maybeRequeue(
  supabase: ReturnType<typeof svc>,
  campaign_id: string | null,
  queue_item_id: string | null,
  reason: string,
) {
  if (!queue_item_id) return;
  let requeue = true;
  if (campaign_id) {
    const { data } = await supabase
      .from("dialer_campaigns")
      .select("requeue_on_failed_bridge, max_attempts")
      .eq("id", campaign_id)
      .maybeSingle();
    if (data && (data as any).requeue_on_failed_bridge === false) requeue = false;
  }
  const { data: row } = await supabase
    .from("outbound_call_queue")
    .select("attempt_count")
    .eq("id", queue_item_id)
    .maybeSingle();
  const attempts = ((row as any)?.attempt_count ?? 0) + 1;
  await supabase
    .from("outbound_call_queue")
    .update({
      status: "failed_bridge",
      bridge_failed_reason: reason,
      attempt_count: attempts,
      next_retry_at: requeue ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
      ended_at: new Date().toISOString(),
      last_error_severity: "error",
      updated_at: new Date().toISOString(),
    })
    .eq("id", queue_item_id);
}
