import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

/**
 * DIALER BRIDGE AGENT
 * 
 * Called by the twilio-status-webhook when AMD detects a human answer.
 * Creates a Twilio Conference, moves the target leg into it, and
 * dials the agent (browser or phone forward) into the same conference.
 * 
 * Supports:
 * - Browser softphone (Twilio Client identity)
 * - Phone forward (PSTN dial to agent's cell)
 * - Optional whisper before joining conference
 * - Idempotent: safe to call twice for same session
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { session_id, queue_item_id, target_call_sid, business_id } = await req.json();

    if (!session_id || !target_call_sid || !business_id) {
      return new Response(
        JSON.stringify({ error: "session_id, target_call_sid, and business_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Idempotency: check if already bridged ──
    const { data: session } = await supabase
      .from("live_call_sessions")
      .select("id, rep_user_id, contact_name, store_id, phone_number, campaign_id")
      .eq("id", session_id)
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if attempt already has a conference (idempotent)
    const { data: existingAttempt } = await supabase
      .from("dialer_call_attempts")
      .select("id, conference_sid")
      .eq("target_call_sid", target_call_sid)
      .maybeSingle();

    if (existingAttempt?.conference_sid) {
      return new Response(
        JSON.stringify({ ok: true, note: "already_bridged", conference_sid: existingAttempt.conference_sid }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // ── Conference name ──
    const conferenceName = `conf_${session_id}`;

    // Recording consent gate: conference recording is dual-sided, so it needs
    // the same gate as <Dial record=...>. Fails closed on unknown jurisdiction.
    const { decision: recDecision } = await recordAttrFor(supabase, session.phone_number, {});
    const confRecordAttr = recDecision.allowed ? ' record="record-from-start"' : "";
    console.log(`[dialer-bridge-agent] conference recording=${confRecordAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);

    // ── Step 1: Move the target (customer) leg into a conference ──
    // Update the target call's TwiML to join a conference
    const targetConferenceTwiml = `<Response><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true"${confRecordAttr} beep="false" waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.soft-rock">${conferenceName}</Conference></Dial></Response>`;

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${target_call_sid}.json`,
      {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ Twiml: targetConferenceTwiml }).toString(),
      }
    );

    console.log(`✅ Target leg ${target_call_sid} moved to conference ${conferenceName}`);

    // ── Step 2: Determine agent routing ──
    const agentUserId = session.rep_user_id;
    if (!agentUserId) {
      return new Response(
        JSON.stringify({ error: "No agent assigned to session" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: agentAvail } = await supabase
      .from("dialer_agent_availability")
      .select("phone_route_type, forward_phone_e164, user_id")
      .eq("user_id", agentUserId)
      .eq("business_id", business_id)
      .maybeSingle();

    const routeType = agentAvail?.phone_route_type || "browser";
    const forwardPhone = agentAvail?.forward_phone_e164;

    // ── Fetch whisper settings ──
    const { data: settings } = await supabase
      .from("dialer_settings")
      .select("whisper_enabled, whisper_template")
      .eq("business_id", business_id)
      .maybeSingle();

    const whisperEnabled = settings?.whisper_enabled || false;
    let whisperText = "";
    if (whisperEnabled) {
      const template = settings?.whisper_template || "Connected: {{contact_name}}";
      whisperText = template
        .replace("{{contact_name}}", session.contact_name || "Unknown")
        .replace("{{store_name}}", session.contact_name || "Unknown")
        .replace("{{last_order_date}}", "check CRM");
    }

    // ── Step 3: Dial the agent ──
    let agentCallSid: string | null = null;
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-status-webhook`;

    if (routeType === "browser") {
      // Dial the Twilio Client identity
      const identity = `user_${agentUserId.replace(/-/g, "")}`;
      
      // Build TwiML: optional whisper then join conference
      let agentTwiml = "<Response>";
      if (whisperEnabled && whisperText) {
        agentTwiml += `<Say voice="Polly.Joanna">${whisperText}</Say><Pause length="1"/>`;
      }
      agentTwiml += `<Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true"${confRecordAttr} beep="false">${conferenceName}</Conference></Dial></Response>`;

      // Create outbound call to browser client
      const params = new URLSearchParams();
      params.set("To", `client:${identity}`);
      params.set("From", TWILIO_PHONE_NUMBER);
      params.set("Twiml", agentTwiml);
      params.set("StatusCallback", statusCallbackUrl);
      params.set("StatusCallbackEvent", "answered completed");
      params.set("StatusCallbackMethod", "POST");
      params.set("Timeout", "30");

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
        {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        }
      );

      const resData = await res.json();
      if (res.ok) {
        agentCallSid = resData.sid;
        console.log(`✅ Agent browser leg dialed: ${agentCallSid} → client:${identity}`);
      } else {
        console.error(`❌ Failed to dial agent browser:`, resData);
      }
    } else if (routeType === "forward" && forwardPhone) {
      // Dial agent's cell phone
      let agentTwiml = "<Response>";
      if (whisperEnabled && whisperText) {
        agentTwiml += `<Say voice="Polly.Joanna">${whisperText}</Say><Pause length="1"/>`;
      }
      agentTwiml += `<Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true"${confRecordAttr} beep="false">${conferenceName}</Conference></Dial></Response>`;

      const params = new URLSearchParams();
      params.set("To", forwardPhone);
      params.set("From", TWILIO_PHONE_NUMBER);
      params.set("Twiml", agentTwiml);
      params.set("StatusCallback", statusCallbackUrl);
      params.set("StatusCallbackEvent", "answered completed");
      params.set("StatusCallbackMethod", "POST");
      params.set("Timeout", "30");

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
        {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        }
      );

      const resData = await res.json();
      if (res.ok) {
        agentCallSid = resData.sid;
        console.log(`✅ Agent forward leg dialed: ${agentCallSid} → ${forwardPhone}`);
      } else {
        console.error(`❌ Failed to dial agent forward:`, resData);
      }
    }

    // ── Step 4: Update records ──
    // Update live_call_sessions with conference info
    await supabase.from("live_call_sessions").update({
      twilio_call_sid: target_call_sid,
    }).eq("id", session_id);

    // Update or create attempt record
    if (existingAttempt) {
      await supabase.from("dialer_call_attempts").update({
        attempt_state: agentCallSid ? "dialing_agent" : "answered_human",
        agent_user_id: agentUserId,
        agent_call_sid: agentCallSid,
        conference_sid: conferenceName,
        conference_name: conferenceName,
        whisper_played: whisperEnabled,
      }).eq("id", existingAttempt.id);
    } else {
      await supabase.from("dialer_call_attempts").insert({
        business_id,
        campaign_id: session.campaign_id,
        queue_item_id: queue_item_id || null,
        store_id: session.store_id,
        target_phone_e164: session.phone_number || "",
        agent_user_id: agentUserId,
        attempt_state: agentCallSid ? "dialing_agent" : "answered_human",
        amd_result: "human",
        target_call_sid,
        agent_call_sid: agentCallSid,
        conference_sid: conferenceName,
        conference_name: conferenceName,
        target_answered_at: new Date().toISOString(),
        whisper_played: whisperEnabled,
      });
    }

    // Update agent availability
    await supabase.from("dialer_agent_availability").update({
      current_session_id: session_id,
    }).eq("user_id", agentUserId).eq("business_id", business_id);

    return new Response(
      JSON.stringify({
        success: true,
        conference_name: conferenceName,
        agent_call_sid: agentCallSid,
        route_type: routeType,
        whisper_played: whisperEnabled,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Bridge error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
