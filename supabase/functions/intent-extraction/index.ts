import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IntentExtractionRequest {
  conversation_id: string;
  force_reanalyze?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { conversation_id, force_reanalyze } = await req.json() as IntentExtractionRequest;

    // Fetch conversation memory and events
    const { data: memory, error: memoryError } = await supabase
      .from("conversation_memories")
      .select("*")
      .eq("id", conversation_id)
      .single();

    if (memoryError || !memory) {
      throw new Error("Conversation memory not found");
    }

    const { data: events, error: eventsError } = await supabase
      .from("memory_events")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true });

    if (eventsError) {
      throw new Error("Failed to fetch memory events");
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: "No events to analyze" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create intent graph
    let { data: intentGraph, error: graphError } = await supabase
      .from("intent_graphs")
      .select("*")
      .eq("conversation_id", conversation_id)
      .single();

    if (!intentGraph) {
      const { data: newGraph, error: createError } = await supabase
        .from("intent_graphs")
        .insert({ conversation_id })
        .select()
        .single();

      if (createError) throw createError;
      intentGraph = newGraph;
    }

    // Prepare conversation context for AI
    const conversationContext = events.map((e: any) => ({
      channel: e.channel,
      direction: e.direction,
      actor: e.actor,
      content: e.raw_content || e.ai_extracted_summary,
      sentiment: e.sentiment_score,
      timestamp: e.created_at,
    }));

    // Call Lovable AI for intent extraction
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
            content: `You are an expert intent analyzer for business conversations. Analyze the conversation and extract all intents.

Intent types to detect:
- Purchase: Interest in buying products/services
- Support: Need for help or assistance
- Complaint: Dissatisfaction or issues
- Negotiation: Pricing/terms discussion
- Partnership: Business collaboration interest
- Curiosity: Information seeking
- Churn_Risk: Signs of leaving/canceling
- Legal: Legal matters or concerns
- Payment: Payment-related discussions
- Trust_Building: Relationship building
- Reorder: Repeat purchase intent
- Upsell_Opportunity: Potential for additional sales
- Referral: Willingness to refer others
- Feedback: Providing feedback

For each intent, assess:
- strength (0-100): How strong is this intent?
- direction (positive/neutral/negative): Overall sentiment toward this intent
- emotional_charge: calm, frustrated, excited, anxious, satisfied, angry, hopeful
- blockers: What obstacles exist?
- urgency_score (0-100): How urgent is this?
- likelihood_to_convert (0.0-1.0): Probability of successful outcome

Also provide:
- risk_index (0.0-1.0): Overall risk level
- opportunity_index (0.0-1.0): Overall opportunity level
- predictions: Likely next actions
- suggestions: Recommended responses`
          },
          {
            role: "user",
            content: `Analyze this conversation:\n${JSON.stringify(conversationContext, null, 2)}\n\nCurrent summary: ${memory.memory_summary_current || 'None'}\nSentiment trend: ${memory.sentiment_trend}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_intents",
              description: "Extract all detected intents from the conversation",
              parameters: {
                type: "object",
                properties: {
                  intents: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        intent_type: { type: "string" },
                        intent_strength: { type: "integer", minimum: 0, maximum: 100 },
                        intent_direction: { type: "string", enum: ["positive", "neutral", "negative"] },
                        emotional_charge: { type: "string" },
                        blockers: { type: "array", items: { type: "string" } },
                        urgency_score: { type: "integer", minimum: 0, maximum: 100 },
                        likelihood_to_convert: { type: "number", minimum: 0, maximum: 1 },
                        ai_reasoning: { type: "string" }
                      },
                      required: ["intent_type", "intent_strength", "intent_direction", "ai_reasoning"]
                    }
                  },
                  risk_index: { type: "number", minimum: 0, maximum: 1 },
                  opportunity_index: { type: "number", minimum: 0, maximum: 1 },
                  predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        prediction_type: { type: "string" },
                        confidence: { type: "number" },
                        reasoning: { type: "string" },
                        time_horizon: { type: "string" }
                      }
                    }
                  },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string" },
                        reasoning: { type: "string" },
                        confidence: { type: "number" },
                        related_intent_types: { type: "array", items: { type: "string" } }
                      }
                    }
                  }
                },
                required: ["intents", "risk_index", "opportunity_index"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_intents" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No intent extraction result from AI");
    }

    const extraction = JSON.parse(toolCall.function.arguments);

    // Process extracted intents
    const activeIntentIds: string[] = [];
    
    for (const intent of extraction.intents) {
      // Check if similar intent already exists
      const { data: existingIntent } = await supabase
        .from("intent_nodes")
        .select("*")
        .eq("intent_graph_id", intentGraph.id)
        .eq("intent_type", intent.intent_type)
        .eq("status", "active")
        .single();

      if (existingIntent && !existingIntent.is_locked) {
        // Update existing intent
        const { data: updated } = await supabase
          .from("intent_nodes")
          .update({
            intent_strength: intent.intent_strength,
            intent_direction: intent.intent_direction,
            emotional_charge: intent.emotional_charge || "neutral",
            blockers: intent.blockers || [],
            urgency_score: intent.urgency_score || 50,
            likelihood_to_convert: intent.likelihood_to_convert || 0.5,
            ai_reasoning: intent.ai_reasoning,
            supporting_event_ids: events.map((e: any) => e.id),
          })
          .eq("id", existingIntent.id)
          .select()
          .single();

        if (updated) activeIntentIds.push(updated.id);
      } else if (!existingIntent) {
        // Create new intent
        const { data: newIntent } = await supabase
          .from("intent_nodes")
          .insert({
            intent_graph_id: intentGraph.id,
            intent_type: intent.intent_type,
            origin_event_id: events[events.length - 1]?.id,
            supporting_event_ids: events.map((e: any) => e.id),
            intent_strength: intent.intent_strength,
            intent_direction: intent.intent_direction,
            emotional_charge: intent.emotional_charge || "neutral",
            blockers: intent.blockers || [],
            urgency_score: intent.urgency_score || 50,
            likelihood_to_convert: intent.likelihood_to_convert || 0.5,
            ai_reasoning: intent.ai_reasoning,
          })
          .select()
          .single();

        if (newIntent) activeIntentIds.push(newIntent.id);
      }
    }

    // Calculate velocity score based on intent changes
    const intentVelocity = extraction.intents.reduce((acc: number, i: any) => 
      acc + (i.intent_strength * (i.intent_direction === 'positive' ? 1 : i.intent_direction === 'negative' ? -1 : 0)), 0
    ) / Math.max(extraction.intents.length, 1);

    // Update intent graph
    await supabase
      .from("intent_graphs")
      .update({
        active_intents: activeIntentIds,
        intent_velocity_score: intentVelocity,
        confidence_score: 0.8,
        risk_index: extraction.risk_index,
        opportunity_index: extraction.opportunity_index,
        predictions: extraction.predictions || [],
        suggestions: extraction.suggestions || [],
        last_analyzed_at: new Date().toISOString(),
      })
      .eq("id", intentGraph.id);

    return new Response(
      JSON.stringify({
        success: true,
        intent_graph_id: intentGraph.id,
        intents_detected: extraction.intents.length,
        risk_index: extraction.risk_index,
        opportunity_index: extraction.opportunity_index,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Intent extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
