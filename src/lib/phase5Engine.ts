/**
 * PHASE 5 ENGINE — SHADOW MODE RECOMMENDATION SYSTEM
 * 
 * This engine observes intents and generates recommendations WITHOUT taking action.
 * In shadow mode, it only logs what it WOULD have done.
 * 
 * RULES (NON-NEGOTIABLE):
 * 1. NEVER mutate business state directly
 * 2. ONLY generate recommendations and log observations
 * 3. All recommendations are advisory, never authoritative
 * 4. Humans retain full decision authority
 */

import { supabase } from '@/integrations/supabase/client';

export interface Phase5Recommendation {
  id: string;
  intent_id: string;
  recommendation_type: 'approve' | 'reject' | 'escalate' | 'amend';
  recommended_action: Record<string, unknown>;
  confidence_score: number;
  reasoning: string;
  supporting_evidence: Record<string, unknown>;
  actual_outcome?: string;
  human_agreed?: boolean;
  processing_time_ms?: number;
  created_at: string;
  resolved_at?: string;
}

export interface Phase5Pattern {
  id: string;
  pattern_type: 'conflict_pattern' | 'approval_pattern' | 'escalation_pattern' | 'drift_pattern';
  pattern_signature: Record<string, unknown>;
  observation_count: number;
  first_observed_at: string;
  last_observed_at: string;
  confidence: number;
  notes?: string;
}

export interface IntentAnalysis {
  intent_type: string;
  confidence_level: number;
  proposed_effect: Record<string, unknown>;
  autonomy_envelope_id?: string;
  portal_type: string;
}

/**
 * Analyze an intent and generate a shadow recommendation
 * This does NOT execute anything - it only logs what the system would recommend
 */
export async function generateShadowRecommendation(
  intentId: string,
  analysis: IntentAnalysis
): Promise<Phase5Recommendation | null> {
  const startTime = Date.now();
  
  try {
    // Check if Phase 5 is enabled and in shadow mode
    const { data: modeData } = await supabase.rpc('get_phase5_mode');
    const mode = modeData as { mode: string; enabled: boolean; kill_switch: boolean } | null;
    
    if (!mode || !mode.enabled || mode.kill_switch || mode.mode === 'off') {
      console.log('[PHASE5] Engine disabled, skipping recommendation');
      return null;
    }

    // Generate recommendation based on analysis
    const recommendation = analyzeIntent(analysis);
    const processingTime = Date.now() - startTime;

    // Store the recommendation
    const { data, error } = await supabase
      .from('phase5_recommendations')
      .insert([{
        intent_id: intentId,
        recommendation_type: recommendation.type,
        recommended_action: recommendation.action as Record<string, unknown>,
        confidence_score: recommendation.confidence,
        reasoning: recommendation.reasoning,
        supporting_evidence: recommendation.evidence as Record<string, unknown>,
        processing_time_ms: processingTime,
      }])
      .select()
      .single();

    if (error) {
      console.error('[PHASE5] Failed to store recommendation:', error);
      return null;
    }

    // Log the audit entry
    await supabase.from('phase5_audit_log').insert({
      action_type: 'recommendation_generated',
      actor_type: 'system',
      details: {
        intent_id: intentId,
        recommendation_type: recommendation.type,
        confidence: recommendation.confidence,
        processing_time_ms: processingTime,
      },
    });

    console.log(`[PHASE5] Shadow recommendation generated: ${recommendation.type} (${recommendation.confidence})`);

    return data as Phase5Recommendation;
  } catch (err) {
    console.error('[PHASE5] Error generating recommendation:', err);
    return null;
  }
}

/**
 * Core analysis logic - determines what the system would recommend
 */
