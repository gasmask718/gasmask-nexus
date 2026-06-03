/**
 * BrandYieldAnalyticsPanel — Lbs → Boxes per brand over time.
 * Trend views (day/week/month) with anomaly flags vs each brand's
 * rolling baseline. Mounted on the Production Portal "Yield" tab.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { AlertTriangle, TrendingDown, TrendingUp, Factory } from 'lucide-react';
import {
  useBrandYieldAnalytics,
  type YieldBucket,
  type BrandYieldPoint,
} from '@/hooks/useBrandYieldAnalytics';

interface Props {
  officeId?: string | null;
}

// Operator-facing brand display names (lowercased keys).
const BRAND_LABELS: Record<string, string> = {
  gasmask: 'GasMask Bags',
  gasmasktubes: 'GasMask Tubes',
  gasmaskbags: 'GasMask Bags',
  gasmaskredtops: 'GasMask Redtops',
  hotmama: 'HotMama',
  hotscolatti: 'Hotscolatti',
  'hotscolatti-light': 'Hotscolatti Light',
  'hotscolatti-dark': 'Hotscolatti Dark',
  hotscolattibros: 'Hotscolatti Bros',
  hotscalatibros: 'Hotscolatti Bros',
  grabba: 'Grabba R Us',
  grabba_r_us: 'Grabba R Us',
};

// Distinct colors keyed by brand. Fall back to a hashed palette.
const BRAND_COLORS: Record<string, string> = {
  gasmask: '#ef4444',
  gasmasktubes: '#3b82f6',
  gasmaskbags: '#ef4444',
  gasmaskredtops: '#dc2626',
  hotmama: '#ec4899',
  hotscolatti: '#f59e0b',
  'hotscolatti-light': '#fbbf24',
  'hotscolatti-dark': '#92400e',
  hotscolattibros: '#3b82f6',
  grabba: '#a855f7',
  grabba_r_us: '#a855f7',
};

const PALETTE = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#0ea5e9', '#84cc16'];

function brandLabel(brand: string): string {
  return BRAND_LABELS[brand] || brand;
}

function brandColor(brand: string, idx: number): string {
  return BRAND_COLORS[brand] || PALETTE[idx % PALETTE.length];
}

// Pivot long-form points into wide rows keyed by bucket.
function pivot(points: BrandYieldPoint[], brands: string[], metric: keyof BrandYieldPoint) {
  const map = new Map<string, Record<string, number | string>>();
  for (const p of points) {
    const row = map.get(p.bucket) || { bucket: p.bucket };
    row[p.brand] = (p[metric] as number) ?? 0;
    map.set(p.bucket, row);
  }
  // Ensure every brand key exists on every row (recharts is happier).
  const rows = Array.from(map.values()).map(r => {
    for (const b of brands) if (!(b in r)) r[b] = 0;
    return r;
  });
  return rows.sort((a, b) =>
    String(a.bucket).localeCompare(String(b.bucket))
  );
}

export function BrandYieldAnalyticsPanel({ officeId }: Props) {
  const [bucket, setBucket] = useState<YieldBucket>('day');
  const { data, isLoading } = useBrandYieldAnalytics({ officeId, bucket, days: bucket === 'day' ? 60 : bucket === 'week' ? 180 : 365 });

  const yieldRows = useMemo(
    () => (data ? pivot(data.points, data.brands, 'boxes_per_lb') : []),
    [data],
  );
  const gramsRows = useMemo(
    () => (data ? pivot(data.points, data.brands, 'grams_per_tube') : []),
    [data],
  );
  const lbsRows = useMemo(
    () => (data ? pivot(data.points, data.brands, 'lbs_in') : []),
    [data],
  );
  const boxesRows = useMemo(
    () => (data ? pivot(data.points, data.brands, 'boxes_out') : []),
    [data],
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" /> Brand Yield Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" /> Brand Yield Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center text-muted-foreground">
          No production batches recorded yet. Log a batch with tobacco lbs and boxes produced to populate trends.
        </CardContent>
      </Card>
    );
  }

  const anomalies = data.summaries.filter(s => s.anomaly !== 'normal');
  const gramsAnomalies = data.summaries.filter(s => s.grams_anomaly !== 'normal');

  return (
    <div className="space-y-4">
      {/* Header + bucket selector */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" /> Brand Yield Analytics
            <span className="text-xs font-normal text-muted-foreground ml-2">
              Lbs → Boxes → Tubes · {data.range.start} → {data.range.end}
            </span>
          </CardTitle>
          <Tabs value={bucket} onValueChange={v => setBucket(v as YieldBucket)}>
            <TabsList>
              <TabsTrigger value="day">Daily</TabsTrigger>
              <TabsTrigger value="week">Weekly</TabsTrigger>
              <TabsTrigger value="month">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
      </Card>

      {/* Per-brand summary cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.summaries.map((s, i) => {
          const color = brandColor(s.brand, i);
          const isLow = s.anomaly === 'low';
          const isHigh = s.anomaly === 'high';
          const isOver = s.grams_anomaly === 'overstuffed';
          const isUnder = s.grams_anomaly === 'understuffed';
          return (
            <Card key={s.brand} className="overflow-hidden">
              <div className="h-1" style={{ background: color }} />
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="font-semibold">{brandLabel(s.brand)}</div>
                  <div className="flex flex-wrap gap-1">
                    {isLow && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Low yield</Badge>}
                    {isHigh && <Badge variant="secondary" className="gap-1"><TrendingUp className="h-3 w-3" /> High yield</Badge>}
                    {isOver && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Overstuffed</Badge>}
                    {isUnder && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Understuffed</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Lbs in</div>
                    <div className="font-medium">{s.total_lbs.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Boxes out</div>
                    <div className="font-medium">{s.total_boxes.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Tubes out</div>
                    <div className="font-medium">{s.total_tubes.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Avg boxes/lb</div>
                    <div className="font-medium">{s.avg_boxes_per_lb.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Lbs/box</div>
                    <div className="font-medium">{s.avg_lbs_per_box.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Tubes/box</div>
                    <div className="font-medium">{s.avg_tubes_per_box.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Avg g/tube</div>
                    <div className="font-medium">{s.avg_grams_per_tube > 0 ? `${s.avg_grams_per_tube.toFixed(2)} g` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Yield Δ vs baseline</div>
                    <div className={`font-medium flex items-center gap-1 ${s.variance_pct < 0 ? 'text-destructive' : s.variance_pct > 0 ? 'text-emerald-600' : ''}`}>
                      {s.variance_pct < 0 ? <TrendingDown className="h-3 w-3" /> : s.variance_pct > 0 ? <TrendingUp className="h-3 w-3" /> : null}
                      {s.variance_pct > 0 ? '+' : ''}{s.variance_pct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(anomalies.length > 0 || gramsAnomalies.length > 0) && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="text-sm space-y-2">
              {anomalies.length > 0 && (
                <div>
                  <div className="font-semibold mb-1">Yield anomalies</div>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {anomalies.map(a => (
                      <li key={`y-${a.brand}`}>
                        <span className="font-medium text-foreground">{brandLabel(a.brand)}</span>{' '}
                        latest yield {a.latest_boxes_per_lb.toFixed(2)} boxes/lb vs baseline{' '}
                        {a.baseline_boxes_per_lb.toFixed(2)} ({a.variance_pct > 0 ? '+' : ''}{a.variance_pct.toFixed(1)}%)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {gramsAnomalies.length > 0 && (
                <div>
                  <div className="font-semibold mb-1">Tube fill anomalies (±15% g/tube)</div>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {gramsAnomalies.map(a => (
                      <li key={`g-${a.brand}`}>
                        <span className="font-medium text-foreground">{brandLabel(a.brand)}</span>{' '}
                        {a.grams_anomaly === 'overstuffed' ? 'overstuffed' : 'understuffed'} —{' '}
                        latest {a.latest_grams_per_tube.toFixed(2)} g/tube vs baseline{' '}
                        {a.baseline_grams_per_tube.toFixed(2)} ({a.grams_variance_pct > 0 ? '+' : ''}{a.grams_variance_pct.toFixed(1)}%)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yield trend (boxes / lb) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yield trend — boxes per lb</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yieldRows}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="bucket" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend formatter={(v) => brandLabel(String(v))} />
              {data.brands.map((b, i) => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  stroke={brandColor(b, i)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Grams-per-tube trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tube fill trend — grams per tube</CardTitle>
          <div className="text-xs text-muted-foreground">
            (tobacco_lbs × 453.592) ÷ tubes_total · ±15% drift flagged
          </div>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gramsRows}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="bucket" fontSize={11} />
              <YAxis fontSize={11} unit=" g" />
              <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)} g`} />
              <Legend formatter={(v) => brandLabel(String(v))} />
              {data.brands.map((b, i) => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  stroke={brandColor(b, i)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>


      {/* Lbs in / Boxes out side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lbs tobacco in</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lbsRows}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="bucket" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend formatter={(v) => brandLabel(String(v))} />
                {data.brands.map((b, i) => (
                  <Bar key={b} dataKey={b} stackId="lbs" fill={brandColor(b, i)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Boxes out</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={boxesRows}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="bucket" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend formatter={(v) => brandLabel(String(v))} />
                {data.brands.map((b, i) => (
                  <Bar key={b} dataKey={b} stackId="boxes" fill={brandColor(b, i)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
