// Auto-dialer dispatcher: Twilio-first call with TTS intro + DTMF/speech confirmation.
// Bland AI is reached via the bridge endpoint after the recipient confirms.
//
// POST /functions/v1/bland-agent-trigger
// Body: { lead_id?, phone_number?, agent_type, prompt?, voice?, queue_item_id?, campaign_id? }
//
// Behavior:
//  1. Resolves phone number from lead_id if needed.
//  2. Resolves the configured Bland agent_id for the requested agent_type.
//  3. Places an outbound Twilio call with:
//       - answer URL  -> /twilio-campaign-twiml  (plays campaign script + Gather)
//       - status cb   -> /dialer-call-status     (timeline + queue state)
//       - recording   -> /twilio-recording-callback
//  4. Persists twilio_call_sid + bland metadata on the queue row immediately.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      return json({ error: "Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)" }, 500);
    }
    if (!TWILIO_ACCOUNT_SID.startsWith("AC")) {
      return json({ error: "TWILIO_ACCOUNT_SID must start with 'AC'" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    let { lead_id, phone_number, agent_type, prompt, voice, queue_item_id, campaign_id } = body ?? {};

    if (!agent_type) return json({ error: "agent_type is required" }, 400);

    // Resolve phone number
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

    // Resolve Bland agent record (id + defaults)
    let blandAgentId: string | null = null;
    {
      const { data: agent } = await supabase
        .from("bland_agent_webhooks")
        .select("bland_agent_id, default_prompt, default_voice")
        .eq("agent_type", agent_type)
        .eq("is_active", true)
        .maybeSingle();
      if (agent) {
        blandAgentId = (agent as any).bland_agent_id ?? null;
        if (!prompt) prompt = (agent as any).default_prompt || `You are an AI calling agent for the ${agent_type} workflow.`;
        voice = voice || (agent as any).default_voice || "maya";
      }
    }

    // Build webhook URLs (all public TwiML / status endpoints)
    const baseUrl = `${SUPABASE_URL}/functions/v1`;
    const ctxParams = new URLSearchParams({
      ...(queue_item_id ? { queue_item_id: String(queue_item_id) } : {}),
      ...(campaign_id ? { campaign_id: String(campaign_id) } : {}),
      ...(lead_id ? { lead_id: String(lead_id) } : {}),
      agent_type,
      ...(blandAgentId ? { bland_agent_id: blandAgentId } : {}),
    });
    const twimlUrl = `${baseUrl}/twilio-campaign-twiml?${ctxParams.toString()}`;
    const statusUrl = `${baseUrl}/dialer-call-status?${ctxParams.toString()}`;
    const recordingUrl = `${baseUrl}/twilio-recording-callback`;

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
      // surface raw error per zero-silent-failures rule
      if (queue_item_id) {
        await supabase
          .from("outbound_call_queue")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", queue_item_id);
      }
      return json({ error: "Twilio call failed", details: twilioJson }, twilioRes.status);
    }

    const callSid: string = twilioJson.sid;

    // Persist call SID on the queue row and log timeline event
    if (queue_item_id) {
      await supabase
        .from("outbound_call_queue")
        .update({
          twilio_call_sid: callSid,
          status: "dialing",
          dialing_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queue_item_id);
    }

    await supabase.from("dialer_call_events").insert({
      campaign_id: campaign_id ?? null,
      queue_item_id: queue_item_id ?? null,
      call_sid: callSid,
      event_type: "dispatch.placed",
      source: "twilio",
      payload: { to: phone_number, agent_type, bland_agent_id: blandAgentId, twilio_status: twilioJson.status },
    });

    return json({ ok: true, twilio_call_sid: callSid, bland_agent_id: blandAgentId });
  } catch (err) {
    console.error("bland-agent-trigger error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
