// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE CALIBRATION HOOK — Phase 7: Advisory, No Auto-Changes
// ═══════════════════════════════════════════════════════════════════════════════
// Computes Platt-style calibration curves from ai_dispatch_feedback.
// All analysis is derived at query-time. Nothing is stored or mutated.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalibrationBucket {
  range: string;
  midpoint: number;
  total: number;
  applied: number;
  dismissed: number;
  ignored: number;
  observedRate: number;   // applied / (applied + dismissed)
  expectedRate: number;   // midpoint / 100
  calibrationError: number; // observed - expected
  state: 'well_calibrated' | 'overconfident' | 'underconfident';
}

export interface ContextSlice {
  label: string;
  buckets: CalibrationBucket[];
  ece: number;
}

export interface AdvisoryInsight {
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface CalibrationAnalysis {
  globalBuckets: CalibrationBucket[];
  globalECE: number;
  maxDeviation: number;
  worstBucket: string | null;
  contextSlices: ContextSlice[];
  advisoryInsights: AdvisoryInsight[];
  timeWindows: {
    label: string;
    ece: number;
    buckets: CalibrationBucket[];
  }[];
  totalSamples: number;
}

// ─── Bucket Definitions (Platt-style) ────────────────────────────────────────

const BUCKET_DEFS = [
  { range: '0–30',  min: 0,  max: 30, midpoint: 15 },
  { range: '31–50', min: 31, max: 50, midpoint: 40.5 },
  { range: '51–65', min: 51, max: 65, midpoint: 58 },
  { range: '66–75', min: 66, max: 75, midpoint: 70.5 },
  { range: '76–85', min: 76, max: 85, midpoint: 80.5 },
  { range: '86–100', min: 86, max: 100, midpoint: 93 },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeBuckets(items: any[]): CalibrationBucket[] {
  return BUCKET_DEFS.map(def => {
    const inBucket = items.filter((f: any) => f.confidence >= def.min && f.confidence <= def.max);
    const applied = inBucket.filter((f: any) => f.event_type === 'applied').length;
    const dismissed = inBucket.filter((f: any) => f.event_type === 'dismissed').length;
    const ignored = inBucket.filter((f: any) => f.event_type === 'ignored').length;
    const actionable = applied + dismissed;
    const observedRate = actionable > 0 ? (applied / actionable) * 100 : 0;
    const expectedRate = def.midpoint;
    const error = observedRate - expectedRate;
    const absError = Math.abs(error);

    let state: CalibrationBucket['state'] = 'well_calibrated';
    if (absError > 5) {
      state = error < 0 ? 'overconfident' : 'underconfident';
    }

    return {
      range: def.range,
      midpoint: def.midpoint,
      total: inBucket.length,
      applied,
      dismissed,
      ignored,
      observedRate: Math.round(observedRate * 10) / 10,
      expectedRate,
      calibrationError: Math.round(error * 10) / 10,
      state,
    };
  });
}

function computeECE(buckets: CalibrationBucket[]): number {
  const totalSamples = buckets.reduce((s, b) => s + (b.applied + b.dismissed), 0);
  if (totalSamples === 0) return 0;
  const weightedError = buckets.reduce((s, b) => {
    const n = b.applied + b.dismissed;
    return s + (n / totalSamples) * Math.abs(b.calibrationError);
  }, 0);
  return Math.round(weightedError * 10) / 10;
}

function sliceByField(items: any[], field: string, labelMap?: Record<string, string>): ContextSlice[] {
  const groups = new Map<string, any[]>();
  items.forEach(item => {
    const val = item[field] || 'unknown';
    if (!groups.has(val)) groups.set(val, []);
    groups.get(val)!.push(item);
  });

  return Array.from(groups.entries())
    .filter(([_, g]) => g.length >= 5) // min sample threshold
    .map(([key, group]) => {
      const buckets = computeBuckets(group);
      return {
        label: labelMap?.[key] || key,
        buckets,
        ece: computeECE(buckets),
      };
    })
    .sort((a, b) => b.ece - a.ece);
}

function generateInsights(
  globalBuckets: CalibrationBucket[],
  contextSlices: ContextSlice[],
  globalECE: number,
): AdvisoryInsight[] {
  const insights: AdvisoryInsight[] = [];

  // Global ECE assessment
  if (globalECE > 15) {
    insights.push({ severity: 'critical', message: `Global calibration error is ${globalECE}% — confidence claims are significantly unreliable.` });
  } else if (globalECE > 8) {
    insights.push({ severity: 'warning', message: `Global calibration error is ${globalECE}% — moderate miscalibration detected.` });
  } else {
    insights.push({ severity: 'info', message: `Global calibration error is ${globalECE}% — confidence is reasonably well-calibrated.` });
  }

  // Per-bucket insights
  const overconfident = globalBuckets.filter(b => b.state === 'overconfident' && b.total >= 5);
  overconfident.forEach(b => {
    insights.push({
      severity: Math.abs(b.calibrationError) > 20 ? 'critical' : 'warning',
      message: `Confidence ${b.range}% is over-stated: expected ~${b.expectedRate}% success, observed ${b.observedRate}% (${b.calibrationError > 0 ? '+' : ''}${b.calibrationError}%).`,
    });
  });

  const underconfident = globalBuckets.filter(b => b.state === 'underconfident' && b.total >= 5);
  underconfident.forEach(b => {
    insights.push({
      severity: 'info',
      message: `Confidence ${b.range}% is under-stated: humans accept at ${b.observedRate}% vs expected ${b.expectedRate}%.`,
    });
  });

  // Context-specific drift
  contextSlices.forEach(slice => {
    if (slice.ece > 20) {
      insights.push({
        severity: 'warning',
        message: `Confidence breaks down in "${slice.label}" context (ECE: ${slice.ece}%).`,
      });
    }
  });

  return insights;
}

// ─── Main Hook ───────────────────────────────────────────────────────────────

export function useConfidenceCalibration() {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ['confidence-calibration'],
    queryFn: async (): Promise<CalibrationAnalysis> => {
      // Fetch all actionable feedback
      const { data: feedback } = await supabase
        .from('ai_dispatch_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      const items = (feedback || []).filter(
        (f: any) => ['applied', 'dismissed', 'ignored'].includes(f.event_type)
      );

      // ── Global calibration ──
      const globalBuckets = computeBuckets(items);
      const globalECE = computeECE(globalBuckets);
      const maxDeviation = Math.max(...globalBuckets.map(b => Math.abs(b.calibrationError)), 0);
      const worstBucket = globalBuckets.reduce(
        (worst, b) => Math.abs(b.calibrationError) > Math.abs(worst?.calibrationError ?? 0) ? b : worst,
        globalBuckets[0]
      )?.range || null;

      // ── Contextual slices ──
      const slaBuckets = sliceByField(items, 'sla_severity', {
        none: 'No SLA', amber: 'Amber SLA', red: 'Red SLA',
      });
      const riskBuckets = sliceByField(items, 'risk_level', {
        low: 'Low Risk', medium: 'Medium Risk', high: 'High Risk',
      });
      const territoryBuckets = sliceByField(items, 'territory');
      const contextSlices = [...slaBuckets, ...riskBuckets, ...territoryBuckets];

      // ── Time windows ──
      const now = new Date();
      const timeWindows = [
        { label: 'Last 7 Days', cutoff: subDays(now, 7) },
        { label: 'Last 30 Days', cutoff: subDays(now, 30) },
        { label: 'Last 90 Days', cutoff: subDays(now, 90) },
      ].map(({ label, cutoff }) => {
        const windowItems = items.filter((f: any) => new Date(f.created_at) >= cutoff);
        const buckets = computeBuckets(windowItems);
        return { label, ece: computeECE(buckets), buckets };
      });

      // ── Advisory insights ──
      const advisoryInsights = generateInsights(globalBuckets, contextSlices, globalECE);

      return {
        globalBuckets,
        globalECE,
        maxDeviation: Math.round(maxDeviation * 10) / 10,
        worstBucket,
        contextSlices,
        advisoryInsights,
        timeWindows,
        totalSamples: items.length,
      };
    },
    staleTime: 60_000, // refresh every 60s
  });

  return { analysis, isLoading };
}
