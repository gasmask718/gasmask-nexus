// ═══════════════════════════════════════════════════════════════════════════════
// COUNTERFACTUAL SIMULATION HOOK — Phase 11: Read-Only Hypothetical Analysis
// ═══════════════════════════════════════════════════════════════════════════════
// Simulates single-variable "what if" scenarios for past AI dispatch decisions.
// Built on Phase 9 attribution + Phase 10 breach data.
// No writes. No automation. No feedback loops. No recommendations.
// Fully removable without side effects.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { translateConfidence, ConfidenceCorrectionRule } from '@/lib/translateConfidence';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChangedVariable =
  | 'human_decision_time'
  | 'route_assignment_time'
  | 'capacity_availability'
  | 'routing_efficiency'
  | 'human_action';

export type ExpectedOutcome =
  | 'on_time_delivery'
  | 'reduced_delay'
  | 'no_change'
  | 'worse_outcome';

export type Likelihood = 'low' | 'medium' | 'high';

export interface CounterfactualScenario {
  scenario_label: string;
  changed_variable: ChangedVariable;
  original_state: string;
  simulated_state: string;
  expected_outcome: ExpectedOutcome;
  likelihood: Likelihood;
  rationale: string;
}

export interface CounterfactualCase {
  store_id: string;
  store_name: string | null;
  confidence_raw: number;
  confidence_displayed: number;
  confidence_corrected: boolean;
  human_action: 'applied' | 'dismissed' | 'ignored';
  sla_severity: string | null;
  risk_level: string | null;
  territory: string | null;
  decision_latency_seconds: number | null;
  route_assignment_lag_hours: number | null;
  arrival_delay_hours: number | null;
  breach_type: string | null;
  scenarios: CounterfactualScenario[];
  created_at: string;
}

export interface CounterfactualAggregate {
  variable: ChangedVariable;
  label: string;
  likelyPreventable: number;
  likelyUnchanged: number;
  indeterminate: number;
  total: number;
  preventablePercent: number;
}

export interface CounterfactualAnalysis {
  cases: CounterfactualCase[];
  totalCases: number;

  kpis: {
    totalBreachesAnalyzed: number;
    likelyPreventablePercent: number;
    topLeveragePoint: string;
    indeterminatePercent: number;
  };

  aggregates: CounterfactualAggregate[];

