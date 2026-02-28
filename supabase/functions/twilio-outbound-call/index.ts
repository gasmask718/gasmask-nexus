import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  console.log("FUNCTION ONLINE:", { name: "twilio-outbound-call", project: Deno.env.get("SUPABASE_URL"), time: new Date().toISOString() });
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    // ── Dry-run / health probe mode ──
    if (body.dry_run === true) {
      return new Response(
        JSON.stringify({ status: "ok", mode: "dry_run", reachable: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { queue_item_id, business_id } = body;

    if (!queue_item_id || !business_id) {
      return new Response(
        JSON.stringify({ error: "queue_item_id and business_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch queue item ──
    const { data: item, error: itemErr } = await supabase
      .from("outbound_call_queue")
      .select("id, status, phone_number, store_id, contact_name, business_id, campaign_id")
      .eq("id", queue_item_id)
      .single();

    if (itemErr || !item) {
      return new Response(
        JSON.stringify({ error: "Queue item not found", details: itemErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Validate: must be in dialing state ──
    if (item.status !== "dialing") {
      return new Response(
        JSON.stringify({ error: `Item not in dialing state (current: ${item.status})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DNC check ──
    if (item.store_id) {
      const { data: store } = await supabase
        .from("store_master")
        .select("do_not_call")
        .eq("id", item.store_id)
        .maybeSingle();

      if (store?.do_not_call) {
        // Auto-complete as compliance block
        await supabase.from("outbound_call_queue")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", queue_item_id);

        return new Response(
          JSON.stringify({ error: "DNC store — blocked", compliance: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Get Twilio credentials ──
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build status callback URL ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-status-webhook`;

    // ── Place Twilio call ──
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;

    const params = new URLSearchParams();
    params.set("To", item.phone_number);
    params.set("From", TWILIO_PHONE_NUMBER);
    // TwiML: ring for 30s, play brief hold message
    params.set("Twiml", `<Response><Pause length="1"/><Say>Please hold while we connect you.</Say><Pause length="30"/></Response>`);
    params.set("StatusCallback", statusCallbackUrl);
    params.set("StatusCallbackEvent", "initiated ringing answered completed");
    params.set("StatusCallbackMethod", "POST");
    params.set("MachineDetection", "DetectMessageEnd"); // AMD
    params.set("AsyncAmd", "true");
    params.set("AsyncAmdStatusCallback", statusCallbackUrl);
    params.set("AsyncAmdStatusCallbackMethod", "POST");
    params.set("Timeout", "30");

    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      // Log the failure
      await supabase.from("twilio_call_logs").insert({
        business_id,
        queue_item_id,
        to_number: item.phone_number,
        from_number: TWILIO_PHONE_NUMBER,
        status: "api_error",
        raw_payload: twilioData,
      });

      return new Response(
        JSON.stringify({ error: "Twilio API error", details: twilioData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callSid = twilioData.sid;

    // ── Save call_sid to queue item ──
    await supabase.from("outbound_call_queue").update({
      twilio_call_sid: callSid,
      dialing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", queue_item_id);

    // ── Audit log ──
    await supabase.from("twilio_call_logs").insert({
      business_id,
      queue_item_id,
      call_sid: callSid,
      direction: "outbound",
      to_number: item.phone_number,
      from_number: TWILIO_PHONE_NUMBER,
      status: "initiated",
      raw_payload: twilioData,
    });

    return new Response(
      JSON.stringify({ success: true, call_sid: callSid, queue_item_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
