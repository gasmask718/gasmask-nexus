import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function invoke(action: string, payload?: any) {
  return supabase.functions.invoke("brandaro-global-scaling", { body: { action, payload } });
}

export function useGlobalScalingDashboard() {
  return useQuery({
    queryKey: ["brandaro-global-scaling-dashboard"],
    queryFn: async () => {
      const { data, error } = await invoke("get-dashboard");
      if (error) throw error;
      return data as {
        territories: any[];
        global: { activeCount: number; totalRevenue: number; avgROI: number; totalLeads: number; totalTerritories: number };
        suggestions: any[];
        recentActions: any[];
      };
    },
    refetchInterval: 30000,
  });
}

export function useLaunchTerritory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; city: string; state?: string; region?: string; cloneFrom?: string }) => {
      const { data, error } = await invoke("launch-territory", payload);
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brandaro-global-scaling-dashboard"] }); toast.success("Territory launched"); },
    onError: (e) => toast.error("Launch failed: " + e.message),
  });
}

export function useRunGlobalCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await invoke("full-cycle");
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brandaro-global-scaling-dashboard"] }); toast.success("Global cycle complete"); },
    onError: (e) => toast.error("Cycle failed: " + e.message),
  });
}
