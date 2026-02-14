// ═══════════════════════════════════════════════════════════════════════════════
// ACTION OUTCOME ATTRIBUTION HOOK — Phase 9: Read-Only Analytics
// ═══════════════════════════════════════════════════════════════════════════════
// Connects AI suggestion confidence → human action → downstream outcomes.
// All computations are derived at query-time. Nothing is stored or mutated.
// No feedback loops. No learning hooks. Fully removable without side effects.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { translateConfidence, ConfidenceCorrectionRule } from '@/lib/translateConfidence';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DownstreamOutcomes {
  order_placed: boolean;
  delivery_completed: boolean;
  follow_up_created: boolean;
  sla_breached: boolean;
  revisit_required: boolean;
}

export interface AttributionRecord {
  store_id: string;
  store_name: string | null;
  confidence_raw: number;
  confidence_displayed: number;
  confidence_corrected: boolean;
  human_action: 'applied' | 'dismissed' | 'ignored';
  downstream_outcomes: DownstreamOutcomes;
  timing: {
    decision_latency_seconds: number | null;
    outcome_latency_hours: number | null;
  };
  context: {
    risk_level: string | null;
    sla_severity: string | null;
    territory: string | null;
  };
  created_at: string;
}

export interface ConfidenceBandOutcome {
  range: string;
  min: number;
  max: number;
  midpoint: number;
  total: number;
  applied: number;
  dismissed: number;
  ignored: number;
  successRate: number;        // applied that led to positive outcomes / applied
  missedOpportunityRate: number; // dismissed that had positive outcomes / dismissed
  orderRate: number;
  deliveryRate: number;
  followUpRate: number;
  slaBreachRate: number;
}

export interface CorrectionLift {
  band: string;
  rawAcceptanceSuccess: number;
  displayedAcceptanceSuccess: number;
  lift: number; // delta percentage points
}

export interface FalseConfidenceZone {
  range: string;
  type: 'high_confidence_poor_outcome' | 'low_confidence_strong_outcome';
  confidence_midpoint: number;
  successRate: number;
  description: string;
}

export interface ActionOutcomeAnalysis {
  records: AttributionRecord[];
  totalRecords: number;
  
  // 1. Confidence → Outcome Curves
  rawBands: ConfidenceBandOutcome[];
  displayedBands: ConfidenceBandOutcome[];
  
  // 2. Trust Delta (correction lift)
  correctionLift: CorrectionLift[];
  overallLift: number;
  
  // 3. False Confidence Zones
  falseZones: FalseConfidenceZone[];
  
  // 4. KPI Summary
  kpis: {
    overallAcceptanceSuccessRate: number;
    overallRejectionMissedRate: number;
    correctionLiftPercent: number;
    totalAttributed: number;
  };
  
