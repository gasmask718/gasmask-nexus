import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DeliveryTask {
  id: string;
  store_order_id: string | null;
  invoice_id: string | null;
  biker_id: string | null;
  assigned_by: string | null;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  biker?: { id: string; full_name: string } | null;
  store_order?: {
    id: string;
    order_number: string | null;
    store_id: string | null;
    total_amount: number | null;
    status: string | null;
    store?: { store_name: string; address: string | null } | null;
  } | null;
}

/** Fetch all delivery tasks for dispatcher view */
export function useDeliveryTasksList() {
  return useQuery({
    queryKey: ["delivery-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_tasks")
        .select(`
          *,
          biker:bikers(id, full_name),
          store_order:store_orders(id, order_number, store_id, total_amount, status)
        `)
        .order("created_at", { ascending: false });

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
      })) as DeliveryTask[];
    },
  });
}

/** Fetch store orders that can be dispatched (not yet linked to a delivery task) */
export function useDispatchableOrders() {
  return useQuery({
    queryKey: ["dispatchable-orders"],
    queryFn: async () => {
      // Get orders that don't already have a delivery task
      const { data: existingTaskOrderIds } = await supabase
        .from("delivery_tasks")
        .select("store_order_id");

      const usedIds = (existingTaskOrderIds || [])
        .map((t: any) => t.store_order_id)
        .filter(Boolean);

      let query = supabase
        .from("store_orders")
        .select(`
          id, order_number, store_id, total_amount, status, payment_status, notes, created_at
        `)
        .in("status", ["pending", "processing", "confirmed"])
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const usedSet = new Set(usedIds);
      const filtered = (data || []).filter((o: any) => !usedSet.has(o.id));

      // Enrich with store info
      const storeIds = [...new Set(filtered.map((o: any) => o.store_id).filter(Boolean))];
      let storeMap: Record<string, any> = {};
      if (storeIds.length > 0) {
        const { data: stores } = await supabase
          .from("store_master")
          .select("id, store_name, address, lat, lng")
          .in("id", storeIds);
        storeMap = Object.fromEntries((stores || []).map((s: any) => [s.id, s]));
      }

      return filtered.map((o: any) => ({
        ...o,
        store: storeMap[o.store_id] || null,
      }));
    },
  });
}

/** Fetch active bikers for assignment dropdown */
export function useActiveBikers() {
  return useQuery({
    queryKey: ["active-bikers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bikers")
        .select("id, full_name, phone, territory, status")
        .eq("status", "active")
        .order("full_name");

      if (error) throw error;
      return data || [];
    },
  });
}

/** Create a delivery task (dispatch an order) */
export function useCreateDeliveryTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (task: {
      store_order_id: string;
      biker_id: string;
      delivery_address: string;
      delivery_lat?: number | null;
      delivery_lng?: number | null;
      delivery_notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("delivery_tasks")
        .insert({
          ...task,
          assigned_by: user?.id || null,
          status: "pending_acceptance",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dispatchable-orders"] });
      toast.success("Delivery task created");
    },
    onError: (err: any) => {
      toast.error(`Failed to create task: ${err.message}`);
    },
  });
}

/** Update delivery task status (used by bikers) */
export function useUpdateDeliveryTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      status,
      delivery_notes,
    }: {
      taskId: string;
      status: string;
      delivery_notes?: string;
    }) => {
      const updates: Record<string, any> = { status };
      if (delivery_notes !== undefined) updates.delivery_notes = delivery_notes;
      if (status === "picked_up") updates.picked_up_at = new Date().toISOString();
      if (status === "delivered") updates.delivered_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("delivery_tasks")
        .update(updates)
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["biker-delivery-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-assigned-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dispatchable-orders"] });
      queryClient.invalidateQueries({ queryKey: ["my-assigned-routes"] });
      queryClient.invalidateQueries({ queryKey: ["assignment-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-bikers"] });
      queryClient.invalidateQueries({ queryKey: ["all-drivers"] });
      toast.success("Task updated");
    },
    onError: (err: any) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });
}
