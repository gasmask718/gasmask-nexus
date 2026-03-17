import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Process a learning event after call analysis ──
export function useProcessLearningEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      call_session_id?: string;
      va_user_id: string;
      lead_id?: string;
      outcome: string;
      objections?: string[];
      buying_signals?: string[];
      strategies_used?: string[];
      next_action_taken?: string;
      revenue_generated?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("brandaro-learning-engine", {
        body: { action: "process-learning-event", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["winning-patterns"] });
      qc.invalidateQueries({ queryKey: ["response-library"] });
      qc.invalidateQueries({ queryKey: ["va-skill-profiles"] });
      qc.invalidateQueries({ queryKey: ["learning-events"] });
    },
    onError: (err: any) => toast.error(`Learning event failed: ${err.message}`),
  });
}

// ── Optimize response library ──
export function useOptimizeResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-learning-engine", {
        body: { action: "optimize-responses" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["response-library"] });
      toast.success("Response library optimized");
    },
  });
}

// ── Winning Patterns ──
export function useWinningPatterns(type?: string) {
  return useQuery({
    queryKey: ["winning-patterns", type],
    queryFn: async () => {
      let q = (supabase as any)
        .from("brandaro_winning_patterns")
        .select("*")
        .gte("sample_size", 3)
        .order("success_rate", { ascending: false })
        .limit(30);
      if (type) q = q.eq("pattern_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
}

// ── Response Library ──
export function useResponseLibrary(objectionType?: string) {
  return useQuery({
    queryKey: ["response-library", objectionType],
    queryFn: async () => {
      let q = (supabase as any)
        .from("brandaro_response_library")
        .select("*")
        .eq("is_active", true)
        .order("success_rate", { ascending: false });
      if (objectionType) q = q.eq("objection_type", objectionType);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

// ── VA Skill Profiles ──
export function useVASkillProfiles() {
  return useQuery({
    queryKey: ["va-skill-profiles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_va_skill_profiles")
        .select("*")
        .order("conversion_rate", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
}

// ── Learning Events (for audit) ──
export function useLearningEvents(limit = 20) {
  return useQuery({
    queryKey: ["learning-events", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_learning_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Full Intelligence Summary (for manager) ──
export function useLearningIntelligence() {
  return useQuery({
    queryKey: ["learning-intelligence"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-learning-engine", {
        body: { action: "get-intelligence" },
      });
      if (error) throw error;
      return data as {
        patterns: any[];
        responses: any[];
        skills: any[];
      };
    },
    refetchInterval: 60000,
  });
}
