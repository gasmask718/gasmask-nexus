import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, 
  BreadcrumbPage, BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { ArrowLeft, Truck, MapPin, Clock, ChevronDown, ChevronRight, Store, CheckCircle2 } from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { SimulationBanner } from '@/components/delivery/SimulationModeToggle';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Simulation data for routes with stores
const SIMULATED_ROUTES = [
  {
    id: 'RT-SIM-101',
    date: new Date().toISOString(),
    territory: 'Brooklyn',
    stopsCount: 8,
    completionTime: '4h 32m',
    status: 'completed',
    stores: [
      { id: 'st-1', name: 'Brooklyn Smoke Shop', address: '123 Flatbush Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-2', name: 'Kings County Tobacco', address: '456 Atlantic Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-3', name: 'Prospect Heights Vape', address: '789 Vanderbilt Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-4', name: 'Park Slope Cigars', address: '321 5th Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-5', name: 'Sunset Smoke', address: '654 4th Ave', status: 'completed', proofSubmitted: false },
      { id: 'st-6', name: 'Bay Ridge Tobacco', address: '987 3rd Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-7', name: 'Flatbush Vape', address: '147 Nostrand Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-8', name: 'Crown Heights Shop', address: '258 Utica Ave', status: 'completed', proofSubmitted: true },
    ]
  },
  {
    id: 'RT-SIM-099',
    date: new Date(Date.now() - 86400000).toISOString(),
    territory: 'Queens',
    stopsCount: 6,
    completionTime: '3h 15m',
    status: 'completed',
    stores: [
      { id: 'st-9', name: 'Jamaica Tobacco', address: '123 Jamaica Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-10', name: 'Astoria Smoke', address: '456 Steinway St', status: 'completed', proofSubmitted: true },
      { id: 'st-11', name: 'LIC Vape Shop', address: '789 Vernon Blvd', status: 'completed', proofSubmitted: true },
      { id: 'st-12', name: 'Flushing Cigars', address: '321 Main St', status: 'completed', proofSubmitted: true },
      { id: 'st-13', name: 'Forest Hills Tobacco', address: '654 Austin St', status: 'completed', proofSubmitted: false },
      { id: 'st-14', name: 'Elmhurst Smoke', address: '987 Broadway', status: 'completed', proofSubmitted: true },
    ]
  },
  {
    id: 'RT-SIM-088',
    date: new Date(Date.now() - 172800000).toISOString(),
    territory: 'Bronx',
    stopsCount: 7,
    completionTime: '3h 48m',
    status: 'completed',
    stores: [
      { id: 'st-15', name: 'Fordham Tobacco', address: '123 Fordham Rd', status: 'completed', proofSubmitted: true },
      { id: 'st-16', name: 'Pelham Bay Smoke', address: '456 Westchester Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-17', name: 'Hunts Point Vape', address: '789 Southern Blvd', status: 'completed', proofSubmitted: true },
      { id: 'st-18', name: 'Tremont Cigars', address: '321 Tremont Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-19', name: 'Mott Haven Shop', address: '654 3rd Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-20', name: 'Parkchester Tobacco', address: '987 White Plains Rd', status: 'completed', proofSubmitted: true },
      { id: 'st-21', name: 'Throgs Neck Smoke', address: '147 E Tremont Ave', status: 'completed', proofSubmitted: true },
    ]
  },
  {
    id: 'RT-SIM-075',
    date: new Date(Date.now() - 259200000).toISOString(),
    territory: 'Manhattan',
    stopsCount: 5,
    completionTime: '2h 55m',
    status: 'completed',
    stores: [
      { id: 'st-22', name: 'Harlem Tobacco', address: '123 125th St', status: 'completed', proofSubmitted: true },
      { id: 'st-23', name: 'Midtown Smoke', address: '456 5th Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-24', name: 'East Village Vape', address: '789 Ave A', status: 'completed', proofSubmitted: true },
      { id: 'st-25', name: 'Chelsea Cigars', address: '321 8th Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-26', name: 'SoHo Smoke Shop', address: '654 Broadway', status: 'completed', proofSubmitted: true },
    ]
  },
  {
    id: 'RT-SIM-062',
    date: new Date(Date.now() - 345600000).toISOString(),
    territory: 'Brooklyn',
    stopsCount: 9,
    completionTime: '5h 12m',
    status: 'completed',
    stores: [
      { id: 'st-27', name: 'Williamsburg Tobacco', address: '123 Bedford Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-28', name: 'Greenpoint Smoke', address: '456 Manhattan Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-29', name: 'Bushwick Vape', address: '789 Knickerbocker Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-30', name: 'Bed-Stuy Cigars', address: '321 Fulton St', status: 'completed', proofSubmitted: true },
      { id: 'st-31', name: 'DUMBO Smoke', address: '654 Jay St', status: 'completed', proofSubmitted: true },
      { id: 'st-32', name: 'Red Hook Tobacco', address: '987 Van Brunt St', status: 'completed', proofSubmitted: true },
      { id: 'st-33', name: 'Gowanus Vape', address: '147 3rd Ave', status: 'completed', proofSubmitted: true },
      { id: 'st-34', name: 'Cobble Hill Shop', address: '258 Court St', status: 'completed', proofSubmitted: true },
      { id: 'st-35', name: 'Boerum Hill Tobacco', address: '369 Atlantic Ave', status: 'completed', proofSubmitted: true },
    ]
  },
];

