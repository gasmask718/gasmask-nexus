import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GraduationRequest {
  business_id: string;
  check_promotion?: boolean;
  check_demotion?: boolean;
  requested_by?: string; // 'system' or user_id
}

const MODE_HIERARCHY = ['off', 'shadow', 'assisted', 'canary', 'live'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body: GraduationRequest = await req.json();
    const { business_id, check_promotion = true, check_demotion = true, requested_by = 'system' } = body;

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: 'business_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current config
    const { data: config } = await supabase
      .from('ai_call_agent_config')
      .select('*')
      .eq('business_id', business_id)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'AI agent not configured for this business' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentMode = config.mode || 'off';
    const currentModeIndex = MODE_HIERARCHY.indexOf(currentMode);

    // Get thresholds
    const { data: thresholds } = await supabase
      .from('ai_graduation_thresholds')
      .select('*')
      .eq('business_id', business_id)
      .single();

    // Use defaults if no custom thresholds
    const t = thresholds || getDefaultThresholds();

    // Get trust calibration scores
    const { data: trustScore } = await supabase
      .from('trust_calibration_scores')
      .select('*')
      .eq('business_id', business_id)
      .eq('scope_type', 'global')
      .single();

    // Get statistics for evaluation
    const stats = await getGraduationStats(supabase, business_id, currentMode);

    let result: {
      action: 'none' | 'promote' | 'demote';
      from_mode: string;
      to_mode: string;
      reason: string;
      thresholds_checked: Record<string, any>;
      thresholds_passed: boolean;
      requires_approval: boolean;
    } = {
      action: 'none',
      from_mode: currentMode,
      to_mode: currentMode,
      reason: 'No action needed',
      thresholds_checked: {},
      thresholds_passed: false,
      requires_approval: false,
    };

    // Check for demotion first (safety priority)
    if (check_demotion && currentModeIndex > 1) {
      const demotionCheck = checkDemotionTriggers(trustScore, stats, t, currentMode);
      if (demotionCheck.shouldDemote) {
        const newModeIndex = Math.max(1, currentModeIndex - 1); // Don't go below shadow
        result = {
          action: 'demote',
          from_mode: currentMode,
          to_mode: MODE_HIERARCHY[newModeIndex],
          reason: demotionCheck.reason,
          thresholds_checked: demotionCheck.thresholds,
          thresholds_passed: false,
          requires_approval: t.require_human_approval_for_demotion,
        };
      }
    }

    // Check for promotion (only if not demoting)
    if (result.action === 'none' && check_promotion && currentModeIndex < MODE_HIERARCHY.length - 1) {
      const promotionCheck = checkPromotionReadiness(trustScore, stats, t, currentMode);
      if (promotionCheck.ready) {
        result = {
          action: 'promote',
          from_mode: currentMode,
          to_mode: MODE_HIERARCHY[currentModeIndex + 1],
          reason: promotionCheck.reason,
          thresholds_checked: promotionCheck.thresholds,
          thresholds_passed: true,
          requires_approval: t.require_human_approval_for_promotion,
        };
      } else {
        result.thresholds_checked = promotionCheck.thresholds;
        result.reason = promotionCheck.reason;
      }
    }

    // If action needed and doesn't require approval, execute it
    if (result.action !== 'none' && !result.requires_approval) {
      await executeGraduation(supabase, business_id, result, requested_by, trustScore?.overall_trust_score);
    } else if (result.action !== 'none' && result.requires_approval) {
      // Log pending graduation event
      await supabase
        .from('ai_graduation_events')
        .insert({
          business_id,
          from_mode: result.from_mode,
          to_mode: result.to_mode,
          event_type: result.action === 'promote' ? 'promotion' : 'demotion',
          trigger_reason: `PENDING: ${result.reason}`,
          trust_score_at_event: trustScore?.overall_trust_score,
          thresholds_checked: result.thresholds_checked,
          thresholds_passed: result.thresholds_passed,
          requested_by,
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        current_mode: currentMode,
        evaluation: result,
        trust_score: trustScore?.overall_trust_score,
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Graduation evaluator error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getDefaultThresholds() {
  return {
    shadow_to_assisted_min_predictions: 100,
    shadow_to_assisted_min_accuracy: 75,
    shadow_to_assisted_max_violations: 0,
    shadow_to_assisted_min_days: 7,
    assisted_to_canary_min_suggestions: 200,
    assisted_to_canary_min_acceptance_rate: 80,
    assisted_to_canary_min_trust_score: 85,
    assisted_to_canary_min_days: 14,
    canary_to_live_min_calls: 500,
    canary_to_live_min_success_rate: 90,
    canary_to_live_min_trust_score: 92,
    canary_to_live_max_escalation_rate: 10,
    canary_to_live_min_days: 30,
    demotion_consecutive_failures: 3,
    demotion_trust_score_floor: 70,
    demotion_violation_threshold: 1,
    require_human_approval_for_promotion: true,
    require_human_approval_for_demotion: false,
  };
}

async function getGraduationStats(supabase: any, businessId: string, currentMode: string) {
  const now = new Date();
  
  // Get shadow predictions count
  const { count: shadowPredictions } = await supabase
    .from('call_shadow_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);

  // Get suggestion acceptance rate
  const { data: suggestions } = await supabase
    .from('ai_suggestion_logs')
    .select('operator_action')
    .eq('business_id', businessId);

  const totalSuggestions = suggestions?.length || 0;
  const acceptedSuggestions = suggestions?.filter((s: any) => s.operator_action === 'accepted').length || 0;
  const acceptanceRate = totalSuggestions > 0 ? (acceptedSuggestions / totalSuggestions) * 100 : 0;

  // Get canary call stats
  const { data: canaryCalls } = await supabase
    .from('ai_call_sessions')
    .select('id, end_status')
    .eq('business_id', businessId)
    .eq('is_canary', true);

  const totalCanaryCalls = canaryCalls?.length || 0;
  const successfulCanaryCalls = canaryCalls?.filter((c: any) => 
    ['completed', 'resolved'].includes(c.end_status)
  ).length || 0;
  const canarySuccessRate = totalCanaryCalls > 0 ? (successfulCanaryCalls / totalCanaryCalls) * 100 : 0;

  // Get violation count
  const { count: violations } = await supabase
    .from('ai_vs_human_diff_logs')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('would_have_violated_compliance', true);

  // Get mode duration
  const { data: lastTransition } = await supabase
    .from('ai_graduation_events')
    .select('created_at')
    .eq('business_id', businessId)
    .eq('to_mode', currentMode)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const daysInCurrentMode = lastTransition 
    ? Math.floor((now.getTime() - new Date(lastTransition.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999; // If no transition, assume long time

  // Get consecutive failures
  const { data: recentPredictions } = await supabase
    .from('call_shadow_predictions')
    .select('would_have_matched')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10);

  let consecutiveFailures = 0;
  for (const p of recentPredictions || []) {
    if (p.would_have_matched === false) consecutiveFailures++;
    else break;
  }

  return {
    shadow_predictions: shadowPredictions || 0,
    total_suggestions: totalSuggestions,
    suggestion_acceptance_rate: acceptanceRate,
    canary_calls: totalCanaryCalls,
    canary_success_rate: canarySuccessRate,
    violations: violations || 0,
    days_in_mode: daysInCurrentMode,
    consecutive_failures: consecutiveFailures,
  };
}

function checkDemotionTriggers(
  trustScore: any,
  stats: any,
  thresholds: any,
  currentMode: string
): { shouldDemote: boolean; reason: string; thresholds: Record<string, any> } {
  const checks: Record<string, any> = {};

  // Check consecutive failures
  checks.consecutive_failures = {
    current: stats.consecutive_failures,
    threshold: thresholds.demotion_consecutive_failures,
    passed: stats.consecutive_failures < thresholds.demotion_consecutive_failures,
  };

  if (!checks.consecutive_failures.passed) {
    return {
      shouldDemote: true,
      reason: `Consecutive failures (${stats.consecutive_failures}) exceeded threshold (${thresholds.demotion_consecutive_failures})`,
      thresholds: checks,
    };
  }

  // Check trust score floor
  if (trustScore) {
    checks.trust_score_floor = {
      current: trustScore.overall_trust_score,
      threshold: thresholds.demotion_trust_score_floor,
      passed: trustScore.overall_trust_score >= thresholds.demotion_trust_score_floor,
    };

    if (!checks.trust_score_floor.passed) {
      return {
        shouldDemote: true,
        reason: `Trust score (${trustScore.overall_trust_score}) below floor (${thresholds.demotion_trust_score_floor})`,
        thresholds: checks,
      };
    }
  }

  // Check violations
  checks.violations = {
    current: stats.violations,
    threshold: thresholds.demotion_violation_threshold,
    passed: stats.violations < thresholds.demotion_violation_threshold,
  };

  if (!checks.violations.passed) {
    return {
      shouldDemote: true,
      reason: `Compliance violations (${stats.violations}) exceeded threshold (${thresholds.demotion_violation_threshold})`,
      thresholds: checks,
    };
  }

  return { shouldDemote: false, reason: 'All demotion checks passed', thresholds: checks };
}

function checkPromotionReadiness(
  trustScore: any,
  stats: any,
  thresholds: any,
  currentMode: string
): { ready: boolean; reason: string; thresholds: Record<string, any> } {
  const checks: Record<string, any> = {};

  if (currentMode === 'shadow') {
    // Shadow → Assisted checks
    checks.min_predictions = {
      current: stats.shadow_predictions,
      required: thresholds.shadow_to_assisted_min_predictions,
      passed: stats.shadow_predictions >= thresholds.shadow_to_assisted_min_predictions,
    };

    const accuracy = trustScore?.resolution_accuracy || 0;
    checks.min_accuracy = {
      current: accuracy,
      required: thresholds.shadow_to_assisted_min_accuracy,
      passed: accuracy >= thresholds.shadow_to_assisted_min_accuracy,
    };

    checks.max_violations = {
      current: stats.violations,
      required: thresholds.shadow_to_assisted_max_violations,
      passed: stats.violations <= thresholds.shadow_to_assisted_max_violations,
    };

    checks.min_days = {
      current: stats.days_in_mode,
      required: thresholds.shadow_to_assisted_min_days,
      passed: stats.days_in_mode >= thresholds.shadow_to_assisted_min_days,
    };

    const allPassed = Object.values(checks).every((c: any) => c.passed);
    const failedChecks = Object.entries(checks).filter(([_, c]: any) => !c.passed).map(([k]) => k);

    return {
      ready: allPassed,
      reason: allPassed 
        ? 'All Shadow → Assisted requirements met'
        : `Missing requirements: ${failedChecks.join(', ')}`,
      thresholds: checks,
    };
  }

  if (currentMode === 'assisted') {
    // Assisted → Canary checks
    checks.min_suggestions = {
      current: stats.total_suggestions,
      required: thresholds.assisted_to_canary_min_suggestions,
      passed: stats.total_suggestions >= thresholds.assisted_to_canary_min_suggestions,
    };

    checks.min_acceptance_rate = {
      current: stats.suggestion_acceptance_rate,
      required: thresholds.assisted_to_canary_min_acceptance_rate,
      passed: stats.suggestion_acceptance_rate >= thresholds.assisted_to_canary_min_acceptance_rate,
    };

    checks.min_trust_score = {
      current: trustScore?.overall_trust_score || 0,
      required: thresholds.assisted_to_canary_min_trust_score,
      passed: (trustScore?.overall_trust_score || 0) >= thresholds.assisted_to_canary_min_trust_score,
    };

    checks.min_days = {
      current: stats.days_in_mode,
      required: thresholds.assisted_to_canary_min_days,
      passed: stats.days_in_mode >= thresholds.assisted_to_canary_min_days,
    };

    const allPassed = Object.values(checks).every((c: any) => c.passed);
    const failedChecks = Object.entries(checks).filter(([_, c]: any) => !c.passed).map(([k]) => k);

    return {
      ready: allPassed,
      reason: allPassed 
        ? 'All Assisted → Canary requirements met'
        : `Missing requirements: ${failedChecks.join(', ')}`,
      thresholds: checks,
    };
  }

  if (currentMode === 'canary') {
    // Canary → Live checks
    checks.min_calls = {
      current: stats.canary_calls,
      required: thresholds.canary_to_live_min_calls,
      passed: stats.canary_calls >= thresholds.canary_to_live_min_calls,
    };

    checks.min_success_rate = {
      current: stats.canary_success_rate,
      required: thresholds.canary_to_live_min_success_rate,
      passed: stats.canary_success_rate >= thresholds.canary_to_live_min_success_rate,
    };

    checks.min_trust_score = {
      current: trustScore?.overall_trust_score || 0,
      required: thresholds.canary_to_live_min_trust_score,
      passed: (trustScore?.overall_trust_score || 0) >= thresholds.canary_to_live_min_trust_score,
    };

    checks.min_days = {
      current: stats.days_in_mode,
      required: thresholds.canary_to_live_min_days,
      passed: stats.days_in_mode >= thresholds.canary_to_live_min_days,
    };

    const allPassed = Object.values(checks).every((c: any) => c.passed);
    const failedChecks = Object.entries(checks).filter(([_, c]: any) => !c.passed).map(([k]) => k);

    return {
      ready: allPassed,
      reason: allPassed 
        ? 'All Canary → Live requirements met'
        : `Missing requirements: ${failedChecks.join(', ')}`,
      thresholds: checks,
    };
  }

  return { ready: false, reason: 'Already at maximum mode', thresholds: checks };
}

async function executeGraduation(
  supabase: any,
  businessId: string,
  result: any,
  requestedBy: string,
  trustScore?: number
) {
  // Update AI config
  await supabase
    .from('ai_call_agent_config')
    .update({
      mode: result.to_mode,
      updated_at: new Date().toISOString(),
    })
    .eq('business_id', businessId);

  // Log graduation event
  await supabase
    .from('ai_graduation_events')
    .insert({
      business_id: businessId,
      from_mode: result.from_mode,
      to_mode: result.to_mode,
      event_type: result.action === 'promote' ? 'promotion' : 'demotion',
      trigger_reason: result.reason,
      trust_score_at_event: trustScore,
      thresholds_checked: result.thresholds_checked,
      thresholds_passed: result.thresholds_passed,
      requested_by: requestedBy,
    });

  // Also log to audit
  await supabase
    .from('ai_audit_logs')
    .insert({
      business_id: businessId,
      audit_type: 'graduation',
      payload: {
        from_mode: result.from_mode,
        to_mode: result.to_mode,
        action: result.action,
        reason: result.reason,
        thresholds: result.thresholds_checked,
      },
    });
}
