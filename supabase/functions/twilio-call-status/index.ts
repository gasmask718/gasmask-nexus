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

    const callSid = formData.get("CallSid")?.toString().trim() || "";
    const parentCallSid = formData.get("ParentCallSid")?.toString().trim() || null;
    const callStatus = formData.get("CallStatus")?.toString() || "";
    const duration = formData.get("CallDuration")?.toString() || "0";
    const recordingUrl = formData.get("RecordingUrl")?.toString() || null;
    const recordingDuration = formData.get("RecordingDuration")?.toString() || null;

    if (!callSid) {
      return new Response(JSON.stringify({ error: "Missing CallSid" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    const dbStatus = STATUS_MAP[callStatus] || callStatus;
    const isTerminal = ["completed", "busy", "no_answer", "failed", "canceled"].includes(dbStatus);
    const effectiveSid = parentCallSid || callSid;

    console.log(`📞 twilio-call-status | sid=${callSid} parent=${parentCallSid} effective=${effectiveSid} status=${callStatus} → ${dbStatus}`);

    // 1. Gather all required DB updates
    const tasks: Promise<any>[] = [];

    // Queue status update
    if (dbStatus === "in_progress" || isTerminal) {
      const statusLabel = dbStatus === "in_progress" ? "connected" : dbStatus === "canceled" ? "failed" : dbStatus;
      tasks.push(
        supabase
          .from("outbound_call_queue")
          .update({ status: statusLabel, updated_at: new Date().toISOString() })
          .eq("twilio_call_sid", effectiveSid),
      );
    }

    // Initial Script Log
    if (dbStatus === "in_progress" && initialScript) {
      tasks.push(
        supabase
          .from("live_call_transcripts")
          .insert({
            call_sid: effectiveSid,
            speaker: "ai",
            text: initialScript,
            is_final: true,
          })
          .then(({ error }) => {
            if (error && error.code !== "23505") console.error("Initial script error:", error);
          }),
      );
    }

    // Recording Updates
    if (recordingUrl || isTerminal) {
      const updateData: any = {};
      if (recordingUrl) updateData.recording_url = recordingUrl;
      if (recordingDuration) updateData.recording_duration = parseInt(recordingDuration, 10);
      if (isTerminal) {
        updateData.completed_at = new Date().toISOString();
        updateData.status = dbStatus;
      }

      tasks.push(supabase.from("call_recordings").update(updateData).eq("provider_call_sid", effectiveSid));
    }

    // 2. Execute primary updates
    await Promise.allSettled(tasks);

    // 3. Fetch ElevenLabs transcripts synchronously on terminal completed calls
    if (isTerminal && ELEVENLABS_API_KEY && dbStatus === "completed") {
      try {
        // Look up conversation_id from call_recordings
        const { data: rec } = await supabase
          .from("call_recordings")
          .select("elevenlabs_conversation_id")
          .eq("provider_call_sid", effectiveSid)
          .single();

        if (rec?.elevenlabs_conversation_id) {
          console.log(`🔍 Fetching ElevenLabs transcript for conversation ${rec.elevenlabs_conversation_id}`);

          // Retry up to 3 times with delay — ElevenLabs may not have transcript ready immediately
          let transcriptData = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            const res = await fetch(
              `https://api.elevenlabs.io/v1/convai/conversations/${rec.elevenlabs_conversation_id}`,
              { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
            );

            if (res.ok) {
              transcriptData = await res.json();
              const messages = transcriptData?.messages || transcriptData?.transcript || [];
              if (messages.length > 0) {
                console.log(`✅ Got ${messages.length} transcript messages on attempt ${attempt + 1}`);
                break;
              }
            }

            // Wait before retrying (1s, 2s, 3s)
            if (attempt < 2) {
              console.log(`⏳ No transcript yet, retrying in ${(attempt + 1)}s...`);
              await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
            }
          }

          if (transcriptData) {
            const messages = transcriptData?.messages || transcriptData?.transcript || [];
            const analysis = transcriptData?.analysis || {};

            if (messages.length > 0) {
              // Batch insert all transcripts
              const rows = messages.map((m: any) => ({
                call_sid: effectiveSid,
                speaker: m.role === "agent" ? "ai" : "caller",
                text: m.text || m.message || "",
                is_final: true,
                created_at: new Date().toISOString(),
              }));
              const { error: insertErr } = await supabase.from("live_call_transcripts").insert(rows);
              if (insertErr) console.error("Transcript insert error:", insertErr);
              else console.log(`✅ Inserted ${rows.length} transcript rows for ${effectiveSid}`);

              // Build full transcript text
              const fullTranscript = messages
                .map((m: any) => `${m.role === "agent" ? "AI" : "Caller"}: ${m.text || m.message || ""}`)
                .join("\n");

              // Detect outcome
              const outcomeRaw = analysis?.call_successful === true ? "reached"
                : analysis?.call_successful === false ? "no_answer"
                : "reached";

              // Look up queue item for context
              const { data: queueItem } = await supabase
                .from("outbound_call_queue")
                .select("business_id, contact_phone, campaign_id")
                .eq("twilio_call_sid", effectiveSid)
                .maybeSingle();

              // Insert ai_call_logs for analytics
              const { error: logErr } = await supabase.from("ai_call_logs").insert({
                business_id: queueItem?.business_id || null,
                phone_number: queueItem?.contact_phone || null,
                duration_seconds: parseInt(duration, 10) || 0,
                transcription: fullTranscript,
                full_transcript: fullTranscript,
                outcome: outcomeRaw,
                ai_summary: analysis?.summary || null,
                language: transcriptData?.metadata?.language || "en",
              });
              if (logErr) console.error("ai_call_logs insert error:", logErr);
              else console.log(`✅ ai_call_logs created for ${effectiveSid}`);

              // Update call_recordings — only columns that exist on the table.
              await supabase
                .from("call_recordings")
                .update({ has_transcript: true })
                .eq("provider_call_sid", effectiveSid);

              // Sync outcome to dc_leads
              if (queueItem?.contact_phone) {
                const leadStatus = outcomeRaw === "reached" ? "called"
                  : ["booked", "interested", "not-interested", "callback"].includes(outcomeRaw) ? outcomeRaw
                  : "called";
                await supabase
                  .from("dc_leads")
                  .update({
                    status: leadStatus,
                    outcome: outcomeRaw,
                    last_called_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("phone", queueItem.contact_phone);
              }
            } else {
              console.warn(`⚠️ No transcript messages found for conversation ${rec.elevenlabs_conversation_id}`);
            }
          }
        } else {
          console.log(`ℹ️ No elevenlabs_conversation_id for ${effectiveSid} — skipping transcript fetch`);
        }
      } catch (e) {
        console.error("Transcript fetch error:", e);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error("Global Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
};

serve(handler);
