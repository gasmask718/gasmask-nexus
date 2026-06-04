import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  MapPin,
  Navigation,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useMyAssignedRoutes } from "@/hooks/delivery/useMyAssignedRoutes";
import { DispatchContextBadges } from "@/components/delivery/DispatchContextBadges";
import { SLAAlertBadges } from "@/components/delivery/SLAAlertBadges";
import { useSLAAlertForStore } from "@/hooks/useSLAAlerts";
import { StopResolutionDialog } from "@/components/delivery/StopResolutionDialog";
import { StopBalanceCallout } from "@/components/portal/field/StopBalanceCallout";

export function DriverDeliveryTasks() {
  const navigate = useNavigate();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [resolutionStop, setResolutionStop] = useState<any>(null);

  // CANONICAL: Use assigned routes instead of delivery_tasks
  const { flatStops: tasks, isLoading } = useMyAssignedRoutes();

  // Filter stops with order_ids (delivery-related)
  const deliveryStops = tasks.filter(
    (stop) => stop.order_ids && stop.order_ids.length > 0
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (deliveryStops.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="font-medium">No active deliveries</p>
          <p className="text-sm">Check back soon for new assignments.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Package className="h-5 w-5" /> My Deliveries ({deliveryStops.length})
      </h3>

      {deliveryStops.map((stop: any) => {
        const storeName = stop.store.store_name || "Unknown Store";
        const address = stop.store.address;

        return (
          <Card
            key={stop.id}
            className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate(`/portal/driver/delivery/${stop.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{storeName}</p>
                  <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" /> {address}
                  </p>
                  {stop.notes_to_worker && (
                    <p className="text-sm font-medium mt-1 text-accent">
                      {stop.notes_to_worker}
                    </p>
                  )}
                  <DispatchContextBadges
                    notesToWorker={stop.notes_to_worker}
                    brandId={stop.brand_id}
                    opportunityIds={stop.opportunity_ids}
                    orderIds={stop.order_ids}
                  />
                  <StopSLAWarnings storeId={stop.store_id} />
                </div>
                <Badge
                  variant="outline"
                  className={
                    stop.status === "pending"
                      ? "bg-primary/10 text-primary"
                      : stop.status === "arrived"
                      ? "bg-muted text-muted-foreground"
                      : stop.status === "in_progress"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-accent text-accent-foreground"
                  }
                >
                  {stop.status.replace("_", " ")}
                </Badge>
              </div>

              <StopBalanceCallout storeId={stop.store_id} storeName={stop.store?.store_name} />

              {stop.brand_id && (
                <div className="mt-2">
                  <Badge variant="secondary" className="text-xs">
                    Brand: {stop.brand_id}
                  </Badge>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/portal/driver/delivery/${stop.id}`);
                  }}
                  className="flex-1"
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Start Delivery
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Post-Completion Resolution Dialog */}
      {resolutionStop && (
        <StopResolutionDialog
          open={!!resolutionStop}
          onOpenChange={(open) => !open && setResolutionStop(null)}
          stopId={resolutionStop.id}
          storeId={resolutionStop.store_id}
          storeName={resolutionStop.store?.store_name || 'Store'}
          opportunityIds={resolutionStop.opportunity_ids || []}
        />
      )}
    </div>
  );
}

/** Inline SLA warning for a single store stop */
function StopSLAWarnings({ storeId }: { storeId: string }) {
  const { data: alert } = useSLAAlertForStore(storeId);
  return <SLAAlertBadges alert={alert} compact className="mt-0.5" />;
}
