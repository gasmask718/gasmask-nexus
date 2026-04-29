// Twilio <Dial action> callback when the bridge to Bland completes (or fails).
// DialCallStatus: completed | answered | busy | no-answer | failed | canceled
//
// On non-answered terminal states we mark failed_bridge, optionally requeue,
// and play a polite message to the caller before hangup.

import {
  corsHeaders,
  xmlHeaders,
  escapeXml,
  svc,
  verifyTwilio,
  readForm,
  logEvent,
} from "../_shared/dialer.ts";

const ANSWERED = new Set(["answered", "completed"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const respond = (xml: string) => new Response(xml.trim(), { headers: xmlHeaders });

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
        event_type: "bridge_fallback.unauthorized", source: "twilio", severity: "warning",
        payload: { reason: auth.reason },
      });
      return respond(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
    }

    const callSid = params["CallSid"] || "";
    const dialStatus = (params["DialCallStatus"] || "").toLowerCase();
    const dialDuration = params["DialCallDuration"] || null;

    await logEvent({
      supabase, campaign_id, queue_item_id, call_session_id, call_sid: callSid,
      event_type: `bridge.${dialStatus || "unknown"}`,
      source: "twilio",
      severity: ANSWERED.has(dialStatus) ? "info" : "warning",
      payload: { dial_status: dialStatus, dial_duration: dialDuration },
    });

    if (queue_item_id) {
      const baseUpdate: Record<string, unknown> = {
        dial_status: dialStatus,
        updated_at: new Date().toISOString(),
      };

      if (ANSWERED.has(dialStatus)) {
        Object.assign(baseUpdate, {
          status: "transferred",
          bridged_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
        });
        await supabase.from("outbound_call_queue").update(baseUpdate).eq("id", queue_item_id);
        return respond(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
      }

      // Failed bridge — requeue per campaign + read voicemail message
      let requeue = true;
      let busyMsg = "All of our agents are currently busy. We'll call you right back. Goodbye.";
      if (campaign_id) {
        const { data: c } = await supabase
          .from("dialer_campaigns")
          .select("requeue_on_failed_bridge, voicemail_message")
          .eq("id", campaign_id).maybeSingle();
        if (c && (c as any).requeue_on_failed_bridge === false) requeue = false;
      }
      const { data: row } = await supabase
        .from("outbound_call_queue")
        .select("attempt_count")
        .eq("id", queue_item_id).maybeSingle();
      const attempts = ((row as any)?.attempt_count ?? 0) + 1;

      Object.assign(baseUpdate, {
        status: "failed_bridge",
        bridge_failed_reason: dialStatus || "unknown",
        attempt_count: attempts,
        next_retry_at: requeue ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
        ended_at: new Date().toISOString(),
        last_error_severity: "warning",
      });
      await supabase.from("outbound_call_queue").update(baseUpdate).eq("id", queue_item_id);

      return respond(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(busyMsg)}</Say>
  <Hangup/>
</Response>`);
    }

    return respond(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
  } catch (err) {
    console.error("twilio-bridge-fallback error:", err);
    return respond(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
  }
});
