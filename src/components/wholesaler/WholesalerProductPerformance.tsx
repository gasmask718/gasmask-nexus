import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Package, TrendingUp, TrendingDown, AlertTriangle, 
  RotateCcw, DollarSign, Zap, ChevronRight 
} from 'lucide-react';
import type { WholesalerProductPerformance } from '@/hooks/useWholesalerIntelligence';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface WholesalerProductPerformanceProps {
  products: WholesalerProductPerformance[];
  onMetricClick?: (metricType: string, value: number, label: string) => void;
  onProductClick?: (product: WholesalerProductPerformance) => void;
}

export function WholesalerProductPerformanceSection({ products, onMetricClick, onProductClick }: WholesalerProductPerformanceProps) {
  const totalUnits = products.reduce((sum, p) => sum + p.units_sold, 0);
  const totalRevenue = products.reduce((sum, p) => sum + Number(p.revenue), 0);
  const avgReturnRate = products.length > 0 
    ? products.reduce((sum, p) => sum + Number(p.return_rate), 0) / products.length 
    : 0;

  // Top performers
  const topProducts = [...products]
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 5);

  // Problem products
  const problemProducts = products.filter(p => 
    Number(p.return_rate) > 10 || 
    Number(p.price_erosion_percent) > 5 ||
    Number(p.substitution_rate) > 20
  );

  // Chart data
  const chartData = topProducts.map(p => ({
    name: p.product_name?.slice(0, 15) || p.sku || 'Unknown',
    revenue: Number(p.revenue),
    units: p.units_sold,
  }));

  const getVelocityColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getVelocityBg = (score: number) => {
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-500" />
            Product Performance
          </CardTitle>
          {problemProducts.length > 0 && (
            <Badge variant="outline" className="text-amber-400 border-amber-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {problemProducts.length} Issues
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div 
            className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
            onClick={() => onMetricClick?.('units', totalUnits, 'Units Sold')}
          >
            <Package className="h-5 w-5 mx-auto text-indigo-500 mb-1" />
            <p className="text-2xl font-bold">{totalUnits.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Units Sold</p>
          </div>
          <div 
            className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
            onClick={() => onMetricClick?.('revenue', totalRevenue, 'Total Revenue')}
          >
            <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Total Revenue</p>
          </div>
          <div 
            className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
            onClick={() => onMetricClick?.('returns', avgReturnRate, 'Avg Return Rate')}
          >
            <RotateCcw className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{avgReturnRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Avg Return Rate</p>
          </div>
        </div>

        {/* Revenue Chart */}
        {chartData.length > 0 && (
          <div className="h-48">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Top Products by Revenue</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" stroke="#666" fontSize={10} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <YAxis type="category" dataKey="name" stroke="#666" fontSize={10} width={100} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Problem Products Alert */}
        {problemProducts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Products Needing Attention</p>
            {problemProducts.slice(0, 3).map((product) => (
              <div 
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
              >
                <div>
                  <p className="text-sm font-medium">{product.product_name || product.sku}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {Number(product.return_rate) > 10 && (
                      <span className="text-xs text-red-400">
                        <RotateCcw className="h-3 w-3 inline mr-1" />
                        {Number(product.return_rate).toFixed(1)}% returns
                      </span>
                    )}
                    {Number(product.price_erosion_percent) > 5 && (
                      <span className="text-xs text-amber-400">
                        <TrendingDown className="h-3 w-3 inline mr-1" />
                        {Number(product.price_erosion_percent).toFixed(1)}% price erosion
                      </span>
                    )}
                    {Number(product.substitution_rate) > 20 && (
                      <span className="text-xs text-orange-400">
                        {Number(product.substitution_rate).toFixed(0)}% substitution
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-amber-400">
                  Review
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Product List */}
        <ScrollArea className="h-48">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">All Products</p>
            {products.map((product) => (
              <div 
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => onProductClick?.(product)}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{product.product_name || product.sku || 'Unknown'}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {product.units_sold.toLocaleString()} units
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ${Number(product.revenue).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Zap className={`h-4 w-4 ${getVelocityColor(product.velocity_score)}`} />
                      <span className={`text-sm font-medium ${getVelocityColor(product.velocity_score)}`}>
                        {product.velocity_score}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">velocity</p>
                  </div>
                  {Number(product.return_rate) > 5 && (
                    <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs">
                      {Number(product.return_rate).toFixed(1)}% ret
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No product data available</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
