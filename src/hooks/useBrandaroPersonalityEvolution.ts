import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useEvolutionDashboard() {
  return useQuery({
    queryKey: ["personality-evolution-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-personality-evolution", {
        body: { action: "get-dashboard" },
      });
      if (error) throw error;
      return data as {
        rankings: any[];
        evolutions: any[];
        tests: any[];
      };
    },
    refetchInterval: 30000,
  });
}

export function useRunEvolutionCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-personality-evolution", {
        body: { action: "full-cycle" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["personality-evolution-dashboard"] });
      qc.invalidateQueries({ queryKey: ["brandaro-personalities"] });
      toast.success(`Evolution cycle complete — ${data?.evolution?.evolved || 0} evolved, ${data?.generation?.generated ? "1 new born" : "no new"}`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useEvaluateRankings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-personality-evolution", {
        body: { action: "evaluate-rankings" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personality-evolution-dashboard"] });
      toast.success("Rankings evaluated");
    },
  });
}

export function useAutoGeneratePersonality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-personality-evolution", {
        body: { action: "auto-generate" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["personality-evolution-dashboard"] });
      qc.invalidateQueries({ queryKey: ["brandaro-personalities"] });
      if (data?.generated) toast.success(`New personality born: ${data.personality?.name}`);
      else toast.info(data?.reason || "No generation needed");
    },
  });
}
