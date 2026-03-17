import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrandaroOffer {
  id: string;
  name: string;
  tier: string;
  price: number;
  features: string[];
  upsell_from: string | null;
  upsell_to: string | null;
  conversion_priority: number;
}

export function useOffers() {
  return useQuery({
    queryKey: ["brandaro-offers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_offers")
        .select("*")
        .eq("active", true)
        .order("conversion_priority", { ascending: true });
      if (error) throw error;
      return (data || []) as BrandaroOffer[];
    },
  });
}

export function useUpsellRecommendation(leadId?: string) {
  return useQuery({
    queryKey: ["brandaro-upsell", leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await (supabase as any)
        .from("brandaro_upsell_engine")
        .select("*")
        .eq("lead_id", leadId)
        .eq("status", "pending")
        .order("probability_score", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });
}

export function useCreateUpsellRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: {
      lead_id: string;
      current_offer: string;
      recommended_offer: string;
      upsell_reason: string;
      probability_score: number;
    }) => {
      const { error } = await (supabase as any)
        .from("brandaro_upsell_engine")
        .insert(rec);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brandaro-upsell"] }),
  });
}

export function useRevenueMetrics() {
  return useQuery({
    queryKey: ["brandaro-revenue-metrics"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_revenue_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
