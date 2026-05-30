/**
 * PRODUCTION EFFICIENCY PANEL
 * 
 * Time intelligence per product type:
 * - Avg time per unit
 * - Fastest/slowest batch
 * - Time trend
 * - Efficiency score
 * - Slowdown alerts
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useConversionIntelligence } from '@/hooks/useConversionIntelligence';
import { useConversionBaseline, getTimeVarianceLevel } from '@/hooks/useConversionBaseline';
import { useProductionOffices } from '@/hooks/useProductionPortal';
import type { ProductType } from '@/hooks/useProductionPortal';
import { Timer, TrendingUp, TrendingDown, AlertTriangle, Zap, Clock, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function ProductionEfficiencyPanel() {
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

  // Filter batches with time data
  const timeBatches = batches.filter(b => b.time_per_box !== null && b.time_per_box > 0);
  const hasTimeData = timeBatches.length > 0;

  // Slowdown alert (based on time per box)
  const baselineTimeBox = baseline?.baseline_time_per_box;
  const avgTimeBox = stats?.avgTimePerBox;
  const slowdownAlert = baselineTimeBox && avgTimeBox
    ? getTimeVarianceLevel(avgTimeBox, baselineTimeBox)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Production Efficiency
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

      {/* Slowdown Alert */}
      {slowdownAlert && slowdownAlert.level === 'critical' && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Production Slowdown Detected</p>
              <p className="text-xs text-muted-foreground">
                Average time per box is {slowdownAlert.pct.toFixed(1)}% above baseline.
                Investigate staffing, equipment, or material quality.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasTimeData ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Timer className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Time Data Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Start tracking production start/end timestamps on batches to unlock time intelligence.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Time KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            <TimeKpi
              label="Avg Min/Box"
              value={avgTimeBox?.toFixed(1) || '—'}
              icon={<Clock className="h-4 w-4" />}
              variant={slowdownAlert?.level === 'critical' ? 'red' : slowdownAlert?.level === 'slow' ? 'amber' : 'default'}
            />
            <TimeKpi
              label={`Avg Min/${unitSingular}`}
              value={stats?.avgTimePerUnit?.toFixed(2) || '—'}
              icon={<Clock className="h-4 w-4" />}
              variant="default"
              subtitle="Per unit"
            />
            <TimeKpi
              label="Fastest Batch"
              value={stats?.fastestBatch?.time_per_box?.toFixed(1) || '—'}
              icon={<Zap className="h-4 w-4" />}
              variant="green"
              subtitle={stats?.fastestBatch ? `${stats.fastestBatch.brand} · min/box` : undefined}
            />
            <TimeKpi
              label="Slowest Batch"
              value={stats?.slowestBatch?.time_per_box?.toFixed(1) || '—'}
              icon={<TrendingDown className="h-4 w-4" />}
              variant="red"
              subtitle={stats?.slowestBatch ? `${stats.slowestBatch.brand} · min/box` : undefined}
            />
            <TimeKpi
              label="Batches w/ Time"
              value={`${timeBatches.length}`}
              icon={<Activity className="h-4 w-4" />}
              variant="default"
              subtitle={`of ${batches.length} total`}
            />
          </div>

          {/* Baseline Comparison */}
          {baselineTimeBox && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground">Baseline Time/Box</p>
                    <p className="text-2xl font-mono font-bold text-primary">{baselineTimeBox.toFixed(1)} min</p>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Avg</p>
                    <p className="text-2xl font-mono font-bold">{avgTimeBox?.toFixed(1) || '—'} min</p>
                  </div>
                  {slowdownAlert && (
                    <Badge
                      variant={slowdownAlert.level === 'critical' ? 'destructive' : slowdownAlert.level === 'slow' ? 'outline' : 'secondary'}
                      className={cn('text-xs', slowdownAlert.level === 'slow' && 'border-hud-amber text-hud-amber')}
                    >
                      {slowdownAlert.label} ({slowdownAlert.pct > 0 ? '+' : ''}{slowdownAlert.pct.toFixed(1)}%)
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Time Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Production Times</CardTitle>
              <CardDescription>Last {Math.min(timeBatches.length, 10)} batches with time data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {timeBatches.slice(0, 10).map(batch => {
                  const timeVariance = baselineTimeBox
                    ? getTimeVarianceLevel(batch.time_per_box!, baselineTimeBox)
                    : null;
                  return (
                    <div key={batch.batch_id} className="flex items-center justify-between p-2 rounded bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{batch.brand}</span>
                        <span className="text-xs text-muted-foreground">
                          {batch.batch_date ? format(new Date(batch.batch_date), 'MMM d, yyyy') : '—'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {batch.product_output_units?.toLocaleString()} {unitLabel} → {batch.boxes_produced} boxes • {batch.production_time_minutes?.toFixed(0)} min
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm">{batch.time_per_box?.toFixed(1)} min/box</span>
                        {timeVariance && (
                          <Badge
                            variant={timeVariance.level === 'critical' ? 'destructive' : timeVariance.level === 'slow' ? 'outline' : 'secondary'}
                            className={cn('text-[10px]', timeVariance.level === 'slow' && 'border-hud-amber text-hud-amber')}
                          >
                            {timeVariance.level === 'normal' ? '✓' : timeVariance.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function TimeKpi({ label, value, icon, variant = 'default', subtitle }: {
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
