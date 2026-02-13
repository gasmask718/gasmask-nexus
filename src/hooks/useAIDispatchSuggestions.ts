// ═══════════════════════════════════════════════════════════════════════════════
// AI DISPATCH SUGGESTIONS HOOK — Phase 4: Advisory Intelligence
// ═══════════════════════════════════════════════════════════════════════════════
// Read-only. No mutations. No background jobs. No auto-dispatch.
// Deterministic weighted scoring model with transparent reasoning.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDispatchIntakeView, type DispatchSignal } from '@/hooks/useDispatchIntakeView';
import { useSLAAlerts, type SLAAlert } from '@/hooks/useSLAAlerts';
import { differenceInDays, differenceInHours } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AIRecommendation {
  store_id: string;
  store_name: string;
  territory: string | null;

  recommended_action: 'assign' | 'delay' | 'bundle' | 'revisit';
  suggested_assignee_ids: string[];
  suggested_assignee_names: string[];
  suggested_date: string | null;

  confidence: number; // 0–100
  risk_level: 'low' | 'medium' | 'high';

  reasons: string[];
  contributing_factors: {
    sla_severity: 'none' | 'amber' | 'red';
    urgency_score: number;
    last_visit_days: number | null;
    opportunity_age_days: number | null;
    follow_up_overdue_hours: number | null;
    worker_load_score: number;
    distance_km: number;
  };
}

export interface AIDispatchSettings {
  enabled: boolean;
  minConfidence: number;        // 0–100, default 70
  maxBundleSize: number;        // default 5
  slaDominance: boolean;        // default true
}

const DEFAULT_SETTINGS: AIDispatchSettings = {
  enabled: true,
  minConfidence: 70,
  maxBundleSize: 5,
  slaDominance: true,
};

// ─── Weights (transparent & deterministic) ───────────────────────────────────

