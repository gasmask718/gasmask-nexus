/**
 * Sales Velocity & Demand Alignment Panel
 * Sections 6-8 of Master Prompt B — Production × Sales Velocity Closed Loop
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useInventoryCoverage,
  getRiskBadgeVariant,
  getDemandTrendIcon,
  getDemandTrendColor,
  InventoryCoverage,
} from '@/hooks/useSalesVelocity';
import {
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  ShieldAlert,
  Flame,
  Boxes,
  Factory,
  BarChart3,
} from 'lucide-react';

function RiskBadge({ risk }: { risk: string }) {
  const labels: Record<string, string> = {
    critical: 'CRITICAL',
    red: 'HIGH RISK',
    amber: 'MONITOR',
    green: 'HEALTHY',
    no_demand: 'NO DEMAND',
  };
  return (
    <Badge variant={getRiskBadgeVariant(risk)} className="text-xs uppercase tracking-wider">
      {labels[risk] || risk}
    </Badge>
  );
}

function DemandTrend({ trend }: { trend: string }) {
  const icon = getDemandTrendIcon(trend);
  const color = getDemandTrendColor(trend);
  const labels: Record<string, string> = {
    accelerating: 'Accelerating',
    declining: 'Declining',
    stable: 'Stable',
  };
  const Icon = trend === 'accelerating' ? TrendingUp : trend === 'declining' ? TrendingDown : ArrowRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {labels[trend] || trend}
    </span>
  );
}

function CoverageBar({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-muted-foreground">N/A</span>;
  const pct = Math.min(100, (days / 45) * 100);
  const color =
    days < 7 ? 'bg-destructive' :
    days < 14 ? 'bg-destructive/70' :
    days <= 21 ? 'bg-yellow-500' :
    'bg-emerald-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-12 text-right">{days.toFixed(0)}d</span>
    </div>
  );
}

function ExecutiveInsights({ data }: { data: InventoryCoverage[] }) {
  const atRisk = data.filter(d => d.risk_level === 'critical' || d.risk_level === 'red');
  const overstock = data.filter(d => d.is_overstock);
  const totalRecommendedLbs = data.reduce((sum, d) => sum + (d.recommended_lbs_to_produce || 0), 0);
  const totalProcurementLbs = data.reduce((sum, d) => sum + (d.procurement_needed_lbs || 0), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card className={atRisk.length > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className={`h-4 w-4 ${atRisk.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stockout Risk</span>
          </div>
          <p className="text-2xl font-bold">{atRisk.length}</p>
          <p className="text-xs text-muted-foreground">
            {atRisk.length > 0
              ? atRisk.map(r => r.brand).join(', ')
              : 'All brands healthy'}
          </p>
        </CardContent>
      </Card>

      <Card className={overstock.length > 0 ? 'border-yellow-500/50 bg-yellow-500/5' : ''}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Boxes className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overstock</span>
          </div>
          <p className="text-2xl font-bold">{overstock.length}</p>
          <p className="text-xs text-muted-foreground">
            {overstock.length > 0 ? '>45 days coverage' : 'No overstock detected'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Factory className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Produce Next 30d</span>
          </div>
          <p className="text-2xl font-bold">{totalRecommendedLbs.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">lbs</span></p>
          <p className="text-xs text-muted-foreground">Recommended production</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Procurement</span>
          </div>
          <p className="text-2xl font-bold">{totalProcurementLbs.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">lbs</span></p>
          <p className="text-xs text-muted-foreground">Raw material needed</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function SalesVelocityPanel() {
  const { data, isLoading, error } = useInventoryCoverage();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading demand intelligence…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-8 text-center text-destructive">
          Failed to load sales velocity data. Ensure finalized invoices exist.
        </CardContent>
      </Card>
    );
  }

  const items = data || [];
  const hasCritical = items.some(d => d.risk_level === 'critical');

  return (
    <div className="space-y-6">
      {/* Critical alert banner */}
      {hasCritical && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-destructive">CRITICAL STOCKOUT WARNING</p>
              <p className="text-xs text-destructive/80">
                {items.filter(d => d.risk_level === 'critical').map(d => d.brand).join(', ')} —
                less than 7 days of inventory remaining. Immediate production required.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Executive insight cards */}
      <ExecutiveInsights data={items} />

      {/* Per-brand demand alignment table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Production Demand Alignment
          </CardTitle>
          <CardDescription>
            Per-brand inventory coverage, velocity, and production recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Flame className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sales velocity data available yet.</p>
              <p className="text-xs mt-1">Finalize invoices to populate demand intelligence.</p>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-[700px]">
                {/* Header */}
                <div className="grid grid-cols-8 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 border-b">
                  <div>Brand</div>
                  <div className="text-right">Inventory</div>
                  <div className="text-right">Velocity/Day</div>
                  <div>Coverage</div>
                  <div className="text-center">Risk</div>
                  <div className="text-center">Trend</div>
                  <div className="text-right">Produce (lbs)</div>
                  <div className="text-right">Procure (lbs)</div>
                </div>

                {/* Rows sorted by risk priority */}
                {[...items]
                  .sort((a, b) => {
                    const riskOrder: Record<string, number> = { critical: 0, red: 1, amber: 2, green: 3, no_demand: 4 };
                    return (riskOrder[a.risk_level] ?? 5) - (riskOrder[b.risk_level] ?? 5);
                  })
                  .map((item) => (
                    <div
                      key={item.brand}
                      className={`grid grid-cols-8 gap-2 items-center py-3 border-b border-border/50 last:border-0 ${
                        item.risk_level === 'critical' ? 'bg-destructive/5' : ''
                      }`}
                    >
                      <div className="font-medium capitalize text-sm">{item.brand}</div>
                      <div className="text-right font-mono text-sm">{item.current_boxes_available} <span className="text-xs text-muted-foreground">boxes</span></div>
                      <div className="text-right font-mono text-sm">{item.avg_daily_velocity_30d}</div>
                      <div><CoverageBar days={item.days_of_inventory_remaining} /></div>
                      <div className="text-center"><RiskBadge risk={item.risk_level} /></div>
                      <div className="text-center"><DemandTrend trend={item.demand_trend} /></div>
                      <div className="text-right font-mono text-sm">{item.recommended_lbs_to_produce?.toFixed(0) ?? '—'}</div>
                      <div className="text-right font-mono text-sm">
                        {item.procurement_needed_lbs != null && item.procurement_needed_lbs > 0
                          ? <span className="text-destructive font-semibold">{item.procurement_needed_lbs.toFixed(0)}</span>
                          : <span className="text-muted-foreground">0</span>
                        }
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Velocity details */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sales Velocity Breakdown</CardTitle>
            <CardDescription>7/14/30-day sales windows per brand</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <Card key={item.brand} className="bg-muted/30">
                  <CardContent className="pt-4 pb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{item.brand}</span>
                      <DemandTrend trend={item.demand_trend} />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{item.units_sold_last_7_days}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">7 Days</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{item.units_sold_last_14_days}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">14 Days</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{item.units_sold_last_30_days}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">30 Days</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                      <span>Raw available: {item.raw_inventory_lbs} lbs</span>
                      <span>Baseline: {item.baseline_boxes_per_lb?.toFixed(2) ?? '—'} box/lb</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
