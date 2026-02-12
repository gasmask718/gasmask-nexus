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
import { SupplierPlaybookPanel } from './SupplierPlaybookPanel';
import { SupplierNegotiationScripts } from './SupplierNegotiationScripts';
import { SupplierLeverageSummary } from './SupplierLeverageSummary';
import { SupplierFallbackChecklist } from './SupplierFallbackChecklist';
import { SupplierOperatorTools } from './SupplierOperatorTools';

interface SupplierActionDetailPanelProps {
  supplier: string;
  onClose: () => void;
}

const riskBandColors: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  risk: "bg-orange-500/10 text-orange-700",
  watch: "bg-yellow-500/10 text-yellow-700",
  healthy: "bg-emerald-500/10 text-emerald-700",
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
            <TabsTrigger value="playbook" className="flex-1">Playbook</TabsTrigger>
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
                      <span className="font-medium text-sm">{(w as any).product_name}</span>
                      <Badge className={(w as any).recommended_contact_window === "immediate" ? "bg-destructive/10 text-destructive" : "bg-orange-500/10 text-orange-700"}>
                        {(w as any).recommended_contact_window?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{(w as any).reason}</p>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">{(w as any).recommended_action?.replace(/_/g, " ")}</Badge>
                      <span className="text-muted-foreground">Risk: {Number((w as any).current_risk_score || 0).toFixed(1)}</span>
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
                  <span className="font-medium text-sm">{(s as any).product_name}</span>
                  <Badge className={riskBandColors[(s as any).risk_band] || riskBandColors.healthy}>{(s as any).risk_band}</Badge>
                </div>
                <MetricRow label="Overall Score" value={Number((s as any).overall_score || 0).toFixed(1)} />
                <MetricRow label="Cost Score" value={Number((s as any).cost_score || 0).toFixed(1)} />
                <MetricRow label="Trend Score" value={Number((s as any).trend_score || 0).toFixed(1)} />
                <MetricRow label="Stability Score" value={Number((s as any).stability_score || 0).toFixed(1)} />
                <MetricRow label="Reliability Score" value={Number((s as any).reliability_score || 0).toFixed(1)} />
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
                  <span className="font-medium text-sm">{(p as any).product_name}</span>
                  <TrendIcon slope={Number((p as any).recent_cost_slope || 0)} />
                </div>
                <MetricRow label="Recent Avg Cost" value={`$${Number((p as any).recent_avg_unit_cost || 0).toFixed(2)}`} />
                <MetricRow label="Slope (per receipt)" value={Number((p as any).recent_cost_slope || 0).toFixed(4)} />
                <MetricRow label="Projected 30d" value={`$${Number((p as any).projected_unit_cost_30d || 0).toFixed(2)}`} />
                <MetricRow label="Projected 60d" value={`$${Number((p as any).projected_unit_cost_60d || 0).toFixed(2)}`} />
                <MetricRow label="Receipts Used" value={(p as any).receipts_used || 0} />
              </div>
            ))}
            {!projection.data?.length && (
              <p className="text-sm text-muted-foreground">Insufficient receipt data for forecasting. At least 3 receipts are required.</p>
            )}
          </TabsContent>

          <TabsContent value="playbook" className="mt-3 space-y-4">
            {(windows.data || []).length > 0 ? (
              <>
                {(windows.data || []).map((w: any, i: number) => {
                  const overlay_item = (overlay.data || []).find(
                    (o: any) => (o as any).product_id === (w as any).product_id
                  );
                  const projection_item = (projection.data || []).find(
                    (p: any) => (p as any).product_id === (w as any).product_id
                  );
                  return (
                    <div key={i} className="space-y-4">
                      <SupplierPlaybookPanel
                        riskBand={(overlay_item as any)?.risk_band}
                        recommendedAction={(w as any).recommended_action}
                        forecastSeverity={(overlay_item as any)?.forecast_severity}
                        primaryRiskDriver={(overlay_item as any)?.primary_risk_driver}
                      />
                      <SupplierNegotiationScripts
                        supplierName={supplier}
                        productName={(w as any).product_name}
                        currentCost={(projection_item as any)?.recent_avg_unit_cost || 0}
                        projectedCost60d={(projection_item as any)?.projected_unit_cost_60d || 0}
                        forecast_pct_increase={(overlay_item as any)?.forecast_pct_increase}
                        recommended_action={(w as any).recommended_action}
                      />
                      <SupplierLeverageSummary
                        primaryRiskDriver={(overlay_item as any)?.primary_risk_driver}
                        volatility={(overlay_item as any)?.volatility}
                        forecast_pct_increase={(overlay_item as any)?.forecast_pct_increase}
                        reliability={(overlay_item as any)?.reliability_score}
                      />
                      <SupplierFallbackChecklist
                        recommendedAction={(w as any).recommended_action}
                        riskTier={(overlay_item as any)?.risk_band}
                        supplierName={supplier}
                      />
                      <div className="p-3 rounded-lg border space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">QUICK ACTIONS</p>
                        <SupplierOperatorTools
                          supplierName={supplier}
                          productName={(w as any).product_name}
                          currentCost={(projection_item as any)?.recent_avg_unit_cost || 0}
                          projectedCost60d={(projection_item as any)?.projected_unit_cost_60d || 0}
                          contractRiskIndex={(w as any).current_risk_score || 0}
                          recommendedAction={(w as any).recommended_action || ""}
                          forecast_pct_increase={(overlay_item as any)?.forecast_pct_increase}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No negotiation playbook available.</p>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            {(overlay.data || []).map((o: any, i: number) => (
              <div key={i} className="mb-3 p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">{(o as any).product_name}</span>
                  {(o as any).forecast_severity && (
                    <Badge className={(o as any).forecast_severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-700"}>
                      {(o as any).forecast_severity}
                    </Badge>
                  )}
                </div>
                <MetricRow label="Combined Risk" value={Number((o as any).combined_risk_score || 0).toFixed(1)} />
                <MetricRow label="Base Risk" value={Number((o as any).risk_score || 0).toFixed(1)} />
                <MetricRow label="Forecast Uplift %" value={`${Number((o as any).forecast_pct_increase || 0).toFixed(1)}%`} />
                <MetricRow label="Action" value={(o as any).updated_recommended_action?.replace(/_/g, " ") || "—"} />
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
