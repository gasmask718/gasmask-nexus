import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const {
      transcript_chunk,
      voice_metrics,
      current_personality,
      context_memory,
      previous_emotions,
    } = await req.json();

    if (!transcript_chunk) {
      return new Response(JSON.stringify({ error: "transcript_chunk required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are the Emotion Detection Engine for Dynasty OS.

You analyze live sales call transcripts to detect the lead's emotional state with precision.

You detect PRIMARY emotions and MICRO-SIGNALS:

PRIMARY EMOTIONS:
- interested: Asking questions, leaning in
- neutral: No strong signals either way
- skeptical: Questioning claims, doubt
- confused: Asking for clarification, lost
- defensive: Pushback, resistance to pressure
- frustrated: Annoyance, impatience
- curious: Exploring, open-minded
- excited: High energy, enthusiastic
- hesitant: Uncertain, wavering
- disengaged: Short answers, distracted
- ready_to_close: Agreement signals, asking next steps

MICRO-SIGNALS to detect:
- Long pauses → hesitation
- Interruptions → resistance or eagerness
- Short one-word answers → disengagement
- Repeated questions → confusion
- Voice speed increase → excitement or frustration
- "Yeah but..." patterns → skepticism
- "How much..." → price sensitivity or buying signal
- Agreement + silence → processing/hesitant

STRATEGY MAPPING:
- interested → increase momentum, push forward
- skeptical → switch to logical proof, data, ROI
- confused → simplify immediately, use analogies
- frustrated → slow down, acknowledge, empathize
- defensive → reduce pressure, ask questions
- curious → expand, engage deeper
- disengaged → pattern interrupt, re-engage
- hesitant → reduce friction, lower commitment ask
- excited → match energy, close
- ready_to_close → direct close immediately

TONE ADJUSTMENTS:
- frustrated/defensive → slower pace, softer tone, shorter sentences
- excited/interested → match energy, confident tone
- confused → educational tone, step-by-step
- skeptical → structured, evidence-based
- disengaged → energetic pattern interrupt`;

    const userPrompt = `TRANSCRIPT CHUNK:
"${transcript_chunk}"

${voice_metrics ? `VOICE METRICS: ${JSON.stringify(voice_metrics)}` : ""}
CURRENT PERSONALITY: ${current_personality || "not set"}
PREVIOUS EMOTIONS: ${previous_emotions ? JSON.stringify(previous_emotions) : "none"}
CONTEXT: ${context_memory ? JSON.stringify(context_memory) : "none"}

Detect the lead's emotional state and recommend adaptations.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "detect_emotion",
            description: "Detect the lead's emotional state from transcript analysis",
            parameters: {
              type: "object",
              properties: {
                detected_emotion: {
                  type: "string",
                  enum: ["interested", "neutral", "skeptical", "confused", "defensive", "frustrated", "curious", "excited", "hesitant", "disengaged", "ready_to_close"],
                  description: "Primary emotional state detected",
                },
                secondary_emotion: {
                  type: "string",
                  enum: ["interested", "neutral", "skeptical", "confused", "defensive", "frustrated", "curious", "excited", "hesitant", "disengaged", "ready_to_close", "none"],
                  description: "Secondary emotional undercurrent if present",
                },
                confidence_score: {
                  type: "number",
                  description: "Confidence in the detection 0-100",
                },
                micro_signals: {
                  type: "array",
                  items: { type: "string" },
                  description: "Micro-signals detected (e.g. 'long_pause', 'interruption', 'short_answers')",
                },
                recommended_strategy: {
                  type: "string",
                  enum: ["push_forward", "slow_down", "simplify", "empathize", "reduce_pressure", "expand_engage", "pattern_interrupt", "lower_friction", "match_energy", "direct_close"],
                  description: "Recommended strategy adjustment",
                },
                tone_adjustment: {
                  type: "string",
                  enum: ["slower_softer", "match_energy", "educational", "structured_evidence", "energetic_interrupt", "calm_confident", "warm_relatable", "no_change"],
                  description: "Recommended tone shift",
                },
                personality_override: {
                  type: "string",
                  enum: ["energizer", "analyst", "consultant", "commander", "connector", "none"],
                  description: "If current personality doesn't match emotion, suggest override archetype",
                },
                urgency: {
                  type: "string",
                  enum: ["low", "medium", "high", "critical"],
                  description: "How urgently the strategy needs to change",
                },
                empathy_phrase: {
                  type: "string",
                  description: "A short empathy/alignment phrase to use if needed",
                },
              },
              required: ["detected_emotion", "confidence_score", "recommended_strategy", "tone_adjustment", "personality_override", "urgency"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "detect_emotion" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Emotion detection failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No structured response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ ok: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("detect-emotion error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
