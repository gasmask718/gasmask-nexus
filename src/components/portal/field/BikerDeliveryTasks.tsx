import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Truck,
  Package,
  MapPin,
  Navigation,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useUpdateDeliveryTaskStatus } from "@/hooks/useDeliveryTasks";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";

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
  const { data: profileData } = useCurrentUserProfile();
  const updateStatus = useUpdateDeliveryTaskStatus();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [notes, setNotes] = useState("");

  // Fetch tasks assigned to this biker
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["biker-delivery-tasks", profileData?.profile?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Find biker record for this user
      const { data: bikerRecord } = await supabase
        .from("bikers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!bikerRecord) return [];

      const { data, error } = await supabase
        .from("delivery_tasks")
        .select(`
          *,
          store_order:store_orders(id, order_number, total_amount, store_id)
        `)
        .eq("biker_id", bikerRecord.id)
        .in("status", ["assigned", "picked_up", "in_transit"])
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Enrich with store info
      const storeIds = [...new Set((data || []).map((t: any) => t.store_order?.store_id).filter(Boolean))];
      let storeMap: Record<string, any> = {};
      if (storeIds.length > 0) {
        const { data: stores } = await supabase
          .from("store_master")
          .select("id, store_name, address")
          .in("id", storeIds);
        storeMap = Object.fromEntries((stores || []).map((s: any) => [s.id, s]));
      }

      return (data || []).map((t: any) => ({
        ...t,
        store_order: t.store_order ? {
          ...t.store_order,
          store: storeMap[t.store_order.store_id] || null,
        } : null,
      }));
    },
    refetchInterval: 30000, // 30s refresh
    enabled: !!profileData,
  });

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

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="font-medium">No active deliveries</p>
          <p className="text-sm">Check back soon for new assignments.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Package className="h-5 w-5" /> My Deliveries ({tasks.length})
      </h3>

      {tasks.map((task: any) => {
        const storeName = task.store_order?.store?.store_name || "Unknown Store";
        const address = task.delivery_address;
        const actions = STATUS_FLOW[task.status] || [];

        return (
          <Card key={task.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{storeName}</p>
                  <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" /> {address}
                  </p>
                  {task.store_order?.total_amount && (
                    <p className="text-sm font-medium mt-1">
                      ${task.store_order.total_amount.toFixed(2)}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={
                    task.status === "assigned"
                      ? "bg-blue-500/10 text-blue-700"
                      : task.status === "picked_up"
                      ? "bg-yellow-500/10 text-yellow-700"
                      : "bg-purple-500/10 text-purple-700"
                  }
                >
                  {task.status.replace("_", " ")}
                </Badge>
              </div>

              {task.delivery_notes && (
                <p className="text-xs bg-muted rounded p-2 mt-2">{task.delivery_notes}</p>
              )}

              <div className="flex gap-2 mt-3">
                {/* Navigate */}
                {task.delivery_lat && task.delivery_lng && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${task.delivery_lat},${task.delivery_lng}`,
                        "_blank"
                      )
                    }
                  >
                    <Navigation className="h-3 w-3 mr-1" /> Navigate
                  </Button>
                )}

                {/* Status actions */}
                {actions.map((action) => (
                  <Button
                    key={action.next}
                    size="sm"
                    variant={action.variant}
                    onClick={() => {
                      if (action.next === "delivered" || action.next === "failed") {
                        setSelectedTask({ ...task, nextStatus: action.next });
                      } else {
                        handleStatusUpdate(task.id, action.next);
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
