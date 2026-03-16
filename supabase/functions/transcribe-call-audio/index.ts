import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractTranscript(content: unknown): string {
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text || "");
        }
        return "";
      })
      .join(" ")
      .trim();
  }

  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Database service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const audioBase64 = typeof body.audio_base64 === "string" ? body.audio_base64 : "";
    const queueItemId = typeof body.queue_item_id === "string" ? body.queue_item_id : "";
    const mimeType = typeof body.mime_type === "string" ? body.mime_type : "audio/webm";

    let effectiveCallSid = typeof body.call_sid === "string" ? body.call_sid.trim() : "";

    if ((!effectiveCallSid || effectiveCallSid.startsWith("browser-")) && queueItemId) {
      const { data: queueItem } = await supabase
        .from("outbound_call_queue")
        .select("twilio_call_sid")
        .eq("id", queueItemId)
        .maybeSingle();

      effectiveCallSid = queueItem?.twilio_call_sid?.trim() || "";
    }

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "Missing audio_base64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!effectiveCallSid) {
      return new Response(JSON.stringify({ text: "", skipped: true, reason: "call_sid_unavailable" }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: mimeType.includes("webm") ? "webm" : "wav",
                },
              },
              {
                type: "text",
                text: "Transcribe only what the remote caller says. Output only spoken words. If no speech, return exactly [silence].",
              },
            ],
          },
        ],
        temperature: 0,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI transcription failed:", errText);
      return new Response(JSON.stringify({ error: "Transcription failed", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const transcript = extractTranscript(aiData?.choices?.[0]?.message?.content);

    if (!transcript || transcript === "[silence]" || transcript.length < 2) {
      return new Response(JSON.stringify({ text: "", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase.from("live_call_transcripts").insert({
      call_sid: effectiveCallSid,
      speaker: "caller",
      text: transcript,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Failed to store transcript:", insertError);
      return new Response(JSON.stringify({ error: "Failed to store transcript" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: transcript, stored: true, call_sid: effectiveCallSid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("transcribe-call-audio error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
