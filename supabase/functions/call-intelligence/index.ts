import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AnalysisResult {
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  sentiment_score: number;
  tags: string[];
  objections: string[];
  promises: string[];
  next_steps: string[];
}

interface QualityResult {
  overall_score: number;
  greeting_score: number;
  clarity_score: number;
  empathy_score: number;
  compliance_score: number;
  offer_delivery_score: number;
  closing_score: number;
  strengths: string[];
  issues: string[];
  coaching_tips: string[];
}

async function analyzeTranscript(transcript: string): Promise<AnalysisResult> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const systemPrompt = `You are a Call Transcript Analyzer for B2B grabba/tobacco wholesale calls. 
Analyze the transcript and extract:
- One-paragraph summary (max 100 words)
- Overall sentiment (positive, neutral, negative, mixed)
- Sentiment score (-100 to 100)
- Key objections raised by the customer
- Any explicit promises made (discounts, delivery time, replacements)
- Recommended next steps
- Tags from: ['restock', 'new_store', 'complaint', 'delivery_issue', 'price_sensitive', 'high_value', 'churn_risk', 'upsell_opportunity', 'policy_violation']

IMPORTANT: If you detect any cross-vertical promotion (e.g., non-tobacco products to smoke shops), add 'policy_violation' to tags.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this call transcript:\n\n${transcript}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_call",
            description: "Return structured call analysis",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "One paragraph summary" },
                sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
                sentiment_score: { type: "number", description: "-100 to 100" },
                tags: { type: "array", items: { type: "string" } },
                objections: { type: "array", items: { type: "string" } },
                promises: { type: "array", items: { type: "string" } },
                next_steps: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "sentiment", "sentiment_score", "tags", "objections", "promises", "next_steps"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "analyze_call" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    throw new Error("No tool call response from AI");
  }

  return JSON.parse(toolCall.function.arguments);
}

async function scoreCallQuality(transcript: string, isAI: boolean): Promise<QualityResult> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const agentType = isAI ? "AI agent" : "human agent";
  const systemPrompt = `You are a QA coach for sales and customer service calls in the grabba/tobacco industry.
Evaluate the ${agentType} on a 0-100 scale in these categories:
- Greeting / Introduction
- Clarity & Communication
- Empathy / Tone
- Compliance with rules (no off-brand promotion, correct disclaimers, no promises outside allowed scope)
- Offer / Pitch effectiveness
- Closing (clear next steps, polite ending)

Return overall score (0-100), scores per category, 3-5 strengths, 3-5 issues, and 3-5 coaching tips.

IMPORTANT: If cross-vertical promotion is detected, lower compliance_score significantly.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Score this call transcript:\n\n${transcript}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "score_call",
            description: "Return structured call quality scores",
            parameters: {
              type: "object",
              properties: {
                overall_score: { type: "number", description: "0-100" },
                greeting_score: { type: "number", description: "0-100" },
                clarity_score: { type: "number", description: "0-100" },
                empathy_score: { type: "number", description: "0-100" },
                compliance_score: { type: "number", description: "0-100" },
                offer_delivery_score: { type: "number", description: "0-100" },
                closing_score: { type: "number", description: "0-100" },
                strengths: { type: "array", items: { type: "string" } },
                issues: { type: "array", items: { type: "string" } },
                coaching_tips: { type: "array", items: { type: "string" } },
              },
              required: ["overall_score", "greeting_score", "clarity_score", "empathy_score", "compliance_score", "offer_delivery_score", "closing_score", "strengths", "issues", "coaching_tips"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "score_call" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    throw new Error("No tool call response from AI");
  }

  return JSON.parse(toolCall.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, recording_id, transcript, is_ai } = await req.json();

    if (action === "analyze") {
      // Analyze transcript and generate analytics + quality scores
      if (!transcript) {
        throw new Error("Transcript is required for analysis");
      }

      console.log("Analyzing transcript, length:", transcript.length);

      // Get analysis
      const analysis = await analyzeTranscript(transcript);
      console.log("Analysis complete:", analysis.sentiment);

      // Get quality scores
      const quality = await scoreCallQuality(transcript, is_ai ?? false);
      console.log("Quality scoring complete:", quality.overall_score);

      // If recording_id provided, save to database
      if (recording_id) {
        // Get recording details
        const { data: recording } = await supabase
          .from("call_recordings")
          .select("*")
          .eq("id", recording_id)
          .single();

        if (recording) {
          // Insert analytics
          const { data: analyticsData, error: analyticsError } = await supabase
            .from("call_analytics")
            .insert({
              recording_id,
              session_id: recording.session_id,
              manual_call_id: recording.manual_call_id,
              business_id: recording.business_id,
              store_id: recording.store_id,
              vertical_id: recording.vertical_id,
              transcript,
              summary: analysis.summary,
              sentiment: analysis.sentiment,
              sentiment_score: analysis.sentiment_score,
              tags: analysis.tags,
              objections: analysis.objections,
              promises: analysis.promises,
              next_steps: analysis.next_steps,
              duration_seconds: recording.recording_duration,
            })
            .select()
            .single();

          if (analyticsError) {
            console.error("Error saving analytics:", analyticsError);
          }

          // Insert quality scores
          const { error: qualityError } = await supabase
            .from("call_quality_scores")
            .insert({
              recording_id,
              analytics_id: analyticsData?.id,
              session_id: recording.session_id,
              manual_call_id: recording.manual_call_id,
              business_id: recording.business_id,
              store_id: recording.store_id,
              vertical_id: recording.vertical_id,
              ...quality,
              is_ai: is_ai ?? false,
            });

          if (qualityError) {
            console.error("Error saving quality scores:", qualityError);
          }

          // Update recording to mark transcript as processed
          await supabase
            .from("call_recordings")
            .update({ has_transcript: true })
            .eq("id", recording_id);
        }
      }

      return new Response(
        JSON.stringify({ success: true, analysis, quality }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "process_pending") {
      // Process all recordings without transcripts
      const { data: pendingRecordings } = await supabase
        .from("call_recordings")
        .select("*")
        .eq("has_transcript", false)
        .not("recording_url", "is", null)
        .limit(10);

      const results = [];
      for (const recording of pendingRecordings || []) {
        // In a real implementation, you would:
        // 1. Download the audio from recording_url
        // 2. Send to a speech-to-text service
        // 3. Get transcript back
        // For now, we'll just mark them as needing manual transcript input
        results.push({
          id: recording.id,
          status: "pending_transcription",
          message: "Recording needs speech-to-text processing",
        });
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Call intelligence error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});