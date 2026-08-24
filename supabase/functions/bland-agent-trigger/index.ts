// Auto-dialer dispatcher: Twilio-first call with TTS intro + DTMF/speech confirmation.
// Bland AI is reached via the bridge endpoint after the recipient confirms.
//
// Hardened (2026-04-29):
//  - call_session_id (UUID) is generated up-front and propagated through
//    every TwiML / status / bridge / Bland callback URL as the single source of truth.
//  - AMD enabled when the campaign has amd_enabled=true (or default).
//  - Error paths log into dialer_call_events with severity tags (no silent failures).
//  - Status callback URL signed by Twilio; downstream verifyTwilio() accepts it.

import { corsHeaders, svc, logEvent, resolveContext } from "../_shared/dialer.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TWILIO_ACCOUNT_SID =
      Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID") ||
      Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN =
      Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN") ||
      Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM =
      Deno.env.get("BRANDARO_TWILIO_NUMBER") ||
      Deno.env.get("TWILIO_FROM_NUMBER") ||
      Deno.env.get("TWILIO_PHONE_NUMBER");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      return json({ error: "Twilio credentials not configured (prefer BRANDARO_TWILIO_ACCOUNT_SID, BRANDARO_TWILIO_AUTH_TOKEN, BRANDARO_TWILIO_NUMBER; fallback to legacy TWILIO_* secrets)" }, 500);
    }
    if (!TWILIO_ACCOUNT_SID.startsWith("AC")) {
      return json({ error: "TWILIO_ACCOUNT_SID must start with 'AC'" }, 500);
    }

    const supabase = svc();

    const body = await req.json().catch(() => ({}));
    let {
      lead_id, phone_number, agent_type, prompt, voice, queue_item_id, campaign_id,
      bland_agent_row_id, bland_agent_id: explicitBlandAgentId,
    } = body ?? {};

    if (!agent_type && !bland_agent_row_id && !explicitBlandAgentId) {
      return json({ error: "agent_type, bland_agent_row_id, or bland_agent_id is required" }, 400);
    }

    if (lead_id && !phone_number) {
      const { data: lead, error } = await supabase
        .from("bland_leads")
        .select("id, phone_number, name")
        .eq("id", lead_id)
        .maybeSingle();
      if (error) throw error;
      if (!lead) return json({ error: "Lead not found" }, 404);
      phone_number = lead.phone_number;
    }
    if (!phone_number) return json({ error: "phone_number or lead_id required" }, 400);

    // Resolve the existing call_session_id off the queue row if we have one,
    // otherwise mint a new one. This is the join key for everything downstream.
    let call_session_id: string | null = null;
    let amd_enabled = true;
    let bridge_timeout = 15;
    if (queue_item_id) {
      const { data: row } = await supabase
        .from("outbound_call_queue")
        .select("call_session_id")
        .eq("id", queue_item_id)
        .maybeSingle();
      call_session_id = (row as any)?.call_session_id || null;
    }
    if (!call_session_id) call_session_id = crypto.randomUUID();

    if (campaign_id) {
      const { data: c } = await supabase
        .from("dialer_campaigns")
        .select("amd_enabled, bridge_timeout_seconds")
        .eq("id", campaign_id)
        .maybeSingle();
      if (c) {
        amd_enabled = (c as any).amd_enabled !== false;
        bridge_timeout = (c as any).bridge_timeout_seconds || 15;
      }
    }

    // Resolve Bland agent — PRIORITY ORDER (no silent remapping):
    //   1. explicit bland_agent_id (string, Bland API id)
    //   2. bland_agent_row_id (uuid in bland_agent_webhooks) → look up bland_agent_id
    //   3. agent_type → first active row (legacy fallback only)
    let blandAgentId: string | null = explicitBlandAgentId || null;
    let resolvedAgentType: string | null = agent_type || null;
    {
      if (!blandAgentId && bland_agent_row_id) {
        const { data: agent } = await supabase
          .from("bland_agent_webhooks")
          .select("bland_agent_id, agent_type, default_prompt, default_voice")
          .eq("id", bland_agent_row_id)
          .maybeSingle();
        if (agent) {
          blandAgentId = (agent as any).bland_agent_id ?? null;
          resolvedAgentType = (agent as any).agent_type || resolvedAgentType;
          if (!prompt) prompt = (agent as any).default_prompt || prompt;
          voice = voice || (agent as any).default_voice || "maya";
        }
      }
      if (!blandAgentId && agent_type) {
        const { data: agent } = await supabase
          .from("bland_agent_webhooks")
          .select("bland_agent_id, agent_type, default_prompt, default_voice")
          .eq("agent_type", agent_type)
          .eq("is_active", true)
          .maybeSingle();
        if (agent) {
          blandAgentId = (agent as any).bland_agent_id ?? null;
          resolvedAgentType = (agent as any).agent_type || resolvedAgentType;
          if (!prompt) prompt = (agent as any).default_prompt || `You are an AI calling agent for the ${resolvedAgentType} workflow.`;
          voice = voice || (agent as any).default_voice || "maya";
        }
      }
    }
    agent_type = resolvedAgentType || agent_type || "unknown";

    // All context propagated to public webhooks (so they can stay stateless).
    const baseUrl = `${SUPABASE_URL}/functions/v1`;
    const ctxParams = new URLSearchParams({
      ...(queue_item_id ? { queue_item_id: String(queue_item_id) } : {}),
      ...(campaign_id ? { campaign_id: String(campaign_id) } : {}),
      ...(lead_id ? { lead_id: String(lead_id) } : {}),
      agent_type,
      ...(blandAgentId ? { bland_agent_id: blandAgentId } : {}),
      call_session_id,
    });
    const twimlUrl = `${baseUrl}/twilio-campaign-twiml?${ctxParams.toString()}`;
    const statusUrl = `${baseUrl}/dialer-call-status?${ctxParams.toString()}`;
    const recordingUrl = `${baseUrl}/twilio-recording-callback?call_session_id=${call_session_id}`;

    // Place the Twilio outbound call
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const form = new URLSearchParams();
    form.set("To", phone_number);
    form.set("From", TWILIO_FROM);
    form.set("Url", twimlUrl);
    form.set("Method", "POST");
    form.set("StatusCallback", statusUrl);
    form.set("StatusCallbackMethod", "POST");
    for (const ev of ["initiated", "ringing", "answered", "completed"]) {
      form.append("StatusCallbackEvent", ev);
    }
    form.set("Record", "true");
    form.set("RecordingChannels", "dual");
    form.set("RecordingStatusCallback", recordingUrl);
    form.set("RecordingStatusCallbackMethod", "POST");

    // Answering Machine Detection — async (non-blocking) so the dial proceeds
    // immediately and AnsweredBy is delivered separately to the status webhook.
    // MachineDetection=Enable is REQUIRED: it switches detection on, while
    // AsyncAmd=true only selects background delivery. (The old comment here
    // claimed the two can't combine — wrong; that belief is why no AMD
    // verdict ever arrived, see dialer_call_events: zero amd_result rows.)
    if (amd_enabled) {
      form.set("MachineDetection", "Enable");
      form.set("AsyncAmd", "true");
      form.set("AsyncAmdStatusCallback", statusUrl);
      form.set("AsyncAmdStatusCallbackMethod", "POST");
      form.set("MachineDetectionTimeout", "5");
    }
    form.set("Timeout", String(bridge_timeout + 15)); // Twilio dial timeout for the recipient

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
    const twilioJson = await twilioRes.json().catch(() => ({}));
    if (!twilioRes.ok) {
      console.error("Twilio call failed:", twilioJson);
      if (queue_item_id) {
        await supabase
          .from("outbound_call_queue")
          .update({
            status: "failed",
            last_error_severity: "error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", queue_item_id);
      }
      await logEvent({
        supabase,
        campaign_id,
        queue_item_id,
        call_session_id,
        event_type: "dispatch.twilio_error",
        source: "dispatcher",
        severity: "error",
        payload: { error: twilioJson, http_status: twilioRes.status },
      });
      return json({ error: "Twilio call failed", details: twilioJson }, twilioRes.status);
    }

    const callSid: string = twilioJson.sid;

    if (queue_item_id) {
      await supabase
        .from("outbound_call_queue")
        .update({
          twilio_call_sid: callSid,
          call_session_id,
          status: "dialing",
          dialing_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queue_item_id);
    }

    // Populate live_calls so the Live Monitor / HUD reflects the call.
    try {
      // business_id from queue row when available
      let businessId: string | null = null;
      if (queue_item_id) {
        const { data: q } = await supabase
          .from("outbound_call_queue")
          .select("business_id")
          .eq("id", queue_item_id)
          .maybeSingle();
        businessId = (q as any)?.business_id || null;
      }
      await supabase.from("live_calls").upsert(
        {
          call_sid: callSid,
          call_session_id,
          queue_item_id: queue_item_id || null,
          campaign_id: campaign_id || null,
          business_id: businessId,
          phone_number,
          agent_type,
          voice_provider: "bland",
          state: "dialing",
          source_reason: "campaign",
          started_at: new Date().toISOString(),
          metadata: { bland_agent_id: blandAgentId, amd_enabled },
        },
        { onConflict: "call_sid" },
      );
    } catch (e) {
      console.error("live_calls upsert failed:", e);
    }

    await logEvent({
      supabase,
      campaign_id,
      queue_item_id,
      call_session_id,
      call_sid: callSid,
      event_type: "dispatch.placed",
      source: "dispatcher",
      severity: "info",
      payload: { to: phone_number, agent_type, bland_agent_id: blandAgentId, twilio_status: twilioJson.status, amd_enabled },
    });

    return json({ ok: true, twilio_call_sid: callSid, bland_agent_id: blandAgentId, call_session_id });
  } catch (err) {
    console.error("bland-agent-trigger error:", err);
    try {
      await logEvent({
        supabase: svc(),
        event_type: "dispatch.exception",
        source: "dispatcher",
        severity: "critical",
        payload: { message: (err as Error).message },
      });
    } catch { /* ignore secondary failure */ }
    return json({ error: (err as Error).message }, 500);
  }
});
