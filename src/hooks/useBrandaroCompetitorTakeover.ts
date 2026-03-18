import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function invokeCompetitor(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("brandaro-competitor-takeover", {
    body: { action, ...params },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed");
  return data;
}

export function useCompetitorDashboard() {
  return useQuery({
    queryKey: ["brandaro-competitor-dashboard"],
    queryFn: () => invokeCompetitor("get-dashboard"),
    refetchInterval: 30000,
  });
}

export function useRunCompetitorCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invokeCompetitor("full-cycle"),
    onSuccess: (d) => {
      toast.success(`⚔️ Analyzed ${d.analyzed} competitors, generated ${d.offersGen} offers`);
      qc.invalidateQueries({ queryKey: ["brandaro-competitor-dashboard"] });
    },
    onError: () => toast.error("Competitor cycle failed"),
  });
}

export function useAnalyzeWeaknesses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competitor_id: string) => invokeCompetitor("analyze-weaknesses", { competitor_id }),
    onSuccess: (d) => {
      toast.success(`Found ${d.weaknesses_found} exploitable weaknesses`);
      qc.invalidateQueries({ queryKey: ["brandaro-competitor-dashboard"] });
    },
  });
}

export function useGenerateUndercut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competitor_id: string) => invokeCompetitor("generate-undercut", { competitor_id }),
    onSuccess: (d) => {
      toast.success(`Generated ${d.offers_generated} counter-offers`);
      qc.invalidateQueries({ queryKey: ["brandaro-competitor-dashboard"] });
    },
  });
}
