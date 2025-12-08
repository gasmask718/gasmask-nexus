import { Card, CardContent } from "@/components/ui/card";
import { Flame, AlertTriangle, TrendingUp, Store } from "lucide-react";
import { useRevenueMetrics } from "@/hooks/useRevenueEngine";

interface RevenueMetricsStripProps {
  businessId?: string;
  verticalId?: string;
}

export function RevenueMetricsStrip({ businessId, verticalId }: RevenueMetricsStripProps) {
  const { data: metrics, isLoading } = useRevenueMetrics(businessId, verticalId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-12 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{metrics?.highValueAtRisk || 0}</div>
              <div className="text-xs text-muted-foreground">High-Value at Risk</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-orange-500/10">
              <Flame className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">{metrics?.hotStores || 0}</div>
              <div className="text-xs text-muted-foreground">Hot Stores Ready</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{metrics?.avgHeatScore || 0}</div>
              <div className="text-xs text-muted-foreground">Avg Heat Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted">
              <Store className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics?.totalStores || 0}</div>
              <div className="text-xs text-muted-foreground">Total Scored</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
