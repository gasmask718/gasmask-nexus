import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  Bike,
  Users,
  MapPin,
  Clock,
  AlertTriangle,
  ChevronRight,
  Route,
  User,
} from "lucide-react";
import type { LiveRoute, WorkerLocation, LiveAlert } from "@/hooks/useLiveMapData";

interface RouteListPanelProps {
  routes: LiveRoute[];
  workers: WorkerLocation[];
  alerts: LiveAlert[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string | null) => void;
  onSelectWorker: (workerId: string | null) => void;
  onSelectAlert: (alertId: string | null) => void;
  onFocusRoute: (routeId: string) => void;
}

export function RouteListPanel({
  routes,
  workers,
  alerts,
  selectedRouteId,
  onSelectRoute,
  onSelectWorker,
  onSelectAlert,
  onFocusRoute,
}: RouteListPanelProps) {
  const [activeTab, setActiveTab] = useState('routes');

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'driver': return <Truck className="h-4 w-4 text-blue-500" />;
      case 'biker': return <Bike className="h-4 w-4 text-cyan-500" />;
      case 'ambassador': return <Users className="h-4 w-4 text-purple-500" />;
      default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'in_progress': return 'bg-green-500';
      case 'planned': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getWorkerStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'stale': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="w-80 border-r bg-background flex flex-col h-full">
      {/* Stats Header */}
      <div className="p-3 border-b grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <div className="text-lg font-bold">{routes.length}</div>
          <div className="text-xs text-muted-foreground">Routes</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <div className="text-lg font-bold">{workers.length}</div>
          <div className="text-xs text-muted-foreground">Workers</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <div className="text-lg font-bold text-red-500">{alerts.length}</div>
          <div className="text-xs text-muted-foreground">Alerts</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start px-3 pt-2">
          <TabsTrigger value="routes" className="flex-1">
            <Route className="h-4 w-4 mr-1" />
            Routes
          </TabsTrigger>
          <TabsTrigger value="workers" className="flex-1">
            <User className="h-4 w-4 mr-1" />
            Workers
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex-1">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Alerts
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1 text-xs">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Routes Tab */}
          <TabsContent value="routes" className="m-0 p-3 space-y-2">
            {routes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active routes
              </div>
            ) : (
              routes.map(route => (
                <div
                  key={route.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50 ${
                    selectedRouteId === route.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    onSelectRoute(route.id);
                    onFocusRoute(route.id);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(route.assignee?.role || route.type)}
                      <span className="font-medium text-sm truncate max-w-[120px]">
                        {route.assignee?.name || 'Unassigned'}
                      </span>
                    </div>
                    <Badge variant="outline" className={`${getStatusColor(route.status)} text-white text-xs`}>
                      {route.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3" />
                    <span>{route.territory || 'Multi-Zone'}</span>
                    <span>•</span>
                    <span>{route.totalStops} stops</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{route.completedStops}/{route.totalStops} completed</span>
                      <span className="font-medium">{route.progressPercent}%</span>
                    </div>
                    <Progress value={route.progressPercent} className="h-1.5" />
                  </div>

                  {route.hasAlerts && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{route.alertCount} alert(s)</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* Workers Tab */}
          <TabsContent value="workers" className="m-0 p-3 space-y-2">
            {workers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No workers found
              </div>
            ) : (
              workers.map(worker => (
                <div
                  key={worker.id}
                  className="p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50"
                  onClick={() => onSelectWorker(worker.worker_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        {worker.avatar_url ? (
                          <img 
                            src={worker.avatar_url} 
                            alt={worker.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            {getRoleIcon(worker.role)}
                          </div>
                        )}
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${getWorkerStatusColor(worker.status)}`} />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{worker.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{worker.role}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {worker.status === 'stale' && (
                    <div className="mt-2 text-xs text-yellow-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last seen {Math.round((Date.now() - new Date(worker.updated_at).getTime()) / 60000)}m ago
                    </div>
                  )}
                  {worker.status === 'offline' && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {worker.lat === 0 && worker.lng === 0 ? 'No GPS signal' : 'Offline'}
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="m-0 p-3 space-y-2">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No open alerts
              </div>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg border cursor-pointer transition-all hover:border-destructive/50"
                  onClick={() => onSelectAlert(alert.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getSeverityColor(alert.severity)}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    {alert.sla_breached && (
                      <Badge variant="destructive" className="text-xs">
                        SLA BREACHED
                      </Badge>
                    )}
                  </div>
                  <div className="font-medium text-sm mb-1">{alert.title}</div>
                  {alert.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {alert.description}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
