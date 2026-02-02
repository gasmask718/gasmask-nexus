import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  Navigation,
  Eye,
  MapPin,
  Clock,
  Truck,
  Bike,
  Users,
  User,
  CheckCircle2,
  Circle,
  XCircle,
  AlertTriangle,
  Pause,
  Play,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatchActions } from "@/hooks/useDispatchInterventions";
import type { LiveRoute, LiveStop } from "@/hooks/useLiveMapData";

interface RouteDrawerProps {
  route: LiveRoute | null;
  open: boolean;
  onClose: () => void;
  onFocusStop: (stop: LiveStop) => void;
}

export function RouteDrawer({
  route,
  open,
  onClose,
  onFocusStop,
}: RouteDrawerProps) {
  const navigate = useNavigate();
  const { pauseRoute, resumeRoute } = useDispatchActions();

  if (!route) return null;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'driver': return <Truck className="h-5 w-5 text-blue-500" />;
      case 'biker': return <Bike className="h-5 w-5 text-cyan-500" />;
      case 'ambassador': return <Users className="h-5 w-5 text-purple-500" />;
      default: return <User className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStopStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'skipped': return <XCircle className="h-4 w-4 text-orange-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'in_progress': return 'bg-green-500';
      case 'planned': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const handlePauseResume = () => {
    if (route.status === 'paused') {
      resumeRoute.mutate({ routeId: route.id, reason: 'Resumed from Live Map' });
    } else {
      pauseRoute.mutate({ routeId: route.id, reason: 'Paused from Live Map' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {getRoleIcon(route.assignee?.role || route.type)}
            <div>
              <div className="text-lg">{route.assignee?.name || 'Unassigned Route'}</div>
              <div className="text-sm font-normal text-muted-foreground">
                {route.territory || 'Multi-Zone'} • {route.date}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex-1 flex flex-col overflow-hidden">
          {/* Status & Progress */}
          <div className="space-y-4 pb-4">
            <div className="flex items-center justify-between">
              <Badge className={`${getStatusColor(route.status)} text-white`}>
                {route.status.toUpperCase()}
              </Badge>
              {route.hasAlerts && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {route.alertCount} Alert(s)
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-medium">{route.completedStops}/{route.totalStops} stops</span>
              </div>
              <Progress value={route.progressPercent} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Est. Duration</div>
                <div className="font-medium">
                  {route.estimated_duration_minutes ? `${route.estimated_duration_minutes} min` : '--'}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Est. Distance</div>
                <div className="font-medium">
                  {route.estimated_distance_km ? `${route.estimated_distance_km.toFixed(1)} km` : '--'}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Stops List */}
          <div className="flex-1 flex flex-col overflow-hidden py-4">
            <h4 className="font-medium mb-3">Stops ({route.stops.length})</h4>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {route.stops.map((stop, idx) => (
                  <div
                    key={stop.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      if (stop.store?.lat && stop.store?.lng) {
                        onFocusStop(stop);
                      }
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </div>
                      {idx < route.stops.length - 1 && (
                        <div className="w-0.5 h-6 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {stop.store?.name || 'Unknown Store'}
                        </span>
                        {getStopStatusIcon(stop.status)}
                      </div>
                      {stop.store?.address_city && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {stop.store.address_city}
                        </div>
                      )}
                      {stop.actual_arrival && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          Arrived: {new Date(stop.actual_arrival).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Actions */}
          <div className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handlePauseResume}
                disabled={pauseRoute.isPending || resumeRoute.isPending}
              >
                {route.status === 'paused' ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => navigate('/delivery/route-ops')}>
                <Eye className="h-4 w-4 mr-2" />
                Ops Center
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
