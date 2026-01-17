import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingCart, TrendingUp, TrendingDown, DollarSign, 
  Package, AlertTriangle, Calendar, Clock, ChevronRight 
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import type { WholesalerOrder } from '@/hooks/useWholesalerIntelligence';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface WholesalerOrderIntelligenceProps {
  orders: WholesalerOrder[];
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    orderFrequency: number;
    skuConcentrationRisk: boolean;
    topSku: string | null;
  } | null;
  onOrderClick?: (order: WholesalerOrder) => void;
  onMetricClick?: (metricType: string, value: number, label: string) => void;
}

export function WholesalerOrderIntelligence({ orders, metrics, onOrderClick, onMetricClick }: WholesalerOrderIntelligenceProps) {
  // Calculate trend data for chart
  const chartData = React.useMemo(() => {
    if (orders.length === 0) return [];
    
    const sortedOrders = [...orders].sort((a, b) => 
      new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
    );

    // Group by month
    const monthlyData: Record<string, { month: string; orders: number; revenue: number }> = {};
    sortedOrders.forEach(order => {
      const month = format(new Date(order.order_date), 'MMM yy');
      if (!monthlyData[month]) {
        monthlyData[month] = { month, orders: 0, revenue: 0 };
      }
      monthlyData[month].orders++;
      monthlyData[month].revenue += order.total_amount || 0;
    });

    return Object.values(monthlyData).slice(-12);
  }, [orders]);

  // Calculate frequency trend
  const frequencyTrend = React.useMemo(() => {
    if (orders.length < 4) return 'stable';
    
    const recent = orders.slice(0, Math.floor(orders.length / 2));
    const older = orders.slice(Math.floor(orders.length / 2));
    
    const recentAvgGap = recent.length > 1 
      ? recent.reduce((sum, o, i) => {
          if (i === 0) return 0;
          return sum + differenceInDays(new Date(recent[i-1].order_date), new Date(o.order_date));
        }, 0) / (recent.length - 1)
      : 0;
      
    const olderAvgGap = older.length > 1
      ? older.reduce((sum, o, i) => {
          if (i === 0) return 0;
          return sum + differenceInDays(new Date(older[i-1].order_date), new Date(o.order_date));
        }, 0) / (older.length - 1)
      : 0;

    if (recentAvgGap < olderAvgGap * 0.8) return 'increasing';
    if (recentAvgGap > olderAvgGap * 1.2) return 'decreasing';
    return 'stable';
  }, [orders]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-500/20 text-green-400';
      case 'shipped': return 'bg-blue-500/20 text-blue-400';
      case 'confirmed': return 'bg-amber-500/20 text-amber-400';
      case 'pending': return 'bg-gray-500/20 text-gray-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPaymentColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-green-500/20 text-green-400';
      case 'partial': return 'bg-amber-500/20 text-amber-400';
      case 'overdue': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-blue-500" />
          Order Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div 
              className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
              onClick={() => onMetricClick?.('orders', metrics.totalOrders, 'Total Orders')}
            >
              <Package className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold">{metrics.totalOrders}</p>
              <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Total Orders</p>
            </div>
            <div 
              className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
              onClick={() => onMetricClick?.('revenue', metrics.totalRevenue, 'Total Revenue')}
            >
              <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Total Revenue</p>
            </div>
            <div 
              className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
              onClick={() => onMetricClick?.('avg_order', metrics.avgOrderValue, 'Avg Order Value')}
            >
              <TrendingUp className="h-5 w-5 mx-auto text-purple-500 mb-1" />
              <p className="text-2xl font-bold">${metrics.avgOrderValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Avg Order Value</p>
            </div>
            <div 
              className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
              onClick={() => onMetricClick?.('frequency', metrics.orderFrequency, 'Orders (30 days)')}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="h-5 w-5 text-amber-500" />
                {frequencyTrend === 'increasing' && <TrendingUp className="h-4 w-4 text-green-500" />}
                {frequencyTrend === 'decreasing' && <TrendingDown className="h-4 w-4 text-red-500" />}
              </div>
              <p className="text-2xl font-bold">{metrics.orderFrequency}</p>
              <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Orders (30 days)</p>
            </div>
          </div>
        )}

        {/* SKU Concentration Warning */}
        {metrics?.skuConcentrationRisk && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-400">SKU Concentration Risk</p>
              <p className="text-xs text-muted-foreground">
                Over 50% of orders include "{metrics.topSku}" — dependency risk
              </p>
            </div>
          </div>
        )}

        {/* Order Frequency Chart */}
        {chartData.length > 0 && (
          <div className="h-48">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Order Trend</p>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  stroke="#666" 
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis stroke="#666" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8b5cf6" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Orders List */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Recent Orders</p>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {orders.slice(0, 10).map((order) => (
                <div 
                  key={order.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => onOrderClick?.(order)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <p className="font-medium">{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.order_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(order.status)} variant="outline">
                      {order.status}
                    </Badge>
                    <Badge className={getPaymentColor(order.payment_status)} variant="outline">
                      {order.payment_status}
                    </Badge>
                    <span className="font-medium">${order.total_amount.toLocaleString()}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
