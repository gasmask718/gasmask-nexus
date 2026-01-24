import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShadowProcessRequest {
  session_id?: string;
  call_log_id?: string;
  business_id: string;
  caller_phone: string;
  transcript?: string;
  call_context?: {
    store_name?: string;
    caller_history?: any;
    time_of_day?: string;
    day_of_week?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: ShadowProcessRequest = await req.json();
    const { session_id, call_log_id, business_id, caller_phone, transcript, call_context } = request;

    // Check if AI agent is enabled for this business
    const { data: config } = await supabase
      .from('ai_call_agent_config')
      .select('*')
      .eq('business_id', business_id)
      .single();

    // If no config or disabled, skip processing
    if (!config || !config.enabled || config.mode === 'off') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'AI agent not enabled for this business' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get business info for context
    const { data: business } = await supabase
      .from('businesses')
      .select('name, industry')
      .eq('id', business_id)
      .single();

    // Build the AI prompt for shadow analysis
    const systemPrompt = `You are an AI call agent analyst for ${business?.name || 'a business'}.
Your job is to analyze incoming calls and predict:
1. Caller intent (sales inquiry, support request, complaint, follow-up, scheduling, etc.)
2. Best routing suggestion (department or person type)
3. What you would have said if you answered the call
4. A confidence score (0-100) for your predictions

Be concise and actionable. Format your response as JSON.`;

    const userPrompt = `Analyze this call:

Caller Phone: ${caller_phone}
${transcript ? `Transcript: ${transcript}` : 'No transcript available yet'}
${call_context?.store_name ? `Related Store: ${call_context.store_name}` : ''}
${call_context?.time_of_day ? `Time: ${call_context.time_of_day}` : ''}
${call_context?.day_of_week ? `Day: ${call_context.day_of_week}` : ''}
${call_context?.caller_history ? `Caller History: ${JSON.stringify(call_context.caller_history)}` : 'New caller'}

Respond with JSON:
{
  "predicted_intent": "string describing the likely intent",
  "predicted_route": "suggested routing (e.g., 'sales team', 'support', 'store manager')",
  "drafted_response": "What you would say if you answered this call (2-3 sentences)",
  "confidence_score": number 0-100,
  "reasoning": "Brief explanation of your analysis"
}`;

    // Call Lovable AI for analysis
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
          JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse AI response
    let prediction;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      prediction = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      prediction = {
        predicted_intent: 'unknown',
        predicted_route: 'general',
        drafted_response: content.slice(0, 500),
        confidence_score: 30,
        reasoning: 'Failed to parse structured response'
      };
    }

    const processingTime = Date.now() - startTime;

    // Store the prediction
    const { data: insertedPrediction, error: insertError } = await supabase
      .from('ai_call_predictions')
      .insert({
        session_id,
        call_log_id,
        business_id,
        caller_phone,
        predicted_intent: prediction.predicted_intent,
        predicted_route: prediction.predicted_route,
        drafted_response: prediction.drafted_response,
        confidence_score: prediction.confidence_score,
        processing_time_ms: processingTime,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert prediction:', insertError);
    }

    // Update trust scores
    await updateTrustScore(supabase, business_id);

    return new Response(
      JSON.stringify({
        success: true,
        prediction: {
          id: insertedPrediction?.id,
          intent: prediction.predicted_intent,
          route: prediction.predicted_route,
          response: prediction.drafted_response,
          confidence: prediction.confidence_score,
          reasoning: prediction.reasoning,
        },
        mode: config.mode,
        processing_time_ms: processingTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Shadow Processor Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function updateTrustScore(supabase: any, businessId: string) {
  // Get recent predictions for this business
  const { data: predictions } = await supabase
    .from('ai_call_predictions')
    .select('confidence_score, was_accurate, human_overrode')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!predictions || predictions.length === 0) return;

  const totalPredictions = predictions.length;
  const accuratePredictions = predictions.filter((p: any) => p.was_accurate === true).length;
  const overrideCount = predictions.filter((p: any) => p.human_overrode === true).length;
  
  // Calculate accuracy rate (only from evaluated predictions)
  const evaluatedPredictions = predictions.filter((p: any) => p.was_accurate !== null);
  const accuracyRate = evaluatedPredictions.length > 0 
    ? (accuratePredictions / evaluatedPredictions.length) * 100 
    : 0;

  // Calculate average confidence
  const avgConfidence = predictions.reduce((sum: number, p: any) => sum + (p.confidence_score || 0), 0) / totalPredictions;

  // Upsert trust score
  await supabase
    .from('ai_trust_scores')
    .upsert({
      business_id: businessId,
      route_id: null, // Business-level score
      total_predictions: totalPredictions,
      accurate_predictions: accuratePredictions,
      accuracy_rate: accuracyRate,
      human_override_count: overrideCount,
      trust_score: Math.round(Math.min(100, (accuracyRate * 0.7) + (avgConfidence * 0.3))),
      last_evaluated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'business_id,route_id'
    });
}
