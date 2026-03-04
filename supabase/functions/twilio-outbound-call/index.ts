import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Initialize Supabase Client
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const { queue_item_id, business_id } = body;

    // Validate Input
    if (!queue_item_id) {
      return new Response(JSON.stringify({ error: "Missing queue_item_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch Queue Item AND Campaign Details
    // We join 'dialer_campaigns' to get the script and agent info
    const { data: item, error: itemErr } = await supabase
      .from("outbound_call_queue")
      .select(
        `
        *,
        dialer_campaigns (
          id,
          initial_script,
          agent_id,
          amd_enabled
        )
      `,
      )
      .eq("id", queue_item_id)
      .single();

    if (itemErr || !item) {
      return new Response(JSON.stringify({ error: "Queue item not found", details: itemErr }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. DNC (Do Not Call) Check
    if (item.store_id) {
      const { data: store } = await supabase
        .from("store_master")
        .select("do_not_call")
        .eq("id", item.store_id)
        .maybeSingle();

      if (store?.do_not_call) {
        // Block the call, mark complete
        await supabase
          .from("outbound_call_queue")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", queue_item_id);

        return new Response(JSON.stringify({ error: "DNC Blocked", compliance: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 5. Prepare Twilio Credentials
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured in Secrets");
    }

    // 6. Build Dynamic TwiML
    // Use the campaign script, or fall back to a default
    let script =
      item.dialer_campaigns?.initial_script || "Hello, this is a call from our automated system. Please hold.";

    // Simple variable replacement
    script = script.replace("{{contact_name}}", item.contact_name || "there");
    script = script.replace("{{agent_name}}", "our assistant");
    script = script.replace("{{business_name}}", "our company");

    // Construct TwiML
    // If you are connecting to ElevenLabs later, you would use <Connect><Stream> here.
    // For now, we use <Say> to speak the script.
    const twiml = `
      <Response>
        <Pause length="1"/>
        <Say voice="alice" language="en-US">${script}</Say>
        <Pause length="30"/> 
      </Response>
    `;

    // 7. Make the Call via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    const params = new URLSearchParams();
    params.set("To", item.phone_number);
    params.set("From", TWILIO_PHONE_NUMBER);
    params.set("Twiml", twiml);

    // Status Callbacks (Optional: Hook this up to a webhook to track 'answered', 'completed')
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (supabaseUrl) {
      params.set("StatusCallback", `${supabaseUrl}/functions/v1/twilio-status-webhook`);
      params.set("StatusCallbackEvent", "initiated ringing answered completed");
      params.set("StatusCallbackMethod", "POST");
    }

    // Machine Detection (AMD)
    if (item.dialer_campaigns?.amd_enabled) {
      params.set("MachineDetection", "DetectMessageEnd");
    }

    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

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
      // Log failure in DB
      await supabase
        .from("outbound_call_queue")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", queue_item_id);

      throw new Error(`Twilio API Error: ${twilioData.message || twilioData.code}`);
    }

    // 8. Success: Update Queue Item
    await supabase
      .from("outbound_call_queue")
      .update({
        twilio_call_sid: twilioData.sid,
        dialing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Note: We leave status as 'dialing'. The webhook should update it to 'connected' or 'completed'.
      })
      .eq("id", queue_item_id);

    return new Response(JSON.stringify({ success: true, call_sid: twilioData.sid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
