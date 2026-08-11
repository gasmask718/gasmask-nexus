import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readForm, verifyTwilio } from "../_shared/dialer.ts";

serve(async (req) => {
  // Twilio sends POST with form data
  if (req.method === "GET" || req.method === "OPTIONS") {
    return new Response("OK", { status: 200 });
  }

  try {
    // SEC-018: recordings are placed by both the primary and the Brandaro
    // Twilio accounts, so both auth tokens are accepted — but a signature is
    // mandatory. Unsigned POSTs could forge call_recordings rows.
    const params = await readForm(req);
    const v = verifyTwilio(req, params, { extraTokenEnvVars: ['BRANDARO_TWILIO_AUTH_TOKEN'] });
    if (!v.ok) {
      console.error('[twilio-recording-callback] rejected unsigned request:', v.reason);
      return new Response(JSON.stringify({ error: 'invalid_twilio_signature', reason: v.reason }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }
    const formData = { get: (k: string) => params[k] ?? null };
    const recordingUrl = formData.get("RecordingUrl")?.toString() || "";
    const callSid = formData.get("CallSid")?.toString().trim() || "";
    const recordingStatus = formData.get("RecordingStatus")?.toString() || "";
    const recordingSid = formData.get("RecordingSid")?.toString() || "";
    const recordingDuration = parseInt(formData.get("RecordingDuration")?.toString() || "0", 10);

    console.log(`📼 Recording callback: ${recordingSid} status=${recordingStatus} call=${callSid} duration=${recordingDuration}s`);

    if (recordingStatus !== "completed" || !recordingUrl || !callSid) {
      return new Response("OK", { status: 200 });
    }

    // Prefer Brandaro Twilio creds (the same account used by bland-agent-trigger
    // to place the call). Falling back to legacy TWILIO_* preserves older flows.
    const TWILIO_ACCOUNT_SID =
      Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID") ||
      Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN =
      Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN") ||
      Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Upsert recording — now works with proper unique constraint on provider_call_sid
    const { error: upsertErr } = await supabase.from("call_recordings").upsert(
      {
        provider_call_sid: callSid,
        recording_url: recordingUrl,
        recording_duration: recordingDuration,
        provider: "twilio",
        channels: "dual",
        status: "completed",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "provider_call_sid" }
    );

    if (upsertErr) {
      console.error(`❌ Recording upsert failed: ${upsertErr.message}`);
    } else {
      console.log(`✅ Recording saved for ${callSid}`);
    }

    // Mark transferred queue items as completed when recording finishes
    await supabase
      .from("outbound_call_queue")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("twilio_call_sid", callSid)
      .eq("status", "transferred");

    // Fetch and transcribe the recording audio
    if (LOVABLE_API_KEY && recordingDuration > 1 && recordingDuration < 600) {
      try {
        const audioRes = await fetch(`${recordingUrl}.wav`, {
          headers: {
            Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          },
        });

        if (audioRes.ok) {
          const audioBuffer = await audioRes.arrayBuffer();
          const bytes = new Uint8Array(audioBuffer);

          // Only transcribe if under 5MB
          if (bytes.length < 5 * 1024 * 1024) {
            let binary = "";
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
            }
            const audioBase64 = btoa(binary);

            const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{
                  role: "user",
                  content: [
                    { type: "input_audio", input_audio: { data: audioBase64, format: "wav" } },
                    {
                      type: "text",
                      text: "Transcribe this phone call recording. Label speakers as 'Agent' and 'Caller'. Output only spoken words with speaker labels, one line per speaker turn. If silence, return [silence].",
                    },
                  ],
                }],
                temperature: 0,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              let transcript = aiData?.choices?.[0]?.message?.content;
              if (Array.isArray(transcript)) {
                transcript = transcript.map((p: any) => typeof p === "string" ? p : p?.text || "").join(" ");
              }
              if (typeof transcript === "string" && transcript.length > 2 && transcript !== "[silence]") {
                const lines = transcript.split("\n").filter((l: string) => l.trim());
                for (const line of lines) {
                  const isCaller = /^caller/i.test(line.trim());
                  const cleanText = line.replace(/^(agent|caller)\s*[:：]\s*/i, "").trim();
                  if (cleanText) {
                    await supabase.from("live_call_transcripts").insert({
                      call_sid: callSid,
                      speaker: isCaller ? "caller" : "human",
                      text: cleanText,
                      created_at: new Date().toISOString(),
                    });
                  }
                }
                // Mark recording as having a transcript
                await supabase
                  .from("call_recordings")
                  .update({ has_transcript: true })
                  .eq("provider_call_sid", callSid);

                console.log(`✅ Transcribed recording for ${callSid}: ${lines.length} lines`);
              }
            } else {
              console.error(`❌ AI transcription failed: ${aiResponse.status}`);
            }
          }
        } else {
          console.error(`❌ Failed to fetch recording audio: ${audioRes.status}`);
        }
      } catch (transcribeErr) {
        console.error("Transcription error:", transcribeErr instanceof Error ? transcribeErr.message : transcribeErr);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Recording callback error:", err instanceof Error ? err.message : err);
    return new Response("OK", { status: 200 });
  }
});
