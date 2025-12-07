import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StoreScore {
  id: string;
  store_id: string;
  business_id: string;
  score: number;
  priority_label: string;
  reason_summary: string | null;
  last_calculated_at: string;
}

interface BrandTask {
  id: string;
  business_id: string;
  store_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  created_by: string;
}

interface BrandInsight {
  id: string;
  business_id: string;
  ai_summary: string | null;
  ai_top_actions: string | null;
  calculated_at: string;
}

export function useBrandCRMV3(businessId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch store scores
  const { data: storeScores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ["store-scores", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_scores")
        .select("*")
        .eq("business_id", businessId!);
      if (error) throw error;
      return data as StoreScore[];
    },
    enabled: !!businessId,
  });

  // Fetch brand tasks
  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ["brand-tasks", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_tasks")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BrandTask[];
    },
    enabled: !!businessId,
  });

  // Fetch brand insights
  const { data: insight, isLoading: insightLoading, refetch: refetchInsight } = useQuery({
    queryKey: ["brand-insight", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_insights_cache")
        .select("*")
        .eq("business_id", businessId!)
        .maybeSingle();
      if (error) throw error;
      return data as BrandInsight | null;
    },
    enabled: !!businessId,
  });

  // Calculate store scores
  const calculateScoresMutation = useMutation({
    mutationFn: async (stores: any[]) => {
      const scores: Omit<StoreScore, "id" | "created_at">[] = [];

      for (const store of stores) {
        let score = 50; // Base score
        const reasons: string[] = [];

        // Sticker compliance
        if (store.sticker_on_door) {
          score += 20;
          reasons.push("+20 door sticker");
        } else {
          score -= 15;
          reasons.push("-15 missing door sticker");
        }

        if (store.sticker_inside_store) {
          score += 15;
          reasons.push("+15 inside sticker");
        }

        // Check notes for sentiment (simplified)
        const notes = store.notes?.toLowerCase() || "";
        if (notes.includes("problem") || notes.includes("issue") || notes.includes("complaint")) {
          score -= 10;
          reasons.push("-10 negative notes");
        }
        if (notes.includes("good") || notes.includes("great") || notes.includes("loves")) {
          score += 10;
          reasons.push("+10 positive notes");
        }

        // Normalize score
        score = Math.max(0, Math.min(100, score));

        // Determine priority
        let priority_label = "Medium";
        if (score >= 75) priority_label = "High";
        else if (score < 50) priority_label = "Low";

        scores.push({
          store_id: store.id,
          business_id: businessId!,
          score,
          priority_label,
          reason_summary: reasons.join(", "),
          last_calculated_at: new Date().toISOString(),
        });
      }

      // Upsert scores
      for (const scoreData of scores) {
        const { error } = await supabase
          .from("store_scores")
          .upsert(scoreData, { onConflict: "store_id,business_id" });
        if (error) console.error("Score upsert error:", error);
      }

      return scores.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["store-scores", businessId] });
      toast.success(`Calculated scores for ${count} stores`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: async (task: Partial<BrandTask>) => {
      const { error } = await supabase.from("brand_tasks").insert({
        business_id: businessId,
        title: task.title,
        description: task.description,
        store_id: task.store_id,
        contact_id: task.contact_id,
        status: task.status || "Open",
        due_date: task.due_date,
        created_by: task.created_by || "User",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTasks();
      toast.success("Task added");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update task status
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const updates: any = { status };
      if (status === "Done") {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("brand_tasks")
        .update(updates)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTasks();
      toast.success("Task updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Generate AI insights
  const generateInsightsMutation = useMutation({
    mutationFn: async (data: {
      brandName: string;
      totalStores: number;
      stickerCompliance: number;
      doorStickers: number;
      insideStickers: number;
      openTasks: number;
      totalContacts: number;
      storesByBoro: Record<string, number>;
    }) => {
      const response = await supabase.functions.invoke("brand-ai-insights", {
        body: {
          type: "brand_summary",
          brandName: data.brandName,
          data,
        },
      });

      if (response.error) throw response.error;
      
      const result = response.data?.result;
      if (!result) throw new Error("No AI response received");

      // Save to cache
      const { error } = await supabase
        .from("brand_insights_cache")
        .upsert({
          business_id: businessId,
          ai_summary: result.summary || result.raw,
          ai_top_actions: Array.isArray(result.topActions) 
            ? result.topActions.join("\n• ") 
            : result.topActions,
          calculated_at: new Date().toISOString(),
        }, { onConflict: "business_id" });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      refetchInsight();
      toast.success("AI insights generated");
    },
    onError: (error: Error) => {
      toast.error(`AI error: ${error.message}`);
    },
  });

  // Generate smart tasks via AI
  const generateSmartTasksMutation = useMutation({
    mutationFn: async (data: {
      brandName: string;
      lowScoreStores: any[];
      missingStickerStores: any[];
      contactsNeedingFollowUp: any[];
    }) => {
      const response = await supabase.functions.invoke("brand-ai-insights", {
        body: {
          type: "smart_tasks",
          brandName: data.brandName,
          data,
        },
      });

      if (response.error) throw response.error;
      
      const tasks = response.data?.result;
      if (!Array.isArray(tasks)) {
        throw new Error("Invalid AI response format");
      }

      // Insert generated tasks
      for (const task of tasks) {
        await supabase.from("brand_tasks").insert({
          business_id: businessId,
          title: task.title,
          description: task.description,
          store_id: task.storeId || null,
          contact_id: task.contactId || null,
          status: "Open",
          created_by: "AI",
        });
      }

      return tasks.length;
    },
    onSuccess: (count) => {
      refetchTasks();
      toast.success(`Generated ${count} smart tasks`);
    },
    onError: (error: Error) => {
      toast.error(`AI error: ${error.message}`);
    },
  });

  // Get score for a specific store
  const getStoreScore = (storeId: string) => {
    return storeScores.find((s) => s.store_id === storeId);
  };

  // Get open tasks count
  const openTasksCount = tasks.filter((t) => t.status === "Open").length;

  // Get high priority stores for suggested visits
  const suggestedVisits = storeScores
    .filter((s) => s.priority_label === "Low" || s.score < 60)
    .slice(0, 10);

  return {
    storeScores,
    scoresLoading,
    tasks,
    tasksLoading,
    insight,
    insightLoading,
    openTasksCount,
    suggestedVisits,
    getStoreScore,
    calculateScores: calculateScoresMutation.mutate,
    isCalculating: calculateScoresMutation.isPending,
    addTask: addTaskMutation.mutateAsync,
    isAddingTask: addTaskMutation.isPending,
    updateTaskStatus: updateTaskMutation.mutate,
    generateInsights: generateInsightsMutation.mutate,
    isGeneratingInsights: generateInsightsMutation.isPending,
    generateSmartTasks: generateSmartTasksMutation.mutate,
    isGeneratingTasks: generateSmartTasksMutation.isPending,
    refetchTasks,
  };
}
