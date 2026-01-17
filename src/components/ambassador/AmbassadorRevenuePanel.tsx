import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, TrendingUp, TrendingDown, Calendar, 
  Store, ShoppingCart, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { format } from "date-fns";
import type { AmbassadorMetrics } from "@/hooks/useAmbassadorIntelligence";

interface AmbassadorRevenuePanelProps {
  metrics: AmbassadorMetrics;
  onlineSales: any[];
  onViewAllSales?: () => void;
}

export function AmbassadorRevenuePanel({ 
  metrics, 
  onlineSales,
  onViewAllSales 
}: AmbassadorRevenuePanelProps) {
  // Calculate trends (mock for now - would need historical data)
  const revenueTrend = metrics.last30DaysRevenue > 0 ? 12.5 : 0; // Placeholder
  const orderTrend = metrics.last30DaysOrders > 0 ? 8.3 : 0; // Placeholder

  const recentSales = onlineSales.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Revenue Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-400">
                  ${metrics.totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs">
              {revenueTrend >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-400" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-400" />
              )}
              <span className={revenueTrend >= 0 ? 'text-green-400' : 'text-red-400'}>
                {Math.abs(revenueTrend).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last 30 Days</p>
                <p className="text-2xl font-bold text-blue-400">
                  ${metrics.last30DaysRevenue.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Calendar className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {metrics.last30DaysOrders} orders this period
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online Sales</p>
                <p className="text-2xl font-bold text-purple-400">
                  ${metrics.onlineSalesRevenue.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <ShoppingCart className="h-6 w-6 text-purple-400" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {metrics.onlineSalesCount} transactions
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commission Earned</p>
                <p className="text-2xl font-bold text-amber-400">
                  ${metrics.onlineCommission.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-500/10">
                <TrendingUp className="h-6 w-6 text-amber-400" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {metrics.conversionRate.toFixed(1)}% conversion rate
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Online Sales */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-purple-400" />
            Recent Online Sales
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onViewAllSales}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              No online sales recorded yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale: any) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <ShoppingCart className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {sale.customer_name || 'Anonymous Customer'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sale.order_reference || 'No reference'} • {format(new Date(sale.sale_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-400">
                      ${Number(sale.order_amount).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${Number(sale.commission_amount).toLocaleString()} commission
                    </div>
                    <Badge 
                      variant={sale.status === 'completed' ? 'default' : 'secondary'}
                      className="mt-1"
                    >
                      {sale.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue by Source */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-400" />
            Revenue Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-cyan-400" />
                <div>
                  <div className="font-medium">Store Orders</div>
                  <div className="text-xs text-muted-foreground">
                    Orders from assigned stores
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">
                  ${(metrics.totalRevenue - metrics.onlineSalesRevenue).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {metrics.totalRevenue > 0 
                    ? ((1 - metrics.onlineSalesRevenue / metrics.totalRevenue) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-purple-400" />
                <div>
                  <div className="font-medium">Online Sales</div>
                  <div className="text-xs text-muted-foreground">
                    Direct sales via tracking code
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">
                  ${metrics.onlineSalesRevenue.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {metrics.totalRevenue > 0 
                    ? ((metrics.onlineSalesRevenue / metrics.totalRevenue) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
