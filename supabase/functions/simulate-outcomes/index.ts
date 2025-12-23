import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, triggeringContext, constraints } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch conversation memory (v1)
    const { data: memory, error: memoryError } = await supabase
      .from("conversation_memories")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (memoryError || !memory) {
      console.error("Memory fetch error:", memoryError);
      return new Response(
        JSON.stringify({ error: "Conversation memory not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch memory events (v1)
    const { data: events } = await supabase
      .from("memory_events")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch intent graph (v2)
    const { data: intentGraph } = await supabase
      .from("intent_graphs")
      .select("*")
      .eq("conversation_id", conversationId)
      .single();

    // Fetch intent nodes (v2)
    const { data: intentNodes } = await supabase
      .from("intent_nodes")
      .select("*")
      .eq("intent_graph_id", intentGraph?.id)
      .eq("status", "active");

    // Build context for AI
    const context = {
      memory: {
        status: memory.status,
        sentiment_trend: memory.sentiment_trend,
        summary: memory.memory_summary_current,
        risk_flags: memory.risk_flags,
        preferences: memory.preferences,
        unresolved_items: memory.unresolved_items,
      },
      recentEvents: events?.slice(0, 10).map(e => ({
        channel: e.channel,
        actor: e.actor,
        direction: e.direction,
        content: e.content?.substring(0, 200),
        sentiment: e.sentiment_score,
        timestamp: e.created_at,
      })),
      intents: intentNodes?.map(n => ({
        type: n.intent_type,
        strength: n.intent_strength,
        direction: n.intent_direction,
        urgency: n.urgency_score,
        blockers: n.blockers,
      })),
      intentVelocity: intentGraph?.intent_velocity_score,
      riskIndex: intentGraph?.risk_index,
      opportunityIndex: intentGraph?.opportunity_index,
      constraints: constraints || {},
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an Outcome Simulation Engine for a conversation intelligence system.
Your role is to simulate multiple possible future conversation paths and predict their outcomes.

RULES:
1. Generate 3-5 distinct, plausible scenarios
2. Each scenario must have traceable evidence from the conversation history
3. Never suggest manipulative or coercive tactics
4. Flag high-risk scenarios but never recommend them
5. Consider emotional impact and trust preservation
6. Be specific about predicted responses and outcomes

For each scenario, analyze:
- What action to take (call, text, email, silence, escalation)
- What tone to use (friendly, firm, reassuring, direct, de-escalating)
- How the contact will likely respond
- How their intent will shift
- Risk vs opportunity tradeoffs
- Time to resolution

Output MUST be valid JSON with this structure:
{
  "scenarios": [
    {
      "name": "string - descriptive name",
      "rank": number,
      "action_type": "call|text|email|silence|escalation",
      "tone": "friendly|firm|reassuring|direct|de-escalating",
      "predicted_response": "string",
      "intent_shift": { "type": "string", "direction": "strengthen|weaken|resolve" },
      "sentiment_shift": "positive|neutral|negative",
      "outcomes": ["string array of likely outcomes"],
      "risk_score": 0-100,
      "opportunity_score": 0-100,
      "trust_impact": -100 to 100,
      "time_to_resolution": "string estimate",
      "confidence": 0-100,
      "evidence": ["references to events/intents"],
      "reasoning": "why this scenario is viable",
      "warnings": ["potential risks"],
      "signals_to_watch": ["what to monitor after execution"]
    }
  ],
  "recommended_index": number (0-based index of best scenario),
  "recommendation_reasoning": "string explaining why",
  "overall_confidence": 0-100
}`;

    const userPrompt = `Analyze this conversation and generate outcome simulations:

CONVERSATION CONTEXT:
${JSON.stringify(context, null, 2)}

${constraints ? `CONSTRAINTS: ${JSON.stringify(constraints)}` : ''}

Generate 3-5 realistic scenarios for the next interaction, ranked by desirability.
Consider the current intents, sentiment trends, and unresolved items.
Prioritize trust preservation and de-escalation where appropriate.`;

    console.log("Calling Lovable AI for outcome simulation...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response
    let simulationResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        simulationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create outcome simulation record
    const { data: simulation, error: simError } = await supabase
      .from("outcome_simulations")
      .insert({
        conversation_id: conversationId,
        triggering_context: triggeringContext || { type: "manual" },
        triggering_type: triggeringContext?.type || "manual",
        confidence_index: simulationResult.overall_confidence || 0,
      })
      .select()
      .single();

    if (simError) {
      console.error("Simulation insert error:", simError);
      throw simError;
    }

    // Create scenario records
    const scenariosToInsert = simulationResult.scenarios.map((s: any, idx: number) => ({
      simulation_id: simulation.id,
      scenario_name: s.name,
      scenario_rank: s.rank || idx + 1,
      initiating_action_type: s.action_type,
      tone_profile: s.tone,
      predicted_contact_response: s.predicted_response,
      predicted_intent_shift: s.intent_shift || {},
      predicted_sentiment_shift: s.sentiment_shift,
      predicted_outcomes: s.outcomes || [],
      risk_score: s.risk_score || 0,
      opportunity_score: s.opportunity_score || 0,
      trust_impact_score: s.trust_impact || 0,
      time_to_resolution_estimate: s.time_to_resolution,
      confidence_level: s.confidence || 0,
      supporting_evidence: s.evidence || [],
      is_recommended: idx === simulationResult.recommended_index,
      recommendation_reasoning: idx === simulationResult.recommended_index 
        ? simulationResult.recommendation_reasoning 
        : s.reasoning,
      warnings: s.warnings || [],
      signals_to_watch: s.signals_to_watch || [],
    }));

    const { data: scenarios, error: scenariosError } = await supabase
      .from("simulation_scenarios")
      .insert(scenariosToInsert)
      .select();

    if (scenariosError) {
      console.error("Scenarios insert error:", scenariosError);
      throw scenariosError;
    }

    // Update simulation with recommended scenario ID
    const recommendedScenario = scenarios?.find(s => s.is_recommended);
    if (recommendedScenario) {
      await supabase
        .from("outcome_simulations")
        .update({ recommended_scenario_id: recommendedScenario.id })
        .eq("id", simulation.id);
    }

    console.log(`Created simulation ${simulation.id} with ${scenarios?.length} scenarios`);

    return new Response(
      JSON.stringify({
        success: true,
        simulation_id: simulation.id,
        scenarios_count: scenarios?.length || 0,
        recommended_scenario: recommendedScenario?.scenario_name,
        confidence: simulationResult.overall_confidence,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Outcome simulation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
