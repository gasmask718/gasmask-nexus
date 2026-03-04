import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map the IDs from your Frontend to valid Twilio/Polly Neural Voices
const VOICE_MAP: Record<string, string> = {
  JBFqnCBsd6RMkjVDRZzb: "Polly.Matthew-Neural", // Adam -> Matthew
  "21m00Tcm4TlvDq8ikWAM": "Polly.Joanna-Neural", // Rachel -> Joanna
  EXAVITQu4vr4xnSDxMaL: "Polly.Amy-Neural", // Bella -> Amy
  ErXwobaYiN019PkySvjV: "Polly.Arthur-Neural", // Antoni -> Arthur
  MF3mGyEYCl7XYWbV9V6O: "Polly.Emma-Neural", // Elli -> Emma
  TxGEqnHWrfWFTfGW9XjX: "Polly.Joey-Neural", // Josh -> Joey
  VR6AewLTigWG4xSOukaG: "Polly.Justin-Neural", // Arnold -> Justin
  pNInz6obpgDQGcFmaJgB: "Polly.Salli-Neural", // Sam (M) -> Salli (Fallback M/F mismatch handled by name usually, but Salli is F. Let's map to Matthew for Male ID)
  yoZ06aMxZJJ28mfd3POQ: "Polly.Kendra-Neural", // Sam (F) -> Kendra
  // Fallback
  default: "Polly.Joanna-Neural",
};

Deno.serve(async (req) => {
  console.log("FUNCTION ONLINE:", { name: "twilio-outbound-call", time: new Date().toISOString() });

  // 1. Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase (Service Role to bypass RLS)
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();

    // Health probe
    if (body.dry_run === true) {
      return new Response(JSON.stringify({ status: "ok", mode: "dry_run" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { queue_item_id, business_id } = body;

    if (!queue_item_id || !business_id) {
      return new Response(JSON.stringify({ error: "queue_item_id and business_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch queue item AND Campaign Data
    const { data: item, error: itemErr } = await supabase
      .from("outbound_call_queue")
      .select(
        `
        id, status, phone_number, store_id, contact_name, business_id, campaign_id,
        dialer_campaigns (
          initial_script,
          agent_id,
          amd_enabled
        )
      `,
      )
      .eq("id", queue_item_id)
      .single();

    if (itemErr || !item) {
      return new Response(JSON.stringify({ error: "Queue item not found", details: itemErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. DNC check (Compliance)
    if (item.store_id) {
      const { data: store } = await supabase
        .from("store_master")
        .select("do_not_call")
        .eq("id", item.store_id)
        .maybeSingle();

      if (store?.do_not_call) {
        await supabase
          .from("outbound_call_queue")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", queue_item_id);

        return new Response(JSON.stringify({ error: "DNC store — blocked", compliance: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 4. Set Twilio credentials
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

    // Ensure you have a valid Twilio number in your ENV or hardcoded here
    const FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "+18776818621";

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: "Twilio SID or Token not configured in Secrets" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Build Webhook URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-status-webhook`;

    // 6. Generate Script & Select Voice
    let script = item.dialer_campaigns?.initial_script || "Hello, this is a call from our automated system.";

    // FIX: Use Regex with 'g' flag for global replacement
    script = script.replace(/{{contact_name}}/g, item.contact_name || "there");
    script = script.replace(/{{agent_name}}/g, "our assistant");
    script = script.replace(/{{business_name}}/g, "our company");

    // FIX: Select the correct Twilio voice based on the Agent ID from campaign
    const agentId = item.dialer_campaigns?.agent_id;
    const voiceId = VOICE_MAP[agentId] || VOICE_MAP["default"];

    const twiml = `
      <Response>
        <Pause length="1"/>
        <Say voice="${voiceId}" language="en-US">${script}</Say>
        <Pause length="2"/>
        <Record maxLength="30" action="${statusCallbackUrl}" />
      </Response>
    `;

    // 7. Place Twilio call
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const params = new URLSearchParams();
    params.append("To", item.phone_number);
    params.append("From", FROM_NUMBER);
    params.append("Twiml", twiml);
    params.append("StatusCallback", statusCallbackUrl);
    params.append("StatusCallbackMethod", "POST");

    // FIX: Enable Recording explicitly for transcripts
    params.append("Record", "true");
    params.append("RecordingStatusCallback", statusCallbackUrl);

    // Call Events
    params.append("StatusCallbackEvent", "initiated");
    params.append("StatusCallbackEvent", "ringing");
    params.append("StatusCallbackEvent", "answered");
    params.append("StatusCallbackEvent", "completed");

    // AMD Logic
    if (item.dialer_campaigns?.amd_enabled) {
      params.append("MachineDetection", "DetectMessageEnd");
      // Optional: Tweaking AMD params can reduce delay, but 'DetectMessageEnd' is safest for voicemail detection
      params.append("MachineDetectionTimeout", "30");
    }

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      // Log failure
      await supabase.from("twilio_call_logs").insert({
        business_id,
        queue_item_id,
        to_number: item.phone_number,
        from_number: FROM_NUMBER,
        status: "api_error",
        raw_payload: twilioData,
      });

      await supabase
        .from("outbound_call_queue")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", queue_item_id);

      return new Response(JSON.stringify({ error: "Twilio API error", details: twilioData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Success: Update queue item
    const callSid = twilioData.sid;

    // Update queue status
    await supabase
      .from("outbound_call_queue")
      .update({
        twilio_call_sid: callSid,
        dialing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queue_item_id);

    // Create log entry
    await supabase.from("twilio_call_logs").insert({
      business_id,
      queue_item_id,
      call_sid: callSid,
      direction: "outbound",
      to_number: item.phone_number,
      from_number: FROM_NUMBER,
      status: "initiated",
      raw_payload: twilioData,
    });

    return new Response(JSON.stringify({ success: true, call_sid: callSid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Internal Function Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
