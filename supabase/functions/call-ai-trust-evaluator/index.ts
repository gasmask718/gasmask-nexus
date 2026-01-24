import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvaluationRequest {
  prediction_id: string;
  was_accurate: boolean;
  human_overrode?: boolean;
  override_reason?: string;
  actual_outcome?: string;
}

interface PromotionThresholds {
  shadow_to_assisted: { min_predictions: number; min_accuracy: number; min_trust: number };
  assisted_to_canary: { min_predictions: number; min_accuracy: number; min_trust: number };
  canary_to_live: { min_predictions: number; min_accuracy: number; min_trust: number; max_failures: number };
}

const THRESHOLDS: PromotionThresholds = {
  shadow_to_assisted: { min_predictions: 25, min_accuracy: 70, min_trust: 60 },
  assisted_to_canary: { min_predictions: 50, min_accuracy: 80, min_trust: 75 },
  canary_to_live: { min_predictions: 100, min_accuracy: 90, min_trust: 85, max_failures: 2 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { prediction_id, was_accurate, human_overrode, override_reason, actual_outcome }: EvaluationRequest = await req.json();

    // Update the prediction with evaluation
    const { data: prediction, error: updateError } = await supabase
      .from('ai_call_predictions')
      .update({
        was_accurate,
        human_overrode: human_overrode || false,
        override_reason,
        actual_outcome,
      })
      .eq('id', prediction_id)
      .select('business_id')
      .single();

    if (updateError || !prediction) {
      throw new Error(`Failed to update prediction: ${updateError?.message}`);
    }

    const businessId = prediction.business_id;

    // Recalculate trust scores
    const trustResult = await recalculateTrustScores(supabase, businessId);

    // Check for mode promotion/demotion
    const modeChange = await evaluateModeChange(supabase, businessId, trustResult);

    // Log failure if applicable
    if (!was_accurate) {
      await logFailure(supabase, businessId, prediction_id, override_reason || 'Prediction marked as inaccurate');
    }

    return new Response(
      JSON.stringify({
        success: true,
        trust_score: trustResult.trust_score,
        accuracy_rate: trustResult.accuracy_rate,
        mode_change: modeChange,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Trust Evaluator Error:', error);
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

async function recalculateTrustScores(supabase: any, businessId: string) {
  // Get all evaluated predictions
  const { data: predictions } = await supabase
    .from('ai_call_predictions')
    .select('confidence_score, was_accurate, human_overrode')
    .eq('business_id', businessId)
    .not('was_accurate', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const total = predictions?.length || 0;
  const accurate = predictions?.filter((p: any) => p.was_accurate === true).length || 0;
  const overrides = predictions?.filter((p: any) => p.human_overrode === true).length || 0;
  
  const accuracyRate = total > 0 ? (accurate / total) * 100 : 0;
  const avgConfidence = total > 0 
    ? predictions.reduce((sum: number, p: any) => sum + (p.confidence_score || 0), 0) / total 
    : 0;

  // Trust score formula: weighted combination of accuracy and confidence
  const trustScore = Math.round(Math.min(100, (accuracyRate * 0.7) + (avgConfidence * 0.3)));

  // Calculate consecutive successes/failures
  let consecutiveSuccesses = 0;
  let consecutiveFailures = 0;
  
  if (predictions && predictions.length > 0) {
    for (const p of predictions) {
      if (p.was_accurate) {
        if (consecutiveFailures === 0) consecutiveSuccesses++;
        else break;
      } else {
        if (consecutiveSuccesses === 0) consecutiveFailures++;
        else break;
      }
    }
  }

  // Update trust score record
  const { data: existingScore } = await supabase
    .from('ai_trust_scores')
    .select('id, current_mode')
    .eq('business_id', businessId)
    .is('route_id', null)
    .single();

  const scoreData = {
    business_id: businessId,
    route_id: null,
    total_predictions: total,
    accurate_predictions: accurate,
    accuracy_rate: accuracyRate,
    human_override_count: overrides,
    trust_score: trustScore,
    consecutive_successes: consecutiveSuccesses,
    consecutive_failures: consecutiveFailures,
    last_evaluated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existingScore) {
    await supabase
      .from('ai_trust_scores')
      .update(scoreData)
      .eq('id', existingScore.id);
  } else {
    await supabase
      .from('ai_trust_scores')
      .insert({ ...scoreData, current_mode: 'shadow' });
  }

  return {
    trust_score: trustScore,
    accuracy_rate: accuracyRate,
    total_predictions: total,
    consecutive_successes: consecutiveSuccesses,
    consecutive_failures: consecutiveFailures,
  };
}

async function evaluateModeChange(supabase: any, businessId: string, trustResult: any) {
  const { data: config } = await supabase
    .from('ai_call_agent_config')
    .select('mode, auto_downgrade_on_failure, max_consecutive_failures')
    .eq('business_id', businessId)
    .single();

  if (!config) return null;

  const currentMode = config.mode;
  let newMode = currentMode;
  let changeReason = '';

  // Check for demotion first (failures)
  if (config.auto_downgrade_on_failure && trustResult.consecutive_failures >= (config.max_consecutive_failures || 3)) {
    if (currentMode === 'live') {
      newMode = 'canary';
      changeReason = `Demoted due to ${trustResult.consecutive_failures} consecutive failures`;
    } else if (currentMode === 'canary') {
      newMode = 'assisted';
      changeReason = `Demoted due to ${trustResult.consecutive_failures} consecutive failures`;
    } else if (currentMode === 'assisted') {
      newMode = 'shadow';
      changeReason = `Demoted due to ${trustResult.consecutive_failures} consecutive failures`;
    }
  }

  // Check for promotion (only if no demotion)
  if (newMode === currentMode) {
    const { trust_score, accuracy_rate, total_predictions } = trustResult;

    if (currentMode === 'shadow' && 
        total_predictions >= THRESHOLDS.shadow_to_assisted.min_predictions &&
        accuracy_rate >= THRESHOLDS.shadow_to_assisted.min_accuracy &&
        trust_score >= THRESHOLDS.shadow_to_assisted.min_trust) {
      newMode = 'assisted';
      changeReason = 'Promoted: Met shadow-to-assisted thresholds';
    } else if (currentMode === 'assisted' &&
               total_predictions >= THRESHOLDS.assisted_to_canary.min_predictions &&
               accuracy_rate >= THRESHOLDS.assisted_to_canary.min_accuracy &&
               trust_score >= THRESHOLDS.assisted_to_canary.min_trust) {
      newMode = 'canary';
      changeReason = 'Promoted: Met assisted-to-canary thresholds';
    } else if (currentMode === 'canary' &&
               total_predictions >= THRESHOLDS.canary_to_live.min_predictions &&
               accuracy_rate >= THRESHOLDS.canary_to_live.min_accuracy &&
               trust_score >= THRESHOLDS.canary_to_live.min_trust &&
               trustResult.consecutive_failures <= THRESHOLDS.canary_to_live.max_failures) {
      newMode = 'live';
      changeReason = 'Promoted: Met canary-to-live thresholds';
    }
  }

  // Apply mode change if needed
  if (newMode !== currentMode) {
    await supabase
      .from('ai_call_agent_config')
      .update({ mode: newMode, updated_at: new Date().toISOString() })
      .eq('business_id', businessId);

    const isPromotion = ['shadow', 'assisted', 'canary', 'live'].indexOf(newMode) > 
                        ['shadow', 'assisted', 'canary', 'live'].indexOf(currentMode);

    await supabase
      .from('ai_trust_scores')
      .update({
        current_mode: newMode,
        [isPromotion ? 'promoted_at' : 'demoted_at']: new Date().toISOString(),
      })
      .eq('business_id', businessId)
      .is('route_id', null);

    return {
      previous_mode: currentMode,
      new_mode: newMode,
      reason: changeReason,
      is_promotion: isPromotion,
    };
  }

  return null;
}

async function logFailure(supabase: any, businessId: string, predictionId: string, reason: string) {
  await supabase
    .from('ai_agent_failures')
    .insert({
      business_id: businessId,
      prediction_id: predictionId,
      failure_type: 'prediction_inaccurate',
      failure_reason: reason,
    });
}
