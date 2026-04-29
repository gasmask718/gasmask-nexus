// Public TwiML endpoint hit by Twilio when the recipient answers.
// Plays the campaign script via TTS, then asks for confirmation.
// On confirmation -> bridges to Bland AI agent. Otherwise -> polite hangup.
//
// Hardened (2026-04-29):
//  - Twilio signature validation (X-Twilio-Signature) — rejects unsigned/invalid.
//  - Idempotent intro logging.
//  - Status update -> 'intro_playing' / 'awaiting_input' for granular UI states.

import {
  corsHeaders,
  xmlHeaders,
  escapeXml,
  svc,
  verifyTwilio,
  readForm,
  logEvent,
} from "../_shared/dialer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // For TwiML endpoints we ALWAYS return TwiML — even on auth failure — to avoid
  // dead-air on the live call. We log the error and play a short polite message.
  const fail = (msg = "An error occurred. Goodbye.") =>
    new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escapeXml(msg)}</Say><Hangup/></Response>`,
      { headers: xmlHeaders },
    );

  try {
    const supabase = svc();
    const url = new URL(req.url);
    const campaign_id = url.searchParams.get("campaign_id");
    const queue_item_id = url.searchParams.get("queue_item_id");
    const lead_id = url.searchParams.get("lead_id");
    const agent_type = url.searchParams.get("agent_type") || "sales-outreach";
    const bland_agent_id = url.searchParams.get("bland_agent_id") || "";
    const call_session_id = url.searchParams.get("call_session_id");

    const params = await readForm(req);
    const callSid = params["CallSid"] || url.searchParams.get("CallSid") || "";

    // Twilio signature check
    const auth = verifyTwilio(req, params);
    if (!auth.ok) {
      await logEvent({
        supabase,
        campaign_id,
        queue_item_id,
        call_session_id,
        call_sid: callSid,
        event_type: "twiml.intro.unauthorized",
        source: "twilio",
        severity: "warning",
        payload: { reason: auth.reason },
      });
      return fail("Unauthorized request.");
    }

    // Load campaign script + confirmation prompt + voicemail config.
    let script = "Hello, this is an important call regarding your account.";
    let confirmPrompt = "Press 1 or say yes to speak with our specialist now. Press 2 to opt out.";
    let voicemailAction = "hangup";
    let voicemailMessage = "";
    if (campaign_id) {
      const { data: c } = await supabase
        .from("dialer_campaigns")
        .select("initial_script, confirmation_prompt, voicemail_action, voicemail_message")
        .eq("id", campaign_id)
        .maybeSingle();
      if (c?.initial_script) script = c.initial_script;
      if ((c as any)?.confirmation_prompt) confirmPrompt = (c as any).confirmation_prompt;
      if ((c as any)?.voicemail_action) voicemailAction = (c as any).voicemail_action;
      if ((c as any)?.voicemail_message) voicemailMessage = (c as any).voicemail_message;
    }

    // Status: intro is starting.
    if (queue_item_id) {
      await supabase
        .from("outbound_call_queue")
        .update({ status: "intro_playing", updated_at: new Date().toISOString() })
        .eq("id", queue_item_id);
    }
    await logEvent({
      supabase,
      campaign_id,
      queue_item_id,
      call_session_id,
      call_sid: callSid,
      event_type: "twiml.intro",
      source: "twilio",
      payload: { agent_type, answered_by: params["AnsweredBy"] || null },
    });

    // ---- AMD branch: if Twilio sent AnsweredBy=machine_*, divert ----
    const answeredBy = (params["AnsweredBy"] || "").toLowerCase();
    if (answeredBy.startsWith("machine") || answeredBy === "fax") {
      if (queue_item_id) {
        await supabase
          .from("outbound_call_queue")
          .update({
            answered_by: answeredBy,
            status: voicemailAction === "leave_message" ? "voicemail_left" : "voicemail_detected",
            voicemail_left: voicemailAction === "leave_message",
            ended_at: voicemailAction === "leave_message" ? null : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", queue_item_id);
      }
      await logEvent({
        supabase,
        campaign_id,
        queue_item_id,
        call_session_id,
        call_sid: callSid,
        event_type: "amd.machine_detected",
        source: "twilio",
        severity: "info",
        payload: { answered_by: answeredBy, action: voicemailAction },
      });

      if (voicemailAction === "leave_message" && voicemailMessage) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(voicemailMessage)}</Say>
  <Hangup/>
</Response>`;
        return new Response(twiml.trim(), { headers: xmlHeaders });
      }
      return fail("Goodbye.");
    }

    const ctx = new URLSearchParams({
      ...(campaign_id ? { campaign_id } : {}),
      ...(queue_item_id ? { queue_item_id } : {}),
      ...(lead_id ? { lead_id } : {}),
      agent_type,
      ...(bland_agent_id ? { bland_agent_id } : {}),
      ...(call_session_id ? { call_session_id } : {}),
      attempt: "1",
    });
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const confirmUrl = `${SUPABASE_URL}/functions/v1/twilio-campaign-confirm?${ctx.toString()}`;

    // Mark awaiting_input.
    if (queue_item_id) {
      await supabase
        .from("outbound_call_queue")
        .update({ status: "awaiting_input", updated_at: new Date().toISOString() })
        .eq("id", queue_item_id);
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(script)}</Say>
  <Gather input="dtmf speech" numDigits="1" timeout="6" speechTimeout="auto"
          hints="yes,sure,okay,interested,one,two,no"
          action="${escapeXml(confirmUrl)}" method="POST">
    <Say voice="Polly.Joanna">${escapeXml(confirmPrompt)}</Say>
  </Gather>
  <Say voice="Polly.Joanna">We did not receive your response. Goodbye.</Say>
  <Hangup/>
</Response>`;

    return new Response(twiml.trim(), { headers: xmlHeaders });
  } catch (err) {
    console.error("twilio-campaign-twiml error:", err);
    return fail();
  }
});
