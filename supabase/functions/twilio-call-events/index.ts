import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Parse Twilio webhook (form-encoded or JSON)
    let callSid: string | null = null;
    let callStatus: string | null = null;
    let duration: string | null = null;
    let recordingUrl: string | null = null;
    let recordingSid: string | null = null;

    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      callSid = formData.get("CallSid") as string;
      callStatus = formData.get("CallStatus") as string;
      duration = formData.get("CallDuration") as string;
      recordingUrl = formData.get("RecordingUrl") as string;
      recordingSid = formData.get("RecordingSid") as string;
    } else {
      const body = await req.json();
      callSid = body.CallSid || body.call_sid;
      callStatus = body.CallStatus || body.call_status;
      duration = body.CallDuration || body.duration;
      recordingUrl = body.RecordingUrl || body.recording_url;
      recordingSid = body.RecordingSid || body.recording_sid;
    }

    if (!callSid || !callStatus) {
      return new Response(JSON.stringify({ error: "Missing CallSid or CallStatus" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[twilio-call-events] SID=${callSid} Status=${callStatus}`);

    // Map Twilio status to our state
    const stateMap: Record<string, string> = {
      queued: "queued",
      initiated: "dialing",
      ringing: "ringing",
      "in-progress": "answered",
      answered: "answered",
      completed: "completed",
      failed: "failed",
      busy: "failed",
      "no-answer": "failed",
      canceled: "failed",
    };

    const newState = stateMap[callStatus] || callStatus;

    const updatePayload: Record<string, any> = {
      state: newState,
      updated_at: new Date().toISOString(),
    };

    if (callStatus === "in-progress" || callStatus === "answered") {
      updatePayload.answered_at = new Date().toISOString();
    }

    if (callStatus === "completed" || callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer" || callStatus === "canceled") {
      updatePayload.ended_at = new Date().toISOString();
      if (duration) {
        updatePayload.duration_seconds = parseInt(duration, 10);
      }
    }

    if (recordingUrl) {
      updatePayload.recording_url = recordingUrl;
      updatePayload.recording_sid = recordingSid;
    }

    // Try to update existing live_calls row by call_sid
    const { data: updated, error } = await supabase
      .from("live_calls")
      .update(updatePayload)
      .eq("call_sid", callSid)
      .select("id");

    if (error) {
      console.error("[twilio-call-events] Update failed:", error);
    }

    // If no row matched by call_sid, try matching by phone from outbound_call_queue
    if (!updated || updated.length === 0) {
      // Look up the queue entry to find the phone and link it
      const { data: queueEntry } = await supabase
        .from("outbound_call_queue")
        .select("phone_number, business_id, store_id, metadata")
        .eq("call_sid", callSid)
        .single();

      if (queueEntry) {
        // Try to update a queued live_calls row with matching phone + no call_sid yet
        const { data: linked } = await supabase
          .from("live_calls")
          .update({ ...updatePayload, call_sid: callSid })
          .eq("phone_number", queueEntry.phone_number)
          .eq("business_id", queueEntry.business_id)
          .is("call_sid", null)
          .in("state", ["queued", "dialing"])
          .order("started_at", { ascending: false })
          .limit(1)
          .select("id");

        if (!linked || linked.length === 0) {
          // Create a new live_calls entry as fallback
          await supabase.from("live_calls").insert({
            call_sid: callSid,
            business_id: queueEntry.business_id,
            store_id: queueEntry.store_id,
            phone_number: queueEntry.phone_number,
            agent_type: (queueEntry.metadata as any)?.route_mode === "ai" ? "ai" : "human",
            voice_provider: (queueEntry.metadata as any)?.voice_engine || null,
            state: newState,
            source_reason: "twilio_webhook",
            started_at: new Date().toISOString(),
            ...(updatePayload.answered_at ? { answered_at: updatePayload.answered_at } : {}),
            ...(updatePayload.ended_at ? { ended_at: updatePayload.ended_at } : {}),
            ...(updatePayload.duration_seconds ? { duration_seconds: updatePayload.duration_seconds } : {}),
            ...(updatePayload.recording_url ? { recording_url: updatePayload.recording_url } : {}),
          });
        }
      }
    }

    // Also update outbound_call_queue status to keep them in sync
    if (callStatus === "completed" || callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer" || callStatus === "canceled") {
      await supabase
        .from("outbound_call_queue")
        .update({ status: callStatus === "completed" ? "completed" : "failed" })
        .eq("call_sid", callSid);
    }

    // Return TwiML-compatible empty response for Twilio webhooks
    return new Response("<Response/>", {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[twilio-call-events] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
