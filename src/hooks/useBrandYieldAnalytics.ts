/**
 * useBrandYieldAnalytics — LBS → BOXES → TUBES yield analytics per brand.
 *
 * Source of truth: production_batches.{tobacco_lbs, boxes_produced, tubes_total}.
 * No tubes_per_box config needed — we derive it from actual tubes_total per batch,
 * which reflects reality (vs. a static config that drifts when fill changes).
 *
 * Metrics per bucket / brand:
 *   - boxes_per_lb  = boxes_out / lbs_in
 *   - lbs_per_box   = lbs_in / boxes_out
 *   - tubes_per_box = tubes_out / boxes_out
 *   - grams_per_tube = (lbs_in * 453.592) / tubes_out
 *
 * Anomaly flag (±15% vs the brand's own rolling baseline) is applied to
 * grams_per_tube — overstuffing (cost leak) or understuffing (thin product).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type YieldBucket = 'day' | 'week' | 'month';

const GRAMS_PER_LB = 453.592;

export interface BrandYieldPoint {
  bucket: string;        // ISO date for the bucket start
  brand: string;
  lbs_in: number;
  boxes_out: number;
  tubes_out: number;
  batches: number;
  boxes_per_lb: number;   // 0 when lbs_in is 0
  lbs_per_box: number;    // 0 when boxes_out is 0
  tubes_per_box: number;  // 0 when boxes_out is 0
  grams_per_tube: number; // 0 when tubes_out is 0
}

export interface BrandYieldSummary {
  brand: string;
  total_lbs: number;
  total_boxes: number;
  total_tubes: number;
  // Yield (boxes per lb)
  avg_boxes_per_lb: number;
  baseline_boxes_per_lb: number;
  latest_boxes_per_lb: number;
  variance_pct: number;
  anomaly: 'normal' | 'low' | 'high';
  // Intermediate: lbs per box
  avg_lbs_per_box: number;
  // Tube fill metrics
  avg_tubes_per_box: number;
  avg_grams_per_tube: number;
  baseline_grams_per_tube: number;
  latest_grams_per_tube: number;
  grams_variance_pct: number;
  grams_anomaly: 'normal' | 'overstuffed' | 'understuffed';
  batches: number;
}

export interface BrandYieldData {
  points: BrandYieldPoint[];
  summaries: BrandYieldSummary[];
  brands: string[];
  range: { start: string; end: string };
}

interface Params {
  officeId?: string | null;
  bucket?: YieldBucket;
  days?: number;
}

function bucketKey(d: Date, bucket: YieldBucket): string {
  const copy = new Date(d);
  if (bucket === 'day') {
    copy.setUTCHours(0, 0, 0, 0);
  } else if (bucket === 'week') {
    copy.setUTCHours(0, 0, 0, 0);
    const dow = copy.getUTCDay();
    copy.setUTCDate(copy.getUTCDate() - dow);
  } else {
    copy.setUTCHours(0, 0, 0, 0);
    copy.setUTCDate(1);
  }
  return copy.toISOString().slice(0, 10);
}

export function useBrandYieldAnalytics({ officeId, bucket = 'day', days = 90 }: Params = {}) {
  return useQuery<BrandYieldData>({
    queryKey: ['brand-yield-analytics', officeId ?? 'all', bucket, days],
    queryFn: async () => {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - days);
      const startIso = start.toISOString().slice(0, 10);

      let q = supabase
        .from('production_batches')
        .select('brand, batch_date, tobacco_lbs, boxes_produced, tubes_total')
        .eq('is_test', false)
        .gte('batch_date', startIso)
        .order('batch_date', { ascending: true });

      if (officeId) q = q.eq('office_id', officeId);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        brand: string;
        batch_date: string;
        tobacco_lbs: number | null;
        boxes_produced: number | null;
        tubes_total: number | null;
      }>;

      // Aggregate raw totals per bucket / brand
      const map = new Map<string, BrandYieldPoint>();
      const brandsSet = new Set<string>();
      for (const r of rows) {
        const brand = (r.brand || 'unknown').toLowerCase();
        brandsSet.add(brand);
        const bk = bucketKey(new Date(r.batch_date), bucket);
        const key = `${bk}__${brand}`;
        const cur = map.get(key) || {
          bucket: bk,
          brand,
          lbs_in: 0,
          boxes_out: 0,
          tubes_out: 0,
          batches: 0,
          boxes_per_lb: 0,
          lbs_per_box: 0,
          tubes_per_box: 0,
          grams_per_tube: 0,
        };
        cur.lbs_in += Number(r.tobacco_lbs || 0);
        cur.boxes_out += Number(r.boxes_produced || 0);
        cur.tubes_out += Number(r.tubes_total || 0);
        cur.batches += 1;
        map.set(key, cur);
      }

      // Derive per-bucket ratios
      const points = Array.from(map.values()).map(p => ({
        ...p,
        boxes_per_lb: p.lbs_in > 0 ? Number((p.boxes_out / p.lbs_in).toFixed(3)) : 0,
        lbs_per_box: p.boxes_out > 0 ? Number((p.lbs_in / p.boxes_out).toFixed(3)) : 0,
        tubes_per_box: p.boxes_out > 0 ? Number((p.tubes_out / p.boxes_out).toFixed(2)) : 0,
        grams_per_tube: p.tubes_out > 0 ? Number(((p.lbs_in * GRAMS_PER_LB) / p.tubes_out).toFixed(3)) : 0,
      })).sort((a, b) => a.bucket.localeCompare(b.bucket));

      // Per-brand summary + anomaly flags (yield AND grams/tube)
      const summaries: BrandYieldSummary[] = Array.from(brandsSet).map(brand => {
        const bp = points.filter(p => p.brand === brand && p.lbs_in > 0);
        const total_lbs = bp.reduce((s, p) => s + p.lbs_in, 0);
        const total_boxes = bp.reduce((s, p) => s + p.boxes_out, 0);
        const total_tubes = bp.reduce((s, p) => s + p.tubes_out, 0);

        const avg_boxes_per_lb = total_lbs > 0 ? total_boxes / total_lbs : 0;
        const avg_lbs_per_box = total_boxes > 0 ? total_lbs / total_boxes : 0;
        const avg_tubes_per_box = total_boxes > 0 ? total_tubes / total_boxes : 0;
        const avg_grams_per_tube = total_tubes > 0 ? (total_lbs * GRAMS_PER_LB) / total_tubes : 0;

        // Yield baseline (mean of bucket yields)
        const baseline = bp.length > 0
          ? bp.reduce((s, p) => s + p.boxes_per_lb, 0) / bp.length
          : 0;
        const latest = bp.length > 0 ? bp[bp.length - 1].boxes_per_lb : 0;
        const variance_pct = baseline > 0 ? ((latest - baseline) / baseline) * 100 : 0;
        let anomaly: 'normal' | 'low' | 'high' = 'normal';
        if (baseline > 0 && bp.length >= 2) {
          if (variance_pct < -15) anomaly = 'low';
          else if (variance_pct > 15) anomaly = 'high';
        }

        // Grams/tube baseline (only buckets with tubes recorded)
        const gp = bp.filter(p => p.tubes_out > 0);
        const baseline_g = gp.length > 0
          ? gp.reduce((s, p) => s + p.grams_per_tube, 0) / gp.length
          : 0;
        const latest_g = gp.length > 0 ? gp[gp.length - 1].grams_per_tube : 0;
        const grams_variance_pct = baseline_g > 0 ? ((latest_g - baseline_g) / baseline_g) * 100 : 0;
        let grams_anomaly: 'normal' | 'overstuffed' | 'understuffed' = 'normal';
        if (baseline_g > 0 && gp.length >= 2) {
          if (grams_variance_pct > 15) grams_anomaly = 'overstuffed';
          else if (grams_variance_pct < -15) grams_anomaly = 'understuffed';
        }

        return {
          brand,
          total_lbs: Number(total_lbs.toFixed(2)),
          total_boxes,
          total_tubes,
          avg_boxes_per_lb: Number(avg_boxes_per_lb.toFixed(3)),
          baseline_boxes_per_lb: Number(baseline.toFixed(3)),
          latest_boxes_per_lb: Number(latest.toFixed(3)),
          variance_pct: Number(variance_pct.toFixed(1)),
          anomaly,
          avg_lbs_per_box: Number(avg_lbs_per_box.toFixed(3)),
          avg_tubes_per_box: Number(avg_tubes_per_box.toFixed(2)),
          avg_grams_per_tube: Number(avg_grams_per_tube.toFixed(2)),
          baseline_grams_per_tube: Number(baseline_g.toFixed(2)),
          latest_grams_per_tube: Number(latest_g.toFixed(2)),
          grams_variance_pct: Number(grams_variance_pct.toFixed(1)),
          grams_anomaly,
          batches: bp.length,
        };
      }).sort((a, b) => b.total_boxes - a.total_boxes);

      return {
        points,
        summaries,
        brands: Array.from(brandsSet).sort(),
        range: { start: startIso, end: new Date().toISOString().slice(0, 10) },
      };
    },
  });
}
