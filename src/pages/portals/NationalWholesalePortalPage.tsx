import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPortalLayout, CommandCenterKPI, ActivityFeed, ActivityItem } from '@/components/portal';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { useResolvedData } from '@/hooks/useResolvedData';
import { Globe, MapPin, Users, ShoppingCart, DollarSign, FileText, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const SIMULATION_REGIONS = [
  { id: 'NY', name: 'New York', partners: 8, revenue: 125000, growth: 12, status: 'active' },
  { id: 'NJ', name: 'New Jersey', partners: 5, revenue: 78000, growth: 8, status: 'active' },
  { id: 'PA', name: 'Pennsylvania', partners: 4, revenue: 45000, growth: 15, status: 'active' },
  { id: 'CT', name: 'Connecticut', partners: 3, revenue: 32000, growth: -2, status: 'active' },
  { id: 'MA', name: 'Massachusetts', partners: 2, revenue: 18000, growth: 25, status: 'expanding' },
];

const SIMULATION_PARTNERS = [
  { id: 'P-001', name: 'Metro Distributors', region: 'NY', volume: 2500, tier: 'platinum' },
  { id: 'P-002', name: 'Garden State Supply', region: 'NJ', volume: 1800, tier: 'gold' },
  { id: 'P-003', name: 'Keystone Wholesale', region: 'PA', volume: 1200, tier: 'silver' },
];

const SIMULATION_ORDERS = [
  { id: 'BO-001', partner: 'Metro Distributors', units: 500, value: 25000, status: 'processing' },
  { id: 'BO-002', partner: 'Garden State Supply', units: 300, value: 15000, status: 'shipped' },
  { id: 'BO-003', partner: 'Keystone Wholesale', units: 200, value: 10000, status: 'pending' },
];

const SIMULATION_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'info', title: 'Bulk Order Received', description: 'BO-001 from Metro Distributors', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { id: '2', type: 'success', title: 'New Partner Added', description: 'Bay State Goods joined MA region', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  { id: '3', type: 'success', title: 'Region Milestone', description: 'NY reached $125K monthly revenue', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000) },
];

type KpiType = 'regions' | 'partners' | 'orders' | 'revenue' | null;

export default function NationalWholesalePortalPage() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<KpiType>(null);

  const regionsResult = useResolvedData([], SIMULATION_REGIONS);
  const partnersResult = useResolvedData([], SIMULATION_PARTNERS);
  const ordersResult = useResolvedData([], SIMULATION_ORDERS);
  const activityResult = useResolvedData([], SIMULATION_ACTIVITY);

  const regions = regionsResult.data;
  const partners = partnersResult.data;
  const orders = ordersResult.data;
  const activity = activityResult.data;

  const totalPartners = regions.reduce((sum, r) => sum + r.partners, 0);
  const totalRevenue = regions.reduce((sum, r) => sum + r.revenue, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing');

  const kpis = [
    { key: 'regions' as KpiType, label: 'Active Regions', value: regions.length.toString(), variant: 'cyan' as const },
    { key: 'partners' as KpiType, label: 'Total Partners', value: totalPartners.toString(), variant: 'purple' as const },
    { key: 'orders' as KpiType, label: 'Pending Orders', value: pendingOrders.length.toString(), variant: 'amber' as const },
    { key: 'revenue' as KpiType, label: 'Monthly Revenue', value: `$${(totalRevenue / 1000).toFixed(0)}K`, variant: 'green' as const },
  ];

  const handleKpiClick = (kpi: KpiType) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800',
      expanding: 'bg-blue-100 text-blue-800',
      pending: 'bg-amber-100 text-amber-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
    };
    return <Badge className={colors[status] || 'bg-muted'}>{status}</Badge>;
  };

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      platinum: 'bg-slate-100 text-slate-800',
      gold: 'bg-amber-100 text-amber-800',
      silver: 'bg-gray-100 text-gray-800',
    };
    return <Badge className={colors[tier]}>{tier}</Badge>;
  };

  const renderDetailContent = () => {
    switch (selectedKpi) {
      case 'regions':
        return (
          <div className="space-y-3">
            <h4 className="font-semibold">Regional Performance</h4>
            {regions.map(region => (
              <div key={region.id} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{region.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(region.status)}
                    <span className={`text-sm font-medium ${region.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {region.growth >= 0 ? '+' : ''}{region.growth}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <span>{region.partners} partners</span>
                  <span>${(region.revenue / 1000).toFixed(0)}K revenue</span>
                </div>
              </div>
            ))}
          </div>
        );
      case 'partners':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Top Partners</h4>
            {partners.map(partner => (
              <div key={partner.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{partner.name}</p>
                  <p className="text-sm text-muted-foreground">{partner.region} • {partner.volume} units/mo</p>
                </div>
                <div className="flex items-center gap-2">
                  {getTierBadge(partner.tier)}
                  <Button size="sm" variant="ghost">View</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'orders':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Bulk Orders</h4>
            {orders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{order.id}</p>
                  <p className="text-sm text-muted-foreground">{order.partner} • {order.units} units</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">${order.value.toLocaleString()}</span>
                  {getStatusBadge(order.status)}
                </div>
              </div>
            ))}
          </div>
        );
      case 'revenue':
        return (
          <div className="space-y-4">
            <h4 className="font-semibold">Revenue by Region</h4>
            {regions.map(region => (
              <div key={region.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{region.name}</span>
                  <span className="font-medium">${(region.revenue / 1000).toFixed(0)}K</span>
                </div>
                <Progress value={totalRevenue > 0 ? (region.revenue / totalRevenue) * 100 : 0} />
              </div>
            ))}
            <div className="pt-2 border-t">
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>${(totalRevenue / 1000).toFixed(0)}K</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <EnhancedPortalLayout
      title="National Wholesale Portal"
      subtitle="Multi-state network management"
      portalIcon={<Globe className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'View Regions', href: '/portals/national-wholesale/regions' },
        { label: 'Partner List', href: '/portals/national-wholesale/partners' },
        { label: 'Bulk Orders', href: '/portals/national-wholesale/orders' },
      ]}
    >
      {/* KPI Command Center */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => (
          <CommandCenterKPI
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            variant={kpi.variant}
            isActive={selectedKpi === kpi.key}
            onClick={() => handleKpiClick(kpi.key)}
            isSimulated={regionsResult.isSimulated}
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
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/national-wholesale/regions')}>
          <CardContent className="p-4 flex items-center gap-3">
            <MapPin className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Regional Dashboard</p>
              <p className="text-sm text-muted-foreground">State-by-state performance</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/national-wholesale/partners')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-500" />
            <div>
              <p className="font-medium">Partner Network</p>
              <p className="text-sm text-muted-foreground">Manage relationships</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/national-wholesale/contracts')}>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <p className="font-medium">Contract Vault</p>
              <p className="text-sm text-muted-foreground">Documents & agreements</p>
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
