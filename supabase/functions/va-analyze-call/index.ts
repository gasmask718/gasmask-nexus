import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { callLogId, transcript } = await req.json();

    if (!callLogId) {
      return new Response(
        JSON.stringify({ error: "callLogId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // If no transcript provided, try to get recording URL and transcribe
    let transcriptText = transcript || "";

    if (!transcriptText) {
      const { data: callLog } = await supabaseAdmin
        .from("va_call_logs")
        .select("recording_url, transcript")
        .eq("id", callLogId)
        .single();

      transcriptText = callLog?.transcript || "No transcript available.";
    }

    // Use Lovable AI for analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let analysis = null;

    if (LOVABLE_API_KEY && transcriptText && transcriptText !== "No transcript available.") {
      const aiResponse = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a sales call analyst. Analyze the transcript and return JSON with: objections_raised (array), va_response_quality (string: excellent/good/needs_improvement), missed_opportunities (array), recommendations (array), overall_score (number 1-10).",
            },
            {
              role: "user",
              content: `Analyze this sales call transcript:\n\n${transcriptText}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        try {
          analysis = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
        } catch {
          analysis = { raw: aiData.choices?.[0]?.message?.content };
        }
      }
    }

    // Save analysis to call log
    await supabaseAdmin
      .from("va_call_logs")
      .update({
        ai_analysis: analysis || { status: "no_transcript_available" },
        transcript: transcriptText,
      })
      .eq("id", callLogId);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
