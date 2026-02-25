/**
 * PROFIT PER POUND INTELLIGENCE PANEL
 * Financial-grade panel using snapshot data only.
 * Shows profit/lb by product type, size, and trends.
 * Includes allocation advisory signal.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useBatchCostHistory, type BatchCostHistoryRecord } from '@/hooks/useBatchCostHistory';
import { useInventoryCoverage } from '@/hooks/useSalesVelocity';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ProfitPerPoundPanelProps {
  officeId: string;
}

interface ConfigProfit {
  key: string;
  product_type: string;
  tube_size: string | null;
  bag_weight_grams: number | null;
  avg_profit_per_lb: number;
  avg_margin_pct: number;
  avg_cost_per_lb: number;
  avg_revenue_per_lb: number;
  batch_count: number;
}

export function ProfitPerPoundPanel({ officeId }: ProfitPerPoundPanelProps) {
  const { data: history = [], isLoading } = useBatchCostHistory(officeId);
  const { data: coverageData = [] } = useInventoryCoverage();
  // Filter records with profit data
  const profitRecords = useMemo(() =>
    history.filter(r =>
      (r.conversion_boxes_per_lb_snapshot || 0) > 0 &&
      (r.revenue_per_lb || 0) > 0
    ),
  [history]);

  // 30-day records
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const recent30d = useMemo(() =>
    profitRecords.filter(r => new Date(r.cost_snapshot_created_at) >= thirtyDaysAgo),
  [profitRecords, thirtyDaysAgo]);

  // Global averages (30d)
  const avg30dProfitPerLb = useMemo(() => {
    if (recent30d.length === 0) return 0;
    return recent30d.reduce((s, r) => s + (r.profit_per_lb || 0), 0) / recent30d.length;
  }, [recent30d]);

  // By product type
  const tubesRecords = useMemo(() => recent30d.filter(r => r.product_type === 'tubes'), [recent30d]);
  const bagsRecords = useMemo(() => recent30d.filter(r => r.product_type === 'bags'), [recent30d]);
  const tubesAvgProfit = tubesRecords.length > 0 ? tubesRecords.reduce((s, r) => s + (r.profit_per_lb || 0), 0) / tubesRecords.length : 0;
  const bagsAvgProfit = bagsRecords.length > 0 ? bagsRecords.reduce((s, r) => s + (r.profit_per_lb || 0), 0) / bagsRecords.length : 0;

  // Group by configuration (product_type + tube_size / bag_weight)
  const configProfits = useMemo<ConfigProfit[]>(() => {
    const map = new Map<string, BatchCostHistoryRecord[]>();
    for (const r of recent30d) {
      const key = r.product_type === 'tubes'
        ? `tubes|${r.tube_size || 'standard'}`
        : `bags|${r.bag_weight_grams || 'standard'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([key, records]) => {
      const first = records[0];
      return {
        key,
        product_type: first.product_type,
        tube_size: first.tube_size,
        bag_weight_grams: first.bag_weight_grams,
        avg_profit_per_lb: records.reduce((s, r) => s + (r.profit_per_lb || 0), 0) / records.length,
        avg_margin_pct: records.reduce((s, r) => s + (r.margin_pct || 0), 0) / records.length,
        avg_cost_per_lb: records.reduce((s, r) => s + (r.cost_per_lb || 0), 0) / records.length,
        avg_revenue_per_lb: records.reduce((s, r) => s + (r.revenue_per_lb || 0), 0) / records.length,
        batch_count: records.length,
      };
    }).sort((a, b) => b.avg_profit_per_lb - a.avg_profit_per_lb);
  }, [recent30d]);

  const top3 = configProfits.slice(0, 3);
  const bottom3 = configProfits.length > 3 ? configProfits.slice(-3).reverse() : [];

  // Trend data for chart
  const trendData = useMemo(() => {
    const sorted = [...profitRecords].sort(
      (a, b) => new Date(a.cost_snapshot_created_at).getTime() - new Date(b.cost_snapshot_created_at).getTime()
    );
    return sorted.map(r => ({
      date: new Date(r.cost_snapshot_created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      profit_per_lb: Math.round((r.profit_per_lb || 0) * 100) / 100,
      cost_per_lb: Math.round((r.cost_per_lb || 0) * 100) / 100,
      type: r.product_type,
    }));
  }, [profitRecords]);

  // Allocation advisory
  const allocationAdvisory = useMemo(() => {
    if (tubesAvgProfit <= 0 || bagsAvgProfit <= 0) return null;
    const diff = ((tubesAvgProfit - bagsAvgProfit) / bagsAvgProfit) * 100;
    if (diff > 15) {
      return {
        message: `Tubes yield $${(tubesAvgProfit - bagsAvgProfit).toFixed(2)}/lb more profit (+${diff.toFixed(0)}%). Consider allocation shift toward tubes.`,
        severity: 'amber' as const,
      };
    }
    if (diff < -15) {
      return {
        message: `Bags yield $${(bagsAvgProfit - tubesAvgProfit).toFixed(2)}/lb more profit (+${Math.abs(diff).toFixed(0)}%). Consider allocation shift toward bags.`,
        severity: 'amber' as const,
      };
    }
    return null;
  }, [tubesAvgProfit, bagsAvgProfit]);

  // 14-day decline detection
  const marginAlert = useMemo(() => {
    const fourteenAgo = new Date();
    fourteenAgo.setDate(fourteenAgo.getDate() - 14);
    const recent14 = profitRecords.filter(r => new Date(r.cost_snapshot_created_at) >= fourteenAgo);
    const older14 = profitRecords.filter(r => {
      const d = new Date(r.cost_snapshot_created_at);
      return d < fourteenAgo && d >= new Date(fourteenAgo.getTime() - 14 * 86400000);
    });
    if (recent14.length < 2 || older14.length < 2) return null;
    const recentAvg = recent14.reduce((s, r) => s + (r.profit_per_lb || 0), 0) / recent14.length;
    const olderAvg = older14.reduce((s, r) => s + (r.profit_per_lb || 0), 0) / older14.length;
    if (olderAvg > 0) {
      const decline = ((olderAvg - recentAvg) / olderAvg) * 100;
      if (decline > 10) return { decline: decline.toFixed(0), recentAvg, olderAvg };
    }
    return null;
  }, [profitRecords]);

  // Economic Throughput Score = Profit/lb × avg daily velocity
  const economicThroughput = useMemo(() => {
    if (configProfits.length === 0 || coverageData.length === 0) return [];
    return configProfits.map(c => {
      // Match velocity data by product_type (brand maps to product_type in coverage)
      const velocityMatch = coverageData.find(v =>
        v.product_type?.toLowerCase() === c.product_type?.toLowerCase()
      );
      const dailyVelocity = velocityMatch?.avg_daily_velocity_30d || 0;
      const score = c.avg_profit_per_lb * dailyVelocity;
      return {
        ...c,
        daily_velocity: dailyVelocity,
        throughput_score: score,
      };
    }).sort((a, b) => b.throughput_score - a.throughput_score);
  }, [configProfits, coverageData]);

  const getComparisonIcon = (value: number, avg: number) => {
    const diff = ((value - avg) / Math.max(avg, 0.01)) * 100;
    if (diff > 5) return <ArrowUpRight className="h-3 w-3 text-emerald-600" />;
    if (diff < -5) return <ArrowDownRight className="h-3 w-3 text-destructive" />;
    return <Minus className="h-3 w-3 text-amber-500" />;
  };

  const getConfigLabel = (c: ConfigProfit) => {
    if (c.product_type === 'tubes') return c.tube_size ? `${c.tube_size} Tubes` : 'Tubes (std)';
    if (c.product_type === 'bags') return c.bag_weight_grams ? `${c.bag_weight_grams}g Bags` : 'Bags (std)';
    return c.product_type;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Loading profit intelligence...</CardContent>
      </Card>
    );
  }

  if (profitRecords.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Scale className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No profit-per-pound data yet. Ensure batches have conversion and wholesale price snapshots before approval.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {marginAlert && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Margin Compression Detected</p>
              <p className="text-xs text-muted-foreground">
                Profit/lb declined {marginAlert.decline}% over 14 days (${marginAlert.olderAvg.toFixed(2)} → ${marginAlert.recentAvg.toFixed(2)}/lb)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {allocationAdvisory && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-3 flex items-center gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Allocation Advisory</p>
              <p className="text-xs text-muted-foreground">{allocationAdvisory.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Profit per Pound Intelligence
          </CardTitle>
          <CardDescription>Snapshot-based economics — never recalculated from live values</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Avg Profit/LB (30d)</p>
              <p className="text-xl font-mono font-bold">${avg30dProfitPerLb.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{recent30d.length} batches</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Tubes Profit/LB</p>
              <p className="text-xl font-mono font-bold flex items-center gap-1">
                ${tubesAvgProfit.toFixed(2)}
                {avg30dProfitPerLb > 0 && getComparisonIcon(tubesAvgProfit, avg30dProfitPerLb)}
              </p>
              <p className="text-[10px] text-muted-foreground">{tubesRecords.length} batches</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Bags Profit/LB</p>
              <p className="text-xl font-mono font-bold flex items-center gap-1">
                ${bagsAvgProfit.toFixed(2)}
                {avg30dProfitPerLb > 0 && getComparisonIcon(bagsAvgProfit, avg30dProfitPerLb)}
              </p>
              <p className="text-[10px] text-muted-foreground">{bagsRecords.length} batches</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Avg Margin %</p>
              <p className={cn(
                'text-xl font-mono font-bold',
                (recent30d.reduce((s, r) => s + (r.margin_pct || 0), 0) / Math.max(recent30d.length, 1)) >= 20
                  ? 'text-emerald-600' : 'text-destructive'
              )}>
                {(recent30d.reduce((s, r) => s + (r.margin_pct || 0), 0) / Math.max(recent30d.length, 1)).toFixed(1)}%
              </p>
              {recent30d.some(r => (r.margin_pct || 0) < 20) && (
                <p className="text-[10px] text-destructive flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> Some batches below 20%
                </p>
              )}
            </div>
          </div>

          {/* Profit by Configuration */}
          {configProfits.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-3">Profit by Configuration</h4>
                <div className="space-y-2">
                  {configProfits.map(c => {
                    const profitColor = c.avg_profit_per_lb > avg30dProfitPerLb * 1.05
                      ? 'text-emerald-600' : c.avg_profit_per_lb < avg30dProfitPerLb * 0.95
                        ? 'text-destructive' : 'text-amber-600';
                    return (
                      <div key={c.key} className="flex items-center justify-between py-1.5 px-2 rounded border bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{c.product_type}</Badge>
                          <span className="text-sm font-medium">{getConfigLabel(c)}</span>
                          <span className="text-[10px] text-muted-foreground">({c.batch_count} batches)</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <span className="text-muted-foreground">Cost: ${c.avg_cost_per_lb.toFixed(2)}/lb</span>
                          <span className="text-muted-foreground">Rev: ${c.avg_revenue_per_lb.toFixed(2)}/lb</span>
                          <span className={cn('font-semibold', profitColor)}>
                            ${c.avg_profit_per_lb.toFixed(2)}/lb
                          </span>
                          <span className={cn('font-medium', c.avg_margin_pct >= 20 ? 'text-emerald-600' : 'text-destructive')}>
                            {c.avg_margin_pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Top/Bottom configs */}
          {(top3.length > 0 || bottom3.length > 0) && (
            <>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {top3.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Most Profitable
                    </h4>
                    <div className="space-y-1.5">
                      {top3.map((c, i) => (
                        <div key={c.key} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50">
                          <span>#{i + 1} {getConfigLabel(c)}</span>
                          <span className="font-mono font-semibold text-emerald-700">${c.avg_profit_per_lb.toFixed(2)}/lb</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {bottom3.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" /> Least Profitable
                    </h4>
                    <div className="space-y-1.5">
                      {bottom3.map((c, i) => (
                        <div key={c.key} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-950/20 border border-red-200/50">
                          <span>#{i + 1} {getConfigLabel(c)}</span>
                          <span className="font-mono font-semibold text-destructive">${c.avg_profit_per_lb.toFixed(2)}/lb</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Economic Throughput Score */}
          {economicThroughput.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Economic Throughput Score
                  <Badge variant="outline" className="text-[9px] font-normal">Display Only</Badge>
                </h4>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Profit/lb × Daily Velocity — identifies which products are both profitable and moving fast.
                </p>
                <div className="space-y-1.5">
                  {economicThroughput.map((et, i) => (
                    <div key={et.key} className="flex items-center justify-between text-xs px-2.5 py-2 rounded border bg-muted/20">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono w-4">#{i + 1}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{et.product_type}</Badge>
                        <span className="font-medium">{getConfigLabel(et)}</span>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="text-muted-foreground">${et.avg_profit_per_lb.toFixed(2)}/lb</span>
                        <span className="text-muted-foreground">×</span>
                        <span className="text-muted-foreground">{et.daily_velocity.toFixed(1)} units/day</span>
                        <span className="text-muted-foreground">=</span>
                        <span className={cn(
                          'font-bold',
                          i === 0 ? 'text-emerald-600' : 'text-foreground'
                        )}>
                          {et.throughput_score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Trend Chart */}
          {trendData.length >= 2 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-3">Profit/LB Trend</h4>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                      <RechartsTooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="profit_per_lb"
                        name="Profit/LB"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cost_per_lb"
                        name="Cost/LB"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
