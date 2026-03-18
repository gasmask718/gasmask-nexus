import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Conversion Predictions ──
export function useConversionPredictions() {
  return useQuery({
    queryKey: ["brandaro-predictions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_conversion_predictions")
        .select("*, brandaro_qualified_leads(business_name, phone_number, industry, city, state, lead_status)")
        .order("conversion_probability", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
}

// ── Prediction Distribution Stats ──
export function usePredictionStats() {
  return useQuery({
    queryKey: ["brandaro-prediction-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_conversion_predictions")
        .select("conversion_probability, priority_tier, action_strategy, outcome");
      if (error) throw error;
      const all = data || [];
      const high = all.filter((p: any) => p.priority_tier === "high").length;
      const medium = all.filter((p: any) => p.priority_tier === "medium").length;
      const low = all.filter((p: any) => p.priority_tier === "low").length;
      const converted = all.filter((p: any) => p.outcome === "converted").length;
      const avgProb = all.length > 0
        ? Math.round(all.reduce((s: number, p: any) => s + Number(p.conversion_probability || 0), 0) / all.length)
        : 0;
      return { total: all.length, high, medium, low, converted, avgProb };
    },
    refetchInterval: 30000,
  });
}

// ── Niche Performance ──
export function useNichePerformance() {
  return useQuery({
    queryKey: ["brandaro-niche-performance"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_niche_performance")
        .select("*")
        .order("revenue_per_lead", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });
}

// ── Revenue Tracking ──
export function useRevenueStats() {
  return useQuery({
    queryKey: ["brandaro-revenue-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_revenue_tracking")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const all = data || [];
      const totalRevenue = all.reduce((s: number, r: any) => s + Number(r.revenue_amount || 0), 0);
      const byScript: Record<string, number> = {};
      const byIndustry: Record<string, number> = {};
      for (const r of all) {
        if (r.attributed_script_variant) {
          byScript[r.attributed_script_variant] = (byScript[r.attributed_script_variant] || 0) + Number(r.revenue_amount || 0);
        }
        if (r.attributed_industry) {
          byIndustry[r.attributed_industry] = (byIndustry[r.attributed_industry] || 0) + Number(r.revenue_amount || 0);
        }
      }
      return { totalRevenue, totalDeals: all.length, byScript, byIndustry, recentDeals: all.slice(0, 10) };
    },
    refetchInterval: 30000,
  });
}

// ── Run Scoring Engine ──
export function useRunPredictiveScoring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-predictive-engine", {
        body: { action: "score_leads" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["brandaro-predictions"] });
      qc.invalidateQueries({ queryKey: ["brandaro-prediction-stats"] });
      toast.success(`Scored ${data?.scored || 0} leads — ${data?.distribution?.high || 0} high priority`);
    },
    onError: (err: any) => toast.error(`Scoring failed: ${err.message}`),
  });
}

// ── Update Niche Data ──
export function useUpdateNiches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-predictive-engine", {
        body: { action: "update_niches" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-niche-performance"] });
      toast.success("Niche performance updated");
    },
  });
}

// ── Record Revenue ──
export function useRecordRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      lead_id: string;
      amount: number;
      script_variant?: string;
      industry?: string;
      campaign?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("brandaro-predictive-engine", {
        body: { action: "record_revenue", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-revenue-stats"] });
      qc.invalidateQueries({ queryKey: ["brandaro-prediction-stats"] });
      toast.success("Revenue recorded");
    },
  });
}
