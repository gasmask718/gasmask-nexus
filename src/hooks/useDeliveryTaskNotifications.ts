import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Subscribes to real-time delivery_tasks changes for the current biker/driver.
 * Shows a toast + invalidates queries when a new task is assigned.
 */
export function useDeliveryTaskNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const workerIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    // Resolve biker/driver record IDs linked to this user
    const resolveWorkerIds = async () => {
      const ids = new Set<string>();

      const [{ data: bikers }, { data: drivers }] = await Promise.all([
        supabase.from("bikers").select("id").eq("user_id", user.id),
        supabase.from("drivers").select("id").eq("user_id", user.id),
      ]);

      bikers?.forEach((b) => ids.add(b.id));
      drivers?.forEach((d) => ids.add(d.id));
      workerIdsRef.current = ids;
    };

    resolveWorkerIds();

    const channel = supabase
      .channel("delivery-task-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_tasks",
        },
        (payload) => {
          const task = payload.new as any;
          const ids = workerIdsRef.current;

          // Only notify if the task is assigned to this worker
          if (
            (task.biker_id && ids.has(task.biker_id)) ||
            (task.driver_id && ids.has(task.driver_id))
          ) {
            toast.info("🚀 New delivery assigned!", {
              description: task.delivery_address || "Check your deliveries",
              duration: 8000,
              action: {
                label: "View",
                onClick: () => {
                  window.location.hash = "";
                  window.location.pathname.includes("/portal/biker")
                    ? (window.location.hash = "#delivery-tasks")
                    : (window.location.hash = "#delivery-tasks");
                },
              },
            });

            // Play notification sound
            try {
              const audio = new Audio("/notification.mp3");
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch {}

            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["my-assigned-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["my-assigned-routes"] });
            queryClient.invalidateQueries({ queryKey: ["assignment-tasks"] });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_tasks",
        },
        (payload) => {
          const task = payload.new as any;
          const old = payload.old as any;
          const ids = workerIdsRef.current;

          const isMyTask =
            (task.biker_id && ids.has(task.biker_id)) ||
            (task.driver_id && ids.has(task.driver_id));

          if (!isMyTask) return;

          // Notify on status changes from dispatcher
          if (old.status !== task.status) {
            queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["my-assigned-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["my-assigned-routes"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
