import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { callLogId, recordingUrl, vaId } = await req.json();

    if (!callLogId) {
      return new Response(JSON.stringify({ error: "callLogId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let transcript = "";

    // Step 1: Transcription via AssemblyAI (if key available)
    const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");

    if (recordingUrl && ASSEMBLYAI_API_KEY) {
      try {
        // Submit transcription job
        const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
          method: "POST",
          headers: {
            Authorization: ASSEMBLYAI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audio_url: recordingUrl,
            speaker_labels: true,
            speakers_expected: 2,
          }),
        });

        const submitData = await submitRes.json();
        const transcriptId = submitData.id;

        // Poll for completion (max 5 minutes)
        let attempts = 0;
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 5000));
          const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
            headers: { Authorization: ASSEMBLYAI_API_KEY },
          });
          const pollData = await pollRes.json();

          if (pollData.status === "completed") {
            // Build transcript with speaker labels
            if (pollData.utterances) {
              transcript = pollData.utterances
                .map((u: any) => `${u.speaker === "A" ? "VA" : "Customer"}: ${u.text}`)
                .join("\n");
            } else {
              transcript = pollData.text || "";
            }
            break;
          } else if (pollData.status === "error") {
            console.error("AssemblyAI error:", pollData.error);
            break;
          }
          attempts++;
        }
      } catch (e) {
        console.error("Transcription error:", e);
      }
    } else {
      console.log("No AssemblyAI key or recording URL — skipping transcription");
    }

    // Step 2: AI Coaching via Lovable AI
    let aiAnalysis = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (transcript && LOVABLE_API_KEY) {
      try {
        const coachingPrompt = `You are a sales call coach for Brandaro. Analyze this call transcript and return a JSON object with these fields:
- summary: 2-sentence call summary
- objections_raised: array of objections the customer raised
- va_strengths: array of things the VA did well
- va_improvements: array of specific things the VA should do differently
- missed_opportunities: array of moments where a close was possible but missed
- recommended_rebuttals: array of better responses to specific objections
- overall_score: integer 1-10 rating of the VA's performance
- coaching_note: one encouraging sentence for the VA

Return ONLY the JSON object, no markdown or explanation.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: coachingPrompt },
              { role: "user", content: transcript },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          try {
            // Strip markdown code fences if present
            const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            aiAnalysis = JSON.parse(cleaned);
          } catch {
            aiAnalysis = { raw: content, parse_error: true };
          }
        } else {
          console.error("AI gateway error:", aiRes.status, await aiRes.text());
        }
      } catch (e) {
        console.error("AI coaching error:", e);
      }
    }

    // Step 3: Save results
    const updateData: any = {};
    if (transcript) updateData.transcript = transcript;
    if (aiAnalysis) updateData.ai_analysis = aiAnalysis;

    if (Object.keys(updateData).length > 0) {
      await supabaseAdmin.from("va_call_logs").update(updateData).eq("id", callLogId);
    }

    return new Response(JSON.stringify({
      success: true,
      hasTranscript: !!transcript,
      hasAnalysis: !!aiAnalysis,
      analysis: aiAnalysis,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("va-post-call-analysis error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