const DriverRoutesCompleted: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { simulationMode } = useSimulationMode();
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  // Fetch real routes data
  const { data: realRoutes = [] } = useQuery({
    queryKey: ['driver-completed-routes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('routes')
        .select(`
          id, date, status, territory,
          route_stops (id, store_id, status, completed_at, store:store_master(id, store_name, address))
        `)
        .eq('assigned_to', user.id)
        .eq('status', 'completed')
        .order('date', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
  });

  const hasRealData = realRoutes.length > 0;
  const showSimulated = simulationMode && !hasRealData;
  const resolvedRoutes = hasRealData ? realRoutes : (showSimulated ? SIMULATED_ROUTES : []);

  const toggleExpand = (routeId: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
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
              <BreadcrumbPage>Routes Completed</BreadcrumbPage>
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
                <Truck className="h-6 w-6 text-primary" />
                Routes Completed
                {showSimulated && <SimulationBadge className="ml-2" />}
              </h1>
              <p className="text-muted-foreground">All your completed delivery routes</p>
            </div>
          </div>
        </div>

        {/* Routes List */}
        {resolvedRoutes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No completed routes yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your completed routes will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {resolvedRoutes.map((route: any) => {
              const isExpanded = expandedRoutes.has(route.id);
              const stores = route.stores || route.route_stops?.map((s: any) => ({
                id: s.store?.id || s.id,
                name: s.store?.store_name || 'Unknown Store',
                address: s.store?.address || '',
                status: s.status,
                proofSubmitted: !!s.completed_at,
              })) || [];

              return (
                <Card key={route.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Route Header */}
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpand(route.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Truck className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{route.id}</p>
                            <Badge variant="secondary">{route.territory}</Badge>
                            {showSimulated && <SimulationBadge text="Demo" />}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{new Date(route.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{stores.length || route.stopsCount} stops</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {route.completionTime || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/delivery/route/${route.id}`);
                          }}
                        >
                          View Details
                        </Button>
                        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </div>
                    </div>

                    {/* Expanded Store List */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30">
                        <div className="p-3 border-b bg-muted/50">
                          <p className="text-sm font-medium text-muted-foreground">Stores on this route</p>
                        </div>
                        <div className="divide-y">
                          {stores.map((store: any) => (
                            <div 
                              key={store.id}
                              className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => navigate(`/delivery/store/${store.id}`)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                  <Store className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{store.name}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {store.address}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant={store.status === 'completed' ? 'default' : 'secondary'}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {store.status}
                                </Badge>
                                {store.proofSubmitted ? (
                                  <Badge variant="outline" className="text-green-600">Proof ✓</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-yellow-600">No Proof</Badge>
                                )}
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

export default DriverRoutesCompleted;
