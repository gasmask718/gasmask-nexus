// ═══════════════════════════════════════════════════════════════════════════════
// PROFIT ANALYTICS CARD — Finance Dashboard Component
// Floor 5 — Shows Gross Profit, COGS, Top Products, Low Margin Alerts
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  AlertTriangle,
  Star,
  BarChart3,
} from 'lucide-react';
import { useProfitDashboardTotals, type ProductProfitSummary } from '@/hooks/useProductProfitAnalytics';

interface ProfitAnalyticsCardProps {
  brandId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function ProfitAnalyticsCard({ brandId, dateFrom, dateTo }: ProfitAnalyticsCardProps) {
  const { data: totals, isLoading } = useProfitDashboardTotals({ 
    brandId, 
    dateFrom, 
    dateTo 
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!totals) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No profit data available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-400">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Gross Revenue</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">
              {formatCurrency(totals.gross_revenue)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {totals.total_orders} orders
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Total COGS</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">
              {formatCurrency(totals.total_cogs)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Cost of goods sold
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Gross Profit</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">
              {formatCurrency(totals.gross_profit)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Revenue minus COGS
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-400">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Gross Margin</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">
              {totals.overall_margin.toFixed(1)}%
            </div>
            <Progress 
              value={Math.min(totals.overall_margin, 100)} 
              className="h-1 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Brand Breakdown */}
      {Object.keys(totals.by_brand).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Profit by Brand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(totals.by_brand).map(([brand, stats]) => (
                <div 
                  key={brand} 
                  className="p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {brand}
                  </p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-medium">{formatCurrency(stats.revenue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Profit:</span>
                      <span className={stats.profit >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {formatCurrency(stats.profit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Margin:</span>
                      <Badge 
                        variant={stats.margin >= 20 ? 'default' : stats.margin >= 10 ? 'secondary' : 'destructive'}
                        className="text-xs"
                      >
                        {stats.margin.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Profitable Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Top Profitable Products
            </CardTitle>
            <CardDescription>Highest gross profit contributors</CardDescription>
          </CardHeader>
          <CardContent>
            {totals.top_products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sales data yet
              </p>
            ) : (
              <div className="space-y-3">
                {totals.top_products.slice(0, 5).map((product, idx) => (
                  <ProductProfitRow 
                    key={product.product_id} 
                    product={product} 
                    rank={idx + 1}
                    type="profit"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Margin Alerts */}
        <Card className={totals.low_margin_products.length > 0 ? 'border-amber-500/30' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low Margin Alerts
            </CardTitle>
            <CardDescription>Products below 20% margin threshold</CardDescription>
          </CardHeader>
          <CardContent>
            {totals.low_margin_products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All products above threshold ✓
              </p>
            ) : (
              <div className="space-y-3">
                {totals.low_margin_products.slice(0, 5).map((product) => (
                  <ProductProfitRow 
                    key={product.product_id} 
                    product={product}
                    type="margin"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProductProfitRow({ 
  product, 
  rank,
  type 
}: { 
  product: ProductProfitSummary; 
  rank?: number;
  type: 'profit' | 'margin';
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        {rank && (
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {rank}
          </div>
        )}
        <div>
          <p className="font-medium text-sm">{product.product_name}</p>
          {product.brand_name && (
            <p className="text-xs text-muted-foreground">{product.brand_name}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        {type === 'profit' ? (
          <>
            <p className="font-mono font-medium text-green-600">
              {formatCurrency(product.total_profit)}
            </p>
            <p className="text-xs text-muted-foreground">
              {product.margin_percent.toFixed(1)}% margin
            </p>
          </>
        ) : (
          <>
            <Badge variant="destructive" className="font-mono">
              {product.margin_percent.toFixed(1)}%
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(product.total_profit)} profit
            </p>
          </>
        )}
      </div>
    </div>
  );
}
