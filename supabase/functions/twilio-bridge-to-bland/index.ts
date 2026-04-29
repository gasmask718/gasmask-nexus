// Bridges the live Twilio call to a Bland AI agent.
//
// Mode A (default, bridge_mode='bland_did' + BLAND_INBOUND_NUMBER set):
//   Returns <Dial><Number>{BLAND_INBOUND_NUMBER}</Number></Dial>
//   Bland answers with the configured agent. Recording continues on the parent leg.
//
// Mode B (fallback, no BLAND_INBOUND_NUMBER OR bridge_mode='bland_api'):
//   Triggers a Bland API outbound call to the same recipient,
//   plays a brief "connecting you now" message, and hangs up the Twilio leg.
//   This causes a brief drop while Bland places its own call.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const xmlHeaders = { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" };

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY");
    const BLAND_INBOUND_NUMBER = Deno.env.get("BLAND_INBOUND_NUMBER");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const url = new URL(req.url);
    const campaign_id = url.searchParams.get("campaign_id");
    const queue_item_id = url.searchParams.get("queue_item_id");
    const lead_id = url.searchParams.get("lead_id");
    const agent_type = url.searchParams.get("agent_type") || "sales-outreach";
    const bland_agent_id = url.searchParams.get("bland_agent_id") || "";

    let form: FormData | null = null;
    try { form = await req.formData(); } catch { /* may be GET */ }
    const callSid = form?.get("CallSid")?.toString() || "";
    const calledTo = form?.get("To")?.toString() || "";

    // Load campaign bridge_mode
    let bridgeMode = "bland_did";
    if (campaign_id) {
      const { data: c } = await supabase
        .from("dialer_campaigns")
        .select("bridge_mode")
        .eq("id", campaign_id)
        .maybeSingle();
      if ((c as any)?.bridge_mode) bridgeMode = (c as any).bridge_mode;
    }

    const useDid = bridgeMode === "bland_did" && !!BLAND_INBOUND_NUMBER;

    // Mark as bridged
    if (queue_item_id) {
      await supabase
        .from("outbound_call_queue")
        .update({
          status: "bridged",
          bridged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queue_item_id);
    }
    await supabase.from("dialer_call_events").insert({
      campaign_id,
      queue_item_id,
      call_sid: callSid,
      event_type: "bridge.start",
      source: "twilio",
      payload: { mode: useDid ? "bland_did" : "bland_api", bland_agent_id, agent_type },
    });

    // ---- Mode A: dial Bland DID ----
    if (useDid) {
      const recCb = `${SUPABASE_URL}/functions/v1/twilio-recording-callback`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" record="record-from-answer-dual"
        recordingStatusCallback="${escapeXml(recCb)}" recordingStatusCallbackMethod="POST">
    <Number>${escapeXml(BLAND_INBOUND_NUMBER!)}</Number>
  </Dial>
</Response>`;
      return new Response(twiml.trim(), { headers: xmlHeaders });
    }

    // ---- Mode B: Bland API outbound to the same recipient ----
    if (!BLAND_API_KEY) {
      const fb = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Bridge configuration missing. Goodbye.</Say><Hangup/></Response>`;
      return new Response(fb, { headers: xmlHeaders });
    }
    let phoneToCall = calledTo;
    if (!phoneToCall && lead_id) {
      const { data: lead } = await supabase
        .from("bland_leads")
        .select("phone_number")
        .eq("id", lead_id)
        .maybeSingle();
      phoneToCall = (lead as any)?.phone_number || "";
    }
    if (!phoneToCall) {
      const fb = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Could not connect. Goodbye.</Say><Hangup/></Response>`;
      return new Response(fb, { headers: xmlHeaders });
    }
    const blandWebhook = `${SUPABASE_URL}/functions/v1/bland-agent-webhook`;
    const blandUrl = bland_agent_id
      ? `https://api.bland.ai/v1/agents/${bland_agent_id}/calls`
      : "https://api.bland.ai/v1/calls";
    const blandPayload: Record<string, unknown> = bland_agent_id
      ? { phone_number: phoneToCall, webhook: blandWebhook, metadata: { lead_id, campaign_id, queue_item_id, agent_type, twilio_call_sid: callSid } }
      : {
          phone_number: phoneToCall,
          task: `You are an AI agent for the ${agent_type} workflow. Continue the conversation with the lead.`,
          voice: "maya",
          webhook: blandWebhook,
          metadata: { lead_id, campaign_id, queue_item_id, agent_type, twilio_call_sid: callSid },
        };
    const r = await fetch(blandUrl, {
      method: "POST",
      headers: { authorization: BLAND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(blandPayload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Bland API error in bridge:", j);
      await supabase.from("dialer_call_events").insert({
        campaign_id,
        queue_item_id,
        call_sid: callSid,
        event_type: "bridge.error",
        source: "bland",
        payload: { error: j, status: r.status },
      });
      const fb = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">We could not connect at this moment. Goodbye.</Say><Hangup/></Response>`;
      return new Response(fb, { headers: xmlHeaders });
    }

    if (queue_item_id) {
      await supabase
        .from("outbound_call_queue")
        .update({ bland_call_id: (j as any).call_id || null, updated_at: new Date().toISOString() })
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
    const fb = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">An error occurred. Goodbye.</Say><Hangup/></Response>`;
    return new Response(fb, { headers: xmlHeaders });
  }
});
