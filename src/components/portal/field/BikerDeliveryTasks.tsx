import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Package,
  MapPin,
  Navigation,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useUpdateDeliveryTaskStatus } from "@/hooks/useDeliveryTasks";
import { useMyAssignedRoutes } from "@/hooks/delivery/useMyAssignedRoutes";
import { StopBalanceCallout } from "@/components/portal/field/StopBalanceCallout";

const STATUS_FLOW: Record<string, { next: string; label: string; variant: "default" | "destructive" }[]> = {
  assigned: [{ next: "picked_up", label: "Mark Picked Up", variant: "default" }],
  picked_up: [
    { next: "in_transit", label: "In Transit", variant: "default" },
  ],
  in_transit: [
    { next: "delivered", label: "Mark Delivered", variant: "default" },
    { next: "failed", label: "Report Issue", variant: "destructive" },
  ],
};

export function BikerDeliveryTasks() {
  const updateStatus = useUpdateDeliveryTaskStatus();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [notes, setNotes] = useState("");

  // CANONICAL: Use assigned routes instead of delivery_tasks
  const { flatStops: tasks, isLoading } = useMyAssignedRoutes();
  
  // Filter stops with order_ids (delivery-related) and in delivery pipeline
  const deliveryStops = tasks.filter(
    (stop) => stop.order_ids && stop.order_ids.length > 0 && ['assigned', 'picked_up', 'in_transit'].includes(stop.status)
  );

  const handleStatusUpdate = (taskId: string, newStatus: string) => {
    updateStatus.mutate(
      { taskId, status: newStatus, delivery_notes: notes || undefined },
      {
        onSuccess: () => {
          setSelectedTask(null);
          setNotes("");
        },
      }
    );
  };

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
        const actions = STATUS_FLOW[stop.status] || [];

        return (
          <Card key={stop.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{storeName}</p>
                  <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" /> {address}
                  </p>
                  {stop.notes_to_worker && (
                    <p className="text-sm font-medium mt-1">
                      {stop.notes_to_worker}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={
                    stop.status === "assigned"
                      ? "bg-blue-500/10 text-blue-700"
                      : stop.status === "picked_up"
                      ? "bg-yellow-500/10 text-yellow-700"
                      : "bg-purple-500/10 text-purple-700"
                  }
                >
                  {stop.status.replace("_", " ")}
                </Badge>
              </div>

              {stop.notes_to_worker && (
                <p className="text-xs bg-muted rounded p-2 mt-2">{stop.notes_to_worker}</p>
              )}

              <StopBalanceCallout storeId={stop.store_id} storeName={stop.store?.store_name} />

              <div className="flex gap-2 mt-3">
                {/* Status actions */}
                {actions.map((action) => (
                  <Button
                    key={action.next}
                    size="sm"
                    variant={action.variant}
                    onClick={() => {
                      if (action.next === "delivered" || action.next === "failed") {
                        setSelectedTask({ ...stop, nextStatus: action.next });
                      } else {
                        handleStatusUpdate(stop.id, action.next);
                      }
                    }}
                    disabled={updateStatus.isPending}
                  >
                    {action.next === "delivered" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {action.next === "failed" && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Confirmation dialog for delivered/failed */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTask?.nextStatus === "delivered" ? "Confirm Delivery" : "Report Issue"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {selectedTask?.nextStatus === "delivered"
                ? "Confirm this order has been delivered successfully."
                : "Describe the issue with this delivery."}
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                selectedTask?.nextStatus === "delivered"
                  ? "Any notes about this delivery..."
                  : "What went wrong?"
              }
              rows={3}
            />
            <Button
              className="w-full"
              variant={selectedTask?.nextStatus === "failed" ? "destructive" : "default"}
              onClick={() =>
                selectedTask && handleStatusUpdate(selectedTask.id, selectedTask.nextStatus)
              }
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending
                ? "Updating..."
                : selectedTask?.nextStatus === "delivered"
                ? "Confirm Delivered"
                : "Submit Issue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
