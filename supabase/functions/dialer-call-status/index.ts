// Twilio status callback for the auto-dialer parent call leg.
// Maps Twilio CallStatus -> outbound_call_queue.status and appends
// every event to dialer_call_events for the live dashboard timeline.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const STATUS_MAP: Record<string, string> = {
  initiated: "dialing",
  queued: "dialing",
  ringing: "dialing",
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const url = new URL(req.url);
    const campaign_id = url.searchParams.get("campaign_id");
    const queue_item_id = url.searchParams.get("queue_item_id");

    const form = await req.formData();
    const callSid = form.get("CallSid")?.toString() || "";
    const callStatus = (form.get("CallStatus")?.toString() || "").toLowerCase();
    const callDuration = form.get("CallDuration")?.toString() || null;
    const errorCode = form.get("ErrorCode")?.toString() || null;
    const errorMsg = form.get("ErrorMessage")?.toString() || null;
    const answeredBy = form.get("AnsweredBy")?.toString() || null;

    // Always log timeline event
    await supabase.from("dialer_call_events").insert({
      campaign_id,
      queue_item_id,
      call_sid: callSid,
      event_type: `twilio.${callStatus || "unknown"}`,
      source: "twilio",
      payload: {
        call_status: callStatus,
        duration: callDuration,
        error_code: errorCode,
        error_message: errorMsg,
        answered_by: answeredBy,
      },
    });

    if (queue_item_id && callStatus) {
      // Resolve current row to avoid clobbering bridged/declined/no_input states
      const { data: row } = await supabase
        .from("outbound_call_queue")
        .select("status")
        .eq("id", queue_item_id)
        .maybeSingle();
      const current = (row as any)?.status as string | undefined;
      const protectedStates = new Set(["bridged", "transferred", "declined", "no_input", "completed", "failed"]);

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const mapped = STATUS_MAP[callStatus];

      if (callStatus === "in-progress") {
        update.answered_at = new Date().toISOString();
        if (!current || !protectedStates.has(current)) update.status = "connected";
      } else if (callStatus === "completed") {
        update.ended_at = new Date().toISOString();
        // If it was bridged, mark transferred; otherwise completed
        if (current === "bridged") update.status = "transferred";
        else if (!current || !protectedStates.has(current)) update.status = "completed";
      } else if (mapped && (!current || !protectedStates.has(current))) {
        update.status = mapped;
      }

      if (Object.keys(update).length > 1) {
        await supabase.from("outbound_call_queue").update(update).eq("id", queue_item_id);
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("dialer-call-status error:", err);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
