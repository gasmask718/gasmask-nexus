/**
 * Sales Velocity & Demand Alignment Panel
 * Stability-First Discipline: Reservation-Aware Procurement
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  ShieldCheck,
  Flame,
  Boxes,
  Factory,
  BarChart3,
  Lock,
  Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const anyBlocked = data.some(d => d.auto_draft_blocked);

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
              ? atRisk.map(r => `${r.brand} (${r.product_type})`).join(', ')
              : 'All products healthy'}
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

      <Card className={anyBlocked ? 'border-yellow-500/50 bg-yellow-500/5' : ''}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Procurement</span>
          </div>
          <p className="text-2xl font-bold">{totalProcurementLbs.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">lbs</span></p>
          <p className="text-xs text-muted-foreground">
            {anyBlocked ? '⚠ Auto-draft blocked — procure first' : 'Raw material needed'}
          </p>
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
  const anyBlocked = items.some(d => d.auto_draft_blocked);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Stability Mode Banner */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">Stability Mode: Protected Allocations Enforced</p>
              <p className="text-xs text-muted-foreground">
                Procurement uses product-reserved raw inventory. No cross-product borrowing. 30-day velocity baseline only.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">v2 — Reservation-Aware</Badge>
          </CardContent>
        </Card>

        {/* Auto-draft blocked banner */}
        {anyBlocked && (
          <Card className="border-yellow-500 bg-yellow-500/10">
            <CardContent className="py-3 flex items-center gap-3">
              <Lock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-700">AUTO-DRAFT PRODUCTION BLOCKED</p>
                <p className="text-xs text-yellow-600">
                  Unallocated buffer is below 8%. System can suggest batches but will not auto-generate. Procure raw material before producing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Critical alert banner */}
        {hasCritical && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="py-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-destructive">CRITICAL STOCKOUT WARNING</p>
                <p className="text-xs text-destructive/80">
                  {items.filter(d => d.risk_level === 'critical').map(d => `${d.brand} (${d.product_type})`).join(', ')} —
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
              Per-brand × product inventory coverage, reservation-aware procurement
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
                <div className="min-w-[1000px]">
                  {/* Header */}
                  <div className="grid grid-cols-11 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 border-b">
                    <div>Brand</div>
                    <div>Product</div>
                    <div className="text-right">Inventory</div>
                    <div className="text-right">Vel/Day</div>
                    <div>Coverage</div>
                    <div className="text-center">Risk</div>
                    <div className="text-center">Trend</div>
                    <div className="text-right">
                      <Tooltip>
                        <TooltipTrigger className="inline-flex items-center gap-1">Reserved <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Product's protected raw LBS allocation</TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-right">
                      <Tooltip>
                        <TooltipTrigger className="inline-flex items-center gap-1">Safe Raw <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Reserved + unallocated buffer (usable without stealing)</TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-right">Produce</div>
                    <div className="text-right">Procure</div>
                  </div>

                  {/* Rows sorted by risk priority */}
                  {[...items]
                    .sort((a, b) => {
                      const riskOrder: Record<string, number> = { critical: 0, red: 1, amber: 2, green: 3, no_demand: 4 };
                      return (riskOrder[a.risk_level] ?? 5) - (riskOrder[b.risk_level] ?? 5);
                    })
                    .map((item, idx) => (
                      <div
                        key={`${item.brand}-${item.product_type}-${idx}`}
                        className={`grid grid-cols-11 gap-2 items-center py-3 border-b border-border/50 last:border-0 ${
                          item.risk_level === 'critical' ? 'bg-destructive/5' : ''
                        } ${item.auto_draft_blocked ? 'bg-yellow-500/5' : ''}`}
                      >
                        <div className="font-medium capitalize text-sm">{item.brand}</div>
                        <div className="text-xs capitalize">
                          <Badge variant="outline" className="text-[10px]">{item.product_type}</Badge>
                        </div>
                        <div className="text-right font-mono text-sm">{item.current_boxes_available} <span className="text-xs text-muted-foreground">box</span></div>
                        <div className="text-right font-mono text-sm">{item.avg_daily_velocity_30d}</div>
                        <div><CoverageBar days={item.days_of_inventory_remaining} /></div>
                        <div className="text-center"><RiskBadge risk={item.risk_level} /></div>
                        <div className="text-center"><DemandTrend trend={item.demand_trend} /></div>
                        <div className="text-right font-mono text-sm text-muted-foreground">{item.raw_reserved_lbs?.toFixed(0) ?? '0'}</div>
                        <div className="text-right font-mono text-sm">{item.raw_safe_lbs?.toFixed(0) ?? '0'}</div>
                        <div className="text-right font-mono text-sm">{item.recommended_lbs_to_produce?.toFixed(0) ?? '—'}</div>
                        <div className="text-right font-mono text-sm">
                          {item.auto_draft_blocked && (
                            <Lock className="h-3 w-3 text-yellow-600 inline mr-1" />
                          )}
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
              <CardDescription>7/14/30-day sales windows per brand × product</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, idx) => (
                  <Card key={`${item.brand}-${item.product_type}-${idx}`} className="bg-muted/30">
                    <CardContent className="pt-4 pb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{item.brand}</span>
                          <Badge variant="outline" className="text-[10px]">{item.product_type}</Badge>
                        </div>
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
                      <Separator />
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Reserved: {item.raw_reserved_lbs?.toFixed(0) ?? '0'} lbs</span>
                        <span>Unallocated: {item.raw_unallocated_lbs?.toFixed(0) ?? '0'} lbs</span>
                        <span>Safe Raw: {item.raw_safe_lbs?.toFixed(0) ?? '0'} lbs</span>
                        <span>Baseline: {item.baseline_boxes_per_lb?.toFixed(2) ?? '—'} box/lb</span>
                      </div>
                      {item.auto_draft_blocked && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600 pt-1">
                          <Lock className="h-3 w-3" />
                          <span>Auto-draft blocked (buffer &lt;8%)</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
