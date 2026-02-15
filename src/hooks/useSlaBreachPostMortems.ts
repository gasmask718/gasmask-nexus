// ═══════════════════════════════════════════════════════════════════════════════
// SLA BREACH POST-MORTEMS HOOK — Phase 10: Read-Only Forensic Analysis
// ═══════════════════════════════════════════════════════════════════════════════
// Builds narrative timelines on top of Phase 9 attribution data.
// Identifies WHERE and WHY SLA breaches occurred in the execution chain.
// No writes. No automation. No feedback loops. Fully removable.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { translateConfidence, ConfidenceCorrectionRule } from '@/lib/translateConfidence';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BreachType = 'late_arrival' | 'missed_visit' | 'capacity_delay' | 'unknown';
export type PrimaryCause = 'routing' | 'capacity' | 'store_closed' | 'human_delay' | 'external';
export type BreakPoint = 'before_route' | 'during_route' | 'after_arrival';

export interface SlaPostMortem {
  store_id: string;
  store_name: string | null;
  route_id: string | null;

  ai_context: {
    confidence_raw: number;
    confidence_displayed: number;
    confidence_corrected: boolean;
    human_action: 'applied' | 'dismissed' | 'ignored';
    decision_latency_seconds: number | null;
  };

  expectation: {
    implied_outcome: 'on_time_delivery' | 'order' | 'follow_up';
    sla_severity: string | null;
    risk_level: string | null;
  };

  actual_timeline: {
    decision_time: string;
    route_assigned_at: string | null;
    arrival_time: string | null;
    delivery_completed_at: string | null;
    order_placed_at: string | null;
    follow_up_created_at: string | null;
  };

  breach_analysis: {
    breach_type: BreachType;
    primary_cause: PrimaryCause;
    contributing_factors: string[];
  };

  delta_analysis: {
    expected_vs_actual_hours: number | null;
    where_it_broke: BreakPoint;
  };

  narrative: string;
  created_at: string;
}

export interface RootCauseBreakdown {
  cause: PrimaryCause;
  label: string;
  count: number;
  percentage: number;
}

export interface BreachByConfidenceBand {
  range: string;
  total: number;
  applied: number;
  dismissed: number;
  avgDelayHours: number;
}

export interface SlaBreachAnalysis {
  cases: SlaPostMortem[];
  totalBreaches: number;

  kpis: {
    totalAnalyzed: number;
    highConfidenceBreachPercent: number;
    avgDelayHours: number;
    topRootCause: string;
  };

  rootCauses: RootCauseBreakdown[];
  byConfidenceBand: BreachByConfidenceBand[];

  bySlaSeverity: { label: string; count: number; avgDelay: number }[];
  byTerritory: { label: string; count: number; avgDelay: number }[];
  byHumanAction: { label: string; count: number; avgDelay: number }[];

  falseTrustSignals: SlaPostMortem[];

