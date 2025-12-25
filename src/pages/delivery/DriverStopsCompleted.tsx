import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, 
  BreadcrumbPage, BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { ArrowLeft, Store, MapPin, Clock, ChevronRight, CheckCircle2, Camera, Search, Filter } from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { SimulationBanner } from '@/components/delivery/SimulationModeToggle';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Simulation data for completed stops
const SIMULATED_STOPS = [
  { id: 'stop-1', storeId: 'st-1', storeName: 'Brooklyn Smoke Shop', address: '123 Flatbush Ave', borough: 'Brooklyn', routeId: 'RT-SIM-101', completedAt: new Date(Date.now() - 3600000).toISOString(), proofStatus: 'submitted' },
  { id: 'stop-2', storeId: 'st-2', storeName: 'Kings County Tobacco', address: '456 Atlantic Ave', borough: 'Brooklyn', routeId: 'RT-SIM-101', completedAt: new Date(Date.now() - 7200000).toISOString(), proofStatus: 'submitted' },
  { id: 'stop-3', storeId: 'st-9', storeName: 'Jamaica Tobacco', address: '123 Jamaica Ave', borough: 'Queens', routeId: 'RT-SIM-099', completedAt: new Date(Date.now() - 90000000).toISOString(), proofStatus: 'submitted' },
  { id: 'stop-4', storeId: 'st-10', storeName: 'Astoria Smoke', address: '456 Steinway St', borough: 'Queens', routeId: 'RT-SIM-099', completedAt: new Date(Date.now() - 93600000).toISOString(), proofStatus: 'pending' },
  { id: 'stop-5', storeId: 'st-15', storeName: 'Fordham Tobacco', address: '123 Fordham Rd', borough: 'Bronx', routeId: 'RT-SIM-088', completedAt: new Date(Date.now() - 180000000).toISOString(), proofStatus: 'submitted' },
  { id: 'stop-6', storeId: 'st-22', storeName: 'Harlem Tobacco', address: '123 125th St', borough: 'Manhattan', routeId: 'RT-SIM-075', completedAt: new Date(Date.now() - 266400000).toISOString(), proofStatus: 'submitted' },
  { id: 'stop-7', storeId: 'st-23', storeName: 'Midtown Smoke', address: '456 5th Ave', borough: 'Manhattan', routeId: 'RT-SIM-075', completedAt: new Date(Date.now() - 270000000).toISOString(), proofStatus: 'submitted' },
  { id: 'stop-8', storeId: 'st-27', storeName: 'Williamsburg Tobacco', address: '123 Bedford Ave', borough: 'Brooklyn', routeId: 'RT-SIM-062', completedAt: new Date(Date.now() - 352800000).toISOString(), proofStatus: 'missing' },
  { id: 'stop-9', storeId: 'st-28', storeName: 'Greenpoint Smoke', address: '456 Manhattan Ave', borough: 'Brooklyn', routeId: 'RT-SIM-062', completedAt: new Date(Date.now() - 356400000).toISOString(), proofStatus: 'submitted' },
  { id: 'stop-10', storeId: 'st-11', storeName: 'LIC Vape Shop', address: '789 Vernon Blvd', borough: 'Queens', routeId: 'RT-SIM-099', completedAt: new Date(Date.now() - 97200000).toISOString(), proofStatus: 'submitted' },
  { id: 'stop-11', storeId: 'st-16', storeName: 'Pelham Bay Smoke', address: '456 Westchester Ave', borough: 'Bronx', routeId: 'RT-SIM-088', completedAt: new Date(Date.now() - 183600000).toISOString(), proofStatus: 'submitted' },
  { id: 'stop-12', storeId: 'st-3', storeName: 'Prospect Heights Vape', address: '789 Vanderbilt Ave', borough: 'Brooklyn', routeId: 'RT-SIM-101', completedAt: new Date(Date.now() - 10800000).toISOString(), proofStatus: 'submitted' },
];

