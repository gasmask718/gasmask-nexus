import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PredictiveRiskScore {
  id: string;
  business_id: string | null;
  store_id: string | null;
  churn_risk: number;
  risk_factors: string[];
  predicted_timeframe: string | null;
  ai_summary: string | null;
  created_at: string;
  store?: { id: string; store_name: string } | null;
}

export interface PredictiveOpportunityScore {
  id: string;
  business_id: string | null;
  store_id: string | null;
  opportunity_score: number;
  opportunity_factors: string[];
  predicted_product_interest: string | null;
  ai_summary: string | null;
  created_at: string;
  store?: { id: string; store_name: string } | null;
}

export interface CommunicationTrendSnapshot {
  id: string;
  business_id: string | null;
  trend_type: string;
  trend_summary: string | null;
  data: Record<string, unknown>;
  forecast_period: string | null;
  created_at: string;
}

export interface PredictiveAction {
  id: string;
  business_id: string | null;
  store_id: string | null;
  action_type: string;
  priority: string;
  ai_reason: string | null;
  recommended_content: string | null;
  predicted_intent: string | null;
  executed: boolean;
  executed_at: string | null;
  created_at: string;
  store?: { id: string; store_name: string } | null;
}

export interface AutopilotSettings {
  id: string;
  business_id: string | null;
  enabled: boolean;
  auto_recovery_enabled: boolean;
  auto_upsell_enabled: boolean;
  churn_threshold: number;
  opportunity_threshold: number;
}

export function usePredictiveIntelligence(businessId?: string) {
  const queryClient = useQueryClient();

  // Fetch churn risk scores
  const { data: riskScores = [], isLoading: riskLoading } = useQuery({
    queryKey: ["predictive-risk-scores", businessId],
    queryFn: async () => {
      let query = supabase
        .from("predictive_risk_scores")
        .select(`*, store:store_master(id, store_name)`)
        .order("churn_risk", { ascending: false })
        .limit(50);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PredictiveRiskScore[];
    },
  });

  // Fetch opportunity scores
  const { data: opportunityScores = [], isLoading: opportunityLoading } = useQuery({
    queryKey: ["predictive-opportunity-scores", businessId],
    queryFn: async () => {
      let query = supabase
        .from("predictive_opportunity_scores")
        .select(`*, store:store_master(id, store_name)`)
        .order("opportunity_score", { ascending: false })
        .limit(50);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PredictiveOpportunityScore[];
    },
  });

  // Fetch trend snapshots
  const { data: trendSnapshots = [], isLoading: trendsLoading } = useQuery({
    queryKey: ["communication-trend-snapshots", businessId],
    queryFn: async () => {
      let query = supabase
        .from("communication_trend_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommunicationTrendSnapshot[];
    },
  });

  // Fetch predictive actions
  const { data: predictiveActions = [], isLoading: actionsLoading, refetch: refetchActions } = useQuery({
    queryKey: ["predictive-actions", businessId],
    queryFn: async () => {
      let query = supabase
        .from("predictive_actions")
        .select(`*, store:store_master(id, store_name)`)
        .eq("executed", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PredictiveAction[];
    },
  });

  // Fetch autopilot settings
  const { data: autopilotSettings } = useQuery({
    queryKey: ["predictive-autopilot-settings", businessId],
    queryFn: async () => {
      let query = supabase
        .from("predictive_autopilot_settings")
        .select("*")
        .limit(1);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.[0] as AutopilotSettings | undefined;
    },
  });

  // Execute predictive action
  const executeActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from("predictive_actions")
        .update({ executed: true, executed_at: new Date().toISOString() })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchActions();
      toast.success("Action executed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update autopilot settings
  const updateAutopilotMutation = useMutation({
    mutationFn: async (settings: Partial<AutopilotSettings>) => {
      if (autopilotSettings?.id) {
        const { error } = await supabase
          .from("predictive_autopilot_settings")
          .update({ ...settings, updated_at: new Date().toISOString() })
          .eq("id", autopilotSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("predictive_autopilot_settings")
          .insert({ ...settings, business_id: businessId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictive-autopilot-settings"] });
      toast.success("Autopilot settings updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Trigger recovery sequence
  const triggerRecoveryMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await supabase.from("predictive_actions").insert({
        store_id: storeId,
        business_id: businessId,
        action_type: "AI recovery sequence",
        priority: "high",
        ai_reason: "Manual recovery trigger for at-risk store",
        recommended_content: "Send personalized check-in message and schedule follow-up call",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchActions();
      toast.success("Recovery sequence triggered");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Trigger upsell sequence
  const triggerUpsellMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await supabase.from("predictive_actions").insert({
        store_id: storeId,
        business_id: businessId,
        action_type: "AI upsell sequence",
        priority: "medium",
        ai_reason: "Manual upsell trigger for high-opportunity store",
        recommended_content: "Send product recommendation and promotional offer",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchActions();
      toast.success("Upsell sequence triggered");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Calculate predicted intent from factors
  const getPredictedIntent = (factors: string[]): string => {
    if (factors.some(f => f.toLowerCase().includes("complaint") || f.toLowerCase().includes("negative"))) {
      return "Potential complaint";
    }
    if (factors.some(f => f.toLowerCase().includes("order") || f.toLowerCase().includes("purchase"))) {
      return "High purchase intent";
    }
    if (factors.some(f => f.toLowerCase().includes("delivery"))) {
      return "Delivery issue forming";
    }
    if (factors.some(f => f.toLowerCase().includes("churn") || f.toLowerCase().includes("inactive"))) {
      return "Store about to churn";
    }
    if (factors.some(f => f.toLowerCase().includes("upsell") || f.toLowerCase().includes("growth"))) {
      return "Store ready for upsell";
    }
    return "Neutral";
  };

  // Stats
  const highRiskCount = riskScores.filter(s => s.churn_risk >= 75).length;
  const mediumRiskCount = riskScores.filter(s => s.churn_risk >= 50 && s.churn_risk < 75).length;
  const highOpportunityCount = opportunityScores.filter(s => s.opportunity_score >= 80).length;
  const pendingActionsCount = predictiveActions.length;

  return {
    riskScores,
    riskLoading,
    opportunityScores,
    opportunityLoading,
    trendSnapshots,
    trendsLoading,
    predictiveActions,
    actionsLoading,
    refetchActions,
    autopilotSettings,
    executeAction: executeActionMutation.mutate,
    isExecuting: executeActionMutation.isPending,
    updateAutopilot: updateAutopilotMutation.mutate,
    triggerRecovery: triggerRecoveryMutation.mutate,
    triggerUpsell: triggerUpsellMutation.mutate,
    getPredictedIntent,
    stats: {
      highRiskCount,
      mediumRiskCount,
      highOpportunityCount,
      pendingActionsCount,
    },
  };
}
