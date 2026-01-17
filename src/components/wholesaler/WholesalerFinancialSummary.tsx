import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign, TrendingUp, Package, Calendar,
  ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';

interface WholesalerOrder {
  id: string;
  order_date: string;
  total_amount: number;
  status: string;
  payment_status: string;
}

interface WholesalerFinancialSummaryProps {
  orders: WholesalerOrder[];
  onMetricClick?: (type: string, value: number, label: string) => void;
}

export function WholesalerFinancialSummary({
  orders,
  onMetricClick,
}: WholesalerFinancialSummaryProps) {
  const metrics = useMemo(() => {
    const now = new Date();
    const day30 = subDays(now, 30);
    const day60 = subDays(now, 60);
    const day90 = subDays(now, 90);

    // Lifetime total
    const lifetimeSpend = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    // 30/60/90 day spend
    const spend30 = orders
      .filter(o => isAfter(new Date(o.order_date), day30))
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    const spend60 = orders
      .filter(o => isAfter(new Date(o.order_date), day60))
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    const spend90 = orders
      .filter(o => isAfter(new Date(o.order_date), day90))
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Order metrics
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0 ? lifetimeSpend / orderCount : 0;
    
    // Largest order
    const largestOrder = orders.reduce((max, o) => 
      (o.total_amount || 0) > (max?.total_amount || 0) ? o : max
    , orders[0] || null);

    // Last 30 days orders
    const orders30 = orders.filter(o => isAfter(new Date(o.order_date), day30));
    const orders30Previous = orders.filter(o => 
      isAfter(new Date(o.order_date), day60) && !isAfter(new Date(o.order_date), day30)
    );
    
    // Trend calculation
    const previousSpend30 = orders30Previous.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const trendPercent = previousSpend30 > 0 
      ? ((spend30 - previousSpend30) / previousSpend30) * 100 
      : spend30 > 0 ? 100 : 0;

    return {
      lifetimeSpend,
      spend30,
      spend60,
      spend90,
      orderCount,
      avgOrderValue,
      largestOrder,
      trendPercent,
      ordersLast30: orders30.length,
    };
  }, [orders]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const MetricCard = ({
    icon: Icon,
    label,
    value,
    subValue,
    type,
    iconColor = 'text-primary',
    trend,
  }: {
    icon: any;
    label: string;
    value: string;
    subValue?: string;
    type: string;
    iconColor?: string;
    trend?: number;
  }) => (
    <button
      onClick={() => onMetricClick?.(type, parseFloat(value.replace(/[^0-9.-]/g, '')), label)}
      className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/30 transition-all group text-left w-full"
    >
      <div className={`p-2.5 rounded-lg bg-background/50 ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-bold">{value}</p>
          {trend !== undefined && (
            <Badge
              variant="outline"
              className={`text-xs ${
                trend >= 0 
                  ? 'text-green-400 border-green-500/30' 
                  : 'text-red-400 border-red-500/30'
              }`}
            >
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
              {Math.abs(trend).toFixed(0)}%
            </Badge>
          )}
        </div>
        {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-400" />
          Financial Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Metric - Lifetime Spend */}
        <div 
          onClick={() => onMetricClick?.('lifetime_spend', metrics.lifetimeSpend, 'Lifetime Spend')}
          className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 cursor-pointer hover:from-green-500/15 transition-all"
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Lifetime Total Spent
            </p>
            <p className="text-4xl font-bold text-green-400">
              {formatCurrency(metrics.lifetimeSpend)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {metrics.orderCount} total orders • Avg {formatCurrency(metrics.avgOrderValue)}/order
            </p>
          </div>
        </div>

        {/* Time-based Spend Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            icon={Calendar}
            label="Last 30 Days"
            value={formatCurrency(metrics.spend30)}
            subValue={`${metrics.ordersLast30} orders`}
            type="spend_30"
            iconColor="text-blue-400"
            trend={metrics.trendPercent}
          />
          <MetricCard
            icon={Calendar}
            label="Last 60 Days"
            value={formatCurrency(metrics.spend60)}
            type="spend_60"
            iconColor="text-indigo-400"
          />
          <MetricCard
            icon={Calendar}
            label="Last 90 Days"
            value={formatCurrency(metrics.spend90)}
            type="spend_90"
            iconColor="text-purple-400"
          />
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Package}
            label="Total Orders"
            value={metrics.orderCount.toString()}
            type="total_orders"
            iconColor="text-amber-400"
          />
          <MetricCard
            icon={TrendingUp}
            label="Avg Order Value"
            value={formatCurrency(metrics.avgOrderValue)}
            type="avg_order"
            iconColor="text-cyan-400"
          />
        </div>

        {/* Largest Order */}
        {metrics.largestOrder && (
          <div 
            onClick={() => onMetricClick?.('largest_order', metrics.largestOrder?.total_amount || 0, 'Largest Order')}
            className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-all"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Largest Single Order
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">
                  {formatCurrency(metrics.largestOrder.total_amount || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(metrics.largestOrder.order_date), 'MMM d, yyyy')}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {metrics.largestOrder.status}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
