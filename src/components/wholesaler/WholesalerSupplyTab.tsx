/**
 * WholesalerSupplyTab — Engine 1: B2B Supply Relationship
 * "What has this wholesaler bought from GasMask?"
 * 
 * Surfaces: Financial Ledger, SKU Breakdown, Risk Signals
 * Data Source: wholesaler_orders, wholesaler_payments, wholesaler_disputes
 */
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, Package, AlertTriangle, TrendingUp, TrendingDown,
  Calendar, CreditCard, Clock, Plus
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useWholesalerFinancials } from '@/hooks/useWholesalerFinancials';

interface WholesalerSupplyTabProps {
  wholesalerId: string;
  orders: any[];
  payments: any[];
  disputes: any[];
  profile: any;
  onCreateOrder?: () => void;
}

export const WholesalerSupplyTab: React.FC<WholesalerSupplyTabProps> = ({
  wholesalerId,
  orders,
  payments,
  disputes,
  profile,
  onCreateOrder,
}) => {
  const financials = useWholesalerFinancials(orders);

  const latePayments = payments.filter(p => !p.on_time);
  const avgDaysToPayment = payments.length > 0 
    ? Math.round(payments.reduce((a, p) => a + (p.days_from_invoice || 0), 0) / payments.length) 
    : 0;
  const punctualityRate = payments.length > 0 
    ? Math.round((payments.filter(p => p.on_time).length / payments.length) * 100) 
    : 100;

  const openDisputes = disputes.filter(d => d.status !== 'resolved');

  return (
    <div className="space-y-6">
      {/* Financial Ledger */}
      <Tabs defaultValue="ledger">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="ledger" className="text-xs">
            <DollarSign className="h-3.5 w-3.5 mr-1" /> Financial Ledger
          </TabsTrigger>
          <TabsTrigger value="sku" className="text-xs">
            <Package className="h-3.5 w-3.5 mr-1" /> SKU Breakdown
          </TabsTrigger>
          <TabsTrigger value="risk" className="text-xs">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Risk Signals
          </TabsTrigger>
        </TabsList>

        {/* === FINANCIAL LEDGER === */}
        <TabsContent value="ledger" className="mt-4 space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard 
              label="Lifetime Purchases" 
              value={`$${financials.lifetimeSpend.toLocaleString()}`}
              icon={DollarSign}
              accent="text-emerald-400"
            />
            <KPICard 
              label="30-Day Spend" 
              value={`$${financials.spend30.toLocaleString()}`}
              trend={financials.trendPercent}
              icon={TrendingUp}
              accent="text-blue-400"
            />
            <KPICard 
              label="Avg Order Size" 
              value={`$${Math.round(financials.avgOrderValue).toLocaleString()}`}
              icon={CreditCard}
              accent="text-purple-400"
            />
            <KPICard 
              label="Total Orders" 
              value={financials.orderCount.toString()}
              sub={financials.ordersLast30 > 0 ? `${financials.ordersLast30} in last 30d` : undefined}
              icon={Package}
              accent="text-amber-400"
            />
          </div>

          {/* Spend Breakdown */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Spend Breakdown</CardTitle>
                {onCreateOrder && (
                  <Button size="sm" variant="outline" onClick={onCreateOrder}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> New Order
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">30 Days</p>
                  <p className="text-lg font-bold">${financials.spend30.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">60 Days</p>
                  <p className="text-lg font-bold">${financials.spend60.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">90 Days</p>
                  <p className="text-lg font-bold">${financials.spend90.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Reliability */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Payment Reliability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Punctuality Rate</span>
                <Badge className={punctualityRate >= 80 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : punctualityRate >= 50 
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-red-500/15 text-red-400 border-red-500/30'
                }>
                  {punctualityRate}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Days to Payment</span>
                <span className="text-sm font-medium">{avgDaysToPayment} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Late Payments</span>
                <span className="text-sm font-medium text-red-400">{latePayments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment Terms</span>
                <span className="text-sm font-medium">{profile?.payment_terms || 'Not set'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No orders yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {orders.slice(0, 10).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {order.order_number || format(new Date(order.order_date || order.created_at), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.items_count || 0} items
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">${(order.total_amount || 0).toLocaleString()}</p>
                        <Badge variant="outline" className="text-xs">
                          {order.status || 'pending'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === SKU BREAKDOWN === */}
        <TabsContent value="sku" className="mt-4 space-y-4">
          <SKUBreakdownView orders={orders} />
        </TabsContent>

        {/* === RISK SIGNALS === */}
        <TabsContent value="risk" className="mt-4 space-y-4">
          <RiskSignalsView 
            payments={payments}
            disputes={disputes}
            orders={orders}
            profile={profile}
            punctualityRate={punctualityRate}
            latePayments={latePayments}
            openDisputes={openDisputes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// === Sub-components ===

function KPICard({ label, value, trend, sub, icon: Icon, accent }: {
  label: string;
  value: string;
  trend?: number;
  sub?: string;
  icon: any;
  accent: string;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${accent}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold">{value}</p>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(Math.round(trend))}% vs prev 30d
          </div>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SKUBreakdownView({ orders }: { orders: any[] }) {
  // Aggregate SKUs from orders
  const BRANDS = [
    { key: 'grabba', name: 'Grabba', color: 'text-purple-400' },
    { key: 'hot grabba', name: 'Hot Grabba', color: 'text-red-400' },
    { key: 'dark grabba', name: 'Dark Grabba', color: 'text-amber-400' },
    { key: 'grabba leaf', name: 'Grabba Leaf', color: 'text-emerald-400' },
    { key: 'gasmask', name: 'GasMask', color: 'text-green-400' },
    { key: 'hot scolatti', name: 'Hot Scolatti', color: 'text-orange-400' },
    { key: 'hotmama', name: 'HotMama', color: 'text-pink-400' },
  ];

  const brandTotals: Record<string, { amount: number; count: number; lastOrder: string | null }> = {};
  
  orders.forEach(order => {
    const brand = (order.brand || '').toLowerCase();
    if (!brandTotals[brand]) {
      brandTotals[brand] = { amount: 0, count: 0, lastOrder: null };
    }
    brandTotals[brand].amount += order.total_amount || 0;
    brandTotals[brand].count += 1;
    const orderDate = order.order_date || order.created_at;
    if (!brandTotals[brand].lastOrder || orderDate > brandTotals[brand].lastOrder!) {
      brandTotals[brand].lastOrder = orderDate;
    }
  });

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Purchases by Brand</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {BRANDS.map(brand => {
            const data = brandTotals[brand.key];
            return (
              <div key={brand.key} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${brand.color.replace('text-', 'bg-')}`} />
                  <span className={`text-sm font-medium ${brand.color}`}>{brand.name}</span>
                </div>
                <div className="text-right">
                  {data ? (
                    <>
                      <p className="text-sm font-bold">${data.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {data.count} orders • Last {data.lastOrder ? formatDistanceToNow(new Date(data.lastOrder), { addSuffix: true }) : 'N/A'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No purchases</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskSignalsView({ payments, disputes, orders, profile, punctualityRate, latePayments, openDisputes }: {
  payments: any[];
  disputes: any[];
  orders: any[];
  profile: any;
  punctualityRate: number;
  latePayments: any[];
  openDisputes: any[];
}) {
  // Calculate risk signals
  const signals: { type: 'critical' | 'warning' | 'info'; label: string; detail: string }[] = [];

  if (punctualityRate < 50) {
    signals.push({ type: 'critical', label: 'Low Payment Reliability', detail: `Only ${punctualityRate}% on-time payment rate` });
  } else if (punctualityRate < 80) {
    signals.push({ type: 'warning', label: 'Payment Reliability Declining', detail: `${punctualityRate}% on-time rate — watch closely` });
  }

  if (openDisputes.length > 0) {
    signals.push({ type: 'critical', label: `${openDisputes.length} Open Dispute(s)`, detail: openDisputes.map(d => d.dispute_type).join(', ') });
  }

  if (latePayments.length > 3) {
    signals.push({ type: 'warning', label: 'Repeat Late Payer', detail: `${latePayments.length} late payments on record` });
  }

  // Declining order volume
  const recentOrders = orders.filter(o => {
    const d = new Date(o.order_date || o.created_at);
    return d > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  });
  const prevOrders = orders.filter(o => {
    const d = new Date(o.order_date || o.created_at);
    return d > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) && d <= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  });
  if (prevOrders.length > 0 && recentOrders.length < prevOrders.length * 0.5) {
    signals.push({ type: 'warning', label: 'Declining Order Volume', detail: `${recentOrders.length} orders in 30d vs ${prevOrders.length} previous period` });
  }

  if (orders.length > 0 && recentOrders.length === 0) {
    signals.push({ type: 'warning', label: 'No Recent Orders', detail: 'No orders in the last 30 days' });
  }

  if (signals.length === 0) {
    signals.push({ type: 'info', label: 'All Clear', detail: 'No risk signals detected for this wholesaler' });
  }

  const getSignalStyle = (type: string) => {
    switch (type) {
      case 'critical': return 'border-red-500/30 bg-red-500/5';
      case 'warning': return 'border-amber-500/30 bg-amber-500/5';
      default: return 'border-emerald-500/30 bg-emerald-500/5';
    }
  };

  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      default: return '✅';
    }
  };

  return (
    <div className="space-y-3">
      {/* Risk Score Header */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <p className="text-xl font-bold">{profile?.risk_level || 'Normal'}</p>
            </div>
            <Badge className={
              profile?.risk_level === 'high' ? 'bg-red-500/15 text-red-400' :
              profile?.risk_level === 'medium' ? 'bg-amber-500/15 text-amber-400' :
              'bg-emerald-500/15 text-emerald-400'
            }>
              {profile?.relationship_health_score || 50}/100 Health
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Signals */}
      {signals.map((signal, i) => (
        <Card key={i} className={`border ${getSignalStyle(signal.type)}`}>
          <CardContent className="p-3 flex items-start gap-3">
            <span className="text-lg">{getSignalIcon(signal.type)}</span>
            <div>
              <p className="text-sm font-medium">{signal.label}</p>
              <p className="text-xs text-muted-foreground">{signal.detail}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
