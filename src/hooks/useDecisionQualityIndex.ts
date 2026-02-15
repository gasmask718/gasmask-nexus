// ═══════════════════════════════════════════════════════════════════════════════
// DECISION QUALITY INDEX HOOK — Phase 12: Read-Only Executive Scoring
// ═══════════════════════════════════════════════════════════════════════════════
// Evaluates past AI–Human decision quality across 5 dimensions WITHOUT
// judging outcomes alone. Decision quality ≠ outcome quality.
// No writes. No automation. No feedback loops. No recommendations.
// Fully removable without side effects.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { translateConfidence, ConfidenceCorrectionRule } from '@/lib/translateConfidence';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DQIGrade = 'Excellent' | 'Good' | 'Mixed' | 'Poor';

export interface DimensionScores {
  information_alignment: number;  // 0–25
  timeliness: number;             // 0–20
  judgment: number;               // 0–20
  execution_separation: number;   // 0–15
  outcome_consistency: number;    // 0–20
}

export interface DecisionQualityAssessment {
  store_id: string;
  store_name: string | null;
  decision_quality_index: number; // 0–100
  grade: DQIGrade;
  dimension_scores: DimensionScores;
  summary: string;
  flags: string[];
  context: {
    confidence_raw: number;
    confidence_displayed: number;
    confidence_corrected: boolean;
    human_action: 'applied' | 'dismissed' | 'ignored';
    sla_severity: string | null;
    risk_level: string | null;
    territory: string | null;
  };
  created_at: string;
}

export interface DQIBandBreakdown {
  range: string;
  count: number;
  avgDqi: number;
  excellent: number;
  good: number;
  mixed: number;
  poor: number;
}

export interface DQIContextSlice {
  label: string;
  count: number;
  avgDqi: number;
  avgGrade: DQIGrade;
  executionFailurePercent: number;
  decisionFailurePercent: number;
}

export interface DecisionQualityAnalysis {
  assessments: DecisionQualityAssessment[];
  totalAssessed: number;

  kpis: {
    avgDqi: number;
    excellentPercent: number;
    poorOutcomeFromExecution: number; // % of poor outcomes caused by execution, not decision
    avgTimelinessScore: number;
    totalAssessed: number;
  };

  gradeDistribution: {
    grade: DQIGrade;
    count: number;
    percent: number;
  }[];

  byConfidenceBand: DQIBandBreakdown[];
  byHumanAction: DQIContextSlice[];
  bySlaSeverity: DQIContextSlice[];
  byTerritory: DQIContextSlice[];

