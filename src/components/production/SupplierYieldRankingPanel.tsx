/**
 * SupplierYieldRankingPanel — Supplier Performance & Yield Intelligence
 * 
 * Ranked display of supplier efficiency, stability, waste, and trends
 * with admin insight cards and baseline comparison.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useSupplierYieldIntelligence, SupplierYield } from '@/hooks/useSupplierYieldIntelligence';
import {
  Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Factory, Shield, Activity, BarChart3, Crown, Gauge, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const bandConfig = {
  above: { label: 'Above Baseline', color: 'text-hud-green', bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  within: { label: 'Within 3%', color: 'text-hud-amber', bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  below: { label: 'Below Baseline', color: 'text-destructive', bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const trendConfig = {
  improving: { label: 'Improving', icon: TrendingUp, color: 'text-hud-green' },
  declining: { label: 'Declining', icon: TrendingDown, color: 'text-destructive' },
  stable: { label: 'Stable', icon: Minus, color: 'text-muted-foreground' },
  no_data: { label: 'No Recent Data', icon: Minus, color: 'text-muted-foreground' },
};

export function SupplierYieldRankingPanel() {
  const { data: suppliers = [], isLoading } = useSupplierYieldIntelligence();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading supplier yield data...</p>
        </div>
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Factory className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Supplier Yield Data Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Assign suppliers to production batches to start tracking yield performance.
            The ranking engine activates once batches with supplier links are approved.
          </p>
        </CardContent>
      </Card>
    );
  }

  const globalBaseline = suppliers[0]?.global_avg_boxes_per_lb || 0;
  const bestSupplier = suppliers[0];
  const mostStable = [...suppliers].sort((a, b) => b.yield_stability_score - a.yield_stability_score)[0];
  const highestVariance = [...suppliers].sort((a, b) => b.variance_frequency - a.variance_frequency)[0];
  const improving30d = suppliers.filter(s => s.trend_direction === 'improving');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Supplier Yield Rankings
        </h2>
        <Badge variant="outline" className="text-xs">
          {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} tracked
        </Badge>
      </div>

      {/* Global Baseline Banner */}
      {globalBaseline > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">Global Yield Baseline</p>
              <p className="text-xs text-muted-foreground">
                Average across all suppliers: <span className="font-mono font-medium">{globalBaseline.toFixed(4)}</span> boxes/lb
                · Suppliers are ranked and scored against this baseline
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Insight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightCard
          icon={<Crown className="h-4 w-4 text-yellow-500" />}
          label="Best Performing"
          value={bestSupplier?.supplier_name || '—'}
          detail={`${bestSupplier?.avg_boxes_per_lb.toFixed(4)} boxes/lb · ${bestSupplier?.batch_count} batches`}
          variant="green"
        />
        <InsightCard
          icon={<Gauge className="h-4 w-4 text-primary" />}
          label="Most Stable"
          value={mostStable?.supplier_name || '—'}
          detail={`Stability: ${mostStable?.yield_stability_score.toFixed(1)} · Variance freq: ${mostStable?.variance_frequency}%`}
          variant="default"
        />
        <InsightCard
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          label="Highest Variance"
          value={highestVariance?.supplier_name || '—'}
          detail={`${highestVariance?.variance_frequency}% batches deviate >5% · Waste: ${highestVariance?.avg_waste_pct}%`}
          variant="red"
        />
        <InsightCard
          icon={<TrendingUp className="h-4 w-4 text-hud-green" />}
          label="Improving (30d)"
          value={improving30d.length > 0 ? `${improving30d.length} supplier${improving30d.length !== 1 ? 's' : ''}` : 'None'}
          detail={improving30d.length > 0 ? improving30d.map(s => s.supplier_name).join(', ') : 'No 30-day improvement detected'}
          variant={improving30d.length > 0 ? 'green' : 'default'}
        />
      </div>

      {/* Main Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Yield Efficiency Rankings
          </CardTitle>
          <CardDescription>
            Suppliers ranked by average boxes per lb. Efficiency score combines yield advantage, waste rate, and consistency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Boxes/LB</TableHead>
                  <TableHead className="text-right">LBS/Box</TableHead>
                  <TableHead className="text-right">Waste %</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead className="text-right">Efficiency</TableHead>
                  <TableHead className="text-right">Variance Freq</TableHead>
                  <TableHead>Baseline</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => {
                  const trend = trendConfig[s.trend_direction];
                  const band = bandConfig[s.baseline_band];
                  const TrendIcon = trend.icon;

                  return (
                    <TableRow key={s.supplier_id} className={cn(
                      s.baseline_band === 'below' && 'bg-destructive/5'
                    )}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-lg">{s.yield_rank}</span>
                          {s.yield_rank === 1 && <Crown className="h-4 w-4 text-yellow-500" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{s.supplier_name}</span>
                          {s.last_batch_date && (
                            <p className="text-[10px] text-muted-foreground">
                              Last: {format(new Date(s.last_batch_date), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {s.avg_boxes_per_lb.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {s.avg_lbs_per_box.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={cn(s.avg_waste_pct > 5 && 'text-destructive font-semibold')}>
                          {s.avg_waste_pct}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {s.batch_count}
                        {s.batch_count_30d > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({s.batch_count_30d} recent)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress
                            value={s.efficiency_score}
                            className={cn('h-2 w-16', 
                              s.efficiency_score >= 70 && '[&>div]:bg-hud-green',
                              s.efficiency_score >= 40 && s.efficiency_score < 70 && '[&>div]:bg-hud-amber',
                              s.efficiency_score < 40 && '[&>div]:bg-destructive'
                            )}
                          />
                          <span className={cn('font-mono font-bold text-sm',
                            s.efficiency_score >= 70 ? 'text-hud-green' :
                            s.efficiency_score >= 40 ? 'text-hud-amber' : 'text-destructive'
                          )}>
                            {s.efficiency_score}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={cn(s.variance_frequency > 20 && 'text-destructive font-semibold')}>
                          {s.variance_frequency}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px]', band.bg)}>
                          {band.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TrendIcon className={cn('h-3.5 w-3.5', trend.color)} />
                          <span className={cn('text-xs', trend.color)}>{trend.label}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Stability Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Stability & Consistency Analysis
          </CardTitle>
          <CardDescription>
            Yield stability score measures how consistent a supplier's output is (higher = more predictable).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {suppliers.map((s) => (
              <div key={s.supplier_id} className="flex items-center gap-4">
                <div className="w-36 truncate text-sm font-medium">{s.supplier_name}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={Math.min(100, s.yield_stability_score)}
                      className="h-3 flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {s.yield_stability_score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-24">
                  <Badge variant="outline" className="text-[10px]">
                    σ {s.stddev_boxes_per_lb !== null ? s.stddev_boxes_per_lb.toFixed(4) : '—'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══ Sub-components ═══

function InsightCard({ icon, label, value, detail, variant = 'default' }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  variant?: 'default' | 'green' | 'amber' | 'red';
}) {
  const borderColor = {
    default: 'border-border/50',
    green: 'border-hud-green/30',
    amber: 'border-hud-amber/30',
    red: 'border-destructive/30',
  }[variant];

  return (
    <Card className={cn('border', borderColor)}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-sm font-bold truncate">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{detail}</p>
      </CardContent>
    </Card>
  );
}
