/**
 * Biker Portal - Full operational portal for bikers (field checkers)
 * Routes: /portals/biker/*
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Bike, MapPin, CheckCircle2, AlertTriangle, DollarSign, 
  Camera, MessageSquare, History, Route as RouteIcon,
  ChevronRight, ClipboardCheck, Map
} from 'lucide-react';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';
import { CommandCenterKPI } from '@/components/portal/CommandCenterKPI';
import { ActivityFeed, ActivityItem } from '@/components/portal/ActivityFeed';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { HudCard } from '@/components/portal/HudCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useResolvedData } from '@/hooks/useResolvedData';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

// Simulation data
const SIMULATION_TASKS = [
  { id: 't1', store: 'Quick Stop #42', address: '123 Knickerbocker Ave', type: 'Shelf Check', status: 'pending', priority: 'high' },
  { id: 't2', store: 'Corner Deli', address: '456 Broadway', type: 'Inventory Count', status: 'pending', priority: 'medium' },
  { id: 't3', store: 'Smoke Shop Plus', address: '789 Myrtle Ave', type: 'Photo Update', status: 'in_progress', priority: 'low' },
  { id: 't4', store: 'Express Mart', address: '321 Flushing Ave', type: 'Issue Follow-up', status: 'pending', priority: 'high' },
  { id: 't5', store: 'City Convenience', address: '654 Gates Ave', type: 'Shelf Check', status: 'pending', priority: 'medium' },
];

const SIMULATION_STORES_CHECKED = [
  { id: 'sc1', store: 'First Stop Deli', time: '9:15 AM', shelfCount: 24, tubesCount: 156, notes: 'All good' },
  { id: 'sc2', store: 'Morning Mart', time: '9:45 AM', shelfCount: 18, tubesCount: 98, notes: 'Low stock on flavors' },
];

const SIMULATION_ISSUES = [
  { id: 'i1', store: 'Corner Deli', type: 'Low Stock', severity: 'medium', status: 'open' },
  { id: 'i2', store: 'Express Mart', type: 'Display Damage', severity: 'high', status: 'pending' },
];

const SIMULATION_ACTIVITY: ActivityItem[] = [
  { id: '1', title: 'Store checked', description: 'Morning Mart - 98 tubes counted', timestamp: new Date(Date.now() - 1800000), type: 'success' },
  { id: '2', title: 'Issue reported', description: 'Corner Deli - Low stock alert', timestamp: new Date(Date.now() - 3600000), type: 'warning' },
  { id: '3', title: 'Task started', description: 'Bushwick route - 5 stores', timestamp: new Date(Date.now() - 7200000), type: 'info' },
];

function BikerPortalContent() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  const { data: tasks, isSimulated: tasksSimulated } = useResolvedData([], SIMULATION_TASKS);
  const { data: storesChecked, isSimulated: storesSimulated } = useResolvedData([], SIMULATION_STORES_CHECKED);
  const { data: issues, isSimulated: issuesSimulated } = useResolvedData([], SIMULATION_ISSUES);
  const { data: activity, isSimulated: activitySimulated } = useResolvedData([], SIMULATION_ACTIVITY);

  const activeTasks = tasks.filter(t => t.status !== 'completed').length;
  const weeklyEarnings = (storesChecked.length * 5) + (tasks.filter(t => t.status === 'completed').length * 3);

  const handleKpiClick = (kpi: string) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  return (
    <EnhancedPortalLayout 
      title="Biker Portal" 
      subtitle="Field checks & store visits"
      portalIcon={<Bike className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'Live Map', href: '/operations/live-map', icon: <Map className="h-4 w-4" /> },
        { label: 'Submit Check', href: '#', icon: <ClipboardCheck className="h-4 w-4" /> },
        { label: 'Report Issue', href: '#', icon: <AlertTriangle className="h-4 w-4" /> },
      ]}
    >
      <div className="space-y-6">
        {/* Command Center KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <CommandCenterKPI
            label="Active Tasks"
            value={activeTasks}
            icon={ClipboardCheck}
            trend={`${tasks.filter(t => t.priority === 'high').length} high priority`}
            variant="cyan"
            isActive={selectedKpi === 'tasks'}
            isSimulated={tasksSimulated}
            onClick={() => handleKpiClick('tasks')}
          />
          <CommandCenterKPI
            label="Stores Checked"
            value={storesChecked.length}
            icon={CheckCircle2}
            variant="green"
            isActive={selectedKpi === 'stores'}
            isSimulated={storesSimulated}
            onClick={() => handleKpiClick('stores')}
          />
          <CommandCenterKPI
            label="Issues Reported"
            value={issues.length}
            icon={AlertTriangle}
            trend={`${issues.filter(i => i.severity === 'high').length} critical`}
            variant="amber"
            isActive={selectedKpi === 'issues'}
            isSimulated={issuesSimulated}
            onClick={() => handleKpiClick('issues')}
          />
          <CommandCenterKPI
            label="Weekly Earnings"
            value={`$${weeklyEarnings}`}
            icon={DollarSign}
            variant="purple"
            isActive={selectedKpi === 'earnings'}
            isSimulated={storesSimulated}
            onClick={() => handleKpiClick('earnings')}
          />
          <CommandCenterKPI
            label="Today's Routes"
            value="2"
            icon={RouteIcon}
            trend="Bushwick, Bed-Stuy"
            variant="default"
            isActive={selectedKpi === 'routes'}
            isSimulated={tasksSimulated}
            onClick={() => handleKpiClick('routes')}
          />
        </div>

        {/* View Details Bar */}
        {selectedKpi && (
          <Card className="border-primary/20 bg-card/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {selectedKpi === 'tasks' && 'Active Tasks'}
                  {selectedKpi === 'stores' && 'Stores Checked Today'}
                  {selectedKpi === 'issues' && 'Issues Reported'}
                  {selectedKpi === 'earnings' && 'Weekly Earnings'}
                  {selectedKpi === 'routes' && "Today's Routes"}
                  {tasksSimulated && <SimulationBadge />}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedKpi(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedKpi === 'tasks' && (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium">{task.store}</p>
                        <p className="text-sm text-muted-foreground">{task.type} • {task.address}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}>
                          {task.priority}
                        </Badge>
                        <Badge variant="outline">{task.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedKpi === 'stores' && (
                <div className="space-y-2">
                  {storesChecked.map((store) => (
                    <div key={store.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium">{store.store}</p>
                        <p className="text-sm text-muted-foreground">Checked at {store.time}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{store.tubesCount} tubes • {store.shelfCount} shelves</p>
                        <p className="text-xs text-muted-foreground">{store.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedKpi === 'issues' && (
                <div className="space-y-2">
                  {issues.map((issue) => (
                    <div key={issue.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium">{issue.store}</p>
                        <p className="text-sm text-muted-foreground">{issue.type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={issue.severity === 'high' ? 'destructive' : 'default'}>
                          {issue.severity}
                        </Badge>
                        <Badge variant="outline">{issue.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedKpi === 'earnings' && (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold">${storesChecked.length * 5}</p>
                    <p className="text-xs text-muted-foreground">Store Checks</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold">$0</p>
                    <p className="text-xs text-muted-foreground">Bonuses</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10">
                    <p className="text-2xl font-bold text-primary">${weeklyEarnings}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              )}
              {selectedKpi === 'routes' && (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Bushwick Route</p>
                        <p className="text-sm text-muted-foreground">3 stores remaining</p>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Bed-Stuy Route</p>
                        <p className="text-sm text-muted-foreground">4 stores</p>
                      </div>
                      <Badge variant="secondary">Upcoming</Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <HudCard title="My Tasks" icon={<ClipboardCheck className="h-4 w-4" />} variant="cyan">
              <div className="space-y-2">
                {tasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${task.priority === 'high' ? 'bg-destructive' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-muted-foreground'}`} />
                      <div>
                        <p className="font-medium">{task.store}</p>
                        <p className="text-sm text-muted-foreground">{task.type}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">Start</Button>
                  </div>
                ))}
              </div>
            </HudCard>
          </div>

          <div className="space-y-6">
            <HudCard title="Quick Actions" variant="default">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <Camera className="h-4 w-4" />
                  <span className="text-xs">Photo Check</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="text-xs">Submit Check</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">Report Issue</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <Map className="h-4 w-4" />
                  <span className="text-xs">Live Map</span>
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

export default function BikerPortalPage() {
  return (
    <PortalRBACGate allowedRoles={['biker']} portalName="Biker Portal">
      <BikerPortalContent />
    </PortalRBACGate>
  );
}
