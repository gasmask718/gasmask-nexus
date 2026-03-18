import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useExecutionQueue() {
  return useQuery({
    queryKey: ["brandaro-execution-queue"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_execution_queue")
        .select("*, brandaro_qualified_leads(business_name, phone_number, industry, city, state, lead_status)")
        .order("conversion_probability", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });
}

export function useExecutionQueueStats() {
  return useQuery({
    queryKey: ["brandaro-execution-queue-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_execution_queue")
        .select("status, priority_tier, attempts, conversion_probability");
      if (error) throw error;
      const all = data || [];
      const pending = all.filter((q: any) => q.status === "pending").length;
      const completed = all.filter((q: any) => q.status === "completed").length;
      const failed = all.filter((q: any) => q.status === "failed").length;
      const exhausted = all.filter((q: any) => q.status === "exhausted").length;
      const inProgress = all.filter((q: any) => q.status === "in_progress").length;
      const highPriority = all.filter((q: any) => q.priority_tier === "high" && q.status === "pending").length;
      const mediumPriority = all.filter((q: any) => q.priority_tier === "medium" && q.status === "pending").length;
      const lowPriority = all.filter((q: any) => q.priority_tier === "low" && q.status === "pending").length;
      return { total: all.length, pending, completed, failed, exhausted, inProgress, highPriority, mediumPriority, lowPriority };
    },
    refetchInterval: 15000,
  });
}

export function usePopulateQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-execution-worker", {
        body: { action: "populate_queue" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["brandaro-execution-queue"] });
      qc.invalidateQueries({ queryKey: ["brandaro-execution-queue-stats"] });
      toast.success(`Queued ${data?.queued || 0} leads for execution`);
    },
    onError: (err: any) => toast.error(`Queue populate failed: ${err.message}`),
  });
}

export function useRunExecutionWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-execution-worker", {
        body: { action: "execute_and_scale" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["brandaro-execution-queue"] });
      qc.invalidateQueries({ queryKey: ["brandaro-execution-queue-stats"] });
      qc.invalidateQueries({ queryKey: ["brandaro-auto-striker-stats"] });
      qc.invalidateQueries({ queryKey: ["brandaro-predictions"] });
      const msg = `Executed: ${data?.executed || 0} | Failed: ${data?.failed || 0} | Deferred: ${data?.deferred || 0}`;
      toast.success(msg);
    },
    onError: (err: any) => toast.error(`Execution failed: ${err.message}`),
  });
}