const DriverStopsCompleted: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [boroughFilter, setBoroughFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');

  // Fetch real stops data
  const { data: realStops = [] } = useQuery({
    queryKey: ['driver-completed-stops', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('route_checkins')
        .select(`
          id, completed_at, status,
          store:store_master(id, store_name, address, city),
          route:routes(id, territory)
        `)
        .eq('driver_id', user.id)
        .order('completed_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
  });

  const hasRealData = realStops.length > 0;
  const showSimulated = simulationMode && !hasRealData;
  const resolvedStops = hasRealData ? realStops : (showSimulated ? SIMULATED_STOPS : []);

  // Get unique boroughs and routes for filters
  const boroughs = useMemo(() => {
    const set = new Set(resolvedStops.map((s: any) => s.borough || s.store?.city || 'Unknown'));
    return Array.from(set);
  }, [resolvedStops]);

  const routes = useMemo(() => {
    const set = new Set(resolvedStops.map((s: any) => s.routeId || s.route?.id || 'Unknown'));
    return Array.from(set);
  }, [resolvedStops]);

  // Filter stops
  const filteredStops = useMemo(() => {
    return resolvedStops.filter((stop: any) => {
      const storeName = stop.storeName || stop.store?.store_name || '';
      const address = stop.address || stop.store?.address || '';
      const borough = stop.borough || stop.store?.city || '';
      const routeId = stop.routeId || stop.route?.id || '';

      const matchesSearch = searchQuery === '' || 
        storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBorough = boroughFilter === 'all' || borough === boroughFilter;
      const matchesRoute = routeFilter === 'all' || routeId === routeFilter;

      return matchesSearch && matchesBorough && matchesRoute;
    });
  }, [resolvedStops, searchQuery, boroughFilter, routeFilter]);

  const getProofBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="default" className="bg-green-600"><Camera className="h-3 w-3 mr-1" />Submitted</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Camera className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'missing':
        return <Badge variant="destructive"><Camera className="h-3 w-3 mr-1" />Missing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <SimulationBanner />
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate('/delivery/driver')} className="cursor-pointer">
                Driver OS
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Stops Completed</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/delivery/driver')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Stops Completed
                {showSimulated && <SimulationBadge className="ml-2" />}
              </h1>
              <p className="text-muted-foreground">All your completed store stops</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={boroughFilter} onValueChange={setBoroughFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Borough" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Boroughs</SelectItem>
                  {boroughs.map((b: string) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={routeFilter} onValueChange={setRouteFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Routes</SelectItem>
                  {routes.map((r: string) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{filteredStops.length}</div>
              <p className="text-sm text-muted-foreground">Total Stops</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredStops.filter((s: any) => (s.proofStatus || 'submitted') === 'submitted').length}
              </div>
              <p className="text-sm text-muted-foreground">With Proof</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {filteredStops.filter((s: any) => (s.proofStatus || 'submitted') !== 'submitted').length}
              </div>
              <p className="text-sm text-muted-foreground">Missing Proof</p>
            </CardContent>
          </Card>
        </div>

        {/* Stops List */}
        {filteredStops.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No completed stops found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredStops.map((stop: any) => {
              const storeName = stop.storeName || stop.store?.store_name || 'Unknown Store';
              const address = stop.address || stop.store?.address || '';
              const routeId = stop.routeId || stop.route?.id || '';
              const completedAt = stop.completedAt || stop.completed_at;
              const proofStatus = stop.proofStatus || 'submitted';
              const storeId = stop.storeId || stop.store?.id;

              return (
                <Card 
                  key={stop.id} 
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/delivery/store/${storeId}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Store className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{storeName}</p>
                            {showSimulated && <SimulationBadge text="Demo" />}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {address}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span>Route: {routeId}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {completedAt ? new Date(completedAt).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getProofBadge(proofStatus)}
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/delivery/route/${routeId}`);
                            }}
                          >
                            View Route
                          </Button>
                          {proofStatus === 'submitted' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Would open proof viewer
                              }}
                            >
                              View Proof
                            </Button>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DriverStopsCompleted;
