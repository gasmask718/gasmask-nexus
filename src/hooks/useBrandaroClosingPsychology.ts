import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface ClosingPsychologyStats {
  interactions: number;
  closed: number;
  closeRate: string;
  objectionWinRate: string;
  revenue: number;
  buyingSignals: number;
  topFrameworks: any[];
  topObjectionResponses: any[];
}

export function useClosingPsychologyStats() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["closing-psychology-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-closing-psychology", {
        body: { action: "get_psychology_stats" },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 20000,
  });

  // Realtime updates
  useEffect(() => {
    const ch = supabase
      .channel("closing-interactions-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brandaro_closing_interactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["closing-psychology-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const stats: ClosingPsychologyStats = {
    interactions: data?.today?.interactions || 0,
    closed: data?.today?.closed || 0,
    closeRate: data?.today?.close_rate || "0",
    objectionWinRate: data?.today?.objection_win_rate || "0",
    revenue: data?.today?.revenue || 0,
    buyingSignals: data?.today?.buying_signals || 0,
    topFrameworks: data?.top_frameworks || [],
    topObjectionResponses: data?.top_objection_responses || [],
  };

  return { stats, isLoading };
}
