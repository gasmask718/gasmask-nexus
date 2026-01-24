import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShadowPredictRequest {
  session_id: string;
  business_id: string;
  transcript: string;
  human_operator_id?: string;
  call_context?: {
    caller_phone?: string;
    store_name?: string;
    time_of_day?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body: ShadowPredictRequest = await req.json();
    const { session_id, business_id, transcript, human_operator_id, call_context } = body;

    if (!session_id || !business_id || !transcript) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: session_id, business_id, transcript' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify AI agent is in shadow mode (or higher for testing)
    const { data: config } = await supabase
      .from('ai_call_agent_config')
      .select('mode, enabled')
      .eq('business_id', business_id)
      .single();

    if (!config?.enabled) {
      return new Response(
        JSON.stringify({ error: 'AI agent not enabled for this business', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get business context
    const { data: business } = await supabase
      .from('businesses')
      .select('name, industry')
      .eq('id', business_id)
      .single();

    // Get active playbook for context
    const { data: playbook } = await supabase
      .from('sales_playbooks')
      .select('*')
      .eq('business_id', business_id)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    // Build shadow prediction prompt
    const systemPrompt = `You are an AI call analyst operating in SHADOW MODE. You are observing a live call handled by a human operator.

Your job is to:
1. Predict what YOU would do if you were handling this call
2. Generate a response you would give
3. Assess escalation needs
4. Identify any risk flags

CRITICAL: You are NOT speaking. You are only predicting what you WOULD do. This is for calibration purposes.

Business: ${business?.name || 'Unknown'}
Industry: ${business?.industry || 'General'}
${playbook ? `Active Playbook: ${playbook.name}
Allowed Tactics: ${JSON.stringify(playbook.allowed_tactics)}
Forbidden Tactics: ${JSON.stringify(playbook.forbidden_tactics)}` : ''}

Respond with a JSON object containing:
{
  "predicted_intent": "the caller's primary intent",
  "predicted_response": "what you would say next",
  "predicted_next_action": "action you would take after speaking",
  "predicted_escalation": true/false,
  "predicted_route": "department/person to route to, if any",
  "confidence_score": 0-100,
  "reasoning": "why you chose this response",
  "risk_flags": ["any concerns or risks detected"]
}`;

    const userPrompt = `Current transcript:
${transcript}

${call_context ? `Context:
- Caller: ${call_context.caller_phone || 'Unknown'}
- Store: ${call_context.store_name || 'Unknown'}
- Time: ${call_context.time_of_day || 'Unknown'}` : ''}

What would you do next? Provide your shadow prediction.`;

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call AI for prediction
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse AI response
    let prediction;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        prediction = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      prediction = {
        predicted_intent: 'unknown',
        predicted_response: content.substring(0, 500),
        predicted_escalation: false,
        confidence_score: 30,
        reasoning: 'Failed to parse structured response',
        risk_flags: ['parse_error']
      };
    }

    const processingTime = Date.now() - startTime;

    // Store shadow prediction
    const { data: shadowPrediction, error: insertError } = await supabase
      .from('call_shadow_predictions')
      .insert({
        session_id,
        business_id,
        human_operator_id,
        predicted_intent: prediction.predicted_intent,
        predicted_response: prediction.predicted_response,
        predicted_next_action: prediction.predicted_next_action,
        predicted_escalation: prediction.predicted_escalation || false,
        predicted_route: prediction.predicted_route,
        confidence_score: Math.min(100, Math.max(0, prediction.confidence_score || 50)),
        reasoning: prediction.reasoning,
        risk_flags: prediction.risk_flags || [],
        transcript_snapshot: transcript.substring(-2000), // Last 2000 chars
        processing_time_ms: processingTime,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store shadow prediction:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        prediction_id: shadowPrediction?.id,
        prediction: {
          intent: prediction.predicted_intent,
          response: prediction.predicted_response,
          escalation: prediction.predicted_escalation,
          confidence: prediction.confidence_score,
          risk_flags: prediction.risk_flags,
        },
        mode: 'shadow',
        processing_time_ms: processingTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Shadow predictor error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
