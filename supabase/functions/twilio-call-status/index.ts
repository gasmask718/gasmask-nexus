import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_MAP: Record<string, string> = {
  queued: "queued",
  initiated: "initiated",
  ringing: "ringing",
  "in-progress": "in_progress",
  answered: "in_progress",
  completed: "completed",
  busy: "busy",
  "no-answer": "no_answer",
  failed: "failed",
  canceled: "canceled",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const initialScript = url.searchParams.get("script");

    const formData = await req.formData();

    // 🔴 FORCE TRIM: Ensures exact matching for the frontend dashboard
    const callSid = formData.get("CallSid")?.toString().trim() || "";
    const parentCallSid = formData.get("ParentCallSid")?.toString().trim() || null;
    const callStatus = formData.get("CallStatus")?.toString() || "";
    const from = formData.get("From")?.toString() || "";
    const to = formData.get("To")?.toString() || "";
    const direction = formData.get("Direction")?.toString() || "";
    const duration = formData.get("CallDuration")?.toString() || formData.get("Duration")?.toString() || "0";
    const recordingUrl = formData.get("RecordingUrl")?.toString() || null;
    const recordingDuration = formData.get("RecordingDuration")?.toString() || null;
    const errorCode = formData.get("ErrorCode")?.toString() || null;
    const errorMessage = formData.get("ErrorMessage")?.toString() || null;
    const timestamp = formData.get("Timestamp")?.toString() || new Date().toISOString();

    console.log(`📞 Call Status Update: SID=${callSid}, Status=${callStatus}`);

    if (!callSid) {
      return new Response(JSON.stringify({ success: false, error: "Missing CallSid" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? null;

    const waitUntil = (promise: Promise<unknown>) => {
      try {
        // @ts-ignore
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(promise);
          return;
        }
      } catch {}
      promise.catch((e) => console.error("❌ Background task failed:", e));
    };

    const dbStatus = STATUS_MAP[callStatus] || callStatus;
    const isTerminal = ["completed", "busy", "no_answer", "failed", "canceled"].includes(dbStatus);

    // 🔴 TRANSCRIPT LOGGING: Only log the initial script when the call starts progressing
    if (callStatus === "in-progress" && initialScript) {
      const { data: existingLog } = await supabase
        .from("live_call_transcripts")
        .select("id")
        .eq("call_sid", callSid)
        .eq("text", initialScript)
        .maybeSingle();

      if (!existingLog) {
        await supabase.from("live_call_transcripts").insert({
          call_sid: callSid,
          speaker: "ai",
          text: initialScript,
          is_final: true,
          created_at: new Date().toISOString(),
        });
        console.log(`🧾 Logged initial TTS script for connected call: ${callSid}`);
      }
    }

    const recordingUpdate: Record<string, any> = {};
    if (recordingUrl) recordingUpdate.recording_url = recordingUrl;
    if (recordingDuration) recordingUpdate.recording_duration = parseInt(recordingDuration, 10);
    if (isTerminal) recordingUpdate.completed_at = new Date().toISOString();

    const effectiveSid = parentCallSid || callSid;

    const { data: recording } = await supabase
      .from("call_recordings")
      .select("id, manual_call_id, elevenlabs_conversation_id")
      .eq("provider_call_sid", effectiveSid)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recording) {
      if (Object.keys(recordingUpdate).length > 0) {
        await supabase.from("call_recordings").update(recordingUpdate).eq("id", recording.id);
      }

      if (recording.manual_call_id) {
        const callLogUpdate: Record<string, any> = { status: dbStatus };
        if (isTerminal) {
          callLogUpdate.ended_at = new Date().toISOString();
          callLogUpdate.duration_seconds = parseInt(duration, 10);
          if (dbStatus === "completed") callLogUpdate.outcome = "connected";
          else if (dbStatus === "no_answer") callLogUpdate.outcome = "no_answer";
          else if (dbStatus === "failed") callLogUpdate.outcome = "failed";
        }

        await supabase.from("manual_call_logs").update(callLogUpdate).eq("id", recording.manual_call_id);

        if (isTerminal && ELEVENLABS_API_KEY && recording.elevenlabs_conversation_id && dbStatus === "completed") {
          waitUntil(
            (async () => {
              try {
                const convoRes = await fetch(
                  `https://api.elevenlabs.io/v1/convai/conversations/${recording.elevenlabs_conversation_id}`,
                  {
                    method: "GET",
                    headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
                  },
                );

                if (!convoRes.ok) return;
                const convoJson = await convoRes.json();
                const items = convoJson?.messages || convoJson?.transcript || [];

                if (Array.isArray(items) && items.length > 0) {
                  const rows = items.map((it: any) => ({
                    call_sid: effectiveSid,
                    speaker: it.role === "agent" || it.role === "ai" ? "ai" : "caller",
                    text: it.text || it.message || "",
                    is_final: true,
                    created_at: new Date().toISOString(),
                  }));
                  await supabase.from("live_call_transcripts").insert(rows);
                }
              } catch (e) {
                console.error("❌ Transcript logging error:", e);
              }
            })(),
          );
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: corsHeaders,
    });
  }
};

serve(handler);
