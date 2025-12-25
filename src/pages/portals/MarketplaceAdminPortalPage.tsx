import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPortalLayout, CommandCenterKPI, ActivityFeed, ActivityItem } from '@/components/portal';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useResolvedData } from '@/hooks/useResolvedData';
import { Settings, Users, ShoppingCart, DollarSign, AlertTriangle, Building2, ChevronUp, Shield, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SIMULATION_USERS = [
  { id: 'U-001', name: 'John Smith', email: 'john@example.com', role: 'driver', status: 'active' },
  { id: 'U-002', name: 'Sarah Jones', email: 'sarah@example.com', role: 'biker', status: 'active' },
  { id: 'U-003', name: 'Mike Brown', email: 'mike@example.com', role: 'ambassador', status: 'pending' },
  { id: 'U-004', name: 'Lisa White', email: 'lisa@example.com', role: 'store', status: 'active' },
];

const SIMULATION_PAYOUTS = [
  { id: 'PAY-001', recipient: 'Metro Distributors', amount: 5200, type: 'wholesaler', status: 'pending' },
  { id: 'PAY-002', recipient: 'John Driver', amount: 850, type: 'driver', status: 'pending' },
  { id: 'PAY-003', recipient: 'Sarah Biker', amount: 420, type: 'biker', status: 'approved' },
];

const SIMULATION_ISSUES = [
  { id: 'ISS-001', title: 'Order dispute #4521', severity: 'high', category: 'dispute', status: 'open' },
  { id: 'ISS-002', title: 'Payment failed for Store XYZ', severity: 'medium', category: 'payment', status: 'investigating' },
  { id: 'ISS-003', title: 'Product listing violation', severity: 'low', category: 'moderation', status: 'open' },
];

const SIMULATION_ORDERS = [
  { id: 'ORD-001', store: 'Corner Store NYC', total: 450, status: 'completed' },
  { id: 'ORD-002', store: 'Brooklyn Bodega', total: 320, refundRequested: true, status: 'refund_pending' },
];

const SIMULATION_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'user', title: 'New User Registered', description: 'Mike Brown (Ambassador)', timestamp: '1 hour ago' },
  { id: '2', type: 'payout', title: 'Payout Approved', description: '$420 to Sarah Biker', timestamp: '2 hours ago' },
  { id: '3', type: 'issue', title: 'Issue Escalated', description: 'Order dispute #4521', timestamp: '3 hours ago' },
  { id: '4', type: 'order', title: 'Refund Requested', description: 'ORD-002 - $320', timestamp: '4 hours ago' },
];

type KpiType = 'users' | 'orders' | 'payouts' | 'issues' | null;

export default function MarketplaceAdminPortalPage() {
  const navigate = useNavigate();
  const { simulationMode, scenario, setScenario } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<KpiType>(null);

  const users = useResolvedData([], SIMULATION_USERS);
  const payouts = useResolvedData([], SIMULATION_PAYOUTS);
  const issues = useResolvedData([], SIMULATION_ISSUES);
  const orders = useResolvedData([], SIMULATION_ORDERS);
  const activity = useResolvedData([], SIMULATION_ACTIVITY);

  const pendingUsers = users.filter(u => u.status === 'pending');
  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'investigating');
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);

  const kpis = [
    { key: 'users' as KpiType, label: 'Total Users', value: users.length.toString(), subValue: `${pendingUsers.length} pending`, icon: Users, color: 'text-blue-500' },
    { key: 'orders' as KpiType, label: 'Total Sales', value: `$${totalSales.toLocaleString()}`, subValue: 'This month', icon: ShoppingCart, color: 'text-emerald-500' },
    { key: 'payouts' as KpiType, label: 'Pending Payouts', value: pendingPayouts.length.toString(), subValue: `$${pendingPayouts.reduce((s, p) => s + p.amount, 0).toLocaleString()}`, icon: DollarSign, color: 'text-amber-500' },
    { key: 'issues' as KpiType, label: 'Open Issues', value: openIssues.length.toString(), icon: AlertTriangle, color: 'text-red-500' },
  ];

  const handleKpiClick = (kpi: KpiType) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800',
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-emerald-100 text-emerald-800',
      open: 'bg-red-100 text-red-800',
      investigating: 'bg-blue-100 text-blue-800',
      completed: 'bg-emerald-100 text-emerald-800',
      refund_pending: 'bg-amber-100 text-amber-800',
    };
    return <Badge className={colors[status] || 'bg-muted'}>{status.replace('_', ' ')}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-amber-100 text-amber-800',
      low: 'bg-blue-100 text-blue-800',
    };
    return <Badge variant="outline" className={colors[severity]}>{severity}</Badge>;
  };

  const renderDetailContent = () => {
    switch (selectedKpi) {
      case 'users':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">User Management</h4>
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email} • {user.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(user.status)}
                  <Button size="sm" variant="ghost">Manage</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'orders':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Order Overview</h4>
            {orders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{order.id}</p>
                  <p className="text-sm text-muted-foreground">{order.store} • ${order.total}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(order.status)}
                  {order.refundRequested && (
                    <Button size="sm" variant="outline" className="text-amber-600">Review Refund</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      case 'payouts':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Payout Approvals</h4>
            {payouts.map(payout => (
              <div key={payout.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{payout.recipient}</p>
                  <p className="text-sm text-muted-foreground">{payout.type} • ${payout.amount}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(payout.status)}
                  {payout.status === 'pending' && (
                    <Button size="sm" variant="outline" className="text-emerald-600">Approve</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      case 'issues':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Open Issues</h4>
            {openIssues.map(issue => (
              <div key={issue.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{issue.title}</p>
                  <p className="text-sm text-muted-foreground">{issue.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getSeverityBadge(issue.severity)}
                  {getStatusBadge(issue.status)}
                  <Button size="sm" variant="ghost">Handle</Button>
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <EnhancedPortalLayout
      title="Marketplace Admin"
      subtitle="Platform governance & management"
      icon={Settings}
      quickActions={[
        { label: 'User Management', onClick: () => navigate('/portals/admin/users') },
        { label: 'Payout Approvals', onClick: () => navigate('/portals/admin/payouts') },
        { label: 'System Health', onClick: () => navigate('/portals/admin/system') },
      ]}
    >
      {/* Simulation Controls (Admin Only) */}
      {simulationMode && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SimulationBadge text="Simulation Controls" />
              </div>
              <Select value={scenario} onValueChange={(v: any) => setScenario(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal Day</SelectItem>
                  <SelectItem value="heavy_issue">Heavy Issue Day</SelectItem>
                  <SelectItem value="low_volume">Low Volume Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* KPI Command Center */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => (
          <CommandCenterKPI
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            subValue={kpi.subValue}
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
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/admin/users')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Users</p>
              <p className="text-sm text-muted-foreground">Manage roles</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/admin/businesses')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-500" />
            <div>
              <p className="font-medium">Businesses</p>
              <p className="text-sm text-muted-foreground">Registry</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/admin/issues')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-8 w-8 text-red-500" />
            <div>
              <p className="font-medium">Disputes</p>
              <p className="text-sm text-muted-foreground">Resolution</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/admin/system')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="font-medium">System</p>
              <p className="text-sm text-muted-foreground">Health & logs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <ActivityFeed items={activity} title="Platform Activity" />
    </EnhancedPortalLayout>
  );
}
