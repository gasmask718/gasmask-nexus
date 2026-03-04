import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // ── THE COMBINED WEBHOOK URLS ──
    const agentId = item.dialer_campaigns?.agent_id || "";
    const baseWebhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;

    // Route 1: For logging answered/completed statuses
    const statusCallbackUrl = `${baseWebhookUrl}?type=status`;

    // Route 2: For processing the user saying "Yes" or pressing "1"
    const gatherActionUrl = `${baseWebhookUrl}?type=gather&agent_id=${agentId}`;

    const rawScript = `Hello ${item.contact_name || "there"}. Are you ready to speak with our AI assistant? Please say yes or press 1 to continue.`;
    const safeScript = escapeXml(rawScript);

    // Prompt the user and wait for a response
    const twiml = `
      <Response>
        <Pause length="1"/>
        <Gather input="dtmf speech" action="${gatherActionUrl}" numDigits="1" timeout="5" hints="yes, yeah, sure, okay, ready">
          <Say voice="Polly.Joanna" language="en-US">${safeScript}</Say>
        </Gather>
        <Say voice="Polly.Joanna">We did not receive a response. Goodbye.</Say>
        <Hangup/>
      </Response>
    `;

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

    if (item.dialer_campaigns?.amd_enabled) {
      params.append("MachineDetection", "DetectMessageEnd");
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

    await supabase
      .from("outbound_call_queue")
      .update({
        twilio_call_sid: twilioData.sid,
        dialing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queue_item_id);

    return new Response(JSON.stringify({ success: true, call_sid: twilioData.sid }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
