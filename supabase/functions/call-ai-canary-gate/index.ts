import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CanaryGateRequest {
  session_id: string;
  business_id: string;
  caller_phone?: string;
  predicted_intent?: string;
  confidence_score?: number;
  transcript?: string;
}

interface CanaryDecision {
  allow_ai_answer: boolean;
  reason: string;
  blockers: string[];
  entry_conditions: {
    mode: string;
    trust_score: number;
    accuracy_rate: number;
    confidence: number;
    callable_users: number;
    unresolved_calls: number;
    kill_switch: boolean;
    concurrent_canary_calls: number;
    max_concurrent: number;
  };
  call_risk_level: 'low' | 'medium' | 'high';
  ai_greeting?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CanaryGateRequest = await req.json();
    const { session_id, business_id, predicted_intent, confidence_score, transcript } = body;

    console.log(`🐦 Canary Gate Check for session ${session_id}, business ${business_id}`);

    // 1. Get AI agent config
    const { data: config } = await supabase
      .from('ai_call_agent_config')
      .select('*')
      .eq('business_id', business_id)
      .single();

    const blockers: string[] = [];
    let callRiskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check kill switch first
    if (config?.canary_kill_switch) {
      blockers.push('Admin kill switch is active');
    }

    // Check mode
    if (!config || config.mode !== 'canary') {
      blockers.push(`Mode is ${config?.mode || 'not configured'}, not canary`);
    }

    if (!config?.enabled) {
      blockers.push('AI agent is disabled');
    }

    // 2. Get trust score
    const { data: trustScore } = await supabase
      .from('ai_trust_scores')
      .select('*')
      .eq('business_id', business_id)
      .is('route_id', null)
      .single();

    const currentTrustScore = trustScore?.trust_score || 0;
    const currentAccuracy = trustScore?.accuracy_rate || 0;
    const confidenceThreshold = config?.confidence_threshold || 85;

    // Check trust score
    if (currentTrustScore < confidenceThreshold) {
      blockers.push(`Trust score ${currentTrustScore}% below threshold ${confidenceThreshold}%`);
    }

    // Check accuracy
    if (currentAccuracy < 80) {
      blockers.push(`Accuracy rate ${currentAccuracy}% below 80% minimum`);
    }

    // Check confidence
    const callConfidence = confidence_score || 0;
    if (callConfidence < confidenceThreshold) {
      blockers.push(`Call confidence ${callConfidence}% below threshold ${confidenceThreshold}%`);
    }

    // Check consecutive failures
    if (trustScore?.consecutive_failures >= (config?.max_consecutive_failures || 3)) {
      blockers.push(`${trustScore.consecutive_failures} consecutive failures exceed limit`);
    }

    // 3. Check callable users (human fallback)
    const { data: callableUsers } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('business_id', business_id)
      .eq('is_callable', true)
      .not('phone', 'is', null);

    const callableCount = callableUsers?.length || 0;
    if (config?.require_callable_fallback && callableCount === 0) {
      blockers.push('No callable human fallback available');
    }

    // 4. Check unresolved calls
    const { data: unresolvedCalls } = await supabase
      .from('call_outcomes')
      .select('id')
      .eq('business_id', business_id)
      .in('resolution_status', ['pending', 'in_progress']);

    const unresolvedCount = unresolvedCalls?.length || 0;
    if (config?.require_resolved_queue && unresolvedCount > 0) {
      blockers.push(`${unresolvedCount} unresolved calls in queue`);
    }

    // 5. Check concurrent canary calls
    const { data: activeCanarycalls } = await supabase
      .from('canary_call_log')
      .select('id')
      .eq('business_id', business_id)
      .is('outcome', null);

    const concurrentCount = activeCanarycalls?.length || 0;
    const maxConcurrent = config?.canary_max_concurrent || 3;
    if (concurrentCount >= maxConcurrent) {
      blockers.push(`${concurrentCount} concurrent canary calls at max limit ${maxConcurrent}`);
    }

    // 6. Check call risk level based on intent
    const blockedIntents = config?.canary_blocked_intents || ['complaint', 'escalation', 'compliance', 'legal'];
    const allowedTypes = config?.canary_allowed_call_types || ['general_inquiry', 'scheduling', 'simple_sales'];

    if (predicted_intent) {
      const intentLower = predicted_intent.toLowerCase();
      
      if (blockedIntents.some((bi: string) => intentLower.includes(bi.toLowerCase()))) {
        blockers.push(`Intent "${predicted_intent}" is blocked for canary mode`);
        callRiskLevel = 'high';
      } else if (!allowedTypes.some((at: string) => intentLower.includes(at.toLowerCase()))) {
        // Not explicitly allowed, mark as medium risk
        callRiskLevel = 'medium';
      }
    }

    // Check transcript for risk signals
    if (transcript) {
      const transcriptLower = transcript.toLowerCase();
      const riskKeywords = ['angry', 'frustrated', 'sue', 'lawyer', 'refund', 'complaint', 'manager', 'supervisor'];
      const hasRiskSignal = riskKeywords.some(kw => transcriptLower.includes(kw));
      
      if (hasRiskSignal) {
        callRiskLevel = 'high';
        blockers.push('High-risk keywords detected in transcript');
      }
    }

    // 7. Get business info for greeting
    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', business_id)
      .single();

    // Decision
    const allowAIAnswer = blockers.length === 0;
    const reason = allowAIAnswer 
      ? 'All canary entry conditions passed'
      : `Blocked: ${blockers.join('; ')}`;

    const entryConditions = {
      mode: config?.mode || 'off',
      trust_score: currentTrustScore,
      accuracy_rate: currentAccuracy,
      confidence: callConfidence,
      callable_users: callableCount,
      unresolved_calls: unresolvedCount,
      kill_switch: config?.canary_kill_switch || false,
      concurrent_canary_calls: concurrentCount,
      max_concurrent: maxConcurrent,
    };

    // If allowed, create canary log entry
    if (allowAIAnswer) {
      await supabase.from('canary_call_log').insert({
        session_id,
        business_id,
        entry_confidence: callConfidence,
        entry_trust_score: currentTrustScore,
        entry_accuracy_rate: currentAccuracy,
        callable_users_count: callableCount,
        unresolved_calls_count: unresolvedCount,
        entry_reason: reason,
        entry_conditions: entryConditions,
        call_risk_level: callRiskLevel,
        call_type: predicted_intent,
        initial_sentiment: 'neutral',
      });

      // Update session to AI active
      await supabase
        .from('ai_call_sessions')
        .update({ 
          status: 'ai_active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', session_id);
    }

    const decision: CanaryDecision = {
      allow_ai_answer: allowAIAnswer,
      reason,
      blockers,
      entry_conditions: entryConditions,
      call_risk_level: callRiskLevel,
      ai_greeting: allowAIAnswer 
        ? `This is the automated assistant for ${business?.name || 'our business'}. A human representative is available at any time. How may I help you today?`
        : undefined,
    };

    console.log(`🐦 Canary Gate Decision: ${allowAIAnswer ? 'ALLOW' : 'BLOCK'} - ${reason}`);

    return new Response(
      JSON.stringify({ success: true, decision }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Canary Gate Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        decision: {
          allow_ai_answer: false,
          reason: `System error: ${error instanceof Error ? error.message : String(error)}`,
          blockers: ['System error occurred'],
          entry_conditions: {},
          call_risk_level: 'high',
        }
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
