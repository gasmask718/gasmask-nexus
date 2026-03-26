import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTerritoryHeatmap() {
  return useQuery({
    queryKey: ["ut-territory-heatmap"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ut_get_territory_heatmap" as any);
      if (error) throw error;
      return (data || []) as Array<{
        city: string;
        category: string;
        total_leads: number;
        onboarded: number;
        supply_gap: string;
        conversion_rate: number;
        demand_level: string;
      }>;
    },
    staleTime: 60_000,
  });
}

export function useCategoryDemand() {
  return useQuery({
    queryKey: ["ut-category-demand"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("ut_category_demand" as any) as any)
        .select("*")
        .order("supply_count", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{
        category: string;
        total_leads: number;
        supply_count: number;
        demand_pipeline: number;
        supply_gap_level: string;
        conversion_rate: number;
      }>;
    },
    staleTime: 60_000,
  });
}

export function useCityDemand() {
  return useQuery({
    queryKey: ["ut-city-demand"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("ut_city_demand" as any) as any)
        .select("*")
        .order("supply_count", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{
        city: string;
        total_leads: number;
        category_count: number;
        supply_count: number;
        demand_pipeline: number;
        supply_gap_level: string;
      }>;
    },
    staleTime: 60_000,
  });
}

export function useRunAIScoring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("ut_calculate_ai_scores" as any);
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ut-partner-leads"] });
      qc.invalidateQueries({ queryKey: ["ut-territory-heatmap"] });
      qc.invalidateQueries({ queryKey: ["ut-category-demand"] });
      qc.invalidateQueries({ queryKey: ["ut-city-demand"] });
    },
  });
}