const WEIGHTS = {
  SLA_RED: 30,
  SLA_AMBER: 15,
  URGENCY_BASE: 1,          // multiplied by urgency_score
  OPPORTUNITY_AGE_14: 8,
  OPPORTUNITY_AGE_30: 18,
  FOLLOW_UP_OVERDUE_24H: 12,
  FOLLOW_UP_OVERDUE_48H: 22,
  NO_VISIT_7D: 10,
  NO_VISIT_14D: 18,
  NEVER_VISITED: 12,
  DISTANCE_PENALTY_PER_KM: -0.5,
  WORKER_OVERLOAD_PENALTY: -15,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAIDispatchSuggestions(settings: AIDispatchSettings = DEFAULT_SETTINGS) {
  const { data: signals = [], isLoading: signalsLoading } = useDispatchIntakeView();
  const storeIds = useMemo(() => signals.map(s => s.store_id), [signals]);
  const { data: slaAlerts = [], isLoading: slaLoading } = useSLAAlerts(storeIds.length > 0 ? storeIds : undefined);

  // Fetch active workers
  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ['ai-dispatch-workers'],
    queryFn: async () => {
      const { data: drivers } = await supabase
        .from('drivers')
        .select('id, full_name, user_id, status')
        .eq('status', 'active');

      const { data: bikers } = await supabase
        .from('bikers')
        .select('id, full_name, user_id, status')
        .eq('status', 'active');

      return [
        ...(drivers || []).map(d => ({ ...d, type: 'driver' as const })),
        ...(bikers || []).map(b => ({ ...b, type: 'biker' as const })),
      ];
    },
    staleTime: 120000,
    enabled: settings.enabled,
  });

  // Fetch current route loads per worker (today)
  const { data: workerLoads = new Map<string, number>() } = useQuery({
    queryKey: ['ai-dispatch-worker-loads'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data: routes } = await supabase
        .from('routes')
        .select('assigned_to, id')
        .eq('date', today)
        .in('status', ['pending', 'in_progress']);

      const loadMap = new Map<string, number>();
      routes?.forEach(r => {
        if (r.assigned_to) {
          loadMap.set(r.assigned_to, (loadMap.get(r.assigned_to) || 0) + 1);
        }
      });
      return loadMap;
    },
    staleTime: 60000,
    enabled: settings.enabled,
  });

  // Fetch follow-up details for overdue hours calculation
  const { data: followUpDetails = [] } = useQuery({
    queryKey: ['ai-dispatch-followups'],
    queryFn: async () => {
      const { data } = await supabase
        .from('follow_up_queue')
        .select('id, store_id, due_at, status')
        .in('status', ['pending', 'overdue']);
      return data || [];
    },
    staleTime: 60000,
    enabled: settings.enabled,
  });

  // Fetch opportunity details for age calculation
  const { data: opportunityDetails = [] } = useQuery({
    queryKey: ['ai-dispatch-opportunities'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_opportunities')
        .select('id, store_id, created_at')
        .eq('is_completed', false);
      return data || [];
    },
    staleTime: 60000,
    enabled: settings.enabled,
  });

  // Fetch last route_stop per store
  const { data: lastStopMap = new Map<string, string>() } = useQuery({
    queryKey: ['ai-dispatch-last-stops', storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return new Map<string, string>();
      const { data } = await supabase
        .from('route_stops')
        .select('store_id, actual_departure, updated_at')
        .in('store_id', storeIds)
        .eq('status', 'completed')
        .order('actual_departure', { ascending: false });

      const map = new Map<string, string>();
      data?.forEach(s => {
        const dt = s.actual_departure || s.updated_at;
        if (dt && s.store_id && !map.has(s.store_id)) {
          map.set(s.store_id, dt);
        }
      });
      return map;
    },
    staleTime: 60000,
    enabled: settings.enabled && storeIds.length > 0,
  });

  const slaMap = useMemo(() => new Map(slaAlerts.map(a => [a.store_id, a])), [slaAlerts]);

  const recommendations = useMemo((): AIRecommendation[] => {
    if (!settings.enabled || signals.length === 0) return [];

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const recs: AIRecommendation[] = [];

    for (const signal of signals) {
      let score = 0;
      const reasons: string[] = [];

      // ── SLA severity ──
      const sla = slaMap.get(signal.store_id);
      const slaSeverity = sla?.severity || 'none';

      if (slaSeverity === 'red') {
        score += WEIGHTS.SLA_RED;
        sla?.reasons.forEach(r => reasons.push(r));
      } else if (slaSeverity === 'amber') {
        score += WEIGHTS.SLA_AMBER;
        sla?.reasons.forEach(r => reasons.push(r));
      }

      // ── Urgency score from dispatch intake ──
      score += signal.urgency_score * WEIGHTS.URGENCY_BASE;
      if (signal.urgency_score >= 15) {
        reasons.push(`High urgency score (${signal.urgency_score})`);
      }

      // ── Opportunity age ──
      const storeOpps = opportunityDetails.filter(o => o.store_id === signal.store_id);
      let maxOppAgeDays: number | null = null;
      if (storeOpps.length > 0) {
        maxOppAgeDays = Math.max(...storeOpps.map(o => differenceInDays(now, new Date(o.created_at))));
        if (maxOppAgeDays >= 30) {
          score += WEIGHTS.OPPORTUNITY_AGE_30;
          reasons.push(`Opportunity aging ${maxOppAgeDays}d`);
        } else if (maxOppAgeDays >= 14) {
          score += WEIGHTS.OPPORTUNITY_AGE_14;
          reasons.push(`Opportunity aging ${maxOppAgeDays}d`);
        }
      }

      // ── Follow-up overdue ──
      const storeFUs = followUpDetails.filter(f => f.store_id === signal.store_id && f.due_at);
      let maxOverdueHours: number | null = null;
      const overdueFUs = storeFUs.filter(f => new Date(f.due_at!) < now);
      if (overdueFUs.length > 0) {
        maxOverdueHours = Math.max(
          ...overdueFUs.map(f => differenceInHours(now, new Date(f.due_at!)))
        );
        if (maxOverdueHours >= 48) {
          score += WEIGHTS.FOLLOW_UP_OVERDUE_48H;
          reasons.push(`Follow-up overdue ${Math.round(maxOverdueHours / 24)}d`);
        } else if (maxOverdueHours >= 24) {
          score += WEIGHTS.FOLLOW_UP_OVERDUE_24H;
          reasons.push(`Follow-up overdue ${maxOverdueHours}h`);
        }
      }

      // ── Last visit / revisit window ──
      const lastStop = lastStopMap.get(signal.store_id);
      let lastVisitDays: number | null = null;
      if (lastStop) {
        lastVisitDays = differenceInDays(now, new Date(lastStop));
        if (lastVisitDays >= 14) {
          score += WEIGHTS.NO_VISIT_14D;
          reasons.push(`No visit in ${lastVisitDays}d`);
        } else if (lastVisitDays >= 7) {
          score += WEIGHTS.NO_VISIT_7D;
          reasons.push(`No visit in ${lastVisitDays}d`);
        }
      } else {
        score += WEIGHTS.NEVER_VISITED;
        reasons.push('Never visited (active signals)');
        lastVisitDays = null;
      }

      // ── Worker suggestion (lowest load in territory) ──
      // Simple heuristic: pick workers with lowest current load
      const sortedWorkers = [...workers].sort((a, b) => {
        const loadA = workerLoads.get(a.user_id || a.id) || 0;
        const loadB = workerLoads.get(b.user_id || b.id) || 0;
        return loadA - loadB;
      });

      const topWorkers = sortedWorkers.slice(0, 3);
      const suggestedWorkerLoad = topWorkers.length > 0
        ? (workerLoads.get(topWorkers[0].user_id || topWorkers[0].id) || 0)
        : 0;

      // Worker overload penalty
      const workerLoadScore = suggestedWorkerLoad;
      if (suggestedWorkerLoad >= 3) {
        score += WEIGHTS.WORKER_OVERLOAD_PENALTY;
        reasons.push(`All workers heavily loaded (${suggestedWorkerLoad}+ routes)`);
      } else if (topWorkers.length > 0) {
        const workerName = topWorkers[0].full_name;
        reasons.push(`${workerName} available (${suggestedWorkerLoad} active routes)`);
      }

      // ── Discard if no reasons ──
      if (reasons.length === 0) continue;

      // ── Normalize score to 0–100 ──
      const normalizedScore = Math.max(0, Math.min(100, score));

      // ── Skip below confidence threshold ──
      if (normalizedScore < settings.minConfidence) continue;

      // ── Determine action ──
      let action: AIRecommendation['recommended_action'] = 'assign';
      if (suggestedWorkerLoad >= 4) {
        action = 'delay';
      } else if (signal.needs.opportunity && !signal.needs.order && !signal.needs.follow_up) {
        action = 'revisit';
      }

      // ── Risk level ──
      const riskLevel: AIRecommendation['risk_level'] =
        slaSeverity === 'red' || normalizedScore >= 70 ? 'high'
        : slaSeverity === 'amber' || normalizedScore >= 40 ? 'medium'
        : 'low';

      recs.push({
        store_id: signal.store_id,
        store_name: signal.store_name,
        territory: signal.territory,
        recommended_action: action,
        suggested_assignee_ids: topWorkers.map(w => w.id),
        suggested_assignee_names: topWorkers.map(w => w.full_name),
        suggested_date: today,
        confidence: normalizedScore,
        risk_level: riskLevel,
        reasons,
        contributing_factors: {
          sla_severity: slaSeverity,
          urgency_score: signal.urgency_score,
          last_visit_days: lastVisitDays,
          opportunity_age_days: maxOppAgeDays,
          follow_up_overdue_hours: maxOverdueHours,
          worker_load_score: workerLoadScore,
          distance_km: 0, // placeholder — no geo data available yet
        },
      });
    }

    // Sort: SLA dominance → confidence desc
    if (settings.slaDominance) {
      const sevOrder = { red: 0, amber: 1, none: 2 };
      recs.sort((a, b) => {
        const sevDiff = sevOrder[a.contributing_factors.sla_severity] - sevOrder[b.contributing_factors.sla_severity];
        if (sevDiff !== 0) return sevDiff;
        return b.confidence - a.confidence;
      });
    } else {
      recs.sort((a, b) => b.confidence - a.confidence);
    }

    return recs;
  }, [signals, slaMap, workers, workerLoads, followUpDetails, opportunityDetails, lastStopMap, settings]);

  // Bundle detection: group nearby stores in same territory
  const bundledRecommendations = useMemo(() => {
    if (!settings.enabled) return [];

    const territoryGroups = new Map<string, AIRecommendation[]>();
    recommendations.forEach(rec => {
      const key = rec.territory || '__no_territory__';
      if (!territoryGroups.has(key)) territoryGroups.set(key, []);
      territoryGroups.get(key)!.push(rec);
    });

    const result: AIRecommendation[] = [];
    territoryGroups.forEach((group, territory) => {
      if (group.length >= 2 && territory !== '__no_territory__') {
        // Mark as bundle candidates (up to maxBundleSize)
        const bundleable = group.slice(0, settings.maxBundleSize);
        bundleable.forEach(rec => {
          const bundled = { ...rec };
          if (bundleable.length >= 2) {
            bundled.recommended_action = 'bundle';
            bundled.reasons = [
              ...bundled.reasons,
              `${bundleable.length} nearby stores can be bundled in ${territory}`,
            ];
          }
          result.push(bundled);
        });
        // Add remaining non-bundled
        group.slice(settings.maxBundleSize).forEach(rec => result.push(rec));
      } else {
        group.forEach(rec => result.push(rec));
      }
    });

    // Re-sort after bundling
    if (settings.slaDominance) {
      const sevOrder = { red: 0, amber: 1, none: 2 };
      result.sort((a, b) => {
        const sevDiff = sevOrder[a.contributing_factors.sla_severity] - sevOrder[b.contributing_factors.sla_severity];
        if (sevDiff !== 0) return sevDiff;
        return b.confidence - a.confidence;
      });
    } else {
      result.sort((a, b) => b.confidence - a.confidence);
    }

    return result;
  }, [recommendations, settings]);

  return {
    recommendations: bundledRecommendations,
    isLoading: signalsLoading || slaLoading || workersLoading,
    totalSignals: signals.length,
    settings,
  };
}
