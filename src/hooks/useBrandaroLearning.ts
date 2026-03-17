import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VaTask {
  id: string;
  va_user_id: string | null;
  task_type: string;
  lead_id: string | null;
  call_id: string | null;
  demo_score_id: string | null;
  priority: string;
  status: string;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  brandaro_qualified_leads?: any;
}

export function useVaTasks(status?: string) {
  return useQuery({
    queryKey: ["brandaro-va-tasks", status],
    queryFn: async () => {
      let query = (supabase as any)
        .from("brandaro_va_tasks")
        .select("*, brandaro_qualified_leads:lead_id(*)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (status) query = query.eq("status", status);
      else query = query.in("status", ["pending", "in_progress"]);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as VaTask[];
    },
    refetchInterval: 15000,
  });
}

export function useCompleteVaTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes?: string }) => {
      const { error } = await (supabase as any)
        .from("brandaro_va_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString(), notes })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brandaro-va-tasks"] }),
  });
}

export function useCreateVaTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Partial<VaTask>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("brandaro_va_tasks")
        .insert({ ...task, va_user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brandaro-va-tasks"] }),
  });
}

// Learning feedback hook
export function useSubmitLearningFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (feedback: {
      lead_id?: string;
      call_id?: string;
      feedback_type: string;
      objection_type?: string;
      outcome?: string;
      deal_value?: number;
      va_notes?: string;
      website_score?: number;
    }) => {
      const { error } = await (supabase as any)
        .from("brandaro_learning_feedback")
        .insert(feedback);
      if (error) throw error;

      // Also update objection library if objection was handled
      if (feedback.objection_type && feedback.outcome) {
        const { data: existing } = await (supabase as any)
          .from("brandaro_objection_library")
          .select("id, frequency, success_rate")
          .eq("objection_type", feedback.objection_type)
          .single();

        if (existing) {
          const newFreq = (existing.frequency || 0) + 1;
          const wasSuccess = ["closed", "interested", "callback"].includes(feedback.outcome || "");
          const oldSuccesses = Math.round((existing.success_rate || 0) * (existing.frequency || 1) / 100);
          const newSuccesses = wasSuccess ? oldSuccesses + 1 : oldSuccesses;
          const newRate = Math.round((newSuccesses / newFreq) * 100);

          await (supabase as any)
            .from("brandaro_objection_library")
            .update({ frequency: newFreq, success_rate: newRate, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await (supabase as any)
            .from("brandaro_objection_library")
            .insert({
              objection_type: feedback.objection_type,
              frequency: 1,
              success_rate: feedback.outcome === "closed" ? 100 : 0,
            });
        }
      }

      // Update design variant stats if deal closed
      if (feedback.feedback_type === "deal_closed" && feedback.deal_value) {
        queryClient.invalidateQueries({ queryKey: ["brandaro-design-insights"] });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-learning-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-objection-library"] });
    },
  });
}

export function useObjectionLibrary() {
  return useQuery({
    queryKey: ["brandaro-objection-library"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_objection_library")
        .select("*")
        .order("frequency", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}
