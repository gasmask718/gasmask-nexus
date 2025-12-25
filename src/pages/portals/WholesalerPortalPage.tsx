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
  { id: '1', type: 'order', title: 'New Order Received', description: 'WO-002 from Midtown Mart', timestamp: '30 min ago' },
  { id: '2', type: 'payout', title: 'Payout Processed', description: '$2,500 deposited', timestamp: '1 day ago' },
  { id: '3', type: 'stock', title: 'Low Stock Alert', description: 'Economy Widget C running low', timestamp: '2 days ago' },
];

type KpiType = 'products' | 'orders' | 'pending' | 'revenue' | 'customers' | null;

export default function WholesalerPortalPage() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<KpiType>(null);

  const products = useResolvedData([], SIMULATION_PRODUCTS);
  const orders = useResolvedData([], SIMULATION_ORDERS);
  const payouts = useResolvedData([], SIMULATION_PAYOUTS);
  const activity = useResolvedData([], SIMULATION_ACTIVITY);

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing');
  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);

  const kpis = [
    { key: 'products' as KpiType, label: 'Active Products', value: products.length.toString(), icon: Package, color: 'text-blue-500' },
    { key: 'orders' as KpiType, label: 'Total Orders', value: orders.length.toString(), icon: ShoppingCart, color: 'text-emerald-500' },
    { key: 'pending' as KpiType, label: 'Pending Orders', value: pendingOrders.length.toString(), icon: TrendingUp, color: 'text-amber-500' },
    { key: 'revenue' as KpiType, label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-500' },
    { key: 'customers' as KpiType, label: 'Customers', value: '12', icon: Users, color: 'text-purple-500' },
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
      icon={Warehouse}
      quickActions={[
        { label: 'Add Product', onClick: () => navigate('/portals/wholesaler/products/new') },
        { label: 'View Orders', onClick: () => navigate('/portals/wholesaler/orders') },
        { label: 'Payouts', onClick: () => navigate('/portals/wholesaler/payouts') },
      ]}
    >
      {/* KPI Command Center */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {kpis.map(kpi => (
          <CommandCenterKPI
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            isActive={selectedKpi === kpi.key}
            onClick={() => handleKpiClick(kpi.key)}
            isSimulated={simulationMode}
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
      <ActivityFeed items={activity} title="Recent Activity" />
    </EnhancedPortalLayout>
  );
}
