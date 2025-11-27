import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, MapPin, Box, DollarSign } from 'lucide-react';

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

  // Get brandData from root metrics (from edge function)
  const brandData = metrics?.brandData;

  if (!brandData) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Loading brand data for {brand}...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Header */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4 capitalize">{brand.replace(/_/g, ' ')} Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="text-2xl font-bold">${brandData.revenue?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Stores</p>
            <p className="text-2xl font-bold">{brandData.activeAccounts || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Orders</p>
            <p className="text-2xl font-bold">{brandData.orders || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tubes Sold</p>
            <p className="text-2xl font-bold">{brandData.tubesSold?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Inventory</p>
            <p className="text-2xl font-bold">{brandData.inventoryInStock?.toLocaleString() || 0}</p>
          </div>
        </div>
      </Card>

      {/* Top Neighborhoods & Boros */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Top Neighborhoods
          </h3>
          <div className="space-y-3">
            {brandData.topNeighborhoods?.length > 0 ? (
              brandData.topNeighborhoods.map((item: any, index: number) => (
                <div key={item.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <p className="font-medium">{item.name}</p>
                  </div>
                  <Badge variant="outline">{item.count} stores</Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-4">No neighborhood data</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-500" />
            Top Boros
          </h3>
          <div className="space-y-3">
            {brandData.topBoros?.length > 0 ? (
              brandData.topBoros.map((item: any, index: number) => (
                <div key={item.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <p className="font-medium">{item.name}</p>
                  </div>
                  <Badge variant="outline">{item.count} stores</Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-4">No boro data</p>
            )}
          </div>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          AI Insights & Strategy Notes
        </h3>
        <div className="space-y-3">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Brand Performance:</strong> {brandData.orders || 0} orders generating ${brandData.revenue?.toLocaleString() || 0} in revenue from {brandData.activeAccounts || 0} active stores.
            </p>
          </div>
          {brandData.inventoryInStock > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Inventory Status:</strong> {brandData.inventoryInStock?.toLocaleString()} tubes currently in stock across all stores.
              </p>
            </div>
          )}
          {brandData.topNeighborhoods?.length > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Top Territory:</strong> {brandData.topNeighborhoods[0]?.name} leads with {brandData.topNeighborhoods[0]?.count} active stores.
              </p>
            </div>
          )}
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <strong>Recommendation:</strong> Focus on expanding in {brandData.topBoros?.[0]?.name || 'high-performing areas'} for maximum ROI.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
