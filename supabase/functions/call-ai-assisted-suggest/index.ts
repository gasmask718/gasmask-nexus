import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssistedSuggestRequest {
  session_id: string;
  business_id: string;
  transcript: string;
  caller_phone?: string;
  store_context?: {
    store_name?: string;
    recent_orders?: any[];
    contact_history?: any[];
  };
  persona_context?: {
    name?: string;
    tone?: string;
  };
}

interface AISuggestion {
  intent: string;
  confidence: number;
  suggested_response: string;
  suggested_next_question: string | null;
  recommended_route: string | null;
  risk_flags: string[];
  reasoning: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: AssistedSuggestRequest = await req.json();
    const { session_id, business_id, transcript, caller_phone, store_context, persona_context } = request;

    // Check AI agent mode - must be in 'assisted' mode
    const { data: config } = await supabase
      .from('ai_call_agent_config')
      .select('*')
      .eq('business_id', business_id)
      .single();

    if (!config || !config.enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI agent not enabled', suggestions: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Must be in assisted mode or higher to generate suggestions
    if (!['assisted', 'canary', 'live'].includes(config.mode)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'AI agent not in assisted mode',
          current_mode: config.mode,
          suggestions: null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get business info
    const { data: business } = await supabase
      .from('businesses')
      .select('name, industry')
      .eq('id', business_id)
      .single();

    // Build the AI prompt for real-time suggestions
    const systemPrompt = `You are an AI call assistant for ${business?.name || 'a business'}.
You are in ASSISTED MODE - you provide real-time suggestions to a HUMAN operator who is on the call.
You do NOT speak to the caller. You advise the human.

Your job is to analyze the live transcript and provide:
1. Caller intent classification
2. A suggested response the human could say (2-3 sentences max)
3. A suggested next question to ask
4. Routing recommendation if needed
5. Risk flags if any (angry caller, compliance risk, repeat complaint)
6. A confidence score (0-100)

Be concise and immediately actionable. The human needs quick guidance.
${persona_context?.tone ? `The brand tone should be: ${persona_context.tone}` : ''}`;

    const userPrompt = `Live call transcript:
"""
${transcript}
"""

${store_context?.store_name ? `Store: ${store_context.store_name}` : ''}
${caller_phone ? `Caller: ${caller_phone}` : ''}
${store_context?.contact_history ? `Previous interactions: ${store_context.contact_history.length} on file` : ''}

Provide your suggestion as JSON:
{
  "intent": "string (sales inquiry, support request, complaint, follow-up, scheduling, general inquiry, etc.)",
  "confidence": number 0-100,
  "suggested_response": "What the human should say next (2-3 sentences max)",
  "suggested_next_question": "A follow-up question to ask, or null if not needed",
  "recommended_route": "If escalation needed (e.g., 'manager', 'technical support'), otherwise null",
  "risk_flags": ["array of flags like 'angry_caller', 'compliance_risk', 'repeat_complaint', or empty array"],
  "reasoning": "Brief 1-sentence explanation of your analysis"
}`;

    const startTime = Date.now();

    // Call Lovable AI for suggestions
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded', suggestions: null }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted', suggestions: null }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    const processingTime = Date.now() - startTime;

    // Parse AI response
    let suggestion: AISuggestion;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      suggestion = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      suggestion = {
        intent: 'unknown',
        confidence: 30,
        suggested_response: 'I can help you with that. Could you tell me more about what you need?',
        suggested_next_question: null,
        recommended_route: null,
        risk_flags: [],
        reasoning: 'Failed to parse structured response - using fallback'
      };
    }

    // Store the suggestion/prediction
    const { data: insertedPrediction } = await supabase
      .from('ai_call_predictions')
      .insert({
        session_id,
        business_id,
        caller_phone,
        predicted_intent: suggestion.intent,
        predicted_route: suggestion.recommended_route,
        drafted_response: suggestion.suggested_response,
        confidence_score: suggestion.confidence,
        processing_time_ms: processingTime,
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        prediction_id: insertedPrediction?.id,
        suggestion: {
          intent: suggestion.intent,
          confidence: suggestion.confidence,
          suggested_response: suggestion.suggested_response,
          suggested_next_question: suggestion.suggested_next_question,
          recommended_route: suggestion.recommended_route,
          risk_flags: suggestion.risk_flags,
          reasoning: suggestion.reasoning,
        },
        processing_time_ms: processingTime,
        mode: config.mode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Assisted Suggest Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        suggestions: null
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
