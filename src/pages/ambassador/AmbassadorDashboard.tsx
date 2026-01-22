/**
 * Ambassador Portal Dashboard - Portfolio command center
 * Shows KPIs, assigned stores, commissions, and quick actions
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, DollarSign, TrendingUp, Package, Users, 
  ArrowRight, Phone, MessageSquare, MapPin, AlertTriangle,
  Plus, Calendar, BarChart3, Clock
} from 'lucide-react';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { CommandCenterKPI } from '@/components/portal/CommandCenterKPI';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorPortfolio, type PortfolioStore } from '@/hooks/useAmbassadorPortfolio';
import { format, formatDistanceToNow } from 'date-fns';

function StoreCard({ store, onClick }: { store: PortfolioStore; onClick: () => void }) {
  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{store.store_name}</h3>
              <Badge variant={store.assignment_type === 'sourced' ? 'default' : 'secondary'} className="text-xs">
                {store.assignment_type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {store.store_address}, {store.store_city}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {store.store_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {store.store_phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Assigned {formatDistanceToNow(new Date(store.assigned_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">Commission</span>
            <span className="font-semibold text-primary">{store.commission_rate}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const navigate = useNavigate();
  const { ambassador, stores, metrics, commissions, onlineSales, isLoading } = useAmbassadorPortfolio();
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  const handleStoreClick = (storeId: string) => {
    navigate(`/ambassador/stores/${storeId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // Separate stores by type
  const assignedStores = stores.filter(s => s.assignment_type === 'assigned');
  const sourcedStores = stores.filter(s => s.assignment_type === 'sourced');

  // Recent commissions
  const recentCommissions = commissions.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Scope Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
        <MapPin className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Your Portfolio</p>
          <p className="text-xs text-muted-foreground">
            Viewing data for {metrics.totalStores} stores you manage ({metrics.assignedStores} assigned, {metrics.sourcedStores} sourced)
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <CommandCenterKPI
          label="Total Stores"
          value={metrics.totalStores}
          icon={Store}
          variant="cyan"
          isActive={selectedKpi === 'stores'}
          onClick={() => setSelectedKpi(selectedKpi === 'stores' ? null : 'stores')}
        />
        <CommandCenterKPI
          label="Total Commission"
          value={`$${metrics.totalCommission.toFixed(2)}`}
          icon={DollarSign}
          trend={metrics.pendingCommission > 0 ? `$${metrics.pendingCommission.toFixed(2)} pending` : undefined}
          variant="green"
          isActive={selectedKpi === 'commissions'}
          onClick={() => setSelectedKpi(selectedKpi === 'commissions' ? null : 'commissions')}
        />
        <CommandCenterKPI
          label="Online Commission"
          value={`$${metrics.onlineCommission.toFixed(2)}`}
          icon={TrendingUp}
          variant="purple"
        />
        <CommandCenterKPI
          label="Total Orders"
          value={metrics.totalOrders}
          icon={Package}
          variant="amber"
        />
        <CommandCenterKPI
          label="Revenue Generated"
          value={`$${metrics.totalRevenue.toFixed(2)}`}
          icon={BarChart3}
          variant="cyan"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* My Stores */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  My Stores
                </CardTitle>
                <CardDescription>
                  {stores.length} stores in your portfolio
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/ambassador/stores')}>
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-4">
              {stores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No stores assigned yet</p>
                  <p className="text-sm">Contact your manager to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stores.slice(0, 6).map((store) => (
                    <StoreCard 
                      key={store.assignment_id} 
                      store={store} 
                      onClick={() => handleStoreClick(store.store_id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Commissions */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Recent Commissions
                </CardTitle>
                <CardDescription>
                  Your latest earnings
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/ambassador/commissions')}>
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-4">
              {recentCommissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No commissions yet</p>
                  <p className="text-sm">Start acquiring stores to earn</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentCommissions.map((commission: any) => (
                    <div 
                      key={commission.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                    >
                      <div>
                        <p className="font-medium text-sm">{commission.entity_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(commission.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">${commission.amount}</p>
                        <Badge variant={commission.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                          {commission.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button 
              className="h-auto py-4 flex-col gap-2" 
              onClick={() => navigate('/ambassador/stores')}
            >
              <Store className="h-5 w-5" />
              <span>View Stores</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/ambassador/commissions')}
            >
              <DollarSign className="h-5 w-5" />
              <span>Commissions</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/ambassador/routes')}
            >
              <MapPin className="h-5 w-5" />
              <span>Plan Route</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/ambassador/leads')}
            >
              <Plus className="h-5 w-5" />
              <span>Add Lead</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AmbassadorDashboard() {
  return (
    <PortalRBACGate allowedRoles={['ambassador']} portalName="Ambassador Portal">
      <EnhancedPortalLayout 
        title="Ambassador Dashboard" 
        subtitle="Portfolio command center"
        portalIcon={<Users className="h-4 w-4 text-primary-foreground" />}
      >
        <DashboardContent />
      </EnhancedPortalLayout>
    </PortalRBACGate>
  );
}
