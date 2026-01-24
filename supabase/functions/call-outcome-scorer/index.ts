import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * OUTCOME SCORER
 * ==============
 * Scores call outcomes for learning and optimization.
 * 
 * Metrics:
 * - Conversion (did we achieve the goal?)
 * - Satisfaction (caller sentiment at end)
 * - Escalation avoidance (did we handle it without escalation?)
 * - Efficiency (time to resolution)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoringRequest {
  session_id: string;
  call_log_id?: string;
  business_id: string;
  
  // Outcome data
  conversion_achieved?: boolean;
  conversion_type?: string;
  conversion_value?: number;
  
  // Call data
  duration_seconds?: number;
  final_sentiment?: string;
  explicit_feedback?: string;
  
  // AI participation
  ai_participated?: boolean;
  playbook_id?: string;
  style_profile_id?: string;
  
  // Human handling
  human_handled?: boolean;
  human_user_id?: string;
  
  // Escalation
  escalation_occurred?: boolean;
  escalation_reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body: ScoringRequest = await req.json();
    const {
      session_id,
      call_log_id,
      business_id,
      conversion_achieved,
      conversion_type,
      conversion_value,
      duration_seconds,
      final_sentiment,
      explicit_feedback,
      ai_participated,
      playbook_id,
      style_profile_id,
      human_handled,
      human_user_id,
      escalation_occurred,
      escalation_reason,
    } = body;

    if (!session_id || !business_id) {
      return new Response(
        JSON.stringify({ success: false, error: "session_id and business_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // STEP 1: CALCULATE SATISFACTION SCORE
    // ============================================
    let satisfactionScore = 0.5; // neutral default

    const sentimentScores: Record<string, number> = {
      'very_positive': 1.0,
      'positive': 0.8,
      'neutral': 0.5,
      'negative': 0.3,
      'very_negative': 0.1,
      'frustrated': 0.2,
      'satisfied': 0.85,
      'happy': 0.9,
    };

    if (final_sentiment && sentimentScores[final_sentiment]) {
      satisfactionScore = sentimentScores[final_sentiment];
    }

    // ============================================
    // STEP 2: CALCULATE OVERALL SCORE
    // ============================================
    let overallScore = 50; // base score

    // Conversion bonus (up to +30)
    if (conversion_achieved) {
      overallScore += 30;
    }

    // Satisfaction bonus/penalty (+/- 20)
    overallScore += (satisfactionScore - 0.5) * 40;

    // Escalation penalty (-15 if occurred and wasn't appropriate)
    if (escalation_occurred) {
      overallScore -= 15;
    }

    // Efficiency bonus (shorter calls for simple resolutions)
    if (duration_seconds && duration_seconds < 180 && conversion_achieved) {
      overallScore += 10; // quick successful resolution
    }

    // Clamp to 0-100
    overallScore = Math.max(0, Math.min(100, overallScore));

    // ============================================
    // STEP 3: GET AI CONFIDENCE DATA
    // ============================================
    let aiConfidenceAvg = null;
    let aiConfidenceMin = null;

    if (ai_participated) {
      const { data: predictions } = await supabase
        .from('ai_call_predictions')
        .select('confidence_score')
        .eq('session_id', session_id)
        .not('confidence_score', 'is', null);

      if (predictions && predictions.length > 0) {
        const scores = predictions.map(p => p.confidence_score!);
        aiConfidenceAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
        aiConfidenceMin = Math.min(...scores);
      }
    }

    // ============================================
    // STEP 4: DETERMINE IF EXEMPLAR CANDIDATE
    // ============================================
    const isExemplarCandidate = 
      human_handled === true && 
      overallScore >= 80 && 
      satisfactionScore >= 0.7 &&
      !escalation_occurred;

    // ============================================
    // STEP 5: STORE OUTCOME SCORE
    // ============================================
    const { data: outcomeScore, error: insertError } = await supabase
      .from('call_outcome_scores')
      .insert({
        session_id,
        call_log_id: call_log_id || null,
        business_id,
        
        // Conversion
        conversion_achieved: conversion_achieved || false,
        conversion_type: conversion_type || null,
        conversion_value: conversion_value || null,
        
        // Satisfaction
        caller_satisfaction_score: satisfactionScore,
        explicit_feedback: explicit_feedback || null,
        
        // Escalation
        escalation_occurred: escalation_occurred || false,
        escalation_reason: escalation_reason || null,
        
        // Efficiency
        call_duration_seconds: duration_seconds || null,
        
        // AI performance
        ai_participated: ai_participated || false,
        ai_confidence_avg: aiConfidenceAvg,
        ai_confidence_min: aiConfidenceMin,
        playbook_id: playbook_id || null,
        style_profile_id: style_profile_id || null,
        
        // Human performance
        human_handled: human_handled || false,
        human_user_id: human_user_id || null,
        is_exemplar_candidate: isExemplarCandidate,
        
        // Overall
        overall_score: overallScore,
        scoring_version: 'v1',
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // ============================================
    // STEP 6: UPDATE PLAYBOOK/STYLE STATS
    // ============================================
    if (playbook_id) {
      // Update playbook usage count and avg score
      try {
        await supabase.rpc('update_playbook_stats', {
          p_playbook_id: playbook_id,
          p_outcome_score: overallScore,
          p_converted: conversion_achieved || false,
        });
      } catch {
        // RPC might not exist yet, that's ok
      }
    }

    if (style_profile_id) {
      // Update style usage count and avg satisfaction
      try {
        await supabase.rpc('update_style_stats', {
          p_style_id: style_profile_id,
          p_satisfaction: satisfactionScore,
        });
      } catch {
        // RPC might not exist yet, that's ok
      }
    }

    // ============================================
    // RESPONSE
    // ============================================
    return new Response(
      JSON.stringify({
        success: true,
        outcome_score_id: outcomeScore.id,
        
        scores: {
          overall: overallScore,
          satisfaction: satisfactionScore,
          conversion: conversion_achieved ? 1 : 0,
          escalation_avoided: !escalation_occurred ? 1 : 0,
        },
        
        is_exemplar_candidate: isExemplarCandidate,
        
        ai_metrics: ai_participated ? {
          confidence_avg: aiConfidenceAvg,
          confidence_min: aiConfidenceMin,
        } : null,
        
        recommendations: isExemplarCandidate 
          ? ['This call is a candidate for technique extraction']
          : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Outcome scorer error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