  delayStats: {
    avgHours: number;
    medianHours: number;
    p90Hours: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferBreachType(stop: any, followUp: any): BreachType {
  if (stop && stop.was_on_time === false && stop.status === 'completed') return 'late_arrival';
  if (!stop || stop.status === 'skipped' || stop.status === 'cancelled') return 'missed_visit';
  if (followUp) return 'capacity_delay';
  return 'unknown';
}

function inferPrimaryCause(
  decisionTime: Date,
  routeAssigned: Date | null,
  arrivalTime: Date | null,
  decisionLatency: number | null
): PrimaryCause {
  // If route was assigned very late after decision → human delay
  if (routeAssigned) {
    const assignmentLag = (routeAssigned.getTime() - decisionTime.getTime()) / (1000 * 60 * 60);
    if (assignmentLag > 4) return 'human_delay';
    if (assignmentLag > 2) return 'capacity';
  } else {
    // No route assigned at all
    if (decisionLatency && decisionLatency > 300) return 'human_delay';
    return 'capacity';
  }

  // If arrival was late after assignment → routing issue
  if (routeAssigned && arrivalTime) {
    const transitHours = (arrivalTime.getTime() - routeAssigned.getTime()) / (1000 * 60 * 60);
    if (transitHours > 3) return 'routing';
  }

  return 'external';
}

function inferBreakPoint(
  decisionTime: Date,
  routeAssigned: Date | null,
  arrivalTime: Date | null
): BreakPoint {
  if (!routeAssigned) return 'before_route';
  const assignmentLag = (routeAssigned.getTime() - decisionTime.getTime()) / (1000 * 60 * 60);
  if (assignmentLag > 3) return 'before_route';
  if (!arrivalTime) return 'during_route';
  return 'after_arrival';
}

function buildNarrative(pm: Omit<SlaPostMortem, 'narrative'>): string {
  const parts: string[] = [];
  const conf = pm.ai_context.confidence_corrected
    ? `${pm.ai_context.confidence_displayed}% (adjusted from ${pm.ai_context.confidence_raw}%)`
    : `${pm.ai_context.confidence_raw}%`;

  parts.push(`AI suggested a ${conf} confidence action for ${pm.store_name || 'this store'}.`);
  parts.push(`The human ${pm.ai_context.human_action} the suggestion.`);

  if (pm.ai_context.decision_latency_seconds) {
    const mins = Math.round(pm.ai_context.decision_latency_seconds / 60);
    parts.push(`Decision was made in ${mins} minute${mins !== 1 ? 's' : ''}.`);
  }

  if (pm.actual_timeline.route_assigned_at && pm.actual_timeline.decision_time) {
    const lagHours = (new Date(pm.actual_timeline.route_assigned_at).getTime() - new Date(pm.actual_timeline.decision_time).getTime()) / (1000 * 60 * 60);
    if (lagHours > 2) {
      parts.push(`Route assignment was delayed by ${lagHours.toFixed(1)} hours.`);
    }
  }

  const causeMap: Record<PrimaryCause, string> = {
    routing: 'route congestion or inefficient pathing',
    capacity: 'insufficient driver/biker capacity',
    store_closed: 'the store being unavailable',
    human_delay: 'delayed human decision-making',
    external: 'external factors',
  };
  parts.push(`Primary cause identified as ${causeMap[pm.breach_analysis.primary_cause]}.`);

  if (pm.delta_analysis.expected_vs_actual_hours) {
    parts.push(`Outcome arrived ${pm.delta_analysis.expected_vs_actual_hours.toFixed(1)} hours later than expected.`);
  }

  if (pm.breach_analysis.breach_type === 'missed_visit') {
    parts.push('The visit was missed entirely, triggering a follow-up.');
  } else if (pm.breach_analysis.breach_type === 'late_arrival') {
    parts.push('Delivery arrived outside the SLA window.');
  }

  return parts.join(' ');
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Confidence Band Definitions ────────────────────────────────────────────

const BAND_DEFS = [
  { range: '0–30', min: 0, max: 30 },
  { range: '31–50', min: 31, max: 50 },
  { range: '51–65', min: 51, max: 65 },
  { range: '66–75', min: 66, max: 75 },
  { range: '76–85', min: 76, max: 85 },
  { range: '86–100', min: 86, max: 100 },
] as const;

// ─── Main Hook ──────────────────────────────────────────────────────────────

export function useSlaBreachPostMortems() {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ['sla-breach-post-mortems'],
    queryFn: async (): Promise<SlaBreachAnalysis> => {
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
      let ordersByStore = new Map<string, any[]>();
      let followUpsByStore = new Map<string, any[]>();

      if (storeIds.length > 0) {
        const slice = storeIds.slice(0, 100);

        const [stopsRes, ordersRes, followUpsRes] = await Promise.all([
          supabase
            .from('route_stops')
            .select('store_id, route_id, status, was_on_time, created_at, arrived_at, completed_at')
            .in('store_id', slice)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('store_orders')
            .select('store_id, status, delivered_at, created_at')
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
        (ordersRes.data || []).forEach((o: any) => {
          if (!ordersByStore.has(o.store_id)) ordersByStore.set(o.store_id, []);
          ordersByStore.get(o.store_id)!.push(o);
        });
        (followUpsRes.data || []).forEach((f: any) => {
          if (!followUpsByStore.has(f.store_id)) followUpsByStore.set(f.store_id, []);
          followUpsByStore.get(f.store_id)!.push(f);
        });
      }

      // 4. Build post-mortem cases (only breaches)
      const cases: SlaPostMortem[] = [];

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

        const storeOrders = (ordersByStore.get(f.store_id) || [])
          .filter((o: any) => {
            const d = new Date(o.created_at);
            return d >= feedbackDate && d <= windowEnd;
          });

        // Check SLA breach qualifiers
        const lateStop = storeStops.find((s: any) => s.was_on_time === false);
        const missedStop = storeStops.find((s: any) => s.status === 'skipped' || s.status === 'cancelled');
        const hasFollowUp = storeFollowUps.length > 0;
        const noStopAtAll = storeStops.length === 0 && (f.event_type === 'applied');

        if (!lateStop && !missedStop && !hasFollowUp && !noStopAtAll) continue;

        const breachStop = lateStop || missedStop || storeStops[0] || null;
        const translated = translateConfidence(
          f.confidence || 0,
          { sla: f.sla_severity, risk: f.risk_level, territory: f.territory },
          correctionRules
        );

        const routeAssigned = breachStop?.created_at ? new Date(breachStop.created_at) : null;
        const arrivalTime = breachStop?.arrived_at ? new Date(breachStop.arrived_at) : null;
        const completedAt = breachStop?.completed_at ? new Date(breachStop.completed_at) : null;
        const orderPlacedAt = storeOrders[0]?.created_at ? new Date(storeOrders[0].created_at) : null;
        const followUpAt = storeFollowUps[0]?.created_at ? new Date(storeFollowUps[0].created_at) : null;

        const primaryCause = inferPrimaryCause(feedbackDate, routeAssigned, arrivalTime, f.decision_latency_seconds);
        const breakPoint = inferBreakPoint(feedbackDate, routeAssigned, arrivalTime);
        const breachType = inferBreachType(breachStop, hasFollowUp ? storeFollowUps[0] : null);

        // Contributing factors
        const factors: string[] = [];
        if (f.decision_latency_seconds && f.decision_latency_seconds > 300) factors.push('Slow human decision (>5min)');
        if (routeAssigned && (routeAssigned.getTime() - feedbackDate.getTime()) > 2 * 60 * 60 * 1000) factors.push('Route assignment lag');
        if (noStopAtAll) factors.push('No route stop created');
        if (hasFollowUp) factors.push('Follow-up was generated');
        if (breachStop?.status === 'skipped') factors.push('Stop was skipped');

        // Expected vs actual delay
        const expectedDeliveryHours = 4; // baseline SLA assumption
        const actualDelivery = completedAt || arrivalTime;
        const expectedVsActual = actualDelivery
          ? Math.round(((actualDelivery.getTime() - feedbackDate.getTime()) / (1000 * 60 * 60) - expectedDeliveryHours) * 10) / 10
          : null;

        const pmCase: Omit<SlaPostMortem, 'narrative'> = {
          store_id: f.store_id,
          store_name: f.store_name,
          route_id: breachStop?.route_id || null,
          ai_context: {
            confidence_raw: f.confidence || 0,
            confidence_displayed: translated.displayed,
            confidence_corrected: translated.corrected,
            human_action: f.event_type as 'applied' | 'dismissed' | 'ignored',
            decision_latency_seconds: f.decision_latency_seconds || null,
          },
          expectation: {
            implied_outcome: 'on_time_delivery',
            sla_severity: f.sla_severity || null,
            risk_level: f.risk_level || null,
          },
          actual_timeline: {
            decision_time: f.created_at,
            route_assigned_at: routeAssigned?.toISOString() || null,
            arrival_time: arrivalTime?.toISOString() || null,
            delivery_completed_at: completedAt?.toISOString() || null,
            order_placed_at: orderPlacedAt?.toISOString() || null,
            follow_up_created_at: followUpAt?.toISOString() || null,
          },
          breach_analysis: {
            breach_type: breachType,
            primary_cause: primaryCause,
            contributing_factors: factors,
          },
          delta_analysis: {
            expected_vs_actual_hours: expectedVsActual,
            where_it_broke: breakPoint,
          },
          created_at: f.created_at,
        };

        cases.push({ ...pmCase, narrative: buildNarrative(pmCase) });
      }

      // 5. Aggregate analytics
      const delays = cases
        .map(c => c.delta_analysis.expected_vs_actual_hours)
        .filter((h): h is number => h !== null && h > 0);

      const avgDelay = delays.length > 0 ? Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10 : 0;

      // Root cause breakdown
      const causeCounts = new Map<PrimaryCause, number>();
      const causeLabels: Record<PrimaryCause, string> = {
        routing: 'Routing Delay',
        capacity: 'Capacity Saturation',
        store_closed: 'Store Unavailable',
        human_delay: 'Human Decision Latency',
        external: 'External Factors',
      };
      cases.forEach(c => {
        causeCounts.set(c.breach_analysis.primary_cause, (causeCounts.get(c.breach_analysis.primary_cause) || 0) + 1);
      });
      const rootCauses: RootCauseBreakdown[] = Array.from(causeCounts.entries())
        .map(([cause, count]) => ({
          cause,
          label: causeLabels[cause],
          count,
          percentage: cases.length > 0 ? Math.round((count / cases.length) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // High-confidence breaches
      const highConfBreaches = cases.filter(c => c.ai_context.confidence_raw >= 70);

      // By confidence band
      const byConfidenceBand: BreachByConfidenceBand[] = BAND_DEFS.map(def => {
        const inBand = cases.filter(c => c.ai_context.confidence_raw >= def.min && c.ai_context.confidence_raw <= def.max);
        const bandDelays = inBand.map(c => c.delta_analysis.expected_vs_actual_hours).filter((h): h is number => h !== null && h > 0);
        return {
          range: def.range,
          total: inBand.length,
          applied: inBand.filter(c => c.ai_context.human_action === 'applied').length,
          dismissed: inBand.filter(c => c.ai_context.human_action === 'dismissed').length,
          avgDelayHours: bandDelays.length > 0 ? Math.round((bandDelays.reduce((a, b) => a + b, 0) / bandDelays.length) * 10) / 10 : 0,
        };
      });

      // Contextual slices helper
      const sliceBy = (field: 'sla_severity' | 'risk_level' | 'territory') => {
        const groups = new Map<string, SlaPostMortem[]>();
        cases.forEach(c => {
          const key = (field === 'sla_severity' ? c.expectation.sla_severity : field === 'risk_level' ? c.expectation.risk_level : c.ai_context.human_action) || 'Unknown';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(c);
        });
        return Array.from(groups.entries()).map(([label, items]) => {
          const d = items.map(i => i.delta_analysis.expected_vs_actual_hours).filter((h): h is number => h !== null && h > 0);
          return { label, count: items.length, avgDelay: d.length > 0 ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : 0 };
        }).sort((a, b) => b.count - a.count);
      };

      const byAction = new Map<string, SlaPostMortem[]>();
      cases.forEach(c => {
        if (!byAction.has(c.ai_context.human_action)) byAction.set(c.ai_context.human_action, []);
        byAction.get(c.ai_context.human_action)!.push(c);
      });
      const byHumanAction = Array.from(byAction.entries()).map(([label, items]) => {
        const d = items.map(i => i.delta_analysis.expected_vs_actual_hours).filter((h): h is number => h !== null && h > 0);
        return { label, count: items.length, avgDelay: d.length > 0 ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : 0 };
      });

      // False trust signals: high confidence + applied + still breached
      const falseTrustSignals = cases.filter(c =>
        c.ai_context.confidence_raw >= 70 && c.ai_context.human_action === 'applied'
      );

      return {
        cases,
        totalBreaches: cases.length,
        kpis: {
          totalAnalyzed: cases.length,
          highConfidenceBreachPercent: cases.length > 0
            ? Math.round((highConfBreaches.length / cases.length) * 1000) / 10 : 0,
          avgDelayHours: avgDelay,
          topRootCause: rootCauses[0]?.label || 'N/A',
        },
        rootCauses,
        byConfidenceBand,
        bySlaSeverity: sliceBy('sla_severity'),
        byTerritory: sliceBy('territory'),
        byHumanAction,
        falseTrustSignals,
        delayStats: {
          avgHours: avgDelay,
          medianHours: Math.round(median(delays) * 10) / 10,
          p90Hours: Math.round(percentile(delays, 90) * 10) / 10,
        },
      };
    },
    refetchInterval: 60000,
  });

  return { analysis: analysis || null, isLoading };
}
