import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTestimonials() {
  return useQuery({
    queryKey: ["brandaro-testimonials"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_testimonials")
        .select("*")
        .eq("is_featured", true)
        .order("rating", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUrgency(leadId?: string) {
  return useQuery({
    queryKey: ["brandaro-urgency", leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await (supabase as any)
        .from("brandaro_urgency")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
    refetchInterval: 30000,
  });
}

export function useLogObjection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (obj: { lead_id: string; objection_type: string; response_sent?: string }) => {
      const { error } = await (supabase as any)
        .from("brandaro_objections")
        .insert(obj);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brandaro-objections"] }),
  });
}

export function useQualityReviews() {
  return useQuery({
    queryKey: ["brandaro-quality-reviews"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_quality_reviews")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useApproveQualityReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, notes }: { reviewId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("brandaro_quality_reviews")
        .update({ status: "approved", reviewed_by: user?.id, notes, reviewed_at: new Date().toISOString() })
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brandaro-quality-reviews"] }),
  });
}
