/**
 * PRODUCTION KPI CARDS
 * 
 * Daily KPI dashboard for production portal.
 * Shows boxes completed, tobacco used, efficiency, workers, tools.
 * Now includes day status (OPEN/CLOSED) indicator.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Boxes, Scale, Gauge, Users, Wrench, TrendingUp, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { DailyKPIs } from '@/hooks/useProductionPortal';
import { cn } from '@/lib/utils';

interface ProductionKPICardsProps {
  kpis: DailyKPIs;
  isLoading?: boolean;
  closedBy?: string;
  closedAt?: string;
}

const BRAND_COLORS: Record<string, string> = {
  gasmask: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  hotmama: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  hotscolati: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'grabba-rus': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const BRAND_LABELS: Record<string, string> = {
  gasmask: 'Gasmask',
  hotmama: 'HotMama',
  hotscolati: 'Hotscolatti',
  'grabba-rus': 'GrabbaRus',
};

export function ProductionKPICards({ kpis, isLoading, closedBy, closedAt }: ProductionKPICardsProps) {
  const getEfficiencyColor = (pct: number) => {
    if (pct >= 90) return 'text-emerald-600';
    if (pct >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getToolsStatusColor = (operational: number, total: number) => {
    if (total === 0) return 'text-muted-foreground';
    const ratio = operational / total;
    if (ratio >= 0.9) return 'text-emerald-600';
    if (ratio >= 0.7) return 'text-amber-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-8 bg-muted rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Day Status Banner */}
      <div className={cn(
        'flex items-center justify-between p-3 rounded-lg',
        kpis.isDayClosed 
          ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800' 
          : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
      )}>
        <div className="flex items-center gap-3">
          {kpis.isDayClosed ? (
            <>
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <Lock className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-200">DAY CLOSED</span>
                  <Badge className="bg-emerald-200 text-emerald-800 text-xs">Locked</Badge>
                </div>
                {closedAt && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {closedBy && `Closed by ${closedBy} • `}{closedAt}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <Unlock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-800 dark:text-amber-200">DAY OPEN</span>
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Editable</Badge>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Batches and outputs can be modified
                </p>
              </div>
            </>
          )}
        </div>

        {/* Variance Alert */}
        {kpis.tubesVariance !== 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className={cn(
              'h-4 w-4',
              kpis.tubesVariance < 0 ? 'text-red-600' : 'text-amber-600'
            )} />
            <span className={cn(
              kpis.tubesVariance < 0 ? 'text-red-700' : 'text-amber-700'
            )}>
              Tube variance: {kpis.tubesVariance > 0 ? '+' : ''}{kpis.tubesVariance}
            </span>
          </div>
        )}
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Boxes */}
        <Card className={cn('border-primary/20', kpis.isDayClosed && 'opacity-90')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Boxes className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Boxes Today</span>
            </div>
            <p className="text-3xl font-bold text-primary">{kpis.totalBoxes.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Tobacco Used */}
        <Card className={cn(kpis.isDayClosed && 'opacity-90')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Scale className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Tobacco (lbs)</span>
            </div>
            <p className="text-3xl font-bold">{kpis.tobaccoUsed.toFixed(1)}</p>
          </CardContent>
        </Card>

        {/* Efficiency */}
        <Card className={cn(kpis.isDayClosed && 'opacity-90')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Gauge className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Efficiency</span>
            </div>
            <p className={cn('text-3xl font-bold', getEfficiencyColor(kpis.efficiencyPct))}>
              {kpis.efficiencyPct}%
            </p>
          </CardContent>
        </Card>

        {/* Workers Present */}
        <Card className={cn(kpis.isDayClosed && 'opacity-90')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Workers</span>
            </div>
            <p className="text-3xl font-bold">{kpis.workersPresent}</p>
          </CardContent>
        </Card>

        {/* Tools Status */}
        <Card className={cn(kpis.isDayClosed && 'opacity-90')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wrench className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Tools</span>
            </div>
            <p className={cn('text-3xl font-bold', getToolsStatusColor(kpis.toolsOperational, kpis.toolsTotal))}>
              {kpis.toolsOperational}/{kpis.toolsTotal}
            </p>
            <p className="text-xs text-muted-foreground">operational</p>
          </CardContent>
        </Card>

        {/* Defect Rate */}
        <Card className={cn(kpis.isDayClosed && 'opacity-90')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Defects</span>
            </div>
            <p className={cn(
              'text-3xl font-bold',
              kpis.defectRate > 5 ? 'text-red-600' : kpis.defectRate > 2 ? 'text-amber-600' : 'text-emerald-600'
            )}>
              {kpis.defectRate}%
            </p>
            <p className="text-xs text-muted-foreground">{kpis.totalDefects} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Brand Breakdown */}
      {Object.keys(kpis.boxesByBrand).length > 0 && (
        <Card className={cn(kpis.isDayClosed && 'opacity-90')}>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Boxes by Brand
            </h4>
            <div className="flex flex-wrap gap-3">
              {Object.entries(kpis.boxesByBrand).map(([brand, count]) => (
                <div key={brand} className="flex items-center gap-2">
                  <Badge className={cn('text-sm px-3 py-1', BRAND_COLORS[brand] || 'bg-muted')}>
                    {BRAND_LABELS[brand] || brand}
                  </Badge>
                  <span className="text-lg font-bold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
