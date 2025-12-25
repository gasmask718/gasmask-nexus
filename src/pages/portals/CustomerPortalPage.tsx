import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPortalLayout, CommandCenterKPI, ActivityFeed, ActivityItem } from '@/components/portal';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { useResolvedData } from '@/hooks/useResolvedData';
import { User, ShoppingBag, Heart, Gift, HeadphonesIcon, ChevronUp, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SIMULATION_ORDERS = [
  { id: 'ORD-001', date: '2024-01-20', items: 3, total: 89.99, status: 'delivered', tracking: 'Delivered Jan 22' },
  { id: 'ORD-002', date: '2024-01-25', items: 2, total: 45.00, status: 'in_transit', tracking: 'Out for delivery' },
];

const SIMULATION_SAVED = [
  { id: 'SAV-001', name: 'Premium Widget Pro', price: 49.99, inStock: true },
  { id: 'SAV-002', name: 'Deluxe Gadget X', price: 79.99, inStock: false },
];

const SIMULATION_REWARDS = {
  points: 1250,
  tier: 'Silver',
  nextTier: 'Gold',
  pointsToNext: 750,
};

const SIMULATION_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'order', title: 'Order Delivered', description: 'ORD-001 delivered successfully', timestamp: '3 days ago' },
  { id: '2', type: 'reward', title: 'Points Earned', description: '+50 points from last order', timestamp: '3 days ago' },
  { id: '3', type: 'promo', title: 'New Offer', description: '20% off your next order', timestamp: '1 week ago' },
];

type KpiType = 'orders' | 'tracking' | 'saved' | 'rewards' | null;

export default function CustomerPortalPage() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<KpiType>(null);

  const orders = useResolvedData([], SIMULATION_ORDERS);
  const saved = useResolvedData([], SIMULATION_SAVED);
  const rewards = useResolvedData({ points: 0, tier: 'Bronze', nextTier: 'Silver', pointsToNext: 500 }, SIMULATION_REWARDS);
  const activity = useResolvedData([], SIMULATION_ACTIVITY);

  const inTransit = orders.filter(o => o.status === 'in_transit');

  const kpis = [
    { key: 'orders' as KpiType, label: 'Total Orders', value: orders.length.toString(), icon: ShoppingBag, color: 'text-blue-500' },
    { key: 'tracking' as KpiType, label: 'In Transit', value: inTransit.length.toString(), icon: Truck, color: 'text-amber-500' },
    { key: 'saved' as KpiType, label: 'Saved Items', value: saved.length.toString(), icon: Heart, color: 'text-red-500' },
    { key: 'rewards' as KpiType, label: 'Reward Points', value: rewards.points.toLocaleString(), icon: Gift, color: 'text-emerald-500' },
  ];

  const handleKpiClick = (kpi: KpiType) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      delivered: 'bg-emerald-100 text-emerald-800',
      in_transit: 'bg-blue-100 text-blue-800',
      processing: 'bg-amber-100 text-amber-800',
    };
    return <Badge className={colors[status] || 'bg-muted'}>{status.replace('_', ' ')}</Badge>;
  };

  const renderDetailContent = () => {
    switch (selectedKpi) {
      case 'orders':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Order History</h4>
            {orders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{order.id}</p>
                  <p className="text-sm text-muted-foreground">{order.items} items • ${order.total.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(order.status)}
                  <Button size="sm" variant="ghost">View</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'tracking':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Orders In Transit</h4>
            {inTransit.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">No orders in transit</p>
            ) : (
              inTransit.map(order => (
                <div key={order.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{order.id}</p>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="h-4 w-4" />
                    <span>{order.tracking}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      case 'saved':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Saved Items</h4>
            {saved.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {item.inStock ? (
                    <Badge className="bg-emerald-100 text-emerald-800">In Stock</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800">Out of Stock</Badge>
                  )}
                  <Button size="sm" variant="outline" disabled={!item.inStock}>Add to Cart</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'rewards':
        return (
          <div className="space-y-4">
            <h4 className="font-semibold">Rewards Program</h4>
            <div className="p-4 bg-gradient-to-r from-amber-500/10 to-amber-600/10 rounded-lg text-center">
              <p className="text-3xl font-bold text-amber-600">{rewards.points.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Points Available</p>
              <Badge className="mt-2 bg-amber-100 text-amber-800">{rewards.tier} Member</Badge>
            </div>
            <div className="text-sm text-center text-muted-foreground">
              <p>{rewards.pointsToNext} more points to reach {rewards.nextTier}</p>
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
      title="My Account"
      subtitle="Orders, rewards, and account settings"
      icon={User}
      quickActions={[
        { label: 'Shop Now', onClick: () => navigate('/shop') },
        { label: 'Track Order', onClick: () => setSelectedKpi('tracking') },
        { label: 'Get Support', onClick: () => navigate('/portals/customer/support') },
      ]}
    >
      {/* KPI Command Center */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/customer/orders')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">My Orders</p>
              <p className="text-sm text-muted-foreground">View order history</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/customer/saved')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Heart className="h-8 w-8 text-red-500" />
            <div>
              <p className="font-medium">Saved Items</p>
              <p className="text-sm text-muted-foreground">Your wishlist</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/customer/support')}>
          <CardContent className="p-4 flex items-center gap-3">
            <HeadphonesIcon className="h-8 w-8 text-purple-500" />
            <div>
              <p className="font-medium">Support</p>
              <p className="text-sm text-muted-foreground">Get help</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <ActivityFeed items={activity} title="Recent Activity" />
    </EnhancedPortalLayout>
  );
}
