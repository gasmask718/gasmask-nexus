import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalibrationRequest {
  business_id: string;
  shadow_prediction_id?: string;
  human_response?: string;
  human_action?: string;
  human_escalated?: boolean;
  call_outcome?: {
    resolved: boolean;
    satisfaction_score?: number;
    escalation_needed?: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body: CalibrationRequest = await req.json();
    const { business_id, shadow_prediction_id, human_response, human_action, human_escalated, call_outcome } = body;

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: 'business_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we have a specific prediction to compare
    if (shadow_prediction_id && human_response !== undefined) {
      // Get the shadow prediction
      const { data: prediction } = await supabase
        .from('call_shadow_predictions')
        .select('*')
        .eq('id', shadow_prediction_id)
        .single();

      if (prediction) {
        // Update prediction with human response
        await supabase
          .from('call_shadow_predictions')
          .update({
            human_actual_response: human_response,
            human_actual_action: human_action,
            human_escalated: human_escalated,
            human_response_timestamp: new Date().toISOString(),
          })
          .eq('id', shadow_prediction_id);

        // Determine if AI would have matched
        const wouldHaveMatched = await compareDecisions(
          prediction,
          { response: human_response, action: human_action, escalated: human_escalated },
          call_outcome
        );

        // Update the prediction with comparison result
        await supabase
          .from('call_shadow_predictions')
          .update({
            would_have_matched: wouldHaveMatched.matched,
            comparison_notes: wouldHaveMatched.notes,
          })
          .eq('id', shadow_prediction_id);

        // Log the diff
        await supabase
          .from('ai_vs_human_diff_logs')
          .insert({
            shadow_prediction_id,
            business_id,
            session_id: prediction.session_id,
            comparison_type: 'response',
            ai_decision: prediction.predicted_response,
            ai_confidence: prediction.confidence_score,
            ai_reasoning: prediction.reasoning,
            human_decision: human_response,
            verdict: wouldHaveMatched.verdict,
            verdict_reason: wouldHaveMatched.notes,
            impact_severity: wouldHaveMatched.severity,
            would_have_caused_escalation: prediction.predicted_escalation && !human_escalated,
            would_have_violated_compliance: wouldHaveMatched.violation,
          });
      }
    }

    // Recalculate trust scores for this business
    const trustScores = await recalculateTrustScores(supabase, business_id);

    return new Response(
      JSON.stringify({
        success: true,
        trust_scores: trustScores,
        calibrated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Trust calibration error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface ComparisonResult {
  matched: boolean;
  verdict: 'ai_correct' | 'human_correct' | 'both_valid' | 'ai_violation' | 'inconclusive';
  notes: string;
  severity: 'none' | 'minor' | 'moderate' | 'major' | 'critical';
  violation: boolean;
}

async function compareDecisions(
  aiPrediction: any,
  humanAction: { response?: string; action?: string; escalated?: boolean },
  outcome?: { resolved?: boolean; satisfaction_score?: number; escalation_needed?: boolean }
): Promise<ComparisonResult> {
  // Escalation comparison
  const aiWouldEscalate = aiPrediction.predicted_escalation;
  const humanEscalated = humanAction.escalated;
  const outcomeNeededEscalation = outcome?.escalation_needed;

  // If outcome shows escalation was needed
  if (outcomeNeededEscalation !== undefined) {
    if (aiWouldEscalate === outcomeNeededEscalation && humanEscalated !== outcomeNeededEscalation) {
      return {
        matched: false,
        verdict: 'ai_correct',
        notes: `AI correctly ${aiWouldEscalate ? 'predicted escalation need' : 'avoided unnecessary escalation'}`,
        severity: 'moderate',
        violation: false,
      };
    }
    if (humanEscalated === outcomeNeededEscalation && aiWouldEscalate !== outcomeNeededEscalation) {
      return {
        matched: false,
        verdict: 'human_correct',
        notes: `Human correctly ${humanEscalated ? 'escalated' : 'handled without escalation'}`,
        severity: 'moderate',
        violation: false,
      };
    }
  }

  // Both made same escalation decision
  if (aiWouldEscalate === humanEscalated) {
    return {
      matched: true,
      verdict: 'both_valid',
      notes: 'AI and human made same escalation decision',
      severity: 'none',
      violation: false,
    };
  }

  // AI wanted to escalate but human didn't (or vice versa)
  if (aiWouldEscalate && !humanEscalated) {
    // If call resolved well, human was right
    if (outcome?.resolved && (outcome?.satisfaction_score || 0) >= 70) {
      return {
        matched: false,
        verdict: 'human_correct',
        notes: 'Human successfully resolved without escalation AI predicted',
        severity: 'minor',
        violation: false,
      };
    }
    return {
      matched: false,
      verdict: 'inconclusive',
      notes: 'AI predicted escalation, human did not escalate',
      severity: 'minor',
      violation: false,
    };
  }

  return {
    matched: false,
    verdict: 'inconclusive',
    notes: 'Unable to determine clear winner',
    severity: 'none',
    violation: false,
  };
}

async function recalculateTrustScores(supabase: any, businessId: string) {
  // Get recent shadow predictions with comparisons
  const { data: predictions } = await supabase
    .from('call_shadow_predictions')
    .select('*')
    .eq('business_id', businessId)
    .not('would_have_matched', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!predictions || predictions.length === 0) {
    return null;
  }

  // Calculate metrics
  const total = predictions.length;
  const matched = predictions.filter((p: any) => p.would_have_matched).length;
  const aiWouldHaveBeenBetter = predictions.filter((p: any) => 
    p.comparison_notes?.includes('AI correctly')
  ).length;
  const aiWouldHaveBeenWorse = predictions.filter((p: any) => 
    p.comparison_notes?.includes('Human correctly')
  ).length;

  // Get diff logs for violation count
  const { data: diffs } = await supabase
    .from('ai_vs_human_diff_logs')
    .select('would_have_violated_compliance')
    .eq('business_id', businessId)
    .eq('would_have_violated_compliance', true);

  const violations = diffs?.length || 0;

  // Calculate scores
  const resolutionAccuracy = (matched / total) * 100;
  const escalationTiming = calculateEscalationScore(predictions);
  const complianceAdherence = Math.max(0, 100 - (violations * 10));
  const efficiencyScore = calculateEfficiencyScore(predictions);

  const overallScore = (
    resolutionAccuracy * 0.35 +
    escalationTiming * 0.25 +
    complianceAdherence * 0.25 +
    efficiencyScore * 0.15
  );

  // Determine trend
  const recentPredictions = predictions.slice(0, 20);
  const olderPredictions = predictions.slice(20, 40);
  const recentMatchRate = recentPredictions.filter((p: any) => p.would_have_matched).length / recentPredictions.length;
  const olderMatchRate = olderPredictions.length > 0 
    ? olderPredictions.filter((p: any) => p.would_have_matched).length / olderPredictions.length 
    : recentMatchRate;
  
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentMatchRate > olderMatchRate + 0.05) trend = 'improving';
  if (recentMatchRate < olderMatchRate - 0.05) trend = 'declining';

  // Upsert global trust score
  const { data: trustScore } = await supabase
    .from('trust_calibration_scores')
    .upsert({
      business_id: businessId,
      scope_type: 'global',
      scope_id: null,
      overall_trust_score: Math.round(overallScore * 100) / 100,
      resolution_accuracy: Math.round(resolutionAccuracy * 100) / 100,
      escalation_timing: Math.round(escalationTiming * 100) / 100,
      compliance_adherence: Math.round(complianceAdherence * 100) / 100,
      efficiency_score: Math.round(efficiencyScore * 100) / 100,
      total_comparisons: total,
      ai_would_have_matched: matched,
      ai_would_have_been_better: aiWouldHaveBeenBetter,
      ai_would_have_been_worse: aiWouldHaveBeenWorse,
      ai_would_have_violated_rules: violations,
      score_trend: trend,
      last_calibrated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,scope_type,scope_id' })
    .select()
    .single();

  return trustScore;
}

function calculateEscalationScore(predictions: any[]): number {
  const escalationPredictions = predictions.filter((p: any) => 
    p.predicted_escalation !== undefined && p.human_escalated !== undefined
  );
  
  if (escalationPredictions.length === 0) return 80; // Default neutral score
  
  const correct = escalationPredictions.filter((p: any) => 
    p.predicted_escalation === p.human_escalated
  ).length;
  
  return (correct / escalationPredictions.length) * 100;
}

function calculateEfficiencyScore(predictions: any[]): number {
  const avgConfidence = predictions.reduce((sum: number, p: any) => 
    sum + (p.confidence_score || 50), 0
  ) / predictions.length;
  
  const avgProcessingTime = predictions.reduce((sum: number, p: any) => 
    sum + (p.processing_time_ms || 1000), 0
  ) / predictions.length;
  
  // Faster processing and higher confidence = better efficiency
  const speedScore = Math.max(0, 100 - (avgProcessingTime / 50)); // Target < 2s
  const confidenceScore = avgConfidence;
  
  return (speedScore * 0.3 + confidenceScore * 0.7);
}