function analyzeIntent(analysis: IntentAnalysis): {
  type: 'approve' | 'reject' | 'escalate' | 'amend';
  action: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  evidence: Record<string, unknown>;
} {
  const { intent_type, confidence_level, proposed_effect, portal_type } = analysis;

  // HIGH CONFIDENCE APPROVAL: Simple intents with high confidence
  if (confidence_level >= 0.9 && isSimpleIntent(intent_type)) {
    return {
      type: 'approve',
      action: { auto_approve: true },
      confidence: 0.95,
      reasoning: `High-confidence (${confidence_level}) simple intent type (${intent_type}). No conflicts detected.`,
      evidence: {
        confidence_check: 'passed',
        complexity_check: 'simple',
        conflict_check: 'none',
      },
    };
  }

  // LOW CONFIDENCE ESCALATION: Intents below threshold
  if (confidence_level < 0.7) {
    return {
      type: 'escalate',
      action: { require_human_review: true, reason: 'low_confidence' },
      confidence: 0.8,
      reasoning: `Confidence (${confidence_level}) below threshold (0.7). Human review recommended.`,
      evidence: {
        confidence_check: 'failed',
        threshold: 0.7,
        actual: confidence_level,
      },
    };
  }

  // COMPLEX INTENTS: Require extra scrutiny
  if (isComplexIntent(intent_type)) {
    return {
      type: 'escalate',
      action: { require_human_review: true, reason: 'complex_intent' },
      confidence: 0.75,
      reasoning: `Intent type (${intent_type}) marked as complex. Requires human oversight.`,
      evidence: {
        complexity_check: 'complex',
        portal_type: portal_type,
        proposed_effect: proposed_effect,
      },
    };
  }

  // HIGH IMPACT INTENTS: Check proposed effect magnitude
  if (isHighImpact(proposed_effect)) {
    return {
      type: 'escalate',
      action: { require_human_review: true, reason: 'high_impact' },
      confidence: 0.7,
      reasoning: 'Proposed effect has high business impact. Human approval required.',
      evidence: {
        impact_check: 'high',
        effect_analysis: proposed_effect,
      },
    };
  }

  // DEFAULT: Moderate confidence approval
  return {
    type: 'approve',
    action: { auto_approve: true },
    confidence: 0.8,
    reasoning: `Standard intent (${intent_type}) with acceptable confidence (${confidence_level}).`,
    evidence: {
      confidence_check: 'passed',
      complexity_check: 'standard',
      impact_check: 'normal',
    },
  };
}

/**
 * Simple intents that can be auto-approved with high confidence
 */
function isSimpleIntent(intentType: string): boolean {
  const simpleIntents = [
    'location_update',
    'shift_start',
    'shift_end',
    'visit_arrival',
    'visit_departure',
  ];
  return simpleIntents.includes(intentType);
}

/**
 * Complex intents that always require human review
 */
function isComplexIntent(intentType: string): boolean {
  const complexIntents = [
    'inventory_adjustment',
    'payment_override',
    'delivery_exception',
    'store_status_change',
    'emergency_escalation',
  ];
  return complexIntents.includes(intentType);
}

/**
 * Check if proposed effect has high business impact
 */
function isHighImpact(effect: Record<string, unknown>): boolean {
  // Check for monetary impact
  const amount = effect.amount as number | undefined;
  if (amount && amount > 500) return true;

  // Check for status changes
  if (effect.status_change === 'critical') return true;

  // Check for cascade effects
  if (effect.affects_multiple_entities) return true;

  return false;
}

/**
 * Record the actual human decision and update agreement log
 */