  byConfidenceBand: {
    range: string;
    total: number;
    preventable: number;
    sensitivity: number; // % of cases where at least one scenario suggests improvement
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

const VARIABLE_LABELS: Record<ChangedVariable, string> = {
  human_decision_time: 'Faster Human Decision',
  route_assignment_time: 'Earlier Route Assignment',
  capacity_availability: 'More Capacity Available',
  routing_efficiency: 'Better Routing Timing',
  human_action: 'Different Human Action',
};

// ─── Scenario Generators ─────────────────────────────────────────────────────
// Each generator evaluates one variable change and produces a scenario if applicable.

function simulateHumanDecisionTime(
  decisionLatency: number | null,
  arrivalDelay: number | null
): CounterfactualScenario | null {
  if (!decisionLatency || decisionLatency <= 120) return null; // Already fast

  const currentMins = Math.round(decisionLatency / 60);
  const reducedMins = Math.max(30, Math.round(currentMins * 0.3));
  const savedHours = (decisionLatency - reducedMins * 60) / 3600;

  const couldHelp = arrivalDelay !== null && savedHours > arrivalDelay * 0.3;

  return {
    scenario_label: 'What if the human decided faster?',
    changed_variable: 'human_decision_time',
    original_state: `Decision took ${currentMins} minutes`,
    simulated_state: `Decision in ~${reducedMins} minutes (70% faster)`,
    expected_outcome: couldHelp ? 'reduced_delay' : 'no_change',
    likelihood: couldHelp ? (savedHours > arrivalDelay! * 0.6 ? 'high' : 'medium') : 'low',
    rationale: couldHelp
      ? `A ${currentMins - reducedMins} minute faster decision could have recovered ~${savedHours.toFixed(1)} hours, potentially reducing the ${arrivalDelay?.toFixed(1)}h delay.`
      : `Even with faster decision-making, the ${arrivalDelay?.toFixed(1) || 'observed'}h delay was primarily caused by downstream factors.`,
  };
}

function simulateRouteAssignment(
  assignmentLagHours: number | null,
  arrivalDelay: number | null
): CounterfactualScenario | null {
  if (!assignmentLagHours || assignmentLagHours <= 1) return null;

  const reducedLag = Math.max(0.5, assignmentLagHours * 0.4);
  const savedHours = assignmentLagHours - reducedLag;

  const couldHelp = arrivalDelay !== null && savedHours > arrivalDelay * 0.25;

  return {
    scenario_label: 'What if the route was assigned earlier?',
    changed_variable: 'route_assignment_time',
    original_state: `Route assigned ${assignmentLagHours.toFixed(1)}h after decision`,
    simulated_state: `Route assigned in ~${reducedLag.toFixed(1)}h (60% faster)`,
    expected_outcome: couldHelp ? 'on_time_delivery' : savedHours > 0.5 ? 'reduced_delay' : 'no_change',
    likelihood: couldHelp ? 'high' : savedHours > 1 ? 'medium' : 'low',
    rationale: couldHelp
      ? `Reducing assignment lag by ${savedHours.toFixed(1)}h could have placed arrival within the SLA window.`
      : `Earlier assignment would have saved ~${savedHours.toFixed(1)}h, but other factors contributed to the delay.`,
  };
}

function simulateCapacityAvailability(
  assignmentLagHours: number | null,
  arrivalDelay: number | null,
  breachType: string | null
): CounterfactualScenario | null {
  // Only relevant if there was significant assignment lag (capacity bottleneck signal)
  if (!assignmentLagHours || assignmentLagHours <= 2) return null;

  const isCapacityIssue = breachType === 'capacity_delay' || assignmentLagHours > 3;
  if (!isCapacityIssue) return null;

  return {
    scenario_label: 'What if more capacity was available?',
    changed_variable: 'capacity_availability',
    original_state: `${assignmentLagHours.toFixed(1)}h assignment lag suggests capacity constraint`,
    simulated_state: 'Adequate driver/biker capacity at time of decision',
    expected_outcome: arrivalDelay && arrivalDelay > 2 ? 'on_time_delivery' : 'reduced_delay',
    likelihood: assignmentLagHours > 4 ? 'high' : 'medium',
    rationale: `The ${assignmentLagHours.toFixed(1)}h gap between decision and route assignment indicates a capacity bottleneck. With available capacity, assignment could have occurred within 1h.`,
  };
}

function simulateRoutingEfficiency(
  assignmentLagHours: number | null,
  arrivalDelay: number | null,
  breachType: string | null
): CounterfactualScenario | null {
  if (!arrivalDelay || arrivalDelay <= 1) return null;
  if (breachType === 'missed_visit') return null; // Routing wasn't the issue

  // Only applies if route was assigned but arrival was still late
  if (assignmentLagHours !== null && assignmentLagHours <= 2 && arrivalDelay > 1.5) {
    return {
      scenario_label: 'What if routing was more efficient?',
      changed_variable: 'routing_efficiency',
      original_state: `Route assigned promptly but arrival was ${arrivalDelay.toFixed(1)}h late`,
      simulated_state: 'Optimized routing reducing transit time by ~40%',
      expected_outcome: arrivalDelay < 3 ? 'on_time_delivery' : 'reduced_delay',
      likelihood: arrivalDelay < 3 ? 'medium' : 'low',
      rationale: `Despite timely assignment, the ${arrivalDelay.toFixed(1)}h delay suggests route inefficiency. More direct routing could have reduced transit time.`,
    };
  }

  return null;
}

function simulateHumanAction(
  humanAction: 'applied' | 'dismissed' | 'ignored',
  confidenceRaw: number,
  arrivalDelay: number | null,
  breachType: string | null
): CounterfactualScenario | null {
  if (humanAction === 'applied') {
    // What if they had dismissed?
    if (confidenceRaw < 50) {
      return {
        scenario_label: 'What if the suggestion was dismissed instead?',
        changed_variable: 'human_action',
        original_state: `Suggestion applied at ${confidenceRaw}% confidence`,
        simulated_state: 'Suggestion dismissed, manual decision made',
        expected_outcome: breachType === 'late_arrival' ? 'reduced_delay' : 'no_change',
        likelihood: 'low',
        rationale: `At ${confidenceRaw}% confidence, the AI's suggestion carried uncertainty. A manual override may have selected a different approach, but outcomes are indeterminate.`,
      };
    }
    return null;
  }

  // Dismissed or ignored — what if they had applied?
  if (humanAction === 'dismissed' || humanAction === 'ignored') {
    return {
      scenario_label: `What if the suggestion was applied instead of ${humanAction}?`,
      changed_variable: 'human_action',
      original_state: `Suggestion ${humanAction} at ${confidenceRaw}% confidence`,
      simulated_state: 'Suggestion applied as recommended by AI',
      expected_outcome: confidenceRaw >= 70 ? 'reduced_delay' : 'no_change',
      likelihood: confidenceRaw >= 70 ? 'medium' : 'low',
      rationale: confidenceRaw >= 70
        ? `The AI had ${confidenceRaw}% confidence. Applying the suggestion may have led to earlier action, potentially reducing delay.`
        : `At ${confidenceRaw}% confidence, applying the suggestion had uncertain value. Outcome change is indeterminate.`,
    };
  }

  return null;
}

// ─── Main Hook ───────────────────────────────────────────────────────────────

export function useCounterfactualSimulation() {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ['counterfactual-simulation'],
    queryFn: async (): Promise<CounterfactualAnalysis> => {
      // 1. Fetch feedback events
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
      let followUpsByStore = new Map<string, any[]>();

      if (storeIds.length > 0) {
        const slice = storeIds.slice(0, 100);
        const [stopsRes, followUpsRes] = await Promise.all([
          supabase
            .from('route_stops')
            .select('store_id, route_id, status, was_on_time, created_at, arrived_at, completed_at')
            .in('store_id', slice)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('follow_up_queue')
            .select('store_id, status, created_at')
            .in('store_id', slice)
            .order('created_at', { ascending: false })
            .limit(500),
        ]);

        (stopsRes.data || []).forEach((s: any) => {
          if (!routeStopsByStore.has(s.store_id)) routeStopsByStore.set(s.store_id, []);
          routeStopsByStore.get(s.store_id)!.push(s);
        });
        (followUpsRes.data || []).forEach((f: any) => {
          if (!followUpsByStore.has(f.store_id)) followUpsByStore.set(f.store_id, []);
          followUpsByStore.get(f.store_id)!.push(f);
        });
      }

      // 4. Build counterfactual cases (only for breach/negative outcomes)
      const cases: CounterfactualCase[] = [];

      for (const f of items) {
        const feedbackDate = new Date(f.created_at);
        const windowEnd = new Date(feedbackDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        const storeStops = (routeStopsByStore.get(f.store_id) || [])
          .filter((s: any) => {
            const d = new Date(s.created_at);
            return d >= feedbackDate && d <= windowEnd;
          });

        const storeFollowUps = (followUpsByStore.get(f.store_id) || [])
          .filter((fu: any) => {
            const d = new Date(fu.created_at);
            return d >= feedbackDate && d <= windowEnd;
          });

        // Only include breach cases
        const lateStop = storeStops.find((s: any) => s.was_on_time === false);
        const missedStop = storeStops.find((s: any) => s.status === 'skipped' || s.status === 'cancelled');
        const hasFollowUp = storeFollowUps.length > 0;
        const noStopAtAll = storeStops.length === 0 && f.event_type === 'applied';

        if (!lateStop && !missedStop && !hasFollowUp && !noStopAtAll) continue;

        const breachStop = lateStop || missedStop || storeStops[0] || null;
        const translated = translateConfidence(
          f.confidence || 0,
          { sla: f.sla_severity, risk: f.risk_level, territory: f.territory },
          correctionRules
        );

        // Compute timing metrics
        const routeAssigned = breachStop?.created_at ? new Date(breachStop.created_at) : null;
        const arrivalTime = breachStop?.arrived_at ? new Date(breachStop.arrived_at) : null;
        const completedAt = breachStop?.completed_at ? new Date(breachStop.completed_at) : null;

        const assignmentLagHours = routeAssigned
          ? Math.round(((routeAssigned.getTime() - feedbackDate.getTime()) / (1000 * 60 * 60)) * 10) / 10
          : null;

        const actualEnd = completedAt || arrivalTime;
        const expectedSlaHours = 4;
        const arrivalDelayHours = actualEnd
          ? Math.round(((actualEnd.getTime() - feedbackDate.getTime()) / (1000 * 60 * 60) - expectedSlaHours) * 10) / 10
          : null;

        // Determine breach type
        let breachType: string | null = null;
        if (missedStop || noStopAtAll) breachType = 'missed_visit';
        else if (lateStop) breachType = 'late_arrival';
        else if (assignmentLagHours && assignmentLagHours > 3) breachType = 'capacity_delay';

        // Generate counterfactual scenarios (max 3)
        const allScenarios: CounterfactualScenario[] = [];

        const s1 = simulateHumanDecisionTime(f.decision_latency_seconds, arrivalDelayHours);
        if (s1) allScenarios.push(s1);

        const s2 = simulateRouteAssignment(assignmentLagHours, arrivalDelayHours);
        if (s2) allScenarios.push(s2);

        const s3 = simulateCapacityAvailability(assignmentLagHours, arrivalDelayHours, breachType);
        if (s3) allScenarios.push(s3);

        const s4 = simulateRoutingEfficiency(assignmentLagHours, arrivalDelayHours, breachType);
        if (s4) allScenarios.push(s4);

        const s5 = simulateHumanAction(
          f.event_type as 'applied' | 'dismissed' | 'ignored',
          f.confidence || 0,
          arrivalDelayHours,
          breachType
        );
        if (s5) allScenarios.push(s5);

        // Take top 3 most impactful (prioritize high likelihood)
        const likelihoodOrder: Record<Likelihood, number> = { high: 3, medium: 2, low: 1 };
        const scenarios = allScenarios
          .sort((a, b) => likelihoodOrder[b.likelihood] - likelihoodOrder[a.likelihood])
          .slice(0, 3);

        if (scenarios.length === 0) continue;

        cases.push({
          store_id: f.store_id,
          store_name: f.store_name,
          confidence_raw: f.confidence || 0,
          confidence_displayed: translated.displayed,
          confidence_corrected: translated.corrected,
          human_action: f.event_type as 'applied' | 'dismissed' | 'ignored',
          sla_severity: f.sla_severity || null,
          risk_level: f.risk_level || null,
          territory: f.territory || null,
          decision_latency_seconds: f.decision_latency_seconds || null,
          route_assignment_lag_hours: assignmentLagHours,
          arrival_delay_hours: arrivalDelayHours,
          breach_type: breachType,
          scenarios,
          created_at: f.created_at,
        });
      }

      // 5. Aggregate analysis
      const allScenarios = cases.flatMap(c => c.scenarios);
      const preventableScenarios = allScenarios.filter(
        s => (s.expected_outcome === 'on_time_delivery' || s.expected_outcome === 'reduced_delay') &&
             s.likelihood !== 'low'
      );

      // By variable
      const variableKeys: ChangedVariable[] = [
        'human_decision_time',
        'route_assignment_time',
        'capacity_availability',
        'routing_efficiency',
        'human_action',
      ];

      const aggregates: CounterfactualAggregate[] = variableKeys.map(v => {
        const forVar = allScenarios.filter(s => s.changed_variable === v);
        const preventable = forVar.filter(
          s => (s.expected_outcome === 'on_time_delivery' || s.expected_outcome === 'reduced_delay') &&
               s.likelihood !== 'low'
        );
        const unchanged = forVar.filter(s => s.expected_outcome === 'no_change' || s.likelihood === 'low');
        const indeterminate = forVar.filter(s => s.expected_outcome === 'worse_outcome');

        return {
          variable: v,
          label: VARIABLE_LABELS[v],
          likelyPreventable: preventable.length,
          likelyUnchanged: unchanged.length,
          indeterminate: indeterminate.length,
          total: forVar.length,
          preventablePercent: forVar.length > 0
            ? Math.round((preventable.length / forVar.length) * 1000) / 10
            : 0,
        };
      }).filter(a => a.total > 0).sort((a, b) => b.preventablePercent - a.preventablePercent);

      // By confidence band
      const byConfidenceBand = BAND_DEFS.map(def => {
        const inBand = cases.filter(c => c.confidence_raw >= def.min && c.confidence_raw <= def.max);
        const preventableInBand = inBand.filter(c =>
          c.scenarios.some(s =>
            (s.expected_outcome === 'on_time_delivery' || s.expected_outcome === 'reduced_delay') &&
            s.likelihood !== 'low'
          )
        );

        return {
          range: def.range,
          total: inBand.length,
          preventable: preventableInBand.length,
          sensitivity: inBand.length > 0
            ? Math.round((preventableInBand.length / inBand.length) * 1000) / 10
            : 0,
        };
      });

      // KPIs
      const casesWithPreventable = cases.filter(c =>
        c.scenarios.some(s =>
          (s.expected_outcome === 'on_time_delivery' || s.expected_outcome === 'reduced_delay') &&
          s.likelihood !== 'low'
        )
      );

      const casesIndeterminate = cases.filter(c =>
        c.scenarios.every(s => s.likelihood === 'low' || s.expected_outcome === 'no_change')
      );

      const topLeverage = aggregates.length > 0 ? aggregates[0].label : 'N/A';

      return {
        cases,
        totalCases: cases.length,
        kpis: {
          totalBreachesAnalyzed: cases.length,
          likelyPreventablePercent: cases.length > 0
            ? Math.round((casesWithPreventable.length / cases.length) * 1000) / 10
            : 0,
          topLeveragePoint: topLeverage,
          indeterminatePercent: cases.length > 0
            ? Math.round((casesIndeterminate.length / cases.length) * 1000) / 10
            : 0,
        },
        aggregates,
        byConfidenceBand,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return { analysis: analysis ?? null, isLoading };
}