  dimensionAverages: {
    dimension: string;
    label: string;
    maxScore: number;
    avgScore: number;
    avgPercent: number;
  }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BAND_DEFS = [
  { range: '0–30', min: 0, max: 30 },
  { range: '31–50', min: 31, max: 50 },
  { range: '51–65', min: 51, max: 65 },
  { range: '66–75', min: 66, max: 75 },
  { range: '76–85', min: 76, max: 85 },
  { range: '86–100', min: 86, max: 100 },
] as const;

function gradeFromDqi(dqi: number): DQIGrade {
  if (dqi >= 90) return 'Excellent';
  if (dqi >= 75) return 'Good';
  if (dqi >= 55) return 'Mixed';
  return 'Poor';
}

// ─── Dimension Scorers ───────────────────────────────────────────────────────

/**
 * 1. Information Alignment (0–25)
 * Was the action aligned with available signals?
 */
function scoreInformationAlignment(
  confidenceRaw: number,
  confidenceCorrected: boolean,
  confidenceDisplayed: number,
  humanAction: 'applied' | 'dismissed' | 'ignored',
  slaSeverity: string | null,
  riskLevel: string | null
): number {
  let score = 12; // baseline

  // Signal consistency: high confidence + applied = aligned
  if (humanAction === 'applied') {
    if (confidenceRaw >= 70) score += 8;
    else if (confidenceRaw >= 50) score += 4;
    else score -= 2; // Applied low-confidence = questionable alignment
  } else if (humanAction === 'dismissed') {
    if (confidenceRaw < 50) score += 6; // Dismissed low-confidence = aligned
    else if (confidenceRaw >= 70) score -= 3; // Dismissed high-confidence = misalignment
    else score += 2;
  } else {
    // Ignored — generally not aligned
    score -= 4;
  }

  // Calibration awareness (using corrected confidence)
  if (confidenceCorrected) {
    const delta = Math.abs(confidenceDisplayed - confidenceRaw);
    if (delta > 10) score += 3; // System had meaningful correction, adds context
    else score += 1;
  }

  // Urgency context
  if (slaSeverity === 'critical' || riskLevel === 'high') {
    if (humanAction !== 'ignored') score += 2;
    else score -= 2;
  }

  return Math.max(0, Math.min(25, score));
}

/**
 * 2. Timeliness (0–20)
 * Was the decision made within a reasonable window given urgency?
 */
function scoreTimeliness(
  decisionLatencySeconds: number | null,
  slaSeverity: string | null
): number {
  if (decisionLatencySeconds === null) return 10; // Unknown, neutral

  const minutes = decisionLatencySeconds / 60;
  const isCritical = slaSeverity === 'critical';
  const isHigh = slaSeverity === 'high';

  // Thresholds vary by urgency
  if (isCritical) {
    if (minutes <= 5) return 20;
    if (minutes <= 15) return 16;
    if (minutes <= 30) return 12;
    if (minutes <= 60) return 8;
    return 4;
  }

  if (isHigh) {
    if (minutes <= 15) return 20;
    if (minutes <= 30) return 16;
    if (minutes <= 60) return 12;
    if (minutes <= 120) return 8;
    return 4;
  }

  // Standard
  if (minutes <= 30) return 20;
  if (minutes <= 60) return 16;
  if (minutes <= 120) return 12;
  if (minutes <= 240) return 8;
  return 4;
}

/**
 * 3. Human Judgment Appropriateness (0–20)
 * Did the human action make sense given uncertainty?
 */
function scoreJudgment(
  confidenceRaw: number,
  confidenceDisplayed: number,
  confidenceCorrected: boolean,
  humanAction: 'applied' | 'dismissed' | 'ignored',
  slaBreached: boolean,
  orderPlaced: boolean,
  deliveryCompleted: boolean
): number {
  let score = 10; // baseline

  const effectiveConf = confidenceCorrected ? confidenceDisplayed : confidenceRaw;

  if (humanAction === 'applied') {
    // Applied high-confidence = reasonable trust
    if (effectiveConf >= 70) score += 6;
    else if (effectiveConf >= 50) score += 3;
    // Applied low-confidence = risky but not inherently wrong
    else score += 0;

    // Reward disciplined trust when it worked
    if (orderPlaced || deliveryCompleted) score += 2;
  } else if (humanAction === 'dismissed') {
    // Dismissed low-confidence = reasonable caution
    if (effectiveConf < 50) score += 6;
    else if (effectiveConf < 70) score += 3;
    // Dismissed high-confidence = override, might be informed
    else score += 0;

    // Caution rewarded when SLA wasn't breached anyway
    if (!slaBreached) score += 2;
  } else {
    // Ignored — lack of engagement
    score -= 4;
    if (effectiveConf >= 70) score -= 2; // Ignoring high-confidence signal
  }

  return Math.max(0, Math.min(20, score));
}

/**
 * 4. Execution Separation (0–15)
 * Was outcome failure due to execution rather than decision?
 */
function scoreExecutionSeparation(
  humanAction: 'applied' | 'dismissed' | 'ignored',
  slaBreached: boolean,
  assignmentLagHours: number | null,
  arrivalDelayHours: number | null,
  deliveryCompleted: boolean
): { score: number; executionFailure: boolean } {
  // If no breach, full score — execution succeeded
  if (!slaBreached) return { score: 15, executionFailure: false };

  // If breach occurred, assess whether decision or execution failed
  let executionContribution = 0;

  // Significant assignment lag = execution issue
  if (assignmentLagHours !== null && assignmentLagHours > 2) executionContribution += 3;

  // Large arrival delay beyond assignment = routing/capacity issue
  if (arrivalDelayHours !== null && arrivalDelayHours > 2) executionContribution += 3;

  // Decision was applied (human acted) but still breached = likely execution
  if (humanAction === 'applied') executionContribution += 2;

  // Delivery eventually completed = partial execution success
  if (deliveryCompleted) executionContribution += 1;

  const isExecutionFailure = executionContribution >= 5;

  // High execution contribution → don't penalize decision
  const score = Math.min(15, 3 + executionContribution);

  return { score, executionFailure: isExecutionFailure };
}

/**
 * 5. Outcome Consistency Check (0–20)
 * Was reality directionally consistent with expectations?
 */
function scoreOutcomeConsistency(
  confidenceRaw: number,
  humanAction: 'applied' | 'dismissed' | 'ignored',
  orderPlaced: boolean,
  deliveryCompleted: boolean,
  slaBreached: boolean,
  followUpCreated: boolean
): number {
  let score = 10; // baseline

  const positiveOutcome = orderPlaced || deliveryCompleted;
  const negativeOutcome = slaBreached || followUpCreated;

  if (humanAction === 'applied') {
    // Applied + positive outcome = consistent expectation
    if (positiveOutcome && !negativeOutcome) score += 10;
    else if (positiveOutcome && negativeOutcome) score += 4; // mixed
    else if (!positiveOutcome && negativeOutcome) score -= 4; // divergence
    else score += 2; // neutral
  } else if (humanAction === 'dismissed') {
    // Dismissed + no negative outcome = consistent caution
    if (!negativeOutcome) score += 6;
    else if (positiveOutcome) score -= 2; // missed opportunity but not disaster
    else score += 2;
  } else {
    // Ignored — less coherence expected
    if (negativeOutcome) score -= 4;
    else score += 2;
  }

  // Extreme divergence flag
  if (confidenceRaw >= 80 && negativeOutcome && humanAction === 'applied') {
    score -= 4;
  }

  return Math.max(0, Math.min(20, score));
}

// ─── Narrative Generator ─────────────────────────────────────────────────────

function buildSummary(assessment: DecisionQualityAssessment): string {
  const { dimension_scores: ds, context: ctx } = assessment;
  const parts: string[] = [];

  const confLabel = ctx.confidence_corrected
    ? `${ctx.confidence_displayed}% (adjusted from ${ctx.confidence_raw}%)`
    : `${ctx.confidence_raw}%`;

  parts.push(`Decision at ${confLabel} confidence was ${ctx.human_action}.`);

  // Strongest dimension
  const dims = [
    { name: 'Information alignment', score: ds.information_alignment, max: 25 },
    { name: 'Timeliness', score: ds.timeliness, max: 20 },
    { name: 'Judgment', score: ds.judgment, max: 20 },
    { name: 'Execution separation', score: ds.execution_separation, max: 15 },
    { name: 'Outcome consistency', score: ds.outcome_consistency, max: 20 },
  ];

  const strongest = dims.reduce((a, b) => (a.score / a.max > b.score / b.max ? a : b));
  const weakest = dims.reduce((a, b) => (a.score / a.max < b.score / b.max ? a : b));

  parts.push(`Strongest dimension: ${strongest.name} (${Math.round((strongest.score / strongest.max) * 100)}%).`);

  if (weakest.score / weakest.max < 0.5) {
    parts.push(`Area of note: ${weakest.name} (${Math.round((weakest.score / weakest.max) * 100)}%).`);
  }

  return parts.join(' ');
}

function buildFlags(
  assessment: DecisionQualityAssessment,
  executionFailure: boolean
): string[] {
  const flags: string[] = [];
  const { dimension_scores: ds, context: ctx } = assessment;

  if (ctx.confidence_raw >= 70 && ds.outcome_consistency < 8) {
    flags.push('High confidence, low outcome consistency');
  }

  if (executionFailure) {
    flags.push('Outcome driven by execution factors, not decision quality');
  }

  if (ds.timeliness < 8 && (ctx.sla_severity === 'critical' || ctx.sla_severity === 'high')) {
    flags.push('Decision latency exceeded urgency threshold');
  }

  if (ctx.human_action === 'ignored') {
    flags.push('AI suggestion was not engaged with');
  }

  if (ds.judgment >= 16 && assessment.decision_quality_index < 55) {
    flags.push('Good judgment undermined by external factors');
  }

  return flags;
}

// ─── Aggregation Helpers ─────────────────────────────────────────────────────

function computeContextSlice(
  assessments: DecisionQualityAssessment[],
  label: string
): DQIContextSlice {
  const count = assessments.length;
  const avgDqi = count > 0
    ? Math.round(assessments.reduce((s, a) => s + a.decision_quality_index, 0) / count)
    : 0;

  const executionFlags = assessments.filter(a =>
    a.flags.some(f => f.includes('execution factors'))
  ).length;
  const poorOutcomes = assessments.filter(a => a.grade === 'Poor').length;

  return {
    label,
    count,
    avgDqi,
    avgGrade: gradeFromDqi(avgDqi),
    executionFailurePercent: count > 0 ? Math.round((executionFlags / count) * 100) : 0,
    decisionFailurePercent: poorOutcomes > 0 && count > 0
      ? Math.round(((poorOutcomes - executionFlags) / count) * 100)
      : 0,
  };
}

// ─── Main Hook ───────────────────────────────────────────────────────────────

export function useDecisionQualityIndex() {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ['decision-quality-index'],
    queryFn: async (): Promise<DecisionQualityAnalysis> => {
      // 1. Fetch feedback
      const { data: feedback } = await supabase
        .from('ai_dispatch_feedback')
        .select('*')
        .in('event_type', ['applied', 'dismissed', 'ignored'])
        .order('created_at', { ascending: false })
        .limit(1000);

      // 2. Fetch approved corrections (Phase 8)
      const { data: corrections } = await supabase
        .from('ai_confidence_corrections')
        .select('*')
        .eq('status', 'approved');

      const correctionRules: ConfidenceCorrectionRule[] = (corrections || []).map(c => ({
        id: c.id,
        scope_type: c.scope_type as ConfidenceCorrectionRule['scope_type'],
        scope_value: c.scope_value,
        confidence_min: c.confidence_min,
        confidence_max: c.confidence_max,
        display_offset: c.display_offset,
      }));

      const items = feedback || [];
      const storeIds = [...new Set(items.map((f: any) => f.store_id).filter(Boolean))];

      // 3. Fetch downstream data
      let routeStopsByStore = new Map<string, any[]>();
      let ordersByStore = new Map<string, any[]>();
      let followUpsByStore = new Map<string, any[]>();

      if (storeIds.length > 0) {
        const slice = storeIds.slice(0, 100);
        const [stopsRes, ordersRes, followUpsRes] = await Promise.all([
          supabase.from('route_stops')
            .select('store_id, status, was_on_time, created_at, arrived_at, completed_at')
            .in('store_id', slice).order('created_at', { ascending: false }).limit(500),
          supabase.from('store_orders')
            .select('store_id, status, delivered_at, created_at')
            .in('store_id', slice).order('created_at', { ascending: false }).limit(500),
          supabase.from('follow_up_queue')
            .select('store_id, status, created_at')
            .in('store_id', slice).order('created_at', { ascending: false }).limit(500),
        ]);

        (stopsRes.data || []).forEach((s: any) => {
          if (!routeStopsByStore.has(s.store_id)) routeStopsByStore.set(s.store_id, []);
          routeStopsByStore.get(s.store_id)!.push(s);
        });
        (ordersRes.data || []).forEach((o: any) => {
          if (!ordersByStore.has(o.store_id)) ordersByStore.set(o.store_id, []);
          ordersByStore.get(o.store_id)!.push(o);
        });
        (followUpsRes.data || []).forEach((f: any) => {
          if (!followUpsByStore.has(f.store_id)) followUpsByStore.set(f.store_id, []);
          followUpsByStore.get(f.store_id)!.push(f);
        });
      }

      // 4. Score each decision
      const assessments: DecisionQualityAssessment[] = [];

      for (const f of items) {
        const feedbackDate = new Date(f.created_at);
        const windowEnd = new Date(feedbackDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        const translated = translateConfidence(
          f.confidence || 0,
          { sla: f.sla_severity, risk: f.risk_level, territory: f.territory },
          correctionRules
        );

        const storeStops = (routeStopsByStore.get(f.store_id) || [])
          .filter((s: any) => new Date(s.created_at) >= feedbackDate && new Date(s.created_at) <= windowEnd);
        const storeOrders = (ordersByStore.get(f.store_id) || [])
          .filter((o: any) => new Date(o.created_at) >= feedbackDate && new Date(o.created_at) <= windowEnd);
        const storeFollowUps = (followUpsByStore.get(f.store_id) || [])
          .filter((fu: any) => new Date(fu.created_at) >= feedbackDate && new Date(fu.created_at) <= windowEnd);

        const deliveryCompleted = storeStops.some((s: any) => s.status === 'completed');
        const orderPlaced = storeOrders.length > 0;
        const slaBreached = storeStops.some((s: any) => s.was_on_time === false);
        const followUpCreated = storeFollowUps.length > 0;

        const routeAssigned = storeStops[0]?.created_at ? new Date(storeStops[0].created_at) : null;
        const arrivalTime = storeStops[0]?.arrived_at ? new Date(storeStops[0].arrived_at) : null;
        const assignmentLagHours = routeAssigned
          ? Math.round(((routeAssigned.getTime() - feedbackDate.getTime()) / (1000 * 60 * 60)) * 10) / 10
          : null;
        const arrivalDelayHours = arrivalTime
          ? Math.round(((arrivalTime.getTime() - feedbackDate.getTime()) / (1000 * 60 * 60) - 4) * 10) / 10
          : null;

        const humanAction = f.event_type as 'applied' | 'dismissed' | 'ignored';

        // Score dimensions
        const information_alignment = scoreInformationAlignment(
          f.confidence || 0, translated.corrected, translated.displayed,
          humanAction, f.sla_severity, f.risk_level
        );

        const timeliness = scoreTimeliness(f.decision_latency_seconds, f.sla_severity);

        const judgment = scoreJudgment(
          f.confidence || 0, translated.displayed, translated.corrected,
          humanAction, slaBreached, orderPlaced, deliveryCompleted
        );

        const { score: execution_separation, executionFailure } = scoreExecutionSeparation(
          humanAction, slaBreached, assignmentLagHours, arrivalDelayHours, deliveryCompleted
        );

        const outcome_consistency = scoreOutcomeConsistency(
          f.confidence || 0, humanAction, orderPlaced, deliveryCompleted, slaBreached, followUpCreated
        );

        const dqi = information_alignment + timeliness + judgment + execution_separation + outcome_consistency;
        const grade = gradeFromDqi(dqi);

        const assessment: DecisionQualityAssessment = {
          store_id: f.store_id,
          store_name: f.store_name,
          decision_quality_index: dqi,
          grade,
          dimension_scores: {
            information_alignment,
            timeliness,
            judgment,
            execution_separation,
            outcome_consistency,
          },
          summary: '', // filled below
          flags: [],
          context: {
            confidence_raw: f.confidence || 0,
            confidence_displayed: translated.displayed,
            confidence_corrected: translated.corrected,
            human_action: humanAction,
            sla_severity: f.sla_severity || null,
            risk_level: f.risk_level || null,
            territory: f.territory || null,
          },
          created_at: f.created_at,
        };

        assessment.summary = buildSummary(assessment);
        assessment.flags = buildFlags(assessment, executionFailure);
        assessments.push(assessment);
      }

      // 5. Aggregate analytics
      const totalAssessed = assessments.length;
      const avgDqi = totalAssessed > 0
        ? Math.round(assessments.reduce((s, a) => s + a.decision_quality_index, 0) / totalAssessed)
        : 0;
      const excellentCount = assessments.filter(a => a.grade === 'Excellent').length;
      const executionCaused = assessments.filter(a =>
        a.flags.some(f => f.includes('execution factors'))
      ).length;
      const avgTimeliness = totalAssessed > 0
        ? Math.round((assessments.reduce((s, a) => s + a.dimension_scores.timeliness, 0) / totalAssessed) * 10) / 10
        : 0;

      const kpis = {
        avgDqi,
        excellentPercent: totalAssessed > 0 ? Math.round((excellentCount / totalAssessed) * 100) : 0,
        poorOutcomeFromExecution: totalAssessed > 0 ? Math.round((executionCaused / totalAssessed) * 100) : 0,
        avgTimelinessScore: avgTimeliness,
        totalAssessed,
      };

      // Grade distribution
      const grades: DQIGrade[] = ['Excellent', 'Good', 'Mixed', 'Poor'];
      const gradeDistribution = grades.map(g => {
        const count = assessments.filter(a => a.grade === g).length;
        return { grade: g, count, percent: totalAssessed > 0 ? Math.round((count / totalAssessed) * 100) : 0 };
      });

      // By confidence band
      const byConfidenceBand: DQIBandBreakdown[] = BAND_DEFS.map(def => {
        const inBand = assessments.filter(a =>
          a.context.confidence_raw >= def.min && a.context.confidence_raw <= def.max
        );
        return {
          range: def.range,
          count: inBand.length,
          avgDqi: inBand.length > 0
            ? Math.round(inBand.reduce((s, a) => s + a.decision_quality_index, 0) / inBand.length)
            : 0,
          excellent: inBand.filter(a => a.grade === 'Excellent').length,
          good: inBand.filter(a => a.grade === 'Good').length,
          mixed: inBand.filter(a => a.grade === 'Mixed').length,
          poor: inBand.filter(a => a.grade === 'Poor').length,
        };
      });

      // By human action
      const actions = ['applied', 'dismissed', 'ignored'] as const;
      const byHumanAction = actions.map(action => {
        const subset = assessments.filter(a => a.context.human_action === action);
        return computeContextSlice(subset, action.charAt(0).toUpperCase() + action.slice(1));
      });

      // By SLA severity
      const slaValues = [...new Set(assessments.map(a => a.context.sla_severity).filter(Boolean))] as string[];
      const bySlaSeverity = slaValues.map(sla => {
        const subset = assessments.filter(a => a.context.sla_severity === sla);
        return computeContextSlice(subset, sla);
      });

      // By territory
      const territoryValues = [...new Set(assessments.map(a => a.context.territory).filter(Boolean))] as string[];
      const byTerritory = territoryValues.map(t => {
        const subset = assessments.filter(a => a.context.territory === t);
        return computeContextSlice(subset, t);
      }).filter(s => s.count >= 3); // Minimum sample threshold

      // Dimension averages
      const dimensionAverages = [
        { dimension: 'information_alignment', label: 'Information Alignment', maxScore: 25 },
        { dimension: 'timeliness', label: 'Timeliness', maxScore: 20 },
        { dimension: 'judgment', label: 'Judgment', maxScore: 20 },
        { dimension: 'execution_separation', label: 'Execution Separation', maxScore: 15 },
        { dimension: 'outcome_consistency', label: 'Outcome Consistency', maxScore: 20 },
      ].map(dim => {
        const avg = totalAssessed > 0
          ? assessments.reduce((s, a) => s + a.dimension_scores[dim.dimension as keyof DimensionScores], 0) / totalAssessed
          : 0;
        return {
          ...dim,
          avgScore: Math.round(avg * 10) / 10,
          avgPercent: Math.round((avg / dim.maxScore) * 100),
        };
      });

      return {
        assessments,
        totalAssessed,
        kpis,
        gradeDistribution,
        byConfidenceBand,
        byHumanAction,
        bySlaSeverity,
        byTerritory,
        dimensionAverages,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return { analysis: analysis ?? null, isLoading };
}
