import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * TWILIO CALL STATUS WEBHOOK
 * 
 * This edge function receives call lifecycle events from Twilio:
 * - initiated
 * - ringing
 * - in-progress / answered
 * - completed
 * - busy
 * - no-answer
 * - failed
 * - canceled
 * 
 * It updates the database with call status and captures:
 * - Duration
 * - End reason
 * - Recording URLs
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Twilio statuses to our internal statuses
const STATUS_MAP: Record<string, string> = {
  "queued": "queued",
  "initiated": "initiated",
  "ringing": "ringing",
  "in-progress": "in_progress",
  "answered": "in_progress",
  "completed": "completed",
  "busy": "busy",
  "no-answer": "no_answer",
  "failed": "failed",
  "canceled": "canceled",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("📞 Call status webhook received");

  try {
    // Parse the form-urlencoded body from Twilio
    const formData = await req.formData();
    
    // Extract all Twilio fields
    const callSid = formData.get("CallSid")?.toString() || "";
    const parentCallSid = formData.get("ParentCallSid")?.toString() || null;
    const callStatus = formData.get("CallStatus")?.toString() || "";
    const from = formData.get("From")?.toString() || "";
    const to = formData.get("To")?.toString() || "";
    const direction = formData.get("Direction")?.toString() || "";
    const duration = formData.get("CallDuration")?.toString() || formData.get("Duration")?.toString() || "0";
    const recordingUrl = formData.get("RecordingUrl")?.toString() || null;
    const recordingSid = formData.get("RecordingSid")?.toString() || null;
    const recordingDuration = formData.get("RecordingDuration")?.toString() || null;
    const transcriptionText = formData.get("TranscriptionText")?.toString() || null;
    const sipResponseCode = formData.get("SipResponseCode")?.toString() || null;
    const errorCode = formData.get("ErrorCode")?.toString() || null;
    const errorMessage = formData.get("ErrorMessage")?.toString() || null;
    const timestamp = formData.get("Timestamp")?.toString() || new Date().toISOString();

    console.log(`📞 Call Status Update: SID=${callSid}, Status=${callStatus}, Duration=${duration}s`);

    if (!callSid) {
      console.error("❌ Missing CallSid");
      return new Response(
        JSON.stringify({ success: false, error: "Missing CallSid" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? null;

    const waitUntil = (promise: Promise<unknown>) => {
      try {
        // @ts-ignore - available in the Edge runtime
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(promise);
          return;
        }
      } catch {
        // ignore
      }
      promise.catch((e) => console.error("❌ Background task failed:", e));
    };

    // Map status
    const dbStatus = STATUS_MAP[callStatus] || callStatus;
    const isTerminal = ["completed", "busy", "no_answer", "failed", "canceled"].includes(dbStatus);

    // Build update payload for call_recordings
    const recordingUpdate: Record<string, any> = {
      // Always update these
    };

    // Add recording info if present
    if (recordingUrl) {
      recordingUpdate.recording_url = recordingUrl;
    }
    if (recordingDuration) {
      recordingUpdate.recording_duration = parseInt(recordingDuration, 10);
    }

    // Add completion info if terminal status
    if (isTerminal) {
      recordingUpdate.completed_at = new Date().toISOString();
    }

    // 1. Update call_recordings by provider_call_sid
    const effectiveSid = parentCallSid || callSid;
    
    const { data: recording, error: recordingFindError } = await supabase
      .from("call_recordings")
      .select("id, manual_call_id, elevenlabs_conversation_id")
      .eq("provider_call_sid", effectiveSid)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recordingFindError && recordingFindError.code !== "PGRST116") {
      console.error("❌ Error finding call recording:", recordingFindError);
    }

    if (recording) {
      // Update the recording entry
      if (Object.keys(recordingUpdate).length > 0) {
        const { error: updateError } = await supabase
          .from("call_recordings")
          .update(recordingUpdate)
          .eq("id", recording.id);

        if (updateError) {
          console.error("❌ Error updating call_recordings:", updateError);
        } else {
          console.log(`✅ Updated call_recordings: ${recording.id}`);
        }
      }

      // 2. Update manual_call_logs if we have the reference
      if (recording.manual_call_id) {
        const callLogUpdate: Record<string, any> = {
          status: dbStatus,
        };

        if (isTerminal) {
          callLogUpdate.ended_at = new Date().toISOString();
          callLogUpdate.duration_seconds = parseInt(duration, 10);
          
          // Map to outcome
          if (dbStatus === "completed") {
            callLogUpdate.outcome = "connected";
          } else if (dbStatus === "no_answer") {
            callLogUpdate.outcome = "no_answer";
          } else if (dbStatus === "busy") {
            callLogUpdate.outcome = "busy";
          } else if (dbStatus === "failed") {
            callLogUpdate.outcome = "failed";
            callLogUpdate.notes = errorMessage || `Error code: ${errorCode}`;
          } else if (dbStatus === "canceled") {
            callLogUpdate.outcome = "canceled";
          }
        }

        const { error: logUpdateError } = await supabase
          .from("manual_call_logs")
          .update(callLogUpdate)
          .eq("id", recording.manual_call_id);

        if (logUpdateError) {
          console.error("❌ Error updating manual_call_logs:", logUpdateError);
        } else {
          console.log(`✅ Updated manual_call_logs: ${recording.manual_call_id} → ${dbStatus}`);
        }

        // 2b. If this was an ElevenLabs-powered AI call, fetch/store transcript after the call ends.
        if (
          isTerminal &&
          ELEVENLABS_API_KEY &&
          recording.elevenlabs_conversation_id &&
          dbStatus === "completed"
        ) {
          const conversationId = recording.elevenlabs_conversation_id;
          const manualCallId = recording.manual_call_id;
          const recordingId = recording.id;

          waitUntil((async () => {
            try {
              // Skip if we already saved a transcript
              const { data: existingLog, error: existingLogError } = await supabase
                .from("manual_call_logs")
                .select("metadata")
                .eq("id", manualCallId)
                .maybeSingle();

              if (existingLogError) {
                console.error("❌ Error reading manual_call_logs.metadata:", existingLogError);
                return;
              }

              const existingMeta = (existingLog?.metadata ?? {}) as Record<string, unknown>;
              const existingEleven = (existingMeta["elevenlabs"] ?? {}) as Record<string, unknown>;
              if (typeof existingEleven["transcript_text"] === "string" && (existingEleven["transcript_text"] as string).trim().length > 0) {
                return;
              }

              const convoRes = await fetch(
                `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
                {
                  method: "GET",
                  headers: {
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                  },
                },
              );

              if (!convoRes.ok) {
                const errText = await convoRes.text();
                console.error(`❌ ElevenLabs conversation fetch failed (${convoRes.status}):`, errText);
                return;
              }

              const convoJson = await convoRes.json();

              const transcriptText = (() => {
                const lines: string[] = [];

                const pushLine = (role: string, text: string) => {
                  const clean = (text ?? "").toString().trim();
                  if (!clean) return;
                  lines.push(`${role}: ${clean}`);
                };

                // Try common shapes
                if (typeof convoJson?.transcript === "string") {
                  return convoJson.transcript;
                }

                const items =
                  convoJson?.messages ??
                  convoJson?.turns ??
                  convoJson?.transcript ??
                  convoJson?.conversation?.messages ??
                  convoJson?.conversation?.turns ??
                  null;

                if (Array.isArray(items)) {
                  for (const it of items) {
                    const role = (it?.role ?? it?.speaker ?? it?.type ?? "unknown").toString();
                    const text = (it?.text ?? it?.message ?? it?.content ?? it?.utterance ?? "").toString();
                    pushLine(role, text);
                  }
                  if (lines.length > 0) return lines.join("\n\n");
                }

                // Fallback: stringify
                return JSON.stringify(convoJson, null, 2);
              })();

              const newMetadata = {
                ...existingMeta,
                elevenlabs: {
                  ...existingEleven,
                  conversation_id: conversationId,
                  transcript_text: transcriptText,
                  fetched_at: new Date().toISOString(),
                },
              };

              const { error: metaUpdateError } = await supabase
                .from("manual_call_logs")
                .update({ metadata: newMetadata })
                .eq("id", manualCallId);

              if (metaUpdateError) {
                console.error("❌ Error saving transcript to manual_call_logs.metadata:", metaUpdateError);
                return;
              }

              const { error: recordingTranscriptFlagError } = await supabase
                .from("call_recordings")
                .update({ has_transcript: true })
                .eq("id", recordingId);

              if (recordingTranscriptFlagError) {
                console.error("❌ Error updating call_recordings.has_transcript:", recordingTranscriptFlagError);
              }

              console.log(`🧾 Saved ElevenLabs transcript for manual_call_id=${manualCallId}`);
            } catch (e: unknown) {
              console.error("❌ Transcript logging error:", e);
            }
          })());
        }

      }
    } else {
      // No existing record found - this might be an outbound call or delayed webhook
      console.log(`⚠️ No recording found for CallSid: ${effectiveSid}`);
      
      // Try to find by parent call sid or create a new orphan record
      if (parentCallSid) {
        const { data: parentRecording } = await supabase
          .from("call_recordings")
          .select("id, manual_call_id")
          .eq("provider_call_sid", callSid)
          .single();

        if (parentRecording) {
          console.log(`✅ Found recording via CallSid: ${parentRecording.id}`);
          // Update found record
          if (Object.keys(recordingUpdate).length > 0) {
            await supabase
              .from("call_recordings")
              .update(recordingUpdate)
              .eq("id", parentRecording.id);
          }
        }
      }
    }

    // 3. Log to communication audit (for timeline visibility)
    const auditPayload = {
      call_sid: callSid,
      parent_call_sid: parentCallSid,
      status: callStatus,
      db_status: dbStatus,
      from,
      to,
      direction,
      duration: parseInt(duration, 10),
      recording_url: recordingUrl,
      error_code: errorCode,
      error_message: errorMessage,
      timestamp,
    };

    // Write to a general audit/activity log if needed
    // For now we'll just log it
    console.log(`📝 Audit: ${JSON.stringify(auditPayload)}`);

    // Return success to Twilio (must respond quickly)
    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("❌ Error in call status handler:", error);
    
    // Still return 200 to prevent Twilio retries
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
