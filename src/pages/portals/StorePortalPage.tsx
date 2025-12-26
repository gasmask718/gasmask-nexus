import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPortalLayout, CommandCenterKPI, PortalEmptyState, ActivityFeed, ActivityItem } from '@/components/portal';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { useResolvedData } from '@/hooks/useResolvedData';
import { Store, ShoppingCart, FileText, HeadphonesIcon, Gift, Package, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Simulation data
const SIMULATION_ORDERS = [
  { id: 'ORD-001', date: '2024-01-15', items: 12, total: 450.00, status: 'delivered' },
  { id: 'ORD-002', date: '2024-01-18', items: 8, total: 320.00, status: 'in_transit' },
  { id: 'ORD-003', date: '2024-01-20', items: 15, total: 580.00, status: 'pending' },
];

const SIMULATION_INVOICES = [
  { id: 'INV-001', date: '2024-01-15', amount: 450.00, status: 'paid' },
  { id: 'INV-002', date: '2024-01-18', amount: 320.00, status: 'pending' },
];

const SIMULATION_TICKETS = [
  { id: 'TKT-001', subject: 'Missing item in order', status: 'open', created: '2024-01-19' },
];

const SIMULATION_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'success', title: 'Order Delivered', description: 'ORD-001 delivered successfully', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { id: '2', type: 'info', title: 'Invoice Paid', description: 'INV-001 payment confirmed', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  { id: '3', type: 'info', title: 'New Promotion', description: '15% off on bulk orders', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000) },
];

type KpiType = 'orders' | 'pending' | 'invoices' | 'tickets' | 'rewards' | null;

export default function StorePortalPage() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<KpiType>(null);

  const ordersResult = useResolvedData([], SIMULATION_ORDERS);
  const invoicesResult = useResolvedData([], SIMULATION_INVOICES);
  const ticketsResult = useResolvedData([], SIMULATION_TICKETS);
  const activityResult = useResolvedData([], SIMULATION_ACTIVITY);

  const orders = ordersResult.data;
  const invoices = invoicesResult.data;
  const tickets = ticketsResult.data;
  const activity = activityResult.data;

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'in_transit');
  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const openTickets = tickets.filter(t => t.status === 'open');

  const kpis = [
    { key: 'orders' as KpiType, label: 'Total Orders', value: orders.length.toString(), variant: 'cyan' as const },
    { key: 'pending' as KpiType, label: 'Pending Orders', value: pendingOrders.length.toString(), variant: 'amber' as const },
    { key: 'invoices' as KpiType, label: 'Unpaid Invoices', value: pendingInvoices.length.toString(), variant: 'red' as const },
    { key: 'tickets' as KpiType, label: 'Open Tickets', value: openTickets.length.toString(), variant: 'purple' as const },
    { key: 'rewards' as KpiType, label: 'Reward Points', value: '1,250', variant: 'green' as const },
  ];

  const handleKpiClick = (kpi: KpiType) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      delivered: 'bg-emerald-100 text-emerald-800',
      in_transit: 'bg-blue-100 text-blue-800',
      pending: 'bg-amber-100 text-amber-800',
      paid: 'bg-emerald-100 text-emerald-800',
      open: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[status] || 'bg-muted'}>{status.replace('_', ' ')}</Badge>;
  };

  const renderDetailContent = () => {
    switch (selectedKpi) {
      case 'orders':
      case 'pending':
        const displayOrders = selectedKpi === 'pending' ? pendingOrders : orders;
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">{selectedKpi === 'pending' ? 'Pending Orders' : 'All Orders'}</h4>
            {displayOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{order.id}</p>
                  <p className="text-sm text-muted-foreground">{order.items} items • ${order.total.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(order.status)}
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/portals/store/orders/${order.id}`)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'invoices':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Unpaid Invoices</h4>
            {pendingInvoices.map(invoice => (
              <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{invoice.id}</p>
                  <p className="text-sm text-muted-foreground">${invoice.amount.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(invoice.status)}
                  <Button size="sm" variant="outline">Pay Now</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'tickets':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Open Support Tickets</h4>
            {openTickets.map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{ticket.subject}</p>
                  <p className="text-sm text-muted-foreground">Created: {ticket.created}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(ticket.status)}
                  <Button size="sm" variant="ghost">View</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'rewards':
        return (
          <div className="space-y-4">
            <h4 className="font-semibold">Rewards Program</h4>
            <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">1,250 Points</p>
              <p className="text-sm text-muted-foreground">Available for redemption</p>
            </div>
            <Button variant="outline" className="w-full">View Rewards Catalog</Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <EnhancedPortalLayout
      title="Store Portal"
      subtitle="Manage orders, invoices, and support"
      portalIcon={<Store className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'Browse Products', href: '/portals/store/products' },
        { label: 'View Cart', href: '/portals/store/cart' },
        { label: 'Contact Support', href: '/portals/store/support' },
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
            isSimulated={ordersResult.isSimulated}
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

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/store/products')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Product Catalog</p>
              <p className="text-sm text-muted-foreground">Browse & reorder products</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/store/orders')}>
          <CardContent className="p-4 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-blue-500" />
            <div>
              <p className="font-medium">Order History</p>
              <p className="text-sm text-muted-foreground">View past orders</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/store/support')}>
          <CardContent className="p-4 flex items-center gap-3">
            <HeadphonesIcon className="h-8 w-8 text-purple-500" />
            <div>
              <p className="font-medium">Support</p>
              <p className="text-sm text-muted-foreground">Get help & submit tickets</p>
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
