import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LearningProposal {
  id: string;
  business_id: string | null;
  proposal_type: string;
  title: string;
  description: string;
  source_calls: string[];
  source_metrics: Record<string, unknown>;
  evidence_summary: string | null;
  expected_benefit: string;
  expected_improvement_pct: number | null;
  risk_assessment: string;
  risk_level: string;
  affects_speech: boolean;
  affects_timing: boolean;
  affects_escalation: boolean;
  affects_routing: boolean;
  current_artifact: Record<string, unknown>;
  proposed_artifact: Record<string, unknown>;
  artifact_diff: Record<string, unknown> | null;
  status: string;
  proposal_hash: string | null;
  is_immutable: boolean;
  created_at: string;
}

export interface SandboxRun {
  id: string;
  proposal_id: string;
  simulation_type: string;
  test_cases_count: number;
  outcome_delta: Record<string, unknown>;
  confidence_variance: number | null;
  failure_modes_detected: string[];
  baseline_metrics: Record<string, unknown>;
  proposed_metrics: Record<string, unknown>;
  improvement_achieved: boolean | null;
  improvement_pct: number | null;
  safety_violations: number;
  compliance_issues: string[];
  regression_detected: boolean;
  status: string;
  failure_reason: string | null;
  run_hash: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface Promotion {
  id: string;
  proposal_id: string;
  approval_id: string;
  business_id: string | null;
  promotion_scope: string;
  affected_artifact_type: string;
  version_number: number;
  previous_snapshot: Record<string, unknown>;
  new_snapshot: Record<string, unknown>;
  promotion_diff: Record<string, unknown>;
  promoted_at: string;
  expires_at: string | null;
  is_permanent: boolean;
  rollback_hash: string;
  is_rolled_back: boolean;
  rolled_back_at: string | null;
  rollback_reason: string | null;
  watch_mode_active: boolean;
  watch_mode_until: string | null;
  elevated_sensitivity: boolean;
  promotion_hash: string;
}

export interface WatchEvent {
  id: string;
  promotion_id: string;
  event_type: string;
  severity: string;
  metrics_snapshot: Record<string, unknown>;
  drift_detected: boolean;
  anomaly_score: number | null;
  action_taken: string | null;
  triggered_rollback: boolean;
  created_at: string;
}

// Query hooks
export function useLearningProposals(businessId: string | null) {
  return useQuery({
    queryKey: ['learning-proposals', businessId],
    queryFn: async () => {
      let query = supabase
        .from('ai_learning_proposals')
        .select('*')
        .order('created_at', { ascending: false });

      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LearningProposal[];
    }
  });
}

export function useProposalDetails(proposalId: string | null) {
  return useQuery({
    queryKey: ['proposal-details', proposalId],
    queryFn: async () => {
      if (!proposalId) return null;

      const { data: proposal, error: proposalError } = await supabase
        .from('ai_learning_proposals')
        .select('*')
        .eq('id', proposalId)
        .single();

      if (proposalError) throw proposalError;

      // Get sandbox runs
      const { data: sandboxRuns } = await supabase
        .from('promotion_sandbox_runs')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false });

      // Get sentinel gates
      const { data: sentinelGates } = await supabase
        .from('sentinel_promotion_gates')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false });

      // Get approvals
      const { data: approvals } = await supabase
        .from('promotion_approvals')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false });

      return {
        proposal: proposal as LearningProposal,
        sandboxRuns: sandboxRuns as SandboxRun[],
        sentinelGates: sentinelGates || [],
        approvals: approvals || []
      };
    },
    enabled: !!proposalId
  });
}

export function useActivePromotions(businessId: string | null) {
  return useQuery({
    queryKey: ['active-promotions', businessId],
    queryFn: async () => {
      let query = supabase
        .from('ai_promotions')
        .select('*')
        .eq('is_rolled_back', false)
        .order('promoted_at', { ascending: false });

      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Promotion[];
    }
  });
}

export function useWatchEvents(promotionId: string | null) {
  return useQuery({
    queryKey: ['watch-events', promotionId],
    queryFn: async () => {
      if (!promotionId) return [];

      const { data, error } = await supabase
        .from('promotion_watch_events')
        .select('*')
        .eq('promotion_id', promotionId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WatchEvent[];
    },
    enabled: !!promotionId
  });
}

// Mutation hooks
export function useRunSimulation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      proposalId, 
      simulationType 
    }: { 
      proposalId: string; 
      simulationType: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('promotion-sandbox', {
        body: {
          action: 'run_simulation',
          proposal_id: proposalId,
          simulation_type: simulationType,
          test_cases_count: 100
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['learning-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-details'] });
      toast({
        title: data.result?.status === 'passed' ? 'Simulation Passed' : 'Simulation Complete',
        description: data.message
      });
    },
    onError: (error) => {
      toast({
        title: 'Simulation Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });
}

export function useCheckSentinelGate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (proposalId: string) => {
      const { data, error } = await supabase.functions.invoke('promotion-gate', {
        body: {
          action: 'check_sentinel_gate',
          proposal_id: proposalId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['learning-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-details'] });
      toast({
        title: data.gate_passed ? 'Sentinel Approved' : 'Sentinel Blocked',
        description: data.message,
        variant: data.gate_passed ? 'default' : 'destructive'
      });
    },
    onError: (error) => {
      toast({
        title: 'Gate Check Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });
}

export function useHumanApprove() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      proposalId: string;
      approverId: string;
      approverEmail: string;
      approverRole: string;
      approvalReason: string;
      scopeDescription: string;
      rollbackInstructions: string;
      validUntil?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('promotion-gate', {
        body: {
          action: 'human_approve',
          proposal_id: params.proposalId,
          approver_id: params.approverId,
          approver_email: params.approverEmail,
          approver_role: params.approverRole,
          approval_reason: params.approvalReason,
          scope_description: params.scopeDescription,
          rollback_instructions: params.rollbackInstructions,
          valid_until: params.validUntil
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['learning-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-details'] });
      toast({
        title: 'Approval Recorded',
        description: `Signature: ${data.signature_hash?.slice(0, 16)}...`
      });
    },
    onError: (error) => {
      toast({
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });
}

export function usePromote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ proposalId, approvalId }: { proposalId: string; approvalId: string }) => {
      const { data, error } = await supabase.functions.invoke('promotion-gate', {
        body: {
          action: 'promote',
          proposal_id: proposalId,
          approval_id: approvalId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['learning-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['active-promotions'] });
      toast({
        title: 'Promotion Complete',
        description: data.message
      });
    },
    onError: (error) => {
      toast({
        title: 'Promotion Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });
}

export function useRollback() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      promotionId, 
      rollbackReason, 
      rolledBackBy 
    }: { 
      promotionId: string; 
      rollbackReason: string; 
      rolledBackBy: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('promotion-gate', {
        body: {
          action: 'rollback',
          promotion_id: promotionId,
          rollback_reason: rollbackReason,
          rolled_back_by: rolledBackBy
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['active-promotions'] });
      toast({
        title: 'Rollback Complete',
        description: 'Previous version has been restored'
      });
    },
    onError: (error) => {
      toast({
        title: 'Rollback Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });
}