  // 5. Contextual slices
  contextualSlices: {
    dimension: string;
    slices: { label: string; bands: ConfidenceBandOutcome[] }[];
  }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BAND_DEFS = [
  { range: '0–30',   min: 0,  max: 30,  midpoint: 15 },
  { range: '31–50',  min: 31, max: 50,  midpoint: 40.5 },
  { range: '51–65',  min: 51, max: 65,  midpoint: 58 },
  { range: '66–75',  min: 66, max: 75,  midpoint: 70.5 },
  { range: '76–85',  min: 76, max: 85,  midpoint: 80.5 },
  { range: '86–100', min: 86, max: 100, midpoint: 93 },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeBandOutcomes(records: AttributionRecord[], useDisplayed: boolean): ConfidenceBandOutcome[] {
  return BAND_DEFS.map(def => {
    const inBand = records.filter(r => {
      const conf = useDisplayed ? r.confidence_displayed : r.confidence_raw;
      return conf >= def.min && conf <= def.max;
    });

    const applied = inBand.filter(r => r.human_action === 'applied');
    const dismissed = inBand.filter(r => r.human_action === 'dismissed');
    const ignored = inBand.filter(r => r.human_action === 'ignored');

    // Success = applied AND led to order or delivery
    const appliedSuccess = applied.filter(r =>
      r.downstream_outcomes.order_placed || r.downstream_outcomes.delivery_completed
    );

    // Missed opportunity = dismissed BUT store got order/delivery anyway
    const dismissedPositive = dismissed.filter(r =>
      r.downstream_outcomes.order_placed || r.downstream_outcomes.delivery_completed
    );

    const successRate = applied.length > 0
      ? Math.round((appliedSuccess.length / applied.length) * 1000) / 10
      : 0;

    const missedOpportunityRate = dismissed.length > 0
      ? Math.round((dismissedPositive.length / dismissed.length) * 1000) / 10
      : 0;

    const allActionable = [...applied, ...dismissed, ...ignored];
    const orderCount = allActionable.filter(r => r.downstream_outcomes.order_placed).length;
    const deliveryCount = allActionable.filter(r => r.downstream_outcomes.delivery_completed).length;
    const followUpCount = allActionable.filter(r => r.downstream_outcomes.follow_up_created).length;
    const slaBreachCount = allActionable.filter(r => r.downstream_outcomes.sla_breached).length;

    return {
      range: def.range,
      min: def.min,
      max: def.max,
      midpoint: def.midpoint,
      total: inBand.length,
      applied: applied.length,
      dismissed: dismissed.length,
      ignored: ignored.length,
      successRate,
      missedOpportunityRate,
      orderRate: allActionable.length > 0 ? Math.round((orderCount / allActionable.length) * 1000) / 10 : 0,
      deliveryRate: allActionable.length > 0 ? Math.round((deliveryCount / allActionable.length) * 1000) / 10 : 0,
      followUpRate: allActionable.length > 0 ? Math.round((followUpCount / allActionable.length) * 1000) / 10 : 0,
      slaBreachRate: allActionable.length > 0 ? Math.round((slaBreachCount / allActionable.length) * 1000) / 10 : 0,
    };
  });
}

function computeFalseZones(bands: ConfidenceBandOutcome[]): FalseConfidenceZone[] {
  const zones: FalseConfidenceZone[] = [];

  for (const band of bands) {
    if (band.total < 5) continue;

    // High confidence but poor outcomes
    if (band.midpoint >= 70 && band.successRate < 40) {
      zones.push({
        range: band.range,
        type: 'high_confidence_poor_outcome',
        confidence_midpoint: band.midpoint,
        successRate: band.successRate,
        description: `Confidence ${band.range}% shows only ${band.successRate}% success rate — AI overestimates certainty in this band.`,
      });
    }

    // Low confidence but strong outcomes
    if (band.midpoint <= 50 && band.successRate > 60) {
      zones.push({
        range: band.range,
        type: 'low_confidence_strong_outcome',
        confidence_midpoint: band.midpoint,
        successRate: band.successRate,
        description: `Confidence ${band.range}% shows ${band.successRate}% success rate — AI underestimates certainty in this band.`,
      });
    }
  }

  return zones;
}

// ─── Main Hook ───────────────────────────────────────────────────────────────

export function useActionOutcomeAttribution() {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ['action-outcome-attribution'],
    queryFn: async (): Promise<ActionOutcomeAnalysis> => {
      // 1. Fetch feedback data
      const { data: feedback } = await supabase
        .from('ai_dispatch_feedback')
        .select('*')
        .in('event_type', ['applied', 'dismissed', 'ignored'])
        .order('created_at', { ascending: false })
        .limit(1000);

      // 2. Fetch approved corrections for Phase 8 translation
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

      // 3. Gather store IDs for downstream joins
      const storeIds = [...new Set(items.map((f: any) => f.store_id).filter(Boolean))];

      // 4. Fetch downstream outcomes per store (within relevant time window)
      let routeStopsByStore = new Map<string, any[]>();
      let ordersByStore = new Map<string, any[]>();
      let followUpsByStore = new Map<string, any[]>();

      if (storeIds.length > 0) {
        // Route stops for these stores
        const { data: stops } = await supabase
          .from('route_stops')
          .select('store_id, status, was_on_time, created_at')
          .in('store_id', storeIds.slice(0, 100))
          .order('created_at', { ascending: false })
          .limit(500);

        (stops || []).forEach((s: any) => {
          if (!routeStopsByStore.has(s.store_id)) routeStopsByStore.set(s.store_id, []);
          routeStopsByStore.get(s.store_id)!.push(s);
        });

        // Orders for these stores
        const { data: orders } = await supabase
          .from('store_orders')
          .select('store_id, status, delivered_at, created_at')
          .in('store_id', storeIds.slice(0, 100))
          .order('created_at', { ascending: false })
          .limit(500);

        (orders || []).forEach((o: any) => {
          if (!ordersByStore.has(o.store_id)) ordersByStore.set(o.store_id, []);
          ordersByStore.get(o.store_id)!.push(o);
        });

        // Follow-ups for these stores
        const { data: followUps } = await supabase
          .from('follow_up_queue')
          .select('store_id, status, created_at')
          .in('store_id', storeIds.slice(0, 100))
          .order('created_at', { ascending: false })
          .limit(500);

        (followUps || []).forEach((f: any) => {
          if (!followUpsByStore.has(f.store_id)) followUpsByStore.set(f.store_id, []);
          followUpsByStore.get(f.store_id)!.push(f);
        });
      }

      // 5. Build attribution records
      const records: AttributionRecord[] = items.map((f: any) => {
        const feedbackDate = new Date(f.created_at);
        const windowEnd = new Date(feedbackDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day window

        // Translate confidence using Phase 8
        const translated = translateConfidence(
          f.confidence || 0,
          { sla: f.sla_severity, risk: f.risk_level, territory: f.territory },
          correctionRules
        );

        // Check downstream outcomes within 7-day window
        const storeStops = (routeStopsByStore.get(f.store_id) || [])
          .filter((s: any) => {
            const d = new Date(s.created_at);
            return d >= feedbackDate && d <= windowEnd;
          });

        const storeOrders = (ordersByStore.get(f.store_id) || [])
          .filter((o: any) => {
            const d = new Date(o.created_at);
            return d >= feedbackDate && d <= windowEnd;
          });

        const storeFollowUps = (followUpsByStore.get(f.store_id) || [])
          .filter((fu: any) => {
            const d = new Date(fu.created_at);
            return d >= feedbackDate && d <= windowEnd;
          });

        const delivery_completed = storeStops.some((s: any) => s.status === 'completed');
        const order_placed = storeOrders.length > 0;
        const follow_up_created = storeFollowUps.length > 0;
        const sla_breached = storeStops.some((s: any) => s.was_on_time === false);
        const revisit_required = storeFollowUps.some((fu: any) => fu.status === 'pending' || fu.status === 'overdue');

        // Outcome latency: time from feedback to first downstream event
        const downstreamDates = [
          ...storeStops.map((s: any) => new Date(s.created_at)),
          ...storeOrders.map((o: any) => new Date(o.created_at)),
        ].filter(d => d >= feedbackDate);

        const earliestOutcome = downstreamDates.length > 0
          ? Math.min(...downstreamDates.map(d => d.getTime()))
          : null;

        const outcome_latency_hours = earliestOutcome
          ? Math.round(((earliestOutcome - feedbackDate.getTime()) / (1000 * 60 * 60)) * 10) / 10
          : null;

        return {
          store_id: f.store_id,
          store_name: f.store_name,
          confidence_raw: f.confidence || 0,
          confidence_displayed: translated.displayed,
          confidence_corrected: translated.corrected,
          human_action: f.event_type as 'applied' | 'dismissed' | 'ignored',
          downstream_outcomes: {
            order_placed,
            delivery_completed,
            follow_up_created,
            sla_breached,
            revisit_required,
          },
          timing: {
            decision_latency_seconds: f.decision_latency_seconds || null,
            outcome_latency_hours,
          },
          context: {
            risk_level: f.risk_level || null,
            sla_severity: f.sla_severity || null,
            territory: f.territory || null,
          },
          created_at: f.created_at,
        };
      });

      // 6. Compute analytics
      const rawBands = computeBandOutcomes(records, false);
      const displayedBands = computeBandOutcomes(records, true);

      // 7. Correction lift analysis
      const correctedRecords = records.filter(r => r.confidence_corrected);
      const uncorrectedRecords = records.filter(r => !r.confidence_corrected);

      const correctionLift: CorrectionLift[] = BAND_DEFS.map(def => {
        const correctedInBand = correctedRecords.filter(r =>
          r.confidence_raw >= def.min && r.confidence_raw <= def.max && r.human_action === 'applied'
        );
        const uncorrectedInBand = uncorrectedRecords.filter(r =>
          r.confidence_raw >= def.min && r.confidence_raw <= def.max && r.human_action === 'applied'
        );

        const correctedSuccess = correctedInBand.filter(r =>
          r.downstream_outcomes.order_placed || r.downstream_outcomes.delivery_completed
        );
        const uncorrectedSuccess = uncorrectedInBand.filter(r =>
          r.downstream_outcomes.order_placed || r.downstream_outcomes.delivery_completed
        );

        const rawRate = uncorrectedInBand.length > 0
          ? (uncorrectedSuccess.length / uncorrectedInBand.length) * 100 : 0;
        const displayedRate = correctedInBand.length > 0
          ? (correctedSuccess.length / correctedInBand.length) * 100 : 0;

        return {
          band: def.range,
          rawAcceptanceSuccess: Math.round(rawRate * 10) / 10,
          displayedAcceptanceSuccess: Math.round(displayedRate * 10) / 10,
          lift: Math.round((displayedRate - rawRate) * 10) / 10,
        };
      });

      // Overall lift
      const allCorrectedApplied = correctedRecords.filter(r => r.human_action === 'applied');
      const allUncorrectedApplied = uncorrectedRecords.filter(r => r.human_action === 'applied');
      const correctedSuccessAll = allCorrectedApplied.filter(r =>
        r.downstream_outcomes.order_placed || r.downstream_outcomes.delivery_completed
      );
      const uncorrectedSuccessAll = allUncorrectedApplied.filter(r =>
        r.downstream_outcomes.order_placed || r.downstream_outcomes.delivery_completed
      );
      const correctedRate = allCorrectedApplied.length > 0
        ? (correctedSuccessAll.length / allCorrectedApplied.length) * 100 : 0;
      const uncorrectedRate = allUncorrectedApplied.length > 0
        ? (uncorrectedSuccessAll.length / allUncorrectedApplied.length) * 100 : 0;
      const overallLift = Math.round((correctedRate - uncorrectedRate) * 10) / 10;

      // 8. False confidence zones
      const falseZones = computeFalseZones(rawBands);

      // 9. KPIs
      const allApplied = records.filter(r => r.human_action === 'applied');
      const allDismissed = records.filter(r => r.human_action === 'dismissed');
      const appliedSuccess = allApplied.filter(r =>
        r.downstream_outcomes.order_placed || r.downstream_outcomes.delivery_completed
      );
      const dismissedMissed = allDismissed.filter(r =>
        r.downstream_outcomes.order_placed || r.downstream_outcomes.delivery_completed
      );

      const kpis = {
        overallAcceptanceSuccessRate: allApplied.length > 0
          ? Math.round((appliedSuccess.length / allApplied.length) * 1000) / 10 : 0,
        overallRejectionMissedRate: allDismissed.length > 0
          ? Math.round((dismissedMissed.length / allDismissed.length) * 1000) / 10 : 0,
        correctionLiftPercent: overallLift,
        totalAttributed: records.length,
      };

      // 10. Contextual slices
      const contextualSlices = [
        { dimension: 'SLA Severity', field: 'sla_severity' as const },
        { dimension: 'Risk Level', field: 'risk_level' as const },
        { dimension: 'Territory', field: 'territory' as const },
      ].map(({ dimension, field }) => {
        const groups = new Map<string, AttributionRecord[]>();
        records.forEach(r => {
          const val = r.context[field] || 'unknown';
          if (!groups.has(val)) groups.set(val, []);
          groups.get(val)!.push(r);
        });

        const slices = Array.from(groups.entries())
          .filter(([_, g]) => g.length >= 3)
          .map(([label, group]) => ({
            label,
            bands: computeBandOutcomes(group, false),
          }));

        return { dimension, slices };
      });

      return {
        records,
        totalRecords: records.length,
        rawBands,
        displayedBands,
        correctionLift,
        overallLift,
        falseZones,
        kpis,
        contextualSlices,
      };
    },
    staleTime: 120_000,
  });

  return { analysis, isLoading };
}
