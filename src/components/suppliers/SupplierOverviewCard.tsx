import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSupplierScorecard } from '@/hooks/useSupplierIntelligence';
import { Building2, TrendingUp, Shield, Package } from 'lucide-react';

const riskBandColors = {
  healthy: 'bg-green-100 text-green-800',
  watch: 'bg-yellow-100 text-yellow-800',
  risk: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export function SupplierOverviewCard() {
  const { data, isLoading } = useSupplierScorecard();

  if (isLoading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading supplier data…</CardContent></Card>;
  }

  if (!data?.length) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">No PO receipts yet. Scorecard populates after receipts arrive.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      {data.map((supplier: any) => (
        <Card key={supplier.supplier_name}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{supplier.supplier_name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {supplier.products_count} products · {supplier.total_receipts_count} receipts
                  </p>
                </div>
              </div>
              <Badge className={riskBandColors[supplier.dominant_risk_band as keyof typeof riskBandColors] || 'bg-slate-100'}>
                {supplier.dominant_risk_band}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall Score */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Score</span>
                <span className="text-sm font-semibold text-primary">{Number(supplier.overall_score).toFixed(1)}/100</span>
              </div>
              <Progress value={Number(supplier.overall_score)} className="h-2" />
            </div>

            {/* Score Components Grid */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground">Cost</p>
                <p className="font-semibold text-sm">{Number(supplier.cost_score).toFixed(0)}</p>
                <Progress value={Number(supplier.cost_score)} className="h-1" />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Trend</p>
                <p className="font-semibold text-sm">{Number(supplier.trend_score).toFixed(0)}</p>
                <Progress value={Number(supplier.trend_score)} className="h-1" />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Stability</p>
                <p className="font-semibold text-sm">{Number(supplier.stability_score).toFixed(0)}</p>
                <Progress value={Number(supplier.stability_score)} className="h-1" />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Reliability</p>
                <p className="font-semibold text-sm">{Number(supplier.reliability_score).toFixed(0)}</p>
                <Progress value={Number(supplier.reliability_score)} className="h-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
