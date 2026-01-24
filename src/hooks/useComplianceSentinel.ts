import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ComplianceBaseline {
  id: string;
  business_id: string | null;
  baseline_name: string;
  baseline_version: string;
  is_active: boolean;
  is_regulator_grade: boolean;
  supersedes_baseline_id: string | null;
  min_permission_rate: number;
  max_kill_switch_latency_ms: number;
  max_confidence_breach_rate: number;
  max_human_takeover_latency_ms: number;
  max_unapproved_technique_count: number;
  min_audit_completeness_rate: number;
  source_evidence_pack_ids: string[];
  source_simulation_ids: string[];
  certified_at: string | null;
  certified_by: string | null;
  certification_hash: string | null;
  certification_notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SentinelStatus {
  id: string;
  business_id: string | null;
  compliance_state: string;
  active_baseline_id: string | null;
  sentinel_enabled: boolean;
  last_evaluation_at: string | null;
  last_evaluation_id: string | null;
  last_evaluation_status: string | null;
  evaluation_interval_seconds: number;
  active_drift_count: number;
  active_critical_count: number;
  active_warning_count: number;
  is_contained: boolean;
  containment_level: string | null;
  containment_reason: string | null;
  containment_started_at: string | null;
  time_since_last_clean_ms: number;
  last_clean_evaluation_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SentinelEvaluation {
  id: string;
  business_id: string | null;
  baseline_id: string | null;
  evaluation_type: string;
  trigger_event: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: string;
  metrics_evaluated: Record<string, unknown>;
  thresholds_checked: Record<string, unknown>;
  drift_detected: boolean;
  drift_count: number;
  evaluation_hash: string | null;
  prev_evaluation_id: string | null;
  prev_evaluation_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DriftEvent {
  id: string;
  business_id: string | null;
  baseline_id: string | null;
  evaluation_id: string | null;
  severity: string;
  drift_type: string;
  metric_name: string;
  baseline_value: number | null;
  current_value: number | null;
  deviation_magnitude: number | null;
  deviation_percentage: number | null;
  drift_direction: string | null;
  first_detected_at: string;
  last_detected_at: string;
  duration_seconds: number;
  occurrence_count: number;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  triggered_containment: boolean;
  containment_action_id: string | null;
  event_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ContainmentAction {
  id: string;
  business_id: string | null;
  drift_event_id: string | null;
  evaluation_id: string | null;
  action_type: string;
  action_reason: string;
  severity_at_action: string;
  previous_mode: string | null;
  new_mode: string | null;
  affected_agents: string[];
  affected_routes: string[];
  executed_at: string;
  execution_success: boolean;
  execution_error: string | null;
  requires_human_approval_to_restore: boolean;
  restored_at: string | null;
  restored_by: string | null;
  restore_approved_by: string | null;
  restore_notes: string | null;
  action_hash: string | null;
  is_immutable: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Sentinel Status Hook
export function useSentinelStatus(businessId: string | null) {
  return useQuery({
    queryKey: ["sentinel-status", businessId],
    queryFn: async () => {
      let query = supabase
        .from("sentinel_status")
        .select("*");

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query.single();
      if (error && error.code !== "PGRST116") throw error;
      return data as SentinelStatus | null;
    },
    enabled: true,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });
}

// Baselines Hook
export function useComplianceBaselines(businessId: string | null) {
  return useQuery({
    queryKey: ["compliance-baselines", businessId],
    queryFn: async () => {
      let query = supabase
        .from("compliance_baselines")
        .select("*")
        .order("created_at", { ascending: false });

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ComplianceBaseline[];
    },
    enabled: true,
  });
}

// Active Baseline Hook
export function useActiveBaseline(businessId: string | null) {
  return useQuery({
    queryKey: ["active-baseline", businessId],
    queryFn: async () => {
      let query = supabase
        .from("compliance_baselines")
        .select("*")
        .eq("is_active", true);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query.single();
      if (error && error.code !== "PGRST116") throw error;
      return data as ComplianceBaseline | null;
    },
    enabled: true,
  });
}

// Sentinel Evaluations Hook
export function useSentinelEvaluations(businessId: string | null, limit = 20) {
  return useQuery({
    queryKey: ["sentinel-evaluations", businessId, limit],
    queryFn: async () => {
      let query = supabase
        .from("sentinel_evaluations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SentinelEvaluation[];
    },
    enabled: true,
  });
}

// Drift Events Hook
export function useDriftEvents(businessId: string | null, unresolvedOnly = false) {
  return useQuery({
    queryKey: ["drift-events", businessId, unresolvedOnly],
    queryFn: async () => {
      let query = supabase
        .from("compliance_drift_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      if (unresolvedOnly) {
        query = query.eq("is_resolved", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DriftEvent[];
    },
    enabled: true,
  });
}

// Containment Actions Hook
export function useContainmentActions(businessId: string | null, pendingOnly = false) {
  return useQuery({
    queryKey: ["containment-actions", businessId, pendingOnly],
    queryFn: async () => {
      let query = supabase
        .from("sentinel_containment_actions")
        .select("*")
        .order("created_at", { ascending: false });

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      if (pendingOnly) {
        query = query.is("restored_at", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContainmentAction[];
    },
    enabled: true,
  });
}

// Run Sentinel Evaluation
export function useRunSentinelEvaluation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      businessId, 
      evaluationType = "manual",
      triggerEvent 
    }: { 
      businessId: string; 
      evaluationType?: string;
      triggerEvent?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("compliance-sentinel", {
        body: { 
          business_id: businessId,
          evaluation_type: evaluationType,
          trigger_event: triggerEvent,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.containment_triggered) {
        toast.warning("Auto-containment triggered", {
          description: `AI downgraded to ${data.containment_action} due to critical drift`,
        });
      } else if (data.status === "passed") {
        toast.success("Sentinel evaluation passed", {
          description: `No drift detected - system compliant`,
        });
      } else if (data.status === "warning") {
        toast.warning("Sentinel detected warnings", {
          description: `${data.warning_count} warning-level drifts detected`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["sentinel-status"] });
      queryClient.invalidateQueries({ queryKey: ["sentinel-evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["drift-events"] });
      queryClient.invalidateQueries({ queryKey: ["containment-actions"] });
    },
    onError: (error: Error) => {
      toast.error("Sentinel evaluation failed", {
        description: error.message,
      });
    },
  });
}

// Create Baseline
export function useCreateBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      businessId, 
      baselineName,
      thresholds,
      sourceEvidencePackIds,
      sourceSimulationIds
    }: { 
      businessId: string; 
      baselineName?: string;
      thresholds?: Record<string, number>;
      sourceEvidencePackIds?: string[];
      sourceSimulationIds?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("compliance-baseline-manager", {
        body: { 
          action: "create",
          business_id: businessId,
          baseline_name: baselineName,
          thresholds,
          source_evidence_pack_ids: sourceEvidencePackIds,
          source_simulation_ids: sourceSimulationIds,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Baseline created", {
        description: "Certify the baseline to make it active",
      });
      queryClient.invalidateQueries({ queryKey: ["compliance-baselines"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to create baseline", {
        description: error.message,
      });
    },
  });
}

// Certify Baseline
export function useCertifyBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      baselineId, 
      certifiedBy,
      certificationNotes,
      isRegulatorGrade
    }: { 
      baselineId: string; 
      certifiedBy: string;
      certificationNotes?: string;
      isRegulatorGrade?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("compliance-baseline-manager", {
        body: { 
          action: "certify",
          baseline_id: baselineId,
          certified_by: certifiedBy,
          certification_notes: certificationNotes,
          is_regulator_grade: isRegulatorGrade,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Baseline certified", {
        description: "Activate the baseline to use it for drift detection",
      });
      queryClient.invalidateQueries({ queryKey: ["compliance-baselines"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to certify baseline", {
        description: error.message,
      });
    },
  });
}

// Activate Baseline
export function useActivateBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ baselineId }: { baselineId: string }) => {
      const { data, error } = await supabase.functions.invoke("compliance-baseline-manager", {
        body: { 
          action: "activate",
          baseline_id: baselineId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Baseline activated", {
        description: "Sentinel will now compare against these thresholds",
      });
      queryClient.invalidateQueries({ queryKey: ["compliance-baselines"] });
      queryClient.invalidateQueries({ queryKey: ["active-baseline"] });
      queryClient.invalidateQueries({ queryKey: ["sentinel-status"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to activate baseline", {
        description: error.message,
      });
    },
  });
}

// Restore from Containment
export function useRestoreFromContainment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      actionId, 
      restoredBy,
      approvedBy,
      restoreNotes
    }: { 
      actionId: string; 
      restoredBy: string;
      approvedBy: string;
      restoreNotes?: string;
    }) => {
      const { error } = await supabase
        .from("sentinel_containment_actions")
        .update({
          restored_at: new Date().toISOString(),
          restored_by: restoredBy,
          restore_approved_by: approvedBy,
          restore_notes: restoreNotes,
        })
        .eq("id", actionId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      toast.success("System restored", {
        description: "AI mode has been restored - monitor closely",
      });
      queryClient.invalidateQueries({ queryKey: ["containment-actions"] });
      queryClient.invalidateQueries({ queryKey: ["sentinel-status"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to restore", {
        description: error.message,
      });
    },
  });
}
