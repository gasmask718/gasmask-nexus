// Twilio bridge fallback — returns TwiML when bridging to Bland AI fails.
// Updates the queue row to `failed_bridge` so the dispatcher can retry per
// campaign settings.
//
// Twilio fetches this URL when:
//   - the <Dial> action callback fires with no Answer
//   - the bridge SIP destination errors out
//   - we explicitly redirect a parent leg here on bridge failure

import { corsHeaders, svc, xmlHeaders, escapeXml, logEvent, readForm, verifyTwilio } from "../_shared/dialer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = svc();
    const url = new URL(req.url);
    const queue_item_id = url.searchParams.get("queue_item_id");
    const campaign_id = url.searchParams.get("campaign_id");
    const call_session_id = url.searchParams.get("call_session_id");

    const params = await readForm(req);
    const auth = verifyTwilio(req, params);
    if (!auth.ok) {
      // Don't 401 — that loses the call. Log + still respond with hangup TwiML.
      console.warn("twilio-bridge-fallback signature invalid:", auth.reason);
    }

    const callSid = params["CallSid"] || "";
    const dialCallStatus = params["DialCallStatus"] || params["CallStatus"] || "unknown";

    if (queue_item_id) {
      // Re-queue if the campaign has requeue_on_failed_bridge=true
      const { data: row } = await supabase
        .from("outbound_call_queue")
        .select("id, attempt_count, status")
        .eq("id", queue_item_id)
        .maybeSingle();

      const { data: camp } = campaign_id
        ? await supabase
            .from("dialer_campaigns")
            .select("requeue_on_failed_bridge, max_attempts, retry_backoff_minutes")
            .eq("id", campaign_id)
            .maybeSingle()
        : { data: null };

      const reQueue = !!(camp as any)?.requeue_on_failed_bridge &&
        ((row as any)?.attempt_count || 0) < ((camp as any)?.max_attempts || 3);

      const update: Record<string, unknown> = {
        status: reQueue ? "queued" : "failed_bridge",
        bridge_failed_reason: dialCallStatus,
        last_error_severity: "warning",
        updated_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      };
      if (reQueue) {
        const backoff = ((camp as any)?.retry_backoff_minutes || 30) * 60_000;
        update.next_retry_at = new Date(Date.now() + backoff).toISOString();
        update.attempt_count = ((row as any)?.attempt_count || 0) + 1;
      }

      await supabase.from("outbound_call_queue").update(update).eq("id", queue_item_id);
    }

    // Live calls reflect the failure
    if (call_session_id) {
      await supabase
        .from("live_calls")
        .update({
          state: "failed_bridge",
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("call_session_id", call_session_id);
    }

    await logEvent({
      supabase,
      campaign_id,
      queue_item_id,
      call_session_id,
      call_sid: callSid,
      event_type: "bridge.failed",
      source: "twilio",
      severity: "error",
      payload: { dial_call_status: dialCallStatus },
    });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We're sorry, the call cannot be connected right now. Please try again later.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml, { status: 200, headers: xmlHeaders });
  } catch (err) {
    console.error("twilio-bridge-fallback error:", err);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
    return new Response(twiml, { status: 200, headers: xmlHeaders });
  }
});
