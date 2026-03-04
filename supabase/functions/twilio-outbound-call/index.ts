import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  console.log("FUNCTION ONLINE:", { name: "twilio-outbound-call", time: new Date().toISOString() });

  // 1. Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();

    // ── Dry-run / health probe mode ──
    if (body.dry_run === true) {
      return new Response(JSON.stringify({ status: "ok", mode: "dry_run", reachable: true }), {
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

    // ── 2. Fetch queue item AND Campaign Data (FIXED) ──
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

    // ── 3. Validate: must be in dialing state ──
    // Note: We allow 'queued' too, just in case the frontend optimistic update failed
    if (item.status !== "dialing" && item.status !== "queued") {
      return new Response(JSON.stringify({ error: `Item state invalid (current: ${item.status})` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. DNC check ──
    if (item.store_id) {
      const { data: store } = await supabase
        .from("store_master")
        .select("do_not_call")
        .eq("id", item.store_id)
        .maybeSingle();

      if (store?.do_not_call) {
        // Auto-complete as compliance block
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

    // ── 5. Get Twilio credentials ──
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 6. Build Status Callback URL ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Note: Ensure you have a 'twilio-status-webhook' function or remove this param if not
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-status-webhook`;

    // ── 7. Generate Dynamic TwiML (FIXED) ──
    // We grab the script from the joined campaign data
    let script = item.dialer_campaigns?.initial_script || "Hello, this is a call from our automated system.";

    // Replace variables
    script = script.replace("{{contact_name}}", item.contact_name || "there");
    script = script.replace("{{agent_name}}", "our assistant");
    script = script.replace("{{business_name}}", "our company");

    const twiml = `
      <Response>
        <Pause length="1"/>
        <Say voice="alice" language="en-US">${script}</Say>
        <Pause length="30"/>
      </Response>
    `;

    // ── 8. Place Twilio call ──
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;

    const params = new URLSearchParams();
    params.set("To", item.phone_number);
    params.set("From", TWILIO_PHONE_NUMBER);
    params.set("Twiml", twiml);
    params.set("StatusCallback", statusCallbackUrl);
    params.set("StatusCallbackEvent", "initiated ringing answered completed");
    params.set("StatusCallbackMethod", "POST");

    // Use campaign setting for AMD
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
      // Log the failure
      await supabase.from("twilio_call_logs").insert({
        business_id,
        queue_item_id,
        to_number: item.phone_number,
        from_number: TWILIO_PHONE_NUMBER,
        status: "api_error",
        raw_payload: twilioData,
      });

      // Mark queue item as failed so it doesn't get stuck
      await supabase
        .from("outbound_call_queue")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", queue_item_id);

      return new Response(JSON.stringify({ error: "Twilio API error", details: twilioData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callSid = twilioData.sid;

    // ── 9. Success: Update queue item ──
    await supabase
      .from("outbound_call_queue")
      .update({
        twilio_call_sid: callSid,
        dialing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Status remains 'dialing' until webhook confirms 'completed'
      })
      .eq("id", queue_item_id);

    // ── 10. Audit log ──
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

    return new Response(JSON.stringify({ success: true, call_sid: callSid, queue_item_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
