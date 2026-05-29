/**
 * VARIANCE PANEL COMPONENT
 * 
 * Shows input vs output reconciliation with variance calculations.
 * Tubes, stickers, empty boxes variance by brand.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useVarianceSummary } from '@/hooks/useProductionPortal';
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VariancePanelProps {
  officeId: string;
  date?: Date;
}

const BRAND_LABELS: Record<string, string> = {
  gasmask: 'Gasmask',
  hotmama: 'HotMama',
  hotscolati: 'Hotscolatti',
  'grabba-rus': 'GrabbaRus',
};

const BRAND_COLORS: Record<string, string> = {
  gasmask: 'text-emerald-600',
  hotmama: 'text-pink-600',
  hotscolati: 'text-amber-600',
  'grabba-rus': 'text-purple-600',
};

export function VariancePanel({ officeId, date }: VariancePanelProps) {
  const { data: variance, isLoading } = useVarianceSummary(officeId, date);

  const getVarianceIndicator = (value: number) => {
    if (value === 0) return { icon: <CheckCircle className="h-4 w-4" />, color: 'text-emerald-600', label: 'Perfect' };
    if (value > 0) return { icon: <TrendingUp className="h-4 w-4" />, color: 'text-amber-600', label: 'Surplus' };
    return { icon: <TrendingDown className="h-4 w-4" />, color: 'text-red-600', label: 'Deficit' };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Today's Variance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!variance) return null;

  const tubesIndicator = getVarianceIndicator(variance.tubesVariance);
  const hasAnyVariance = variance.tubesVariance !== 0 || 
    Object.values(variance.stickersByBrand).some(v => v.variance !== 0) ||
    Object.values(variance.boxesByBrand).some(v => v.variance !== 0);

  return (
    <Card className={cn(hasAnyVariance && 'border-amber-300')}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Today's Variance
          {hasAnyVariance && (
            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Review Needed
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tubes Variance */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Tubes</span>
            <div className={cn('flex items-center gap-1', tubesIndicator.color)}>
              {tubesIndicator.icon}
              <span className="text-sm">{tubesIndicator.label}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{variance.tubesIssued.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Issued</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{variance.tubesUsed.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Used</p>
            </div>
            <div>
              <p className={cn('text-2xl font-bold', tubesIndicator.color)}>
                {variance.tubesVariance >= 0 ? '+' : ''}{variance.tubesVariance.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Variance</p>
            </div>
          </div>
        </div>

        {/* Efficiency */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Box Efficiency</span>
            <Badge className={cn(
              variance.efficiencyPct >= 90 ? 'bg-emerald-100 text-emerald-800' :
              variance.efficiencyPct >= 70 ? 'bg-amber-100 text-amber-800' :
              'bg-red-100 text-red-800'
            )}>
              {variance.efficiencyPct}%
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{variance.expectedBoxes}</p>
              <p className="text-xs text-muted-foreground">Expected (tubes/20)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{variance.actualBoxes}</p>
              <p className="text-xs text-muted-foreground">Actual</p>
            </div>
          </div>
        </div>

        {/* Per-Brand Stickers Variance */}
        {Object.entries(variance.stickersByBrand).some(([_, v]) => v.issued > 0 || v.used > 0) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Stickers by Brand</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(variance.stickersByBrand).map(([brand, data]) => {
                if (data.issued === 0 && data.used === 0) return null;
                const indicator = getVarianceIndicator(data.variance);
                return (
                  <div key={brand} className="p-2 bg-muted/30 rounded text-sm">
                    <div className="flex items-center justify-between">
                      <span className={cn('font-medium', BRAND_COLORS[brand])}>
                        {BRAND_LABELS[brand]}
                      </span>
                      <span className={cn('text-xs', indicator.color)}>
                        {data.variance >= 0 ? '+' : ''}{data.variance}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.issued} issued → {data.used} used
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Per-Brand Empty Boxes Variance */}
        {Object.entries(variance.boxesByBrand).some(([_, v]) => v.issued > 0 || v.used > 0) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Empty Boxes by Brand</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(variance.boxesByBrand).map(([brand, data]) => {
                if (data.issued === 0 && data.used === 0) return null;
                const indicator = getVarianceIndicator(data.variance);
                return (
                  <div key={brand} className="p-2 bg-muted/30 rounded text-sm">
                    <div className="flex items-center justify-between">
                      <span className={cn('font-medium', BRAND_COLORS[brand])}>
                        {BRAND_LABELS[brand]}
                      </span>
                      <span className={cn('text-xs', indicator.color)}>
                        {data.variance >= 0 ? '+' : ''}{data.variance}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.issued} issued → {data.used} used
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
