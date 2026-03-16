import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Receives base64 audio chunks from the browser, transcribes via Gemini,
 * and stores the transcript in live_call_transcripts as "caller" speaker.
 */
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

    const { audio_base64, call_sid, mime_type } = await req.json();

    if (!audio_base64 || !call_sid) {
      return new Response(JSON.stringify({ error: "Missing audio_base64 or call_sid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Gemini with audio for transcription
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: audio_base64,
                  format: mime_type === "audio/webm" ? "webm" : "wav",
                },
              },
              {
                type: "text",
                text: "Transcribe this audio exactly as spoken. Return ONLY the spoken words, nothing else. If there is silence or no speech, return exactly: [silence]",
              },
            ],
          },
        ],
        temperature: 0.1,
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
    const transcript = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Skip silence
    if (!transcript || transcript === "[silence]" || transcript.length < 2) {
      return new Response(JSON.stringify({ text: "", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store in live_call_transcripts
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("live_call_transcripts").insert({
      call_sid,
      speaker: "caller",
      text: transcript,
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ text: transcript, stored: true }), {
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
