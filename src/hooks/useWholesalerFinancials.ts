import { useMemo } from 'react';
import { subDays, isAfter } from 'date-fns';

interface Order {
  id: string;
  order_date: string;
  total_amount: number;
  status: string;
  payment_status: string;
}

interface FinancialMetrics {
  lifetimeSpend: number;
  spend30: number;
  spend60: number;
  spend90: number;
  orderCount: number;
  avgOrderValue: number;
  largestOrder: Order | null;
  trendPercent: number;
  ordersLast30: number;
}

export function useWholesalerFinancials(orders: Order[] = []): FinancialMetrics {
  return useMemo(() => {
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
}
