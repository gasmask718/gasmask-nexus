/**
 * MARGIN ANALYTICS PANEL
 * Shows margin analysis across batches — admin/manager only.
 * - Brand-level margin summary
 * - Low-margin alerts (<20%)
 * - Trend visualization
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMarginAnalysis, type MarginAnalysis as MarginData } from '@/hooks/useBatchCosts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Info,
  Package,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarginAnalyticsProps {
  officeId: string;
}

export function MarginAnalytics({ officeId }: MarginAnalyticsProps) {
  const { data: margins = [], isLoading } = useMarginAnalysis(officeId);

  // Only batches with cost data
  const costedBatches = margins.filter(m => m.total_cost !== null && m.total_cost > 0);
  const lowMarginBatches = costedBatches.filter(
    m => m.margin_pct_wholesale !== null && m.margin_pct_wholesale < 20
  );

  // Brand aggregation
  const brandStats = costedBatches.reduce<Record<string, {
    brand: string;
    totalCost: number;
    totalBoxes: number;
    totalRevenue: number;
    batchCount: number;
    avgMargin: number;
    margins: number[];
  }>>((acc, m) => {
    const key = m.brand;
    if (!acc[key]) {
      acc[key] = {
        brand: key,
        totalCost: 0,
        totalBoxes: 0,
        totalRevenue: 0,
        batchCount: 0,
        avgMargin: 0,
        margins: [],
      };
    }
    acc[key].totalCost += m.total_cost || 0;
    acc[key].totalBoxes += m.boxes_produced || 0;
    acc[key].totalRevenue += (m.wholesale_price_per_box || 0) * (m.boxes_produced || 0);
    acc[key].batchCount += 1;
    if (m.margin_pct_wholesale !== null) acc[key].margins.push(m.margin_pct_wholesale);
    return acc;
  }, {});

  // Compute averages
  Object.values(brandStats).forEach(stat => {
    stat.avgMargin = stat.margins.length > 0
      ? stat.margins.reduce((a, b) => a + b, 0) / stat.margins.length
      : 0;
  });

  // Global stats
  const totalCost = costedBatches.reduce((s, m) => s + (m.total_cost || 0), 0);
  const totalBoxes = costedBatches.reduce((s, m) => s + (m.boxes_produced || 0), 0);
  const avgCostPerBox = totalBoxes > 0 ? totalCost / totalBoxes : 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Low Margin Alert */}
      {lowMarginBatches.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-destructive">
                  {lowMarginBatches.length} batch{lowMarginBatches.length > 1 ? 'es' : ''} below 20% margin
                </p>
                <div className="mt-2 space-y-1">
                  {lowMarginBatches.slice(0, 5).map(m => (
                    <div key={m.batch_id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs capitalize">{m.brand}</Badge>
                      <span>{m.batch_date}</span>
                      <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">
                        {m.margin_pct_wholesale?.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Costed Batches"
          value={costedBatches.length.toString()}
          sublabel={`of ${margins.length} total`}
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          label="Total Production Cost"
          value={`$${totalCost.toFixed(0)}`}
          sublabel={`${totalBoxes} boxes`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <StatCard
          label="Avg Cost/Box"
          value={`$${avgCostPerBox.toFixed(2)}`}
          sublabel="across all brands"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label="Low Margin Alerts"
          value={lowMarginBatches.length.toString()}
          sublabel="below 20%"
          icon={<AlertTriangle className="h-4 w-4" />}
          alert={lowMarginBatches.length > 0}
        />
      </div>

      {/* Brand Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Margin by Brand
          </CardTitle>
          <CardDescription>Aggregate cost and margin analysis per brand</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(brandStats).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No cost data yet. Add costs to batches to see margin analytics.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.values(brandStats)
                .sort((a, b) => b.avgMargin - a.avgMargin)
                .map(stat => {
                  const costPerBox = stat.totalBoxes > 0 ? stat.totalCost / stat.totalBoxes : 0;
                  const isHealthy = stat.avgMargin >= 20;

                  return (
                    <div
                      key={stat.brand}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize font-semibold">
                          {stat.brand}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {stat.batchCount} batch{stat.batchCount > 1 ? 'es' : ''} · {stat.totalBoxes} boxes
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Cost/Box</div>
                          <div className="text-sm font-mono font-medium">${costPerBox.toFixed(2)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Avg Margin</div>
                          <Badge className={cn(
                            'font-mono text-xs',
                            isHealthy
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                          )}>
                            {isHealthy ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {stat.avgMargin.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Batch Costs Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Batch Costs</CardTitle>
        </CardHeader>
        <CardContent>
          {costedBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No costed batches yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 px-2">Brand</th>
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-right py-2 px-2">Boxes</th>
                    <th className="text-right py-2 px-2">Total Cost</th>
                    <th className="text-right py-2 px-2">Cost/Box</th>
                    <th className="text-right py-2 px-2">WS Price</th>
                    <th className="text-right py-2 px-2">Margin</th>
                    <th className="text-center py-2 px-2">State</th>
                  </tr>
                </thead>
                <tbody>
                  {costedBatches.slice(0, 20).map(m => (
                    <tr key={m.batch_id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 px-2 capitalize font-medium">{m.brand}</td>
                      <td className="py-2 px-2 text-muted-foreground">{m.batch_date || '—'}</td>
                      <td className="py-2 px-2 text-right font-mono">{m.boxes_produced || 0}</td>
                      <td className="py-2 px-2 text-right font-mono">${(m.total_cost || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-mono">${(m.cost_per_box || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-mono">${(m.wholesale_price_per_box || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right">
                        {m.margin_pct_wholesale !== null ? (
                          <Badge className={cn(
                            'text-xs font-mono',
                            (m.margin_pct_wholesale ?? 0) >= 20
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                          )}>
                            {m.margin_pct_wholesale?.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className="text-xs capitalize">
                          {m.inventory_state?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon,
  alert = false,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <Card className={cn(alert && 'border-destructive/30')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={cn('text-muted-foreground', alert && 'text-destructive')}>{icon}</span>
        </div>
        <div className={cn('text-xl font-bold font-mono', alert && 'text-destructive')}>{value}</div>
        <div className="text-xs text-muted-foreground">{sublabel}</div>
      </CardContent>
    </Card>
  );
}
