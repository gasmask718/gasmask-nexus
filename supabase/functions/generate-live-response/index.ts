import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      transcript_chunk,
      lead_id,
      call_session_id,
      context_memory,
      lead_heat_score,
      stream,
    } = await req.json();

    if (!transcript_chunk) {
      return new Response(JSON.stringify({ error: "transcript_chunk required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch winning offer + patterns for injection
    const [offerRes, patternsRes, responsesRes] = await Promise.all([
      supabase
        .from("brandaro_offer_variants")
        .select("offer_name, headline, pricing, value_props, guarantee, urgency_trigger")
        .eq("status", "winning")
        .order("conversion_rate", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("brandaro_winning_patterns")
        .select("pattern_key, success_rate, pattern_type")
        .order("success_rate", { ascending: false })
        .limit(5),
      supabase
        .from("brandaro_response_library")
        .select("objection_type, response_text, strategy, success_rate")
        .eq("is_active", true)
        .order("success_rate", { ascending: false })
        .limit(10),
    ]);

    const winningOffer = offerRes.data;
    const topPatterns = patternsRes.data || [];
    const topResponses = responsesRes.data || [];

    const systemPrompt = `You are a real-time sales conversation intelligence engine for Dynasty OS.

You analyze LIVE call transcript chunks and generate the BEST next response for the VA/closer.

RULES:
- Be SHORT (1-3 sentences max)
- Be NATURAL and conversational (not robotic)
- NEVER repeat a response from context_memory
- Always move the conversation TOWARD a close
- If buying signals are strong → push for close immediately
- If objection detected → handle with proven strategy
- If uncertain → ask a clarifying question to regain control

WINNING OFFER TO INJECT (when relevant):
${winningOffer ? JSON.stringify(winningOffer) : "No winning offer yet"}

TOP PERFORMING PATTERNS:
${topPatterns.map(p => `${p.pattern_type}: ${p.pattern_key} (${Math.round(p.success_rate)}% success)`).join("\n")}

PROVEN OBJECTION RESPONSES:
${topResponses.map(r => `${r.objection_type}: "${r.response_text}" [${r.strategy}] (${Math.round(r.success_rate)}% success)`).join("\n")}

You MUST return a JSON object with tool calling. Analyze the transcript and return structured data.`;

    const userPrompt = `LIVE TRANSCRIPT CHUNK:
"${transcript_chunk}"

LEAD HEAT SCORE: ${lead_heat_score ?? "unknown"}
CONTEXT MEMORY (what has already been said/handled):
${context_memory ? JSON.stringify(context_memory) : "No prior context"}

Analyze this transcript chunk and provide the optimal next response.`;

    const aiBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "live_call_response",
            description: "Generate real-time response for a live sales call based on transcript analysis",
            parameters: {
              type: "object",
              properties: {
                detected_objection: {
                  type: "string",
                  description: "The objection detected, or null if none",
                  enum: [
                    "too_expensive", "not_interested", "too_busy", "send_info",
                    "already_have_solution", "need_to_ask_partner", "no_budget",
                    "bad_timing", "distrust", "skeptical", "not_decision_maker", "none"
                  ],
                },
                detected_signal: {
                  type: "string",
                  description: "The buying signal detected, or null if none",
                  enum: [
                    "asks_price", "asks_how_it_works", "asks_timeline", "asks_next_step",
                    "asks_demo", "asks_customizable", "asks_results", "gives_callback_time",
                    "confirms_decision_maker", "asks_payment_link", "asks_examples",
                    "agrees", "shows_enthusiasm", "none"
                  ],
                },
                mood: {
                  type: "string",
                  enum: ["positive", "neutral", "resistant", "skeptical", "ready_to_close"],
                },
                response_text: {
                  type: "string",
                  description: "The exact response the VA should say next. Must be short, natural, persuasive.",
                },
                strategy_used: {
                  type: "string",
                  description: "The persuasion strategy applied",
                  enum: [
                    "roi_framing", "value_stacking", "social_proof", "urgency",
                    "pattern_interrupt", "micro_commitment", "lower_friction",
                    "differentiation", "control_next_step", "direct_close",
                    "clarifying_question", "empathy_bridge", "reframe",
                  ],
                },
                confidence_score: {
                  type: "number",
                  description: "How confident this is the right response (0-100)",
                },
                should_close_now: {
                  type: "boolean",
                  description: "Whether the VA should attempt to close the deal right now",
                },
                close_type: {
                  type: "string",
                  description: "If should_close_now, what type of close",
                  enum: ["payment_link", "demo_booking", "commitment", "callback_lock", "none"],
                },
                escalation_needed: {
                  type: "boolean",
                  description: "Whether to escalate to a closer immediately",
                },
                heat_delta: {
                  type: "number",
                  description: "How much to adjust lead heat score (-20 to +30)",
                },
              },
              required: [
                "detected_objection", "detected_signal", "mood",
                "response_text", "strategy_used", "confidence_score",
                "should_close_now", "close_type", "escalation_needed", "heat_delta"
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "live_call_response" } },
    };

    // Non-streaming: get structured response fast
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiBody),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No structured response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Update lead heat if we have a lead_id
    if (lead_id && result.heat_delta && result.heat_delta !== 0) {
      const { data: currentHeat } = await supabase
        .from("brandaro_va_lead_heat")
        .select("heat_score")
        .eq("lead_id", lead_id)
        .maybeSingle();

      if (currentHeat) {
        const newScore = Math.max(0, Math.min(100, (currentHeat.heat_score || 0) + result.heat_delta));
        let status = "cold";
        if (newScore >= 90) status = "closing_now";
        else if (newScore >= 70) status = "hot";
        else if (newScore >= 45) status = "interested";
        else if (newScore >= 20) status = "warming";

        await supabase.from("brandaro_va_lead_heat").update({
          heat_score: newScore,
          status,
          updated_at: new Date().toISOString(),
          ...(result.detected_signal !== "none" ? { last_signal_at: new Date().toISOString() } : {}),
          ...(result.detected_objection !== "none" ? { last_objection_at: new Date().toISOString() } : {}),
        }).eq("lead_id", lead_id);
      }
    }

    // If escalation needed, create alert
    if (result.escalation_needed && call_session_id) {
      await supabase.from("brandaro_va_alerts").insert({
        title: `🔥 ESCALATE NOW — Lead showing strong close signals`,
        severity: "critical",
        alert_type: "hot_lead_detected",
        details: {
          call_session_id,
          lead_id,
          mood: result.mood,
          signal: result.detected_signal,
          heat_delta: result.heat_delta,
        },
      }).then(() => {});
    }

    return new Response(JSON.stringify({ ok: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("generate-live-response error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
