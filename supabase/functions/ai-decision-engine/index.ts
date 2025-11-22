import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { decision_type, entity_id, entity_type, context } = await req.json();

    console.log(`AI Decision Engine: ${decision_type} for ${entity_type}`);

    // Fetch relevant context data
    let entityData: any = null;
    if (entity_type === 'lead' && entity_id) {
      const { data } = await supabase
        .from("leads_raw")
        .select("*, ai_comps(*)")
        .eq("id", entity_id)
        .single();
      entityData = data;
    } else if (entity_type === 'deal' && entity_id) {
      const { data } = await supabase
        .from("acquisitions_pipeline")
        .select("*, leads_raw(*, ai_comps(*))")
        .eq("id", entity_id)
        .single();
      entityData = data;
    }

    // Use AI to make decision
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an AI CEO making strategic decisions for a real estate wholesaling business. Make data-driven decisions that maximize profitability.'
          },
          {
            role: 'user',
            content: `Make a ${decision_type} decision:

Entity Type: ${entity_type}
Entity Data: ${JSON.stringify(entityData)}
Additional Context: ${JSON.stringify(context)}

Decision Types:
- negotiate_harder: Should we negotiate more aggressively?
- wholesale_vs_hold: Should we wholesale or hold this property?
- investor_priority: Which investor should get this deal first?
- market_expansion: Should we expand into this market?
- va_assignment: Which VA should handle this task?
- follow_up_timing: When should we follow up?

Provide:
1. Your decision
2. Detailed reasoning
3. Confidence score (0-100)
4. Expected impact
5. Alternative options considered

Format as JSON with keys: decision, reasoning, confidence_score, expected_impact, alternatives`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    let decisionData;
    try {
      decisionData = JSON.parse(content);
    } catch {
      decisionData = {
        decision: "analyze_further",
        reasoning: content,
        confidence_score: 50,
        expected_impact: { type: "analysis_needed" },
        alternatives: []
      };
    }

    // Store the decision
    const { data: storedDecision, error: decisionError } = await supabase
      .from("ceo_decisions")
      .insert([{
        decision_type,
        entity_type,
        entity_id,
        decision: decisionData.decision,
        reasoning: decisionData.reasoning,
        confidence_score: decisionData.confidence_score,
        expected_impact: decisionData.expected_impact,
        status: 'pending_implementation'
      }])
      .select()
      .single();

    if (decisionError) throw decisionError;

    console.log(`Decision made: ${storedDecision.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        decision_id: storedDecision.id,
        decision: decisionData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in decision engine:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});