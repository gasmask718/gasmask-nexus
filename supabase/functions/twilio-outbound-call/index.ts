import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(unsafe: string) {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

/** Normalize any phone format to E.164 */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();

    // Handle dry_run health checks before validation
    if (body.dry_run) {
      return new Response(JSON.stringify({ status: "ok", dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { queue_item_id, business_id } = body;
    if (!queue_item_id || !business_id) {
      return new Response(JSON.stringify({ error: "Missing IDs", hint: "Provide queue_item_id and business_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER") || "+18776818621";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const campaign = Array.isArray(item.dialer_campaigns) ? item.dialer_campaigns[0] : item.dialer_campaigns;
    
    // agent_id from campaign is an ElevenLabs Conversational Agent ID (e.g. agent_xxx)
    const agentId = campaign?.agent_id || "";

    const campaignScript = campaign?.initial_script || "";
    const rawScript =
      campaignScript ||
      `Hello ${item.contact_name || "there"}. Are you ready to speak with our AI assistant? Please press 1 on your keypad or say yes to connect.`;
    const safeScript = escapeXml(rawScript);

    // Normalize phone to E.164
    const toNumber = toE164(item.phone_number);

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status?script=${encodeURIComponent(rawScript)}`;
    const humanNumber = Deno.env.get("LIVE_HANDOFF_NUMBER") || "";
    
    // Pass agent_id (ElevenLabs Conversational Agent ID) to the gather webhook
    const gatherActionUrl = `${supabaseUrl}/functions/v1/twilio-gather-webhook?agent_id=${encodeURIComponent(agentId)}&amp;queue_item_id=${encodeURIComponent(queue_item_id)}&amp;campaign_id=${encodeURIComponent(item.campaign_id || "")}&amp;human_number=${encodeURIComponent(humanNumber)}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" action="${gatherActionUrl}" numDigits="1" timeout="4" speechTimeout="2">
    <Say voice="Polly.Matthew" language="en-US">${safeScript}</Say>
  </Gather>
  <Say voice="Polly.Matthew" language="en-US">We did not receive a response. Goodbye.</Say>
  <Hangup/>
</Response>`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const params = new URLSearchParams();

    params.append("To", toNumber);
    params.append("From", FROM_NUMBER);
    params.append("Twiml", twiml);
    params.append("StatusCallback", statusCallbackUrl);
    params.append("StatusCallbackMethod", "POST");
    params.append("StatusCallbackEvent", "initiated");
    params.append("StatusCallbackEvent", "ringing");
    params.append("StatusCallbackEvent", "answered");
    params.append("StatusCallbackEvent", "completed");
    params.append("Record", "true");
    params.append("RecordingChannels", "dual");
    params.append("RecordingStatusCallback", `${supabaseUrl}/functions/v1/twilio-recording-callback`);
    params.append("RecordingStatusCallbackMethod", "POST");

    if (campaign?.amd_enabled) {
      params.append("MachineDetection", "Enable");
      params.append("MachineDetectionTimeout", "8");
    }

    console.log(`📞 Calling ${toNumber} from ${FROM_NUMBER} for queue item ${queue_item_id} | agent_id=${agentId}`);

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error(`❌ Twilio error: ${JSON.stringify(twilioData)}`);
      await supabase.from("outbound_call_queue").update({ status: "failed" }).eq("id", queue_item_id);
      return new Response(JSON.stringify({ error: twilioData }), { status: 500, headers: corsHeaders });
    }

    const callSid = twilioData.sid.trim();
    console.log(`✅ Call initiated: ${callSid}`);

    // Update queue item with call SID
    await supabase
      .from("outbound_call_queue")
      .update({
        twilio_call_sid: callSid,
        status: "dialing",
        dialing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queue_item_id);

    // Pre-create call_recordings row
    const { error: recordingError } = await supabase.from("call_recordings").insert({
      provider_call_sid: callSid,
      business_id: business_id,
      direction: "outbound",
      status: "initiated",
      provider: "twilio",
      channels: "dual",
      from_number: FROM_NUMBER,
      to_number: toNumber,
      created_at: new Date().toISOString(),
    });

    if (recordingError) {
      console.error(`⚠️ Recording pre-insert failed (non-fatal): ${recordingError.message}`);
    }

    return new Response(JSON.stringify({ success: true, call_sid: callSid }), { headers: corsHeaders });
  } catch (err: any) {
    console.error(`💥 twilio-outbound-call error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