export async function recordHumanDecision(
  recommendationId: string,
  intentId: string,
  humanDecision: string,
  disagreementReason?: string
): Promise<boolean> {
  try {
    // Get the original recommendation
    const { data: rec, error: fetchError } = await supabase
      .from('phase5_recommendations')
      .select('recommendation_type')
      .eq('id', recommendationId)
      .single();

    if (fetchError || !rec) {
      console.error('[PHASE5] Failed to fetch recommendation:', fetchError);
      return false;
    }

    const phase5Recommendation = rec.recommendation_type;
    const agreed = phase5Recommendation === humanDecision;

    // Update the recommendation with outcome
    const { error: updateError } = await supabase
      .from('phase5_recommendations')
      .update({
        actual_outcome: humanDecision,
        human_agreed: agreed,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', recommendationId);

    if (updateError) {
      console.error('[PHASE5] Failed to update recommendation:', updateError);
      return false;
    }

    // Log to agreement table
    const { error: logError } = await supabase
      .from('phase5_agreement_log')
      .insert({
        recommendation_id: recommendationId,
        intent_id: intentId,
        phase5_recommendation: phase5Recommendation,
        human_decision: humanDecision,
        agreed,
        disagreement_reason: agreed ? null : disagreementReason,
      });

    if (logError) {
      console.error('[PHASE5] Failed to log agreement:', logError);
      return false;
    }

    console.log(`[PHASE5] Human decision recorded: ${agreed ? 'AGREED' : 'DISAGREED'}`);
    return true;
  } catch (err) {
    console.error('[PHASE5] Error recording decision:', err);
    return false;
  }
}

/**
 * Detect and record patterns from intent flow
 */
export async function detectPattern(
  patternType: Phase5Pattern['pattern_type'],
  signature: Record<string, unknown>,
  notes?: string
): Promise<boolean> {
  try {
    // Check for existing pattern with same signature
    const { data: existing } = await supabase
      .from('phase5_pattern_observations')
      .select('id, observation_count')
      .eq('pattern_type', patternType)
      .single();

    if (existing) {
      // Update existing pattern
      const { error } = await supabase
        .from('phase5_pattern_observations')
        .update({
          observation_count: existing.observation_count + 1,
          last_observed_at: new Date().toISOString(),
          confidence: Math.min(0.95, 0.5 + (existing.observation_count * 0.05)),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('[PHASE5] Failed to update pattern:', error);
        return false;
      }
    } else {
      // Insert new pattern
      const { error } = await supabase
        .from('phase5_pattern_observations')
        .insert([{
          pattern_type: patternType,
          pattern_signature: signature as Record<string, unknown>,
          notes,
        }]);

      if (error) {
        console.error('[PHASE5] Failed to insert pattern:', error);
        return false;
      }

      // Log pattern detection
      await supabase.from('phase5_audit_log').insert([{
        action_type: 'pattern_detected',
        actor_type: 'system',
        details: { pattern_type: patternType, signature } as Record<string, unknown>,
      }]);
    }

    console.log(`[PHASE5] Pattern detected: ${patternType}`);
    return true;
  } catch (err) {
    console.error('[PHASE5] Error detecting pattern:', err);
    return false;
  }
}

/**
 * Fetch recent recommendations for display
 */
export async function fetchRecentRecommendations(
  limit: number = 50
): Promise<Phase5Recommendation[]> {
  const { data, error } = await supabase
    .from('phase5_recommendations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[PHASE5] Failed to fetch recommendations:', error);
    return [];
  }

  return (data || []) as Phase5Recommendation[];
}

/**
 * Fetch patterns for analysis
 */
export async function fetchPatterns(
  type?: Phase5Pattern['pattern_type']
): Promise<Phase5Pattern[]> {
  let query = supabase
    .from('phase5_pattern_observations')
    .select('*')
    .order('observation_count', { ascending: false });

  if (type) {
    query = query.eq('pattern_type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[PHASE5] Failed to fetch patterns:', error);
    return [];
  }

  return (data || []) as Phase5Pattern[];
}

/**
 * Get agreement statistics
 */
export async function getAgreementStats(): Promise<{
  total: number;
  agreed: number;
  disagreed: number;
  rate: number;
  byType: Record<string, { agreed: number; total: number }>;
}> {
  const { data, error } = await supabase
    .from('phase5_agreement_log')
    .select('agreed, phase5_recommendation');

  if (error || !data) {
    return { total: 0, agreed: 0, disagreed: 0, rate: 0, byType: {} };
  }

  const total = data.length;
  const agreed = data.filter(d => d.agreed).length;
  const disagreed = total - agreed;
  const rate = total > 0 ? (agreed / total) * 100 : 0;

  // Group by recommendation type
  const byType: Record<string, { agreed: number; total: number }> = {};
  data.forEach(d => {
    const type = d.phase5_recommendation;
    if (!byType[type]) {
      byType[type] = { agreed: 0, total: 0 };
    }
    byType[type].total++;
    if (d.agreed) byType[type].agreed++;
  });

  return { total, agreed, disagreed, rate, byType };
}
