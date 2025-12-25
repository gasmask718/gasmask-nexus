import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  User, Truck, MapPin, DollarSign, Clock, 
  CheckCircle2, AlertTriangle, History, Navigation,
  ChevronRight, Home, FileText, Settings
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { SimulationModeToggle, SimulationBanner } from '@/components/delivery/SimulationModeToggle';

const DriverOS: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { simulationMode, simulationData } = useSimulationMode();
  const [isAvailable, setIsAvailable] = useState(true);

  // Fetch driver profile
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, phone, avatar_url, driver_health_score')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch driver profile extended info
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile-extended', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch lifetime stats - routes completed
  const { data: routesCompleted = 0 } = useQuery({
    queryKey: ['driver-lifetime-routes', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_driver_id', user.id)
        .eq('status', 'completed');
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Fetch lifetime stats - stops completed
  const { data: stopsCompleted = 0 } = useQuery({
    queryKey: ['driver-lifetime-stops', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('route_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', user.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Fetch routes from routes table as backup
  const { data: routeStats } = useQuery({
    queryKey: ['driver-route-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { completed: 0, total: 0 };
      const { data, error } = await supabase
        .from('routes')
        .select('id, status')
        .eq('assigned_to', user.id);
      if (error) return { completed: 0, total: 0 };
      const completed = data?.filter(r => r.status === 'completed').length || 0;
      return { completed, total: data?.length || 0 };
    },
    enabled: !!user?.id,
  });

  // Fetch payout summary
  const { data: payoutSummary } = useQuery({
    queryKey: ['driver-payout-summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Get last paid payout
      const { data: lastPaid } = await supabase
        .from('worker_payouts')
        .select('total_to_pay, paid_at')
        .eq('worker_id', user.id)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get pending payout
      const { data: pending } = await supabase
        .from('worker_payouts')
        .select('total_to_pay')
        .eq('worker_id', user.id)
        .in('status', ['pending', 'approved'])
        .maybeSingle();

      return {
        lastPaid: lastPaid?.total_to_pay || 0,
        lastPaidDate: lastPaid?.paid_at,
        pendingAmount: pending?.total_to_pay || 0,
      };
    },
    enabled: !!user?.id,
  });

  // Fetch recent route history
  const { data: recentHistory = [] } = useQuery({
    queryKey: ['driver-route-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('routes')
        .select('id, date, status, type, territory')
        .eq('assigned_to', user.id)
        .order('date', { ascending: false })
        .limit(5);
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
  });

  const handleAvailabilityChange = (checked: boolean) => {
    setIsAvailable(checked);
    toast.success(checked ? 'You are now available for routes' : 'You are now offline');
  };

  // Simulate driver data when no real data exists
  const simDriver = simulationData.drivers?.[0];
  const hasRealData = !!profile || routesCompleted > 0 || stopsCompleted > 0;
  const showSimulated = simulationMode && !hasRealData;

  // Resolve stats: real or simulated
  const totalRoutes = hasRealData 
    ? Math.max(routesCompleted, routeStats?.completed || 0)
    : (showSimulated ? simDriver?.routes_today || 1 : 0);
  const totalStops = hasRealData 
    ? stopsCompleted 
    : (showSimulated ? (simDriver?.stops_completed || 0) + (simDriver?.stops_pending || 0) : 0);
  const healthScore = hasRealData 
    ? (profile?.driver_health_score || 100)
    : (showSimulated ? 95 : 100);
  const lastPayout = hasRealData 
    ? (payoutSummary?.lastPaid || 0)
    : (showSimulated ? 320 : 0);
  const pendingPayout = hasRealData 
    ? (payoutSummary?.pendingAmount || 0)
    : (showSimulated ? simDriver?.estimated_earnings || 280 : 0);

  // Simulated activity
  const resolvedActivity = hasRealData 
    ? recentHistory 
    : (showSimulated ? [
        { id: 'sim-1', date: new Date().toISOString(), type: 'Wholesale', territory: 'Brooklyn', status: 'completed' },
        { id: 'sim-2', date: new Date(Date.now() - 86400000).toISOString(), type: 'Retail', territory: 'Queens', status: 'completed' },
        { id: 'sim-3', date: new Date(Date.now() - 172800000).toISOString(), type: 'Wholesale', territory: 'Bronx', status: 'completed' },
      ] : []);

  return (
    <Layout>
      <SimulationBanner />
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              Driver OS
              {showSimulated && <SimulationBadge className="ml-2" />}
            </h1>
            <p className="text-muted-foreground">Your driver profile and system settings</p>
          </div>
          <SimulationModeToggle />
        </div>

        {/* Driver Profile Card */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile?.name} 
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{profile?.name || 'Driver'}</h2>
                <p className="text-muted-foreground">{profile?.email}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <Badge variant={isAvailable ? 'default' : 'secondary'}>
                    {isAvailable ? 'Active' : 'Offline'}
                  </Badge>
                  {driverProfile?.region && (
                    <Badge variant="outline">
                      <MapPin className="h-3 w-3 mr-1" />
                      {driverProfile.region}
                    </Badge>
                  )}
                  {driverProfile?.vehicle_type && (
                    <Badge variant="outline">
                      <Truck className="h-3 w-3 mr-1" />
                      {driverProfile.vehicle_type}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Available</span>
                <Switch
                  checked={isAvailable}
                  onCheckedChange={handleAvailabilityChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lifetime Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div className="text-2xl font-bold">{totalRoutes}</div>
              <p className="text-sm text-muted-foreground">Routes Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="h-10 w-10 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-2xl font-bold">{totalStops}</div>
              <p className="text-sm text-muted-foreground">Stops Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="h-10 w-10 mx-auto rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="text-2xl font-bold">0</div>
              <p className="text-sm text-muted-foreground">Issues Reported</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="h-10 w-10 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-2xl font-bold">{healthScore}</div>
              <p className="text-sm text-muted-foreground">Health Score</p>
            </CardContent>
          </Card>
        </div>

        {/* Payout Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payout Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Last Payout</p>
                <p className="text-2xl font-bold">
                  ${lastPayout.toFixed(2)}
                </p>
                {payoutSummary?.lastPaidDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(payoutSummary.lastPaidDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Pending Payout</p>
                <p className="text-2xl font-bold text-primary">
                  ${pendingPayout.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingPayout > 0 ? 'Awaiting approval' : 'No pending payouts'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-auto py-4 justify-between"
                onClick={() => navigate('/delivery/driver-home')}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Driver Home</p>
                    <p className="text-sm text-muted-foreground">Today's routes & tasks</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Button>

              <Button 
                variant="outline" 
                className="h-auto py-4 justify-between"
                onClick={() => navigate('/delivery/my-route')}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Navigation className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">My Route</p>
                    <p className="text-sm text-muted-foreground">Active route navigation</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Button>

              <Button 
                variant="outline" 
                className="h-auto py-4 justify-between"
                onClick={() => navigate('/delivery/payouts')}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">View Payouts</p>
                    <p className="text-sm text-muted-foreground">Earnings history</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Button>

              <Button 
                variant="outline" 
                className="h-auto py-4 justify-between"
                onClick={() => {}}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <History className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Route History</p>
                    <p className="text-sm text-muted-foreground">Past deliveries</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resolvedActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No activity yet</p>
                <p className="text-sm">Your route history will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {resolvedActivity.map((activity: any) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {activity.type || 'Route'} · {activity.territory || 'N/A'}
                        {showSimulated && <SimulationBadge className="ml-2" text="Demo" />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.date).toLocaleDateString()} · 
                        <Badge variant="outline" className="ml-1 text-xs">
                          {activity.status}
                        </Badge>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DriverOS;
