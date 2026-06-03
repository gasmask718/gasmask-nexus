/**
 * useBrandYieldAnalytics — LBS → BOXES analytics per brand over time.
 * Aggregates production_batches into day / week / month buckets and
 * computes per-brand yield (boxes_per_lb) + anomaly flags vs that
 * brand's own rolling baseline.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type YieldBucket = 'day' | 'week' | 'month';

export interface BrandYieldPoint {
  bucket: string;        // ISO date for the bucket start
  brand: string;
  lbs_in: number;
  boxes_out: number;
  batches: number;
  boxes_per_lb: number;  // 0 when lbs_in is 0
}

export interface BrandYieldSummary {
  brand: string;
  total_lbs: number;
  total_boxes: number;
  avg_boxes_per_lb: number;
  baseline_boxes_per_lb: number; // rolling mean across all buckets
  latest_boxes_per_lb: number;
  variance_pct: number;            // (latest - baseline) / baseline * 100
  anomaly: 'normal' | 'low' | 'high';
  batches: number;
}

export interface BrandYieldData {
  points: BrandYieldPoint[];     // long-form for charts
  summaries: BrandYieldSummary[];
  brands: string[];
  range: { start: string; end: string };
}

interface Params {
  officeId?: string | null;
  bucket?: YieldBucket;
  days?: number; // window size, default 90
}

function bucketKey(d: Date, bucket: YieldBucket): string {
  const copy = new Date(d);
  if (bucket === 'day') {
    copy.setUTCHours(0, 0, 0, 0);
  } else if (bucket === 'week') {
    copy.setUTCHours(0, 0, 0, 0);
    const dow = copy.getUTCDay(); // 0=Sun
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
        .select('brand, batch_date, tobacco_lbs, boxes_produced')
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
      }>;

      // Aggregate
      const map = new Map<string, BrandYieldPoint>();
      const brandsSet = new Set<string>();
      for (const r of rows) {
        const brand = (r.brand || 'unknown').toLowerCase();
        brandsSet.add(brand);
        const key = `${bucketKey(new Date(r.batch_date), bucket)}__${brand}`;
        const cur = map.get(key) || {
          bucket: bucketKey(new Date(r.batch_date), bucket),
          brand,
          lbs_in: 0,
          boxes_out: 0,
          batches: 0,
          boxes_per_lb: 0,
        };
        cur.lbs_in += Number(r.tobacco_lbs || 0);
        cur.boxes_out += Number(r.boxes_produced || 0);
        cur.batches += 1;
        map.set(key, cur);
      }

      const points = Array.from(map.values()).map(p => ({
        ...p,
        boxes_per_lb: p.lbs_in > 0 ? Number((p.boxes_out / p.lbs_in).toFixed(3)) : 0,
      })).sort((a, b) => a.bucket.localeCompare(b.bucket));

      // Per-brand summary + anomaly flag
      const summaries: BrandYieldSummary[] = Array.from(brandsSet).map(brand => {
        const bp = points.filter(p => p.brand === brand && p.lbs_in > 0);
        const total_lbs = bp.reduce((s, p) => s + p.lbs_in, 0);
        const total_boxes = bp.reduce((s, p) => s + p.boxes_out, 0);
        const avg = total_lbs > 0 ? total_boxes / total_lbs : 0;
        // baseline = mean of bucket boxes_per_lb (equal weight per period)
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
        return {
          brand,
          total_lbs: Number(total_lbs.toFixed(2)),
          total_boxes,
          avg_boxes_per_lb: Number(avg.toFixed(3)),
          baseline_boxes_per_lb: Number(baseline.toFixed(3)),
          latest_boxes_per_lb: Number(latest.toFixed(3)),
          variance_pct: Number(variance_pct.toFixed(1)),
          anomaly,
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
