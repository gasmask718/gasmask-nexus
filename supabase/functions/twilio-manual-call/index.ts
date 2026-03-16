import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Manual outbound call for campaign cold calling.
 * No AI, no TTS — just dials the number and connects via Twilio.
 * Records the call and logs transcript via Twilio's recording.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();

    const { queue_item_id, business_id } = body;
    if (!queue_item_id || !business_id) {
      return new Response(JSON.stringify({ error: "Missing IDs", hint: "Provide queue_item_id and business_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: item, error: itemErr } = await supabase
      .from("outbound_call_queue")
      .select("id, status, phone_number, store_id, contact_name, business_id, campaign_id")
      .eq("id", queue_item_id)
      .single();

    if (itemErr || !item) throw new Error("Queue item not found");

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "+18776818621";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;

    // Simple TwiML — just connect the call, no gather, no AI
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">Connecting your call now.</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${supabaseUrl}/functions/v1/twilio-call-status">
    <Number>${item.phone_number}</Number>
  </Dial>
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
    params.append("Record", "true");

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
        twilio_call_sid: twilioData.sid.trim(),
        status: "dialing",
        dialing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queue_item_id);

    await supabase.from("call_recordings").upsert(
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

    return new Response(JSON.stringify({ success: true, call_sid: twilioData.sid.trim(), mode: "manual" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
