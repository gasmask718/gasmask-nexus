import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Package, Clock, DollarSign, ChevronDown, ChevronUp, 
  X, ExternalLink, Eye, CheckCircle2, Route, Store 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

export type KpiType = 'routes' | 'stops_left' | 'stops_completed' | 'earnings' | null;

interface ViewDetailsBarProps {
  selectedKpi: KpiType;
  onClose: () => void;
}

// Simulation data
const SIMULATED_ROUTES = [
  {
    id: 'RT-101',
    area: 'Brooklyn',
    stopsCount: 8,
    status: 'in_progress',
    stores: [
      { id: 's1', name: 'Smoke King Brooklyn', address: '123 Atlantic Ave', status: 'completed' },
      { id: 's2', name: 'Quick Stop Tobacco', address: '456 Flatbush Ave', status: 'current' },
      { id: 's3', name: 'Downtown Smoke', address: '789 Court St', status: 'pending' },
    ]
  },
  {
    id: 'RT-102',
    area: 'Manhattan',
    stopsCount: 5,
    status: 'pending',
    stores: [
      { id: 's4', name: 'Midtown Tobacco', address: '100 5th Ave', status: 'pending' },
      { id: 's5', name: 'Central Smoke Shop', address: '200 Park Ave', status: 'pending' },
    ]
  }
];

const SIMULATED_STOPS_LEFT = [
  { id: 's2', name: 'Quick Stop Tobacco', address: '456 Flatbush Ave', routeId: 'RT-101', eta: '10:45 AM' },
  { id: 's3', name: 'Downtown Smoke', address: '789 Court St', routeId: 'RT-101', eta: '11:30 AM' },
  { id: 's4', name: 'Midtown Tobacco', address: '100 5th Ave', routeId: 'RT-102', eta: '1:00 PM' },
  { id: 's5', name: 'Central Smoke Shop', address: '200 Park Ave', routeId: 'RT-102', eta: '1:45 PM' },
];

const SIMULATED_STOPS_COMPLETED = [
  { id: 's1', name: 'Smoke King Brooklyn', completionTime: '9:32 AM', routeId: 'RT-101', proofStatus: 'submitted' },
  { id: 's0', name: 'Harbor Tobacco', completionTime: '8:45 AM', routeId: 'RT-101', proofStatus: 'submitted' },
];

const SIMULATED_EARNINGS = [
  { routeId: 'RT-101', storesCompleted: 2, earnings: 85, bonus: 10 },
  { routeId: 'RT-102', storesCompleted: 0, earnings: 0, bonus: 0 },
];

