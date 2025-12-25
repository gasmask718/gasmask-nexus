/**
 * Driver Portal - Full operational portal for drivers
 * Routes: /portals/driver/*
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Truck, MapPin, CheckCircle2, AlertTriangle, DollarSign, 
  Clock, Camera, MessageSquare, History, Route as RouteIcon,
  ChevronRight, Package
} from 'lucide-react';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';
import { CommandCenterKPI } from '@/components/portal/CommandCenterKPI';
import { ActivityFeed, ActivityItem } from '@/components/portal/ActivityFeed';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { HudCard } from '@/components/portal/HudCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useResolvedData, useResolvedValue } from '@/hooks/useResolvedData';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

// Simulation data for driver portal
const SIMULATION_ROUTES = [
  { id: 'RT-001', area: 'Brooklyn - Bushwick', stops: 8, status: 'active', completedStops: 3 },
  { id: 'RT-002', area: 'Brooklyn - Bed-Stuy', stops: 6, status: 'upcoming', completedStops: 0 },
];

const SIMULATION_STOPS_LEFT = [
  { id: 's1', store: 'Quick Stop #42', address: '123 Knickerbocker Ave', routeId: 'RT-001', eta: '10:30 AM' },
  { id: 's2', store: 'Corner Deli', address: '456 Broadway', routeId: 'RT-001', eta: '10:45 AM' },
  { id: 's3', store: 'Smoke Shop Plus', address: '789 Myrtle Ave', routeId: 'RT-001', eta: '11:00 AM' },
  { id: 's4', store: 'Express Mart', address: '321 Flushing Ave', routeId: 'RT-001', eta: '11:15 AM' },
  { id: 's5', store: 'City Convenience', address: '654 Gates Ave', routeId: 'RT-001', eta: '11:30 AM' },
];

const SIMULATION_STOPS_COMPLETED = [
  { id: 'c1', store: 'First Stop Deli', time: '9:15 AM', routeId: 'RT-001', proofUploaded: true },
  { id: 'c2', store: 'Morning Mart', time: '9:35 AM', routeId: 'RT-001', proofUploaded: true },
  { id: 'c3', store: 'Early Bird Shop', time: '9:55 AM', routeId: 'RT-001', proofUploaded: false },
];

const SIMULATION_ACTIVITY: ActivityItem[] = [
  { id: '1', title: 'Delivery completed', description: 'Early Bird Shop - 3 boxes delivered', timestamp: new Date(Date.now() - 1800000), type: 'success' },
  { id: '2', title: 'Proof uploaded', description: 'Morning Mart - Photo verified', timestamp: new Date(Date.now() - 3600000), type: 'info' },
  { id: '3', title: 'Route started', description: 'RT-001 Brooklyn - Bushwick', timestamp: new Date(Date.now() - 7200000), type: 'info' },
];

function DriverPortalContent() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  // Resolve data - real vs simulation
  const { data: routes, isSimulated: routesSimulated } = useResolvedData([], SIMULATION_ROUTES);
  const { data: stopsLeft, isSimulated: stopsSimulated } = useResolvedData([], SIMULATION_STOPS_LEFT);
  const { data: stopsCompleted } = useResolvedData([], SIMULATION_STOPS_COMPLETED);
  const { data: activity, isSimulated: activitySimulated } = useResolvedData([], SIMULATION_ACTIVITY);

  // Calculate KPI values
  const totalStopsToday = routes.reduce((sum, r) => sum + r.stops, 0);
  const completedCount = stopsCompleted.length;
  const remainingCount = stopsLeft.length;
  const estimatedEarnings = completedCount * 15 + routes.filter(r => r.status === 'active').length * 25;

  const handleKpiClick = (kpi: string) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  return (
    <EnhancedPortalLayout 
      title="Driver Portal" 
      subtitle="Daily operations & earnings"
      portalIcon={<Truck className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'My Route', href: '/delivery/my-route', icon: <RouteIcon className="h-4 w-4" /> },
        { label: 'Upload Proof', href: '#', icon: <Camera className="h-4 w-4" /> },
        { label: 'Report Issue', href: '#', icon: <AlertTriangle className="h-4 w-4" /> },
      ]}
    >
      <div className="space-y-6">
        {/* Command Center KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <CommandCenterKPI
            label="Routes Today"
            value={routes.length}
            icon={RouteIcon}
            trend={`${totalStopsToday} total stops`}
            variant="cyan"
            isActive={selectedKpi === 'routes'}
            isSimulated={routesSimulated}
            onClick={() => handleKpiClick('routes')}
          />
          <CommandCenterKPI
            label="Stops Left"
            value={remainingCount}
            icon={MapPin}
            trend="Next: 10:30 AM"
            variant="amber"
            isActive={selectedKpi === 'stops-left'}
            isSimulated={stopsSimulated}
            onClick={() => handleKpiClick('stops-left')}
          />
          <CommandCenterKPI
            label="Stops Completed"
            value={completedCount}
            icon={CheckCircle2}
            trend={`${Math.round((completedCount / totalStopsToday) * 100) || 0}% complete`}
            trendDirection="up"
            variant="green"
            isActive={selectedKpi === 'stops-completed'}
            isSimulated={stopsSimulated}
            onClick={() => handleKpiClick('stops-completed')}
          />
          <CommandCenterKPI
            label="Est. Earnings"
            value={`$${estimatedEarnings}`}
            icon={DollarSign}
            trend="Today's projected"
            variant="purple"
            isActive={selectedKpi === 'earnings'}
            isSimulated={routesSimulated}
            onClick={() => handleKpiClick('earnings')}
          />
        </div>

        {/* View Details Bar */}
        {selectedKpi && (
          <Card className="border-primary/20 bg-card/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {selectedKpi === 'routes' && 'Routes Today'}
                  {selectedKpi === 'stops-left' && 'Remaining Stops'}
                  {selectedKpi === 'stops-completed' && 'Completed Stops'}
                  {selectedKpi === 'earnings' && 'Earnings Breakdown'}
                  {(routesSimulated || stopsSimulated) && <SimulationBadge />}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedKpi(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedKpi === 'routes' && (
                <div className="space-y-2">
                  {routes.map((route) => (
                    <div key={route.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate('/delivery/my-route')}>
                      <div>
                        <p className="font-medium">{route.id}</p>
                        <p className="text-sm text-muted-foreground">{route.area}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={route.status === 'active' ? 'default' : 'secondary'}>
                          {route.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{route.completedStops}/{route.stops} stops</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedKpi === 'stops-left' && (
                <div className="space-y-2">
                  {stopsLeft.map((stop) => (
                    <div key={stop.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium">{stop.store}</p>
                        <p className="text-sm text-muted-foreground">{stop.address}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{stop.eta}</Badge>
                        <span className="text-xs text-muted-foreground">{stop.routeId}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedKpi === 'stops-completed' && (
                <div className="space-y-2">
                  {stopsCompleted.map((stop) => (
                    <div key={stop.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium">{stop.store}</p>
                        <p className="text-sm text-muted-foreground">Completed at {stop.time}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {stop.proofUploaded ? (
                          <Badge variant="default" className="bg-hud-green/20 text-hud-green">Proof ✓</Badge>
                        ) : (
                          <Badge variant="destructive">Missing Proof</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedKpi === 'earnings' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold">${completedCount * 15}</p>
                      <p className="text-xs text-muted-foreground">Stop Earnings</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold">${routes.length * 25}</p>
                      <p className="text-xs text-muted-foreground">Route Bonus</p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/10">
                      <p className="text-2xl font-bold text-primary">${estimatedEarnings}</p>
                      <p className="text-xs text-muted-foreground">Total Est.</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Final earnings calculated after route completion and proof verification
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active Route */}
          <div className="lg:col-span-2">
            <HudCard title="Active Route" icon={<RouteIcon className="h-4 w-4" />} variant="cyan">
              {routes.filter(r => r.status === 'active').length > 0 ? (
                <div className="space-y-4">
                  {routes.filter(r => r.status === 'active').map(route => (
                    <div key={route.id}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-lg">{route.id}</p>
                          <p className="text-sm text-muted-foreground">{route.area}</p>
                        </div>
                        <Button asChild>
                          <Link to="/delivery/my-route">View Route</Link>
                        </Button>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-hud-green rounded-full transition-all"
                          style={{ width: `${(route.completedStops / route.stops) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {route.completedStops} of {route.stops} stops completed
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No active route</p>
                </div>
              )}
            </HudCard>
          </div>

          {/* Quick Actions & Activity */}
          <div className="space-y-6">
            <HudCard title="Quick Actions" variant="default">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
                  <Link to="/delivery/my-route">
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs">My Route</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <Camera className="h-4 w-4" />
                  <span className="text-xs">Upload Proof</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">Report Issue</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs">Messages</span>
                </Button>
              </div>
            </HudCard>

            <HudCard title="Recent Activity" icon={<History className="h-4 w-4" />} variant="default">
              <ActivityFeed 
                items={activity} 
                isSimulated={activitySimulated}
                maxItems={5}
              />
            </HudCard>
          </div>
        </div>
      </div>
    </EnhancedPortalLayout>
  );
}

export default function DriverPortalPage() {
  return (
    <PortalRBACGate allowedRoles={['driver']} portalName="Driver Portal">
      <DriverPortalContent />
    </PortalRBACGate>
  );
}
