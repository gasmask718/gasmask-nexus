import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  MessageSquare,
  Navigation,
  Eye,
  MapPin,
  Clock,
  Truck,
  Bike,
  Users,
  User,
  Target,
  Bell,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { WorkerLocation, LiveRoute } from "@/hooks/useLiveMapData";
import { useDispatchPing } from "@/hooks/useDispatchPing";
import { SLACountdownBadge } from "./SLACountdownBadge";

interface WorkerDrawerProps {
  worker: WorkerLocation | null;
  route: LiveRoute | null;
  open: boolean;
  onClose: () => void;
  onFollowWorker: (workerId: string) => void;
  isFollowing: boolean;
}

export function WorkerDrawer({
  worker,
  route,
  open,
  onClose,
  onFollowWorker,
  isFollowing,
}: WorkerDrawerProps) {
  const navigate = useNavigate();
  const pingWorker = useDispatchPing();

  if (!worker) return null;

  const handlePingWorker = () => {
    pingWorker.mutate({
      workerId: worker.worker_id,
      workerName: worker.name,
      routeId: route?.id,
      reason: 'Check-in request from Live Map',
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'driver': return <Truck className="h-5 w-5 text-blue-500" />;
      case 'biker': return <Bike className="h-5 w-5 text-cyan-500" />;
      case 'ambassador': return <Users className="h-5 w-5 text-purple-500" />;
      default: return <User className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500">Active</Badge>;
      case 'stale': return <Badge className="bg-yellow-500">Stale</Badge>;
      case 'offline': return <Badge variant="secondary">Offline</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCall = () => {
    // Phone not yet exposed on WorkerLocation — route through logged pipeline once available.
    // Avoid tel: bypass (was creating invisible calls).
    import("sonner").then(({ toast }) => toast.info("Worker phone not available — assign via dispatch."));
  };

  const handleNavigate = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${worker.lat},${worker.lng}`,
      '_blank'
    );
  };

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="relative">
              {worker.avatar_url ? (
                <img
                  src={worker.avatar_url}
                  alt={worker.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  {getRoleIcon(worker.role)}
                </div>
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background ${
                worker.status === 'active' ? 'bg-green-500' : worker.status === 'stale' ? 'bg-yellow-500' : 'bg-gray-500'
              }`} />
            </div>
            <div>
              <div className="text-lg">{worker.name}</div>
              <div className="text-sm font-normal text-muted-foreground capitalize flex items-center gap-2">
                {getRoleIcon(worker.role)}
                {worker.role}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            {getStatusBadge(worker.status)}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Current Location
            </div>
            <div className="text-sm font-mono bg-muted rounded p-2">
              {worker.lat.toFixed(6)}, {worker.lng.toFixed(6)}
            </div>
          </div>

          {/* Last Update */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last Update
            </div>
            <span className="text-sm">
              {new Date(worker.updated_at).toLocaleTimeString()}
            </span>
          </div>

          <Separator />

          {/* Active Route Info */}
          {route && (
            <div className="space-y-3">
              <h4 className="font-medium">Active Route</h4>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Territory</span>
                  <span className="text-sm font-medium">{route.territory || 'Multi-Zone'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="text-sm font-medium">
                    {route.completedStops}/{route.totalStops} stops ({route.progressPercent}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant="outline">{route.status}</Badge>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-3">
            <h4 className="font-medium">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleCall}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
              <Button variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                Message
              </Button>
              <Button variant="outline" onClick={handleNavigate}>
                <Navigation className="h-4 w-4 mr-2" />
                Navigate
              </Button>
              <Button 
                variant={isFollowing ? "default" : "outline"}
                onClick={() => onFollowWorker(worker.worker_id)}
              >
                <Target className="h-4 w-4 mr-2" />
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            </div>
            
            {/* Ping Worker - Critical Command Action */}
            <Button 
              variant="secondary"
              className="w-full"
              onClick={handlePingWorker}
              disabled={pingWorker.isPending}
            >
              {pingWorker.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Ping Worker
            </Button>
          </div>

          <Separator />

          {/* Command Actions */}
          <div className="space-y-3">
            <h4 className="font-medium">Command Actions</h4>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/delivery/route-ops')}
              >
                <Eye className="h-4 w-4 mr-2" />
                View in Route Ops Center
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
