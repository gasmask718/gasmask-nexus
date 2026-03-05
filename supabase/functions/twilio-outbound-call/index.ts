import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICE_MAP: Record<string, string> = {
  JBFqnCBsd6RMkjVDRZzb: "Polly.Matthew",
  "21m00Tcm4TlvDq8ikWAM": "Polly.Joanna",
  EXAVITQu4vr4xnSDxMaL: "Polly.Amy",
  ErXwobaYiN019PkySvjV: "Polly.Arthur",
  MF3mGyEYCl7XYWbV9V6O: "Polly.Emma",
  TxGEqnHWrfWFTfGW9XjX: "Polly.Joey",
  VR6AewLTigWG4xSOukaG: "Polly.Justin",
  pNInz6obpgDQGcFmaJgB: "Polly.Salli",
  yoZ06aMxZJJ28mfd3POQ: "Polly.Kendra",
  default: "Polly.Joanna",
};

function escapeXml(unsafe: string) {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();

    const { queue_item_id, business_id } = body;
    if (!queue_item_id || !business_id) throw new Error("Missing IDs");

    const { data: item, error: itemErr } = await supabase
      .from("outbound_call_queue")
      .select(
        `id, status, phone_number, store_id, contact_name, business_id, campaign_id, dialer_campaigns ( initial_script, agent_id, amd_enabled )`,
      )
      .eq("id", queue_item_id)
      .single();

    if (itemErr || !item) throw new Error("Queue item not found");

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "+18776818621";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const campaign = Array.isArray(item.dialer_campaigns) ? item.dialer_campaigns[0] : item.dialer_campaigns;
    const agentId = campaign?.agent_id || "";

    const campaignScript = campaign?.initial_script || "";
    const rawScript =
      campaignScript ||
      `Hello ${item.contact_name || "there"}. Are you ready to speak with our AI assistant? Please press 1 on your keypad or say yes to connect.`;
    const safeScript = escapeXml(rawScript);
    const voiceId = VOICE_MAP[agentId] || VOICE_MAP["default"];

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status?script=${encodeURIComponent(rawScript)}`;
    const gatherActionUrl = `${supabaseUrl}/functions/v1/twilio-gather-webhook?agent_id=${agentId}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Gather input="dtmf speech" action="${gatherActionUrl}" numDigits="1" timeout="8">
    <Say voice="${voiceId}" language="en-US">${safeScript}</Say>
  </Gather>
  <Say voice="${voiceId}" language="en-US">We did not receive a response. Goodbye.</Say>
  <Hangup/>
</Response>`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const params = new URLSearchParams();

    params.append("To", item.phone_number);
    params.append("From", FROM_NUMBER);
    params.append("Twiml", twiml);
    params.append("StatusCallback", statusCallbackUrl);
    params.append("StatusCallbackMethod", "POST");
    params.append("StatusCallbackEvent", "initiated");
    params.append("StatusCallbackEvent", "ringing");
    params.append("StatusCallbackEvent", "answered");
    params.append("StatusCallbackEvent", "completed");

    if (campaign?.amd_enabled) {
      params.append("MachineDetection", "Enable");
      params.append("MachineDetectionTimeout", "8");
    }

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      await supabase.from("outbound_call_queue").update({ status: "failed" }).eq("id", queue_item_id);
      return new Response(JSON.stringify({ error: twilioData }), { status: 500, headers: corsHeaders });
    }

    // 🔴 FORCE TRIM & STATUS UPDATE: Ensures the frontend registers the SID immediately
    await supabase
      .from("outbound_call_queue")
      .update({
        twilio_call_sid: twilioData.sid.trim(),
        status: "dialing",
        dialing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queue_item_id);

    const { error: recordingError } = await supabase.from("call_recordings").upsert(
      {
        provider_call_sid: twilioData.sid.trim(),
        business_id: business_id,
        direction: "outbound",
        status: "initiated",
        from_number: FROM_NUMBER,
        to_number: item.phone_number,
        created_at: new Date().toISOString(),
      },
      { onConflict: "provider_call_sid" },
    );

    return new Response(JSON.stringify({ success: true, call_sid: twilioData.sid.trim() }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
