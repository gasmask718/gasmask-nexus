import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * brandaro-call-analysis
 * 
 * Analyzes call recordings/transcripts using AI to score performance,
 * detect patterns, and feed improvements back into the script engine.
 * 
 * Actions:
 *   - analyze: Full analysis of a call transcript
 *   - clone_patterns: Extract winning patterns from top calls
 *   - score_batch: Batch-score recent calls
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    if (body.dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = body;

    switch (action) {
      case "analyze":
        return await handleAnalyze(supabase, body);
      case "clone_patterns":
        return await handleClonePatterns(supabase, body);
      case "score_batch":
        return await handleScoreBatch(supabase, body);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("brandaro-call-analysis error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── ANALYZE A SINGLE CALL ─────────────────────────────────────────
async function handleAnalyze(supabase: any, body: any) {
  const { call_id, transcript } = body;

  let callTranscript = transcript;
  let callRecord: any = null;

  // If call_id provided, fetch from DB
  if (call_id) {
    const { data } = await supabase
      .from("brandaro_voice_agent_calls")
      .select("*")
      .eq("id", call_id)
      .single();
    callRecord = data;
    callTranscript = callTranscript || data?.call_transcript;
  }

  if (!callTranscript) {
    return new Response(JSON.stringify({ error: "No transcript available" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use AI to analyze the transcript
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  let analysis: any;
  
  if (LOVABLE_API_KEY) {
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
            role: "system",
            content: `You are a sales call analyst. Analyze this call transcript and extract structured data.`
          },
          {
            role: "user",
            content: `Analyze this sales call transcript:\n\n${callTranscript}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_call",
            description: "Return structured call analysis",
            parameters: {
              type: "object",
              properties: {
                confidence_score: { type: "number", description: "0-100, how confident/natural the agent sounded" },
                control_score: { type: "number", description: "0-100, how well the agent controlled the conversation flow" },
                conversion_probability: { type: "number", description: "0-100, likelihood this lead will convert" },
                sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
                objections_detected: { type: "array", items: { type: "string" } },
                stage_reached: { type: "string", enum: ["greeting", "qualification", "problem_awareness", "value_positioning", "demo_offer", "objection_handling", "close"] },
                improvement_suggestions: { type: "array", items: { type: "string" } },
                opening_effectiveness: { type: "number", description: "0-100" },
                closing_effectiveness: { type: "number", description: "0-100" },
                key_moments: { type: "array", items: { type: "string" } },
                tone_assessment: { type: "string" }
              },
              required: ["confidence_score", "control_score", "conversion_probability", "sentiment", "improvement_suggestions"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_call" } },
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        analysis = JSON.parse(toolCall.function.arguments);
      }
    } else {
      const errText = await aiResponse.text();
      console.error("AI analysis failed:", errText);
    }
  }

  // Fallback to heuristic analysis if AI unavailable
  if (!analysis) {
    analysis = heuristicAnalysis(callTranscript);
  }

  // Update call record with scores
  if (call_id) {
    await supabase.from("brandaro_voice_agent_calls").update({
      ai_confidence_score: analysis.confidence_score,
      ai_control_score: analysis.control_score,
      conversion_probability: analysis.conversion_probability,
      improvement_suggestions: analysis.improvement_suggestions || [],
    }).eq("id", call_id);
  }

  return new Response(JSON.stringify({ success: true, analysis }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function heuristicAnalysis(transcript: string) {
  const lower = transcript.toLowerCase();
  const wordCount = transcript.split(/\s+/).length;
  const questionCount = (transcript.match(/\?/g) || []).length;
  
  const hasDemo = /demo|show|send|look at/i.test(lower);
  const hasPositive = /yes|sure|sounds good|interested|great/i.test(lower);
  const hasNegative = /no|not interested|stop|busy|hang up/i.test(lower);
  const hasObjection = /expensive|cost|budget|already have|not now|think about/i.test(lower);
  
  let confidence = 50;
  if (questionCount > 3) confidence += 15;
  if (wordCount < 200) confidence += 10; // concise = good
  if (wordCount > 500) confidence -= 10; // too verbose
  
  let control = 50;
  if (questionCount > 2) control += 20;
  if (hasDemo) control += 15;
  
  let convProb = 30;
  if (hasPositive) convProb += 25;
  if (hasDemo) convProb += 20;
  if (hasNegative) convProb -= 30;
  if (hasObjection) convProb -= 10;

  return {
    confidence_score: Math.max(0, Math.min(100, confidence)),
    control_score: Math.max(0, Math.min(100, control)),
    conversion_probability: Math.max(0, Math.min(100, convProb)),
    sentiment: hasPositive ? "positive" : hasNegative ? "negative" : "neutral",
    improvement_suggestions: [
      wordCount > 400 ? "Keep responses shorter — aim for 1-2 sentences" : null,
      questionCount < 2 ? "Ask more qualifying questions to maintain control" : null,
      !hasDemo ? "Push toward the demo offer earlier in the conversation" : null,
      hasObjection ? "Practice objection handling — use the rebuttals from the script" : null,
    ].filter(Boolean),
    stage_reached: hasDemo ? "demo_offer" : hasPositive ? "value_positioning" : "qualification",
    key_moments: [],
    tone_assessment: "Could not be determined from text analysis",
  };
}

// ─── CLONE PATTERNS FROM TOP CALLS ─────────────────────────────────
async function handleClonePatterns(supabase: any, body: any) {
  const { min_conversion_probability = 70, limit = 10 } = body;

  // Find top performing calls
  const { data: topCalls, error } = await supabase
    .from("brandaro_voice_agent_calls")
    .select("*")
    .gte("conversion_probability", min_conversion_probability)
    .not("call_transcript", "is", null)
    .order("conversion_probability", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const patterns: any[] = [];

  for (const call of (topCalls || [])) {
    // Extract pattern from each winning call
    const pattern = {
      source_call_id: call.id,
      pattern_type: "winning_call",
      opening_style: extractOpening(call.call_transcript || ""),
      objection_responses: extractObjectionResponses(call),
      tone_markers: extractToneMarkers(call.call_transcript || ""),
      conversion_probability: call.conversion_probability,
    };

    const { error: insertErr } = await supabase
      .from("brandaro_call_patterns")
      .insert(pattern);

    if (!insertErr) patterns.push(pattern);
  }

  // Auto-update scripts if we have enough patterns
  if (patterns.length >= 3) {
    console.log(`📊 ${patterns.length} winning patterns extracted — script improvement possible`);
  }

  return new Response(JSON.stringify({ 
    success: true, 
    patterns_extracted: patterns.length,
    top_calls_analyzed: topCalls?.length || 0,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractOpening(transcript: string): string {
  const lines = transcript.split("\n").filter(l => l.trim());
  return lines.slice(0, 3).join(" ").substring(0, 200);
}

function extractObjectionResponses(call: any): Record<string, string> {
  const responses: Record<string, string> = {};
  const handled = call.objections_handled || [];
  for (const obj of handled) {
    responses[obj] = "successfully_handled";
  }
  return responses;
}

function extractToneMarkers(transcript: string): string[] {
  const markers: string[] = [];
  if (/ha|haha|lol/i.test(transcript)) markers.push("humor");
  if (/absolutely|definitely|exactly/i.test(transcript)) markers.push("confident_affirmation");
  if (/I understand|I get that|totally/i.test(transcript)) markers.push("empathy");
  if (/quick question|real quick|just/i.test(transcript)) markers.push("casual_minimizer");
  return markers;
}

// ─── BATCH SCORE RECENT CALLS ──────────────────────────────────────
async function handleScoreBatch(supabase: any, body: any) {
  const { limit = 20 } = body;

  const { data: unscored } = await supabase
    .from("brandaro_voice_agent_calls")
    .select("id, call_transcript")
    .is("ai_confidence_score", null)
    .not("call_transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  let scored = 0;
  for (const call of (unscored || [])) {
    const analysis = heuristicAnalysis(call.call_transcript);
    await supabase.from("brandaro_voice_agent_calls").update({
      ai_confidence_score: analysis.confidence_score,
      ai_control_score: analysis.control_score,
      conversion_probability: analysis.conversion_probability,
      improvement_suggestions: analysis.improvement_suggestions,
    }).eq("id", call.id);
    scored++;
  }

  return new Response(JSON.stringify({ success: true, calls_scored: scored }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
