/**
 * ConversionIntelligencePanel — Tobacco → Box Conversion Engine
 * 
 * Displays rolling averages, baseline-aware variance detection,
 * office comparison, batch history, and projection tools.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConversionIntelligence, ConversionBatch } from '@/hooks/useConversionIntelligence';
import { useConversionBaseline, getVarianceLevel } from '@/hooks/useConversionBaseline';
import { useProductionOffices } from '@/hooks/useProductionPortal';
import type { ProductType } from '@/hooks/useProductionPortal';
import {
  Factory, TrendingUp, TrendingDown, AlertTriangle, BarChart3,
  Weight, Box, Flame, DollarSign, Activity, Trophy, Minus, Shield, Building2, Timer
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function ConversionIntelligencePanel() {
  const { data: offices = [] } = useProductionOffices();
  const [selectedOffice, setSelectedOffice] = useState<string>('all');
  const [selectedProductType, setSelectedProductType] = useState<ProductType>('tubes');

  const officeId = selectedOffice === 'all' ? undefined : selectedOffice;
  const { data, isLoading } = useConversionIntelligence(officeId, selectedProductType);
  const { data: baselineData } = useConversionBaseline(officeId, selectedProductType);

  const stats = data?.stats;
  const batches = data?.batches || [];
  const baseline = baselineData?.active;
  const unitLabel = selectedProductType === 'bags' ? 'bags' : 'tubes';
  const unitSingular = selectedProductType === 'bags' ? 'bag' : 'tube';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading conversion data...</p>
        </div>
      </div>
    );
  }

  if (!stats || batches.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Factory className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Conversion Data Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Start logging batches with tobacco LBS input and boxes output to build your conversion intelligence.
            After 10+ approved batches, the baseline engine activates automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  const deviationAlert = stats.rolling7.deviationPct > 8;

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Flame className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Conversion Intelligence
        </h2>
        <Tabs value={selectedProductType} onValueChange={(v) => setSelectedProductType(v as ProductType)}>
          <TabsList>
            <TabsTrigger value="tubes">🚬 Tubes</TabsTrigger>
            <TabsTrigger value="bags">🛍️ Bags</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={selectedOffice} onValueChange={setSelectedOffice}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All Offices" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Offices</SelectItem>
            {offices.filter(o => o.active !== false).map(o => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Baseline Status */}
      {baseline && baseline.calculated_from_batch_count >= 10 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">Baseline Active — {baseline.calculated_from_batch_count} batches <span className="capitalize">({selectedProductType})</span></p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono font-medium">{baseline.baseline_units_per_lb || baseline.baseline_boxes_per_lb}</span> {unitLabel}/lb
                · <span className="font-mono font-medium">{baseline.baseline_lbs_per_unit || baseline.baseline_lbs_per_box}</span> lbs/{unitSingular}
                · <span className="font-mono font-medium">{baseline.baseline_boxes_per_lb}</span> boxes/lb
                {baseline.baseline_time_per_unit && (
                  <> · <span className="font-mono font-medium">{baseline.baseline_time_per_unit}</span> min/{unitSingular}</>
                )}
                {baseline.baseline_time_per_box && (
                  <> · <span className="font-mono font-medium">{baseline.baseline_time_per_box}</span> min/box</>
                )}
                · Updated {format(new Date(baseline.last_updated_at), 'MMM d, yyyy')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deviation Alert */}
      {deviationAlert && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Conversion Variance Alert</p>
              <p className="text-xs text-muted-foreground">
                Rolling 7-batch average deviates {stats.rolling7.deviationPct}% from your global baseline.
                Investigate waste, input quality, or worker performance.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
        <KpiCard label="Total LBS" value={stats.totalLbs.toLocaleString()} icon={<Weight className="h-4 w-4" />} variant="default" />
        <KpiCard label={`Total ${unitLabel}`} value={stats.totalUnits.toLocaleString()} icon={<Box className="h-4 w-4" />} variant="default" />
        <KpiCard label="Total Boxes" value={stats.totalBoxes.toLocaleString()} icon={<Box className="h-4 w-4" />} variant="default" />
        <KpiCard label={`${unitLabel}/LB`} value={stats.globalAvgUnitsPerLb.toFixed(2)} icon={<TrendingUp className="h-4 w-4" />} variant="green" subtitle="Global avg" />
        <KpiCard label="Boxes/LB" value={stats.globalAvgBoxesPerLb.toFixed(3)} icon={<TrendingUp className="h-4 w-4" />} variant="green" subtitle="Global avg" />
        <KpiCard label="Avg Waste" value={`${stats.avgWastePct}%`} icon={<AlertTriangle className="h-4 w-4" />} variant={stats.avgWastePct > 5 ? 'red' : 'default'} />
        {stats.avgTimePerBox !== null && (
          <KpiCard label="Min/Box" value={stats.avgTimePerBox.toFixed(1)} icon={<Timer className="h-4 w-4" />} variant="default" subtitle="Avg time" />
        )}
        <KpiCard label="Efficiency" value={`${stats.efficiencyScore}/100`} icon={<Activity className="h-4 w-4" />} variant={stats.efficiencyScore >= 80 ? 'green' : stats.efficiencyScore >= 60 ? 'amber' : 'red'} />
      </div>

      {/* Rolling 7 + Cost + Best/Worst */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Rolling 7 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Rolling 7-Batch Average
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">LBS / {unitSingular}</span>
              <span className="font-mono font-bold">{stats.rolling7.avgLbsPerUnit.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{unitLabel} / LB</span>
              <span className="font-mono font-bold">{stats.rolling7.avgUnitsPerLb.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deviation</span>
              <Badge variant={deviationAlert ? 'destructive' : 'secondary'}>
                {stats.rolling7.deviationPct}%
              </Badge>
            </div>
            <div className="pt-2">
              <div className="text-xs text-muted-foreground mb-1">Baseline match</div>
              <Progress value={Math.max(0, 100 - stats.rolling7.deviationPct)} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Cost per Box */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Cost Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Cost / Box</span>
              <span className="font-mono font-bold text-lg">
                {stats.avgCostPerBox !== null ? `$${stats.avgCostPerBox.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Batches with cost data</span>
              <span className="font-mono">
                {batches.filter(b => b.cost_per_box !== null).length} / {batches.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-2 italic">
              {stats.avgCostPerBox !== null
                ? `Projected: 500 lbs → ~${Math.round(500 * stats.globalAvgBoxesPerLb)} boxes @ $${stats.avgCostPerBox.toFixed(2)}/box`
                : 'Add cost data to batches to unlock margin projections'}
            </p>
          </CardContent>
        </Card>

        {/* Best / Worst */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Performance Extremes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.bestBatch && (
              <div className="p-2 rounded-md bg-muted/30 border border-muted">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3 w-3 text-hud-green" />
                  Best Batch
                </div>
                <div className="text-sm font-medium">
                  {stats.bestBatch.units_per_lb?.toFixed(2)} {unitLabel}/lb
                  <span className="text-xs text-muted-foreground ml-2">
                    {stats.bestBatch.brand} • {stats.bestBatch.batch_date ? format(new Date(stats.bestBatch.batch_date), 'MMM d, yyyy') : '—'}
                  </span>
                </div>
              </div>
            )}
            {stats.worstBatch && (
              <div className="p-2 rounded-md bg-muted/30 border border-muted">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  Worst Batch
                </div>
                <div className="text-sm font-medium">
                  {stats.worstBatch.units_per_lb?.toFixed(2)} {unitLabel}/lb
                  <span className="text-xs text-muted-foreground ml-2">
                    {stats.worstBatch.brand} • {stats.worstBatch.batch_date ? format(new Date(stats.worstBatch.batch_date), 'MMM d, yyyy') : '—'}
                  </span>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {stats.batchCount} batches analyzed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Office Comparison (when viewing all) */}
      {selectedOffice === 'all' && baselineData?.all && baselineData.all.filter(b => b.office_id !== null).length > 1 && (
        <OfficeComparisonCard baselines={baselineData.all} offices={offices} />
      )}

      {/* Projection Calculator */}
      <ProjectionCard
        avgBoxesPerLb={baseline?.baseline_boxes_per_lb || stats.globalAvgBoxesPerLb}
        avgCostPerBox={stats.avgCostPerBox}
        isBaseline={!!baseline && baseline.calculated_from_batch_count >= 10}
      />

      {/* Batch History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-primary" />
            Batch Conversion History
          </CardTitle>
          <CardDescription>
            All {selectedProductType} batches with tobacco input and output recorded. Locked batches have permanent snapshots.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">LBS In</TableHead>
                  <TableHead className="text-right">{unitLabel}</TableHead>
                  <TableHead className="text-right">Boxes</TableHead>
                  <TableHead className="text-right">{unitLabel}/LB</TableHead>
                  <TableHead className="text-right">Boxes/LB</TableHead>
                  <TableHead className="text-right">Waste %</TableHead>
                  <TableHead className="text-right">Cost/Box</TableHead>
                  <TableHead className="text-right">Time/Box</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.slice(0, 50).map((batch) => {
                  const baselineUnitsPerLb = baseline?.baseline_units_per_lb || baseline?.baseline_boxes_per_lb || stats.globalAvgUnitsPerLb;
                  const variance = batch.units_per_lb !== null
                    ? getVarianceLevel(batch.units_per_lb, baselineUnitsPerLb)
                    : null;

                  return (
                    <TableRow key={batch.batch_id} className={cn(variance?.level === 'high' && 'bg-destructive/5')}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {batch.batch_date ? format(new Date(batch.batch_date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{batch.brand}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{batch.tobacco_lbs}</TableCell>
                      <TableCell className="text-right font-mono">{batch.product_output_units?.toLocaleString() ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{batch.boxes_produced ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{batch.units_per_lb?.toFixed(2) ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{batch.boxes_per_lb?.toFixed(3) ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {batch.waste_pct !== null ? (
                          <span className={cn(batch.waste_pct > 5 && 'text-destructive font-semibold')}>
                            {batch.waste_pct}%
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {batch.cost_per_box !== null ? `$${batch.cost_per_box.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {batch.time_per_box !== null ? `${batch.time_per_box.toFixed(1)}m` : '—'}
                      </TableCell>
                      <TableCell>
                        {variance ? (
                          <Badge
                            variant={variance.level === 'high' ? 'destructive' : variance.level === 'moderate' ? 'outline' : 'secondary'}
                            className={cn('text-[10px]', variance.level === 'moderate' && 'border-hud-amber text-hud-amber')}
                          >
                            {variance.level === 'normal' ? '✓' : `${variance.pct}%`}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant={batch.is_locked ? 'default' : 'secondary'} className="text-[10px]">
                            {batch.inventory_state}
                          </Badge>
                          {batch.is_locked && <Shield className="h-3 w-3 text-primary" />}
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
    </div>
  );
}

// ═══ Sub-components ═══

function KpiCard({ label, value, icon, variant = 'default', subtitle }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: 'default' | 'green' | 'amber' | 'red';
  subtitle?: string;
}) {
  const borderColor = {
    default: 'border-border/50',
    green: 'border-hud-green/30',
    amber: 'border-hud-amber/30',
    red: 'border-destructive/30',
  }[variant];

  const valueColor = {
    default: 'text-foreground',
    green: 'text-hud-green',
    amber: 'text-hud-amber',
    red: 'text-destructive',
  }[variant];

  return (
    <Card className={cn('border', borderColor)}>
      <CardContent className="pt-4 pb-3 px-3 sm:px-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <p className={cn('text-lg sm:text-xl font-mono font-bold', valueColor)}>{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function ProjectionCard({ avgBoxesPerLb, avgCostPerBox, isBaseline }: {
  avgBoxesPerLb: number;
  avgCostPerBox: number | null;
  isBaseline: boolean;
}) {
  const [lbsInput, setLbsInput] = useState('500');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const lbs = parseFloat(lbsInput) || 0;
  const projectedBoxes = Math.round(lbs * avgBoxesPerLb);
  const projectedCost = avgCostPerBox !== null ? projectedBoxes * avgCostPerBox : null;
  const wholesale = parseFloat(wholesalePrice) || 0;
  const projectedRevenue = wholesale > 0 ? projectedBoxes * wholesale : null;
  const projectedProfit = projectedCost !== null && projectedRevenue !== null ? projectedRevenue - projectedCost : null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Production Projector
          {isBaseline && <Badge variant="secondary" className="text-[10px]">Baseline-Powered</Badge>}
        </CardTitle>
        <CardDescription>Predict output, cost, and profit from raw material input</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="w-full sm:w-auto">
            <label className="text-xs text-muted-foreground block mb-1">LBS to Purchase</label>
            <input
              type="number"
              value={lbsInput}
              onChange={e => setLbsInput(e.target.value)}
              className="w-full sm:w-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              min={0}
              step={1}
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="text-xs text-muted-foreground block mb-1">Wholesale $/box (optional)</label>
            <input
              type="number"
              value={wholesalePrice}
              onChange={e => setWholesalePrice(e.target.value)}
              className="w-full sm:w-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              min={0}
              step={0.01}
              placeholder="0.00"
            />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Minus className="h-4 w-4" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
            <div>
              <p className="text-xs text-muted-foreground">Projected Boxes</p>
              <p className="text-xl sm:text-2xl font-mono font-bold text-primary">{projectedBoxes.toLocaleString()}</p>
            </div>
            {projectedCost !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Projected Cost</p>
                <p className="text-xl sm:text-2xl font-mono font-bold text-foreground">${projectedCost.toLocaleString()}</p>
              </div>
            )}
            {projectedRevenue !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Projected Revenue</p>
                <p className="text-xl sm:text-2xl font-mono font-bold text-foreground">${projectedRevenue.toLocaleString()}</p>
              </div>
            )}
            {projectedProfit !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Gross Profit</p>
                <p className={cn('text-xl sm:text-2xl font-mono font-bold', projectedProfit >= 0 ? 'text-hud-green' : 'text-destructive')}>
                  ${projectedProfit.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OfficeComparisonCard({ baselines, offices }: {
  baselines: any[];
  offices: any[];
}) {
  const officeBaselines = baselines.filter(b => b.office_id !== null && b.calculated_from_batch_count >= 10);
  if (officeBaselines.length < 2) return null;

  const getOfficeName = (id: string) => offices.find(o => o.id === id)?.name || id.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Office Efficiency Comparison
        </CardTitle>
        <CardDescription>Side-by-side conversion performance by production office</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {officeBaselines.map(b => (
            <div key={b.id} className="p-3 rounded-md border bg-muted/20 space-y-2">
              <p className="text-sm font-semibold">{getOfficeName(b.office_id)}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Boxes/LB:</span>
                <span className="font-mono font-medium">{b.baseline_boxes_per_lb}</span>
                <span className="text-muted-foreground">LBS/Box:</span>
                <span className="font-mono font-medium">{b.baseline_lbs_per_box}</span>
                <span className="text-muted-foreground">Batches:</span>
                <span className="font-mono">{b.calculated_from_batch_count}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ConversionIntelligencePanel;
