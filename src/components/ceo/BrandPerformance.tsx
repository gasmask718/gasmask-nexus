import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';

interface BrandPerformanceProps {
  brand: string | null;
  metrics: any;
}

export function BrandPerformance({ brand, metrics }: BrandPerformanceProps) {
  if (!brand) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Select a brand to view performance metrics</p>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Loading brand data...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Header */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">{brand} Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Revenue Today</p>
            <p className="text-2xl font-bold">${metrics.revenue?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Accounts</p>
            <p className="text-2xl font-bold">{metrics.activeAccounts || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Communication Volume</p>
            <p className="text-2xl font-bold">{metrics.communicationVolume || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Orders Today</p>
            <p className="text-2xl font-bold">{metrics.orders || 0}</p>
          </div>
        </div>
      </Card>

      {/* Top Stores */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Performing Stores</h3>
        <div className="space-y-3">
          {metrics.topStores?.length > 0 ? (
            metrics.topStores.map((store: any, index: number) => (
              <div key={store.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{store.store_master?.store_name || 'Unknown Store'}</p>
                    <p className="text-xs text-muted-foreground">
                      {store.store_master?.address}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-4">No store data available</p>
          )}
        </div>
      </Card>

      {/* AI Insights Placeholder */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          AI Insights & Strategy Notes
        </h3>
        <div className="space-y-3">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Pending Reorders:</strong> AI detected 12 stores likely to reorder within 48 hours.
            </p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>High-Risk Stores:</strong> 3 stores have not ordered in 30+ days.
            </p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Payment Reliability:</strong> 95% on-time payment rate for this brand.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}