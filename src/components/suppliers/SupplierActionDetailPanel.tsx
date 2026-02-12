import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  useForecastDecisionOverlay,
  useSupplierProductScorecard,
  useCostTrendProjection,
  useRenegotiationWindow,
} from '@/hooks/useSupplierIntelligence';
import { SupplierDecisionTimeline } from './SupplierDecisionTimeline';

interface SupplierActionDetailPanelProps {
  supplier: string;
  onClose: () => void;
}

const riskBandColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  risk: 'bg-orange-100 text-orange-800',
  watch: 'bg-yellow-100 text-yellow-800',
  healthy: 'bg-green-100 text-green-800',
};

function TrendIcon({ slope }: { slope: number }) {
  if (slope > 0.01) return <TrendingUp className="h-4 w-4 text-red-500" />;
  if (slope < -0.01) return <TrendingDown className="h-4 w-4 text-green-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function MetricRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium">{value}</span>
        {sub && <span className="text-xs text-muted-foreground ml-1">{sub}</span>}
      </div>
    </div>
  );
}

export function SupplierActionDetailPanel({ supplier, onClose }: SupplierActionDetailPanelProps) {
  const overlay = useForecastDecisionOverlay(supplier);
  const scorecard = useSupplierProductScorecard(supplier);
  const projection = useCostTrendProjection(supplier);
  const windows = useRenegotiationWindow(supplier);

  const isLoading = overlay.isLoading || scorecard.isLoading || projection.isLoading;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">{supplier}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <SupplierDecisionTimeline supplier={supplier} />

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="risk" className="flex-1">Risk</TabsTrigger>
            <TabsTrigger value="forecast" className="flex-1">Forecast</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {(windows.data || []).map((w: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg border space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{w.product_name}</span>
                      <Badge className={w.recommended_contact_window === 'immediate' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}>
                        {w.recommended_contact_window?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{w.reason}</p>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">{w.recommended_action?.replace(/_/g, ' ')}</Badge>
                      <span className="text-muted-foreground">Risk: {Number(w.current_risk_score || 0).toFixed(1)}</span>
                    </div>
                  </div>
                ))}
                {!windows.data?.length && (
                  <p className="text-sm text-muted-foreground">No active renegotiation windows for this supplier.</p>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="risk" className="mt-3">
            {(scorecard.data || []).map((s: any, i: number) => (
              <div key={i} className="mb-3 p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">{s.product_name}</span>
                  <Badge className={riskBandColors[s.risk_band] || riskBandColors.healthy}>{s.risk_band}</Badge>
                </div>
                <MetricRow label="Overall Score" value={Number(s.overall_score || 0).toFixed(1)} />
                <MetricRow label="Cost Score" value={Number(s.cost_score || 0).toFixed(1)} />
                <MetricRow label="Trend Score" value={Number(s.trend_score || 0).toFixed(1)} />
                <MetricRow label="Stability Score" value={Number(s.stability_score || 0).toFixed(1)} />
                <MetricRow label="Reliability Score" value={Number(s.reliability_score || 0).toFixed(1)} />
              </div>
            ))}
            {!scorecard.data?.length && (
              <p className="text-sm text-muted-foreground">No product scorecards available.</p>
            )}
          </TabsContent>

          <TabsContent value="forecast" className="mt-3">
            {(projection.data || []).map((p: any, i: number) => (
              <div key={i} className="mb-3 p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">{p.product_name}</span>
                  <TrendIcon slope={Number(p.recent_cost_slope || 0)} />
                </div>
                <MetricRow label="Recent Avg Cost" value={`$${Number(p.recent_avg_unit_cost || 0).toFixed(2)}`} />
                <MetricRow label="Slope (per receipt)" value={Number(p.recent_cost_slope || 0).toFixed(4)} />
                <MetricRow label="Projected 30d" value={`$${Number(p.projected_unit_cost_30d || 0).toFixed(2)}`} />
                <MetricRow label="Projected 60d" value={`$${Number(p.projected_unit_cost_60d || 0).toFixed(2)}`} />
                <MetricRow label="Receipts Used" value={p.receipts_used || 0} />
              </div>
            ))}
            {!projection.data?.length && (
              <p className="text-sm text-muted-foreground">Insufficient receipt data for forecasting. At least 3 receipts are required.</p>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            {(overlay.data || []).map((o: any, i: number) => (
              <div key={i} className="mb-3 p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">{o.product_name}</span>
                  {o.forecast_severity && (
                    <Badge className={o.forecast_severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                      {o.forecast_severity}
                    </Badge>
                  )}
                </div>
                <MetricRow label="Combined Risk" value={Number(o.combined_risk_score || 0).toFixed(1)} />
                <MetricRow label="Base Risk" value={Number(o.risk_score || 0).toFixed(1)} />
                <MetricRow label="Forecast Uplift %" value={`${Number(o.forecast_pct_increase || 0).toFixed(1)}%`} />
                <MetricRow label="Action" value={o.updated_recommended_action?.replace(/_/g, ' ') || '—'} />
              </div>
            ))}
            {!overlay.data?.length && (
              <p className="text-sm text-muted-foreground">No forecast overlay data available.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
