import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPortalLayout, CommandCenterKPI, ActivityFeed, ActivityItem } from '@/components/portal';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { useResolvedData } from '@/hooks/useResolvedData';
import { Warehouse, Package, ShoppingCart, DollarSign, Users, TrendingUp, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SIMULATION_PRODUCTS = [
  { id: 'PRD-001', name: 'Premium Widget A', stock: 150, price: 25.00, status: 'active' },
  { id: 'PRD-002', name: 'Standard Widget B', stock: 80, price: 15.00, status: 'active' },
  { id: 'PRD-003', name: 'Economy Widget C', stock: 5, price: 8.00, status: 'low_stock' },
];

const SIMULATION_ORDERS = [
  { id: 'WO-001', store: 'Corner Store NYC', items: 25, total: 625.00, status: 'pending' },
  { id: 'WO-002', store: 'Midtown Mart', items: 40, total: 1000.00, status: 'processing' },
  { id: 'WO-003', store: 'Brooklyn Bodega', items: 15, total: 375.00, status: 'shipped' },
  { id: 'WO-004', store: 'Queens Quick Stop', items: 30, total: 750.00, status: 'delivered' },
];

const SIMULATION_PAYOUTS = [
  { id: 'PAY-001', period: 'Week 1', amount: 2500.00, status: 'paid' },
  { id: 'PAY-002', period: 'Week 2', amount: 3200.00, status: 'pending' },
];

const SIMULATION_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'info', title: 'New Order Received', description: 'WO-002 from Midtown Mart', timestamp: new Date(Date.now() - 30 * 60 * 1000) },
  { id: '2', type: 'success', title: 'Payout Processed', description: '$2,500 deposited', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  { id: '3', type: 'warning', title: 'Low Stock Alert', description: 'Economy Widget C running low', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000) },
];

type KpiType = 'products' | 'orders' | 'pending' | 'revenue' | 'customers' | null;

export default function WholesalerPortalPage() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<KpiType>(null);

  const productsResult = useResolvedData([], SIMULATION_PRODUCTS);
  const ordersResult = useResolvedData([], SIMULATION_ORDERS);
  const payoutsResult = useResolvedData([], SIMULATION_PAYOUTS);
  const activityResult = useResolvedData([], SIMULATION_ACTIVITY);

  const products = productsResult.data;
  const orders = ordersResult.data;
  const payouts = payoutsResult.data;
  const activity = activityResult.data;

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing');
  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);

  const kpis = [
    { key: 'products' as KpiType, label: 'Active Products', value: products.length.toString(), variant: 'cyan' as const },
    { key: 'orders' as KpiType, label: 'Total Orders', value: orders.length.toString(), variant: 'green' as const },
    { key: 'pending' as KpiType, label: 'Pending Orders', value: pendingOrders.length.toString(), variant: 'amber' as const },
    { key: 'revenue' as KpiType, label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, variant: 'green' as const },
    { key: 'customers' as KpiType, label: 'Customers', value: '12', variant: 'purple' as const },
  ];

  const handleKpiClick = (kpi: KpiType) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800',
      low_stock: 'bg-red-100 text-red-800',
      pending: 'bg-amber-100 text-amber-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-emerald-100 text-emerald-800',
      paid: 'bg-emerald-100 text-emerald-800',
    };
    return <Badge className={colors[status] || 'bg-muted'}>{status.replace('_', ' ')}</Badge>;
  };

  const renderDetailContent = () => {
    switch (selectedKpi) {
      case 'products':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Product Inventory</h4>
            {products.map(product => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">Stock: {product.stock} • ${product.price}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(product.status)}
                  <Button size="sm" variant="ghost">Edit</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'orders':
      case 'pending':
        const displayOrders = selectedKpi === 'pending' ? pendingOrders : orders;
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">{selectedKpi === 'pending' ? 'Pending Orders' : 'All Orders'}</h4>
            {displayOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{order.id} - {order.store}</p>
                  <p className="text-sm text-muted-foreground">{order.items} items • ${order.total.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(order.status)}
                  <Button size="sm" variant="ghost">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'revenue':
        return (
          <div className="space-y-4">
            <h4 className="font-semibold">Payout Summary</h4>
            {payouts.map(payout => (
              <div key={payout.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{payout.period}</p>
                  <p className="text-sm text-muted-foreground">${payout.amount.toFixed(2)}</p>
                </div>
                {getStatusBadge(payout.status)}
              </div>
            ))}
          </div>
        );
      case 'customers':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Customer Stores</h4>
            <p className="text-muted-foreground">12 active store customers</p>
            <Button variant="outline" onClick={() => navigate('/portals/wholesaler/customers')}>
              View All Customers
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <EnhancedPortalLayout
      title="Wholesaler Portal"
      subtitle="Manage inventory, orders, and payouts"
      portalIcon={<Warehouse className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'Add Product', href: '/portals/wholesaler/products/new' },
        { label: 'View Orders', href: '/portals/wholesaler/orders' },
        { label: 'Payouts', href: '/portals/wholesaler/payouts' },
      ]}
    >
      {/* KPI Command Center */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {kpis.map(kpi => (
          <CommandCenterKPI
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            variant={kpi.variant}
            isActive={selectedKpi === kpi.key}
            onClick={() => handleKpiClick(kpi.key)}
            isSimulated={productsResult.isSimulated}
          />
        ))}
      </div>

      {/* View Details Bar */}
      {selectedKpi && (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setSelectedKpi(null)}>
              <ChevronUp className="h-4 w-4 mr-1" /> Close
            </Button>
          </CardHeader>
          <CardContent>{renderDetailContent()}</CardContent>
        </Card>
      )}

      {/* Quick Actions Grid */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/wholesaler/inventory')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Inventory Manager</p>
              <p className="text-sm text-muted-foreground">Add & edit products</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/wholesaler/orders')}>
          <CardContent className="p-4 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-blue-500" />
            <div>
              <p className="font-medium">Orders Received</p>
              <p className="text-sm text-muted-foreground">Accept & fulfill orders</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/wholesaler/payouts')}>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-500" />
            <div>
              <p className="font-medium">Payouts & Fees</p>
              <p className="text-sm text-muted-foreground">View earnings</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={activity} isSimulated={activityResult.isSimulated} />
        </CardContent>
      </Card>
    </EnhancedPortalLayout>
  );
}
