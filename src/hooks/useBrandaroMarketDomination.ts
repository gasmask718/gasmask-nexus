import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Competitor Intel ──
export function useCompetitorIntel() {
  return useQuery({
    queryKey: ["competitor-intel"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_competitor_intel")
        .select("*")
        .order("last_updated", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpsertCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      competitor_name: string;
      pricing_model?: string;
      offer_structure?: string;
      guarantees?: string;
      positioning?: string;
      strengths?: string[];
      weaknesses?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("brandaro-market-domination", {
        body: { action: "analyze-competitors", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitor-intel"] });
      toast.success("Competitor intel updated");
    },
  });
}

// ── Offer Variants ──
export function useOfferVariants(status?: string) {
  return useQuery({
    queryKey: ["offer-variants", status],
    queryFn: async () => {
      let q = (supabase as any)
        .from("brandaro_offer_variants")
        .select("*")
        .order("revenue_generated", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (offer: {
      offer_name: string;
      pricing: number;
      headline?: string;
      value_props?: string[];
      guarantee?: string;
      urgency_trigger?: string;
      target_segment?: string;
    }) => {
      const { error } = await (supabase as any)
        .from("brandaro_offer_variants")
        .insert({ ...offer, status: "testing" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offer-variants"] });
      toast.success("Offer variant created");
    },
  });
}

export function useOptimizeOffers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-market-domination", {
        body: { action: "optimize-offers" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["offer-variants"] });
      toast.success(`Promoted ${data?.promoted?.length || 0}, killed ${data?.killed?.length || 0}`);
    },
  });
}

// ── Pricing Tests ──
export function usePricingTests() {
  return useQuery({
    queryKey: ["pricing-tests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_pricing_tests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreatePricingTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { base_price: number; test_price: number; segment?: string }) => {
      const { data, error } = await supabase.functions.invoke("brandaro-market-domination", {
        body: { action: "run-pricing-test", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-tests"] });
      toast.success("Pricing test started");
    },
  });
}

export function useEvaluatePricingTests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-market-domination", {
        body: { action: "evaluate-pricing-tests" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-tests"] });
      toast.success("Pricing tests evaluated");
    },
  });
}

// ── Positioning Tests ──
export function usePositioningTests() {
  return useQuery({
    queryKey: ["positioning-tests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_positioning_tests")
        .select("*")
        .order("win_rate", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreatePositioningTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { positioning_angle: string; headline?: string; script_variant?: string }) => {
      const { data, error } = await supabase.functions.invoke("brandaro-market-domination", {
        body: { action: "update-positioning", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["positioning-tests"] });
      toast.success("Positioning test created");
    },
  });
}

// ── Full Dashboard ──
export function useDominationDashboard() {
  return useQuery({
    queryKey: ["domination-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-market-domination", {
        body: { action: "get-domination-dashboard" },
      });
      if (error) throw error;
      return data as {
        competitors: any[];
        offers: any[];
        winning_offers: any[];
        pricing_tests: any[];
        active_pricing_tests: number;
        positioning: any[];
      };
    },
    refetchInterval: 60000,
  });
}