export function ViewDetailsBar({ selectedKpi, onClose }: ViewDetailsBarProps) {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  if (!selectedKpi) {
    return (
      <div className="border border-border/50 rounded-lg p-4 bg-muted/20 text-center text-muted-foreground">
        <p className="text-sm">Select a metric above to view details</p>
      </div>
    );
  }

  const renderRoutesView = () => {
    const routes = simulationMode ? SIMULATED_ROUTES : SIMULATED_ROUTES; // TODO: real data

    return (
      <div className="space-y-2">
        {routes.map((route) => (
          <Collapsible 
            key={route.id} 
            open={expandedRoute === route.id}
            onOpenChange={(open) => setExpandedRoute(open ? route.id : null)}
          >
            <div className="border border-border/50 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-hud-cyan/20 flex items-center justify-center">
                    <Route className="h-4 w-4 text-hud-cyan" />
                  </div>
                  <div>
                    <p className="font-mono font-medium">{route.id}</p>
                    <p className="text-xs text-muted-foreground">{route.area}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={route.status === 'in_progress' ? 'default' : 'secondary'}>
                    {route.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{route.stopsCount} stops</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate('/delivery/my-route')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {expandedRoute === route.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent>
                <div className="border-t border-border/30 p-2 space-y-1 bg-background/50">
                  {route.stores.map((store) => (
                    <div 
                      key={store.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/stores/${store.id}`)}
                    >
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{store.name}</p>
                          <p className="text-xs text-muted-foreground">{store.address}</p>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          store.status === 'completed' && 'border-hud-green text-hud-green',
                          store.status === 'current' && 'border-hud-cyan text-hud-cyan',
                          store.status === 'pending' && 'border-muted-foreground'
                        )}
                      >
                        {store.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    );
  };

  const renderStopsLeftView = () => {
    const stops = simulationMode ? SIMULATED_STOPS_LEFT : SIMULATED_STOPS_LEFT;

    return (
      <div className="space-y-2">
        {stops.map((stop) => (
          <div 
            key={stop.id}
            className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-hud-amber/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-hud-amber" />
              </div>
              <div>
                <p className="font-medium">{stop.name}</p>
                <p className="text-xs text-muted-foreground">{stop.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-mono text-hud-cyan">{stop.eta}</p>
                <p className="text-xs text-muted-foreground">{stop.routeId}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/stores/${stop.id}`)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/delivery/my-route')}>
                  <Route className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStopsCompletedView = () => {
    const stops = simulationMode ? SIMULATED_STOPS_COMPLETED : SIMULATED_STOPS_COMPLETED;

    return (
      <div className="space-y-2">
        {stops.map((stop) => (
          <div 
            key={stop.id}
            className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-hud-green/20 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-hud-green" />
              </div>
              <div>
                <p className="font-medium">{stop.name}</p>
                <p className="text-xs text-muted-foreground">Completed at {stop.completionTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <Badge variant="outline" className="border-hud-green text-hud-green">
                  {stop.proofStatus}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">{stop.routeId}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/stores/${stop.id}`)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/delivery/my-route')}>
                  <Route className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEarningsView = () => {
    const earnings = simulationMode ? SIMULATED_EARNINGS : SIMULATED_EARNINGS;
    const totalEarnings = earnings.reduce((sum, e) => sum + e.earnings + e.bonus, 0);

    return (
      <div className="space-y-3">
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Route</th>
                <th className="text-center p-3 font-medium">Stores</th>
                <th className="text-right p-3 font-medium">Earnings</th>
                <th className="text-right p-3 font-medium">Bonus</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((row) => (
                <tr key={row.routeId} className="border-t border-border/30">
                  <td className="p-3 font-mono">{row.routeId}</td>
                  <td className="p-3 text-center">{row.storesCompleted}</td>
                  <td className="p-3 text-right">${row.earnings}</td>
                  <td className="p-3 text-right text-hud-green">+${row.bonus}</td>
                  <td className="p-3 text-right font-medium">${row.earnings + row.bonus}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/delivery/my-route')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-4 bg-hud-amber/10 border border-hud-amber/30 rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-hud-amber" />
            <span className="font-medium">Total Estimated Earnings (Today)</span>
          </div>
          <span className="text-2xl font-bold text-hud-amber">${totalEarnings}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/delivery/payouts')}>
          View Full Payout Breakdown
        </Button>
      </div>
    );
  };

  const kpiConfig = {
    routes: { title: 'Routes Today', icon: MapPin, color: 'hud-cyan' },
    stops_left: { title: 'Stops Left', icon: Package, color: 'hud-amber' },
    stops_completed: { title: 'Stops Completed', icon: CheckCircle2, color: 'hud-green' },
    earnings: { title: 'Estimated Earnings', icon: DollarSign, color: 'hud-amber' },
  };

  const config = kpiConfig[selectedKpi];
  const Icon = config.icon;

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 text-${config.color}`} />
          <span className="font-medium">{config.title} - Details</span>
          {simulationMode && (
            <Badge variant="outline" className="text-xs">Simulated</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {selectedKpi === 'routes' && renderRoutesView()}
        {selectedKpi === 'stops_left' && renderStopsLeftView()}
        {selectedKpi === 'stops_completed' && renderStopsCompletedView()}
        {selectedKpi === 'earnings' && renderEarningsView()}
      </div>
    </div>
  );
}
