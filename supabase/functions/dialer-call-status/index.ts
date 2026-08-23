// Twilio status callback for the auto-dialer parent call leg.
// Maps Twilio CallStatus + AsyncAmd events -> outbound_call_queue.status,
// and appends every event to dialer_call_events for the live dashboard.
//
// Hardened (2026-04-29):
//  - Twilio signature validation
//  - Webhook idempotency via dialer_webhook_events (CallSid + status)
//  - Severity-tagged events on errors
//  - AMD result captured into answered_by

import {
  corsHeaders,
  svc,
  verifyTwilio,
  readForm,
  logEvent,
  recordWebhookDelivery,
} from "../_shared/dialer.ts";

const STATUS_MAP: Record<string, string> = {
  initiated: "dialing",
  queued: "dialing",
  ringing: "ringing",
  "in-progress": "connected",
  completed: "completed",
  busy: "failed",
  failed: "failed",
  "no-answer": "no_answer",
  canceled: "failed",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = svc();
    const url = new URL(req.url);
    const campaign_id = url.searchParams.get("campaign_id");
    const queue_item_id = url.searchParams.get("queue_item_id");
    const call_session_id = url.searchParams.get("call_session_id");

    const params = await readForm(req);
    const auth = verifyTwilio(req, params);
    if (!auth.ok) {
      await logEvent({
        supabase, campaign_id, queue_item_id, call_session_id,
        call_sid: params["CallSid"] || null,
        event_type: "status.unauthorized", source: "twilio", severity: "warning",
        payload: { reason: auth.reason },
      });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const callSid = params["CallSid"] || "";
    const callStatus = (params["CallStatus"] || "").toLowerCase();
    const callDuration = params["CallDuration"] || null;
    const errorCode = params["ErrorCode"] || null;
    const errorMsg = params["ErrorMessage"] || null;
    const answeredBy = params["AnsweredBy"] || null;

    // The Twilio AsyncAmd callback fires WITHOUT a CallStatus — it carries AnsweredBy only.
    const isAmdCallback = !!answeredBy && !callStatus;
    const externalId = `${callSid}|${isAmdCallback ? `amd:${answeredBy}` : callStatus || "unknown"}`;
    const firstDelivery = await recordWebhookDelivery({
      supabase,
      provider: "twilio",
      external_id: externalId,
      event_type: isAmdCallback ? "twilio.amd" : `twilio.${callStatus || "unknown"}`,
      call_session_id,
      call_sid: callSid,
      payload: params,
    });
    if (!firstDelivery) {
      // Already processed — return 200 but skip writes.
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const severity =
      callStatus === "failed" || callStatus === "busy" || callStatus === "canceled" ? "error" :
      callStatus === "no-answer" ? "warning" : "info";

    await logEvent({
      supabase, campaign_id, queue_item_id, call_session_id, call_sid: callSid,
      event_type: isAmdCallback ? "twilio.amd_result" : `twilio.${callStatus || "unknown"}`,
      source: "twilio", severity,
      payload: {
        call_status: callStatus,
        duration: callDuration,
        error_code: errorCode,
        error_message: errorMsg,
        answered_by: answeredBy,
      },
    });

    if (queue_item_id) {
      const { data: row } = await supabase
        .from("outbound_call_queue")
        .select("status")
        .eq("id", queue_item_id)
        .maybeSingle();
      const current = (row as any)?.status as string | undefined;
      const protectedStates = new Set([
        "bridging", "bridged", "in_ai_conversation", "transferred",
        "declined", "no_input", "voicemail_detected", "voicemail_left",
        "failed_bridge", "completed", "failed",
      ]);

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const mapped = STATUS_MAP[callStatus];

      if (isAmdCallback) {
        update.answered_by = answeredBy;
        // Power-dialer AMD verdicts (2026-08-23): a human bridges to the
        // agent; a machine hangs up — the agent never hears non-humans.
        if (answeredBy === "human" && call_session_id) {
          update.status = "bridging";
          update.bridge_attempted_at = new Date().toISOString();
          const { data: qrow } = await supabase
            .from("outbound_call_queue").select("business_id").eq("id", queue_item_id).maybeSingle();
          supabase.functions.invoke("dialer-bridge-agent", {
            body: { session_id: call_session_id, queue_item_id, target_call_sid: callSid, business_id: qrow?.business_id },
          }).then((r: any) => {
            if (r?.error) console.error("bridge invoke failed:", r.error);
          }).catch((e: any) => console.error("bridge invoke threw:", e));
        } else if (answeredBy && answeredBy !== "human") {
          update.status = "voicemail_detected";
          update.ended_at = new Date().toISOString();
          try {
            const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
            const tok = Deno.env.get("TWILIO_AUTH_TOKEN")!;
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}.json`, {
              method: "POST",
              headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ Twiml: "<Response><Hangup/></Response>" }),
            });
          } catch (e) { console.error("amd machine hangup failed:", e); }
          // Agent was never engaged — release them for the next number.
          if (call_session_id) {
            const { data: sess } = await supabase
              .from("live_call_sessions").select("rep_user_id, business_id").eq("id", call_session_id).maybeSingle();
            if (sess?.rep_user_id) {
              await supabase.from("dialer_agent_availability").update({
                status: "available", current_session_id: null, active_calls_count: 0,
                updated_at: new Date().toISOString(),
              }).eq("user_id", sess.rep_user_id).eq("business_id", sess.business_id);
            }
            await supabase.from("live_call_sessions")
              .update({ ended_at: new Date().toISOString(), outcome: "voicemail_detected" })
              .eq("id", call_session_id);
          }
        }
      } else if (callStatus === "in-progress") {
        update.answered_at = new Date().toISOString();
        if (!current || !protectedStates.has(current)) update.status = "connected";
      } else if (callStatus === "completed") {
        update.ended_at = new Date().toISOString();
        if (current === "bridged" || current === "in_ai_conversation") update.status = "transferred";
        else if (!current || !protectedStates.has(current)) update.status = "completed";
      } else if (mapped && (!current || !protectedStates.has(current))) {
        update.status = mapped;
        if (severity !== "info") update.last_error_severity = severity;
      }

      if (Object.keys(update).length > 1) {
        await supabase.from("outbound_call_queue").update(update).eq("id", queue_item_id);
      }
    }

    // Mirror to live_calls so the Live Monitor reflects truth in realtime.
    try {
      const liveUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (callStatus === "ringing") liveUpdate.state = "ringing";
      else if (callStatus === "in-progress") {
        liveUpdate.state = "connected";
        liveUpdate.answered_at = new Date().toISOString();
      } else if (callStatus === "completed") {
        liveUpdate.state = "completed";
        liveUpdate.ended_at = new Date().toISOString();
      } else if (["busy", "failed", "canceled"].includes(callStatus)) {
        liveUpdate.state = "failed";
        liveUpdate.ended_at = new Date().toISOString();
      } else if (callStatus === "no-answer") {
        liveUpdate.state = "no_answer";
        liveUpdate.ended_at = new Date().toISOString();
      }
      if (Object.keys(liveUpdate).length > 1 && callSid) {
        await supabase.from("live_calls").update(liveUpdate).eq("call_sid", callSid);
      }
    } catch (e) {
      console.error("live_calls mirror failed:", e);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("dialer-call-status error:", err);
    // Always 200 so Twilio doesn't pile up retries — we logged severity above.
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
