// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5: AUTONOMY ENGINE HOOKS
// Proposal management, execution, policy, and rollback
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ProposalType = 'split_route' | 'reassign_stop' | 'add_support_worker' | 
  'resequence_stops' | 'pause_route' | 'ping_worker';

export type ProposalStatus = 'open' | 'approved' | 'rejected' | 'executed' | 'expired' | 'rolled_back';

export type ExecutionStatus = 'success' | 'partial' | 'failed';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface DispatchProposal {
  id: string;
  created_at: string;
  route_id: string | null;
  territory: string | null;
  date: string;
  proposal_type: ProposalType;
  priority: Priority;
  confidence: number;
  predicted_impact: {
    minutes_saved?: number;
    sla_risk_reduction?: number;
    workload_change?: number;
  };
  reason: string;
  proposed_payload: Json;
  status: ProposalStatus;
  created_by: string | null;
  expires_at: string | null;
}

export interface DispatchExecution {
  id: string;
  proposal_id: string;
  approved_by: string | null;
  approved_at: string | null;
  executed_by: string | null;
  executed_at: string | null;
  execution_status: ExecutionStatus;
  before_state: Json;
  after_state: Json;
  verification_result: Json;
  rollback_payload: Json | null;
  rollback_expires_at: string | null;
  rolled_back_at: string | null;
  rolled_back_by: string | null;
  error_message: string | null;
}

export interface AutonomyPolicy {
  id: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  min_confidence_threshold: number;
  max_actions_per_route_per_hour: number;
  max_reassigned_stops_per_route: number;
  allowed_territories: string[];
  blocked_territories: string[];
  allowed_roles_to_approve: string[];
  blackout_windows: { start: string; end: string }[];
  simulation_only: boolean;
  enabled_actions: ProposalType[];
  is_active: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPOSALS HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useProposals(filters?: {
  status?: ProposalStatus;
  territory?: string;
  date?: string;
}) {
  return useQuery({
    queryKey: ['dispatch-proposals', filters],
    queryFn: async () => {
      let query = supabase
        .from('dispatch_action_proposals')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.territory) {
        query = query.eq('territory', filters.territory);
      }
      if (filters?.date) {
        query = query.eq('date', filters.date);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DispatchProposal[];
    },
    refetchInterval: 30000,
  });
}

export function useOpenProposals() {
  return useProposals({ status: 'open' });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      routeId?: string;
      territory?: string;
      proposalType: ProposalType;
      priority: Priority;
      confidence: number;
      predictedImpact?: DispatchProposal['predicted_impact'];
      reason: string;
      proposedPayload: Json;
    }) => {
      const { data, error } = await supabase
        .from('dispatch_action_proposals')
        .insert({
          route_id: params.routeId || null,
          territory: params.territory || null,
          proposal_type: params.proposalType,
          priority: params.priority,
          confidence: params.confidence,
          predicted_impact: params.predictedImpact || {},
          reason: params.reason,
          proposed_payload: params.proposedPayload,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DispatchProposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-proposals'] });
      toast.success('Proposal created');
    },
    onError: (error) => {
      console.error('Failed to create proposal:', error);
      toast.error('Failed to create proposal');
    },
  });
}

export function useApproveProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposalId: string) => {
      const { data, error } = await supabase
        .from('dispatch_action_proposals')
        .update({ status: 'approved' })
        .eq('id', proposalId)
        .select()
        .single();

      if (error) throw error;
      return data as DispatchProposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-proposals'] });
      toast.success('Proposal approved');
    },
    onError: (error) => {
      console.error('Failed to approve proposal:', error);
      toast.error('Failed to approve proposal');
    },
  });
}

export function useRejectProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposalId: string) => {
      const { data, error } = await supabase
        .from('dispatch_action_proposals')
        .update({ status: 'rejected' })
        .eq('id', proposalId)
        .select()
        .single();

      if (error) throw error;
      return data as DispatchProposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-proposals'] });
      toast.info('Proposal rejected');
    },
    onError: (error) => {
      console.error('Failed to reject proposal:', error);
      toast.error('Failed to reject proposal');
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useExecutions(proposalId?: string) {
  return useQuery({
    queryKey: ['dispatch-executions', proposalId],
    queryFn: async () => {
      let query = supabase
        .from('dispatch_action_executions')
        .select('*')
        .order('executed_at', { ascending: false });

      if (proposalId) {
        query = query.eq('proposal_id', proposalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DispatchExecution[];
    },
  });
}

export function useExecuteProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      proposalId: string;
      beforeState: Json;
      afterState: Json;
      rollbackPayload?: Json;
      executionStatus?: ExecutionStatus;
      verificationResult?: Json;
      errorMessage?: string;
    }) => {
      // First update proposal status
      await supabase
        .from('dispatch_action_proposals')
        .update({ status: 'executed' })
        .eq('id', params.proposalId);

      // Then create execution record
      const { data, error } = await supabase
        .from('dispatch_action_executions')
        .insert({
          proposal_id: params.proposalId,
          approved_at: new Date().toISOString(),
          executed_at: new Date().toISOString(),
          execution_status: params.executionStatus || 'success',
          before_state: params.beforeState,
          after_state: params.afterState,
          rollback_payload: params.rollbackPayload || null,
          verification_result: params.verificationResult || {},
          error_message: params.errorMessage || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DispatchExecution;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-executions'] });
      toast.success('Action executed');
    },
    onError: (error) => {
      console.error('Failed to execute action:', error);
      toast.error('Execution failed');
    },
  });
}

export function useRollbackExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (executionId: string) => {
      // Mark execution as rolled back
      const { data, error } = await supabase
        .from('dispatch_action_executions')
        .update({
          rolled_back_at: new Date().toISOString(),
        })
        .eq('id', executionId)
        .select()
        .single();

      if (error) throw error;

      // Update proposal status
      await supabase
        .from('dispatch_action_proposals')
        .update({ status: 'rolled_back' })
        .eq('id', (data as DispatchExecution).proposal_id);

      return data as DispatchExecution;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-executions'] });
      toast.success('Action rolled back');
    },
    onError: (error) => {
      console.error('Failed to rollback:', error);
      toast.error('Rollback failed');
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useAutonomyPolicy() {
  return useQuery({
    queryKey: ['autonomy-policy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('autonomy_policy')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as AutonomyPolicy;
    },
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Partial<AutonomyPolicy>) => {
      const { data, error } = await supabase
        .from('autonomy_policy')
        .update({
          ...params,
          updated_at: new Date().toISOString(),
        })
        .eq('is_active', true)
        .select()
        .single();

      if (error) throw error;
      return data as AutonomyPolicy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomy-policy'] });
      toast.success('Policy updated');
    },
    onError: (error) => {
      console.error('Failed to update policy:', error);
      toast.error('Failed to update policy');
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export function validateProposalAgainstPolicy(
  proposal: Pick<DispatchProposal, 'proposal_type' | 'confidence' | 'territory'>,
  policy: AutonomyPolicy
): { valid: boolean; reason?: string } {
  // Check if action type is enabled
  if (!policy.enabled_actions.includes(proposal.proposal_type)) {
    return { valid: false, reason: `Action type "${proposal.proposal_type}" is not enabled` };
  }

  // Check confidence threshold
  if (proposal.confidence < policy.min_confidence_threshold) {
    return { 
      valid: false, 
      reason: `Confidence ${(proposal.confidence * 100).toFixed(0)}% below threshold ${(policy.min_confidence_threshold * 100).toFixed(0)}%` 
    };
  }

  // Check territory restrictions
  if (proposal.territory) {
    if (policy.blocked_territories.includes(proposal.territory)) {
      return { valid: false, reason: `Territory "${proposal.territory}" is blocked` };
    }
    if (policy.allowed_territories.length > 0 && !policy.allowed_territories.includes(proposal.territory)) {
      return { valid: false, reason: `Territory "${proposal.territory}" is not allowed` };
    }
  }

  // Check blackout windows
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  for (const window of policy.blackout_windows) {
    if (currentTime >= window.start && currentTime <= window.end) {
      return { valid: false, reason: `Currently in blackout window (${window.start} - ${window.end})` };
    }
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useProposalSubscription() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['proposal-subscription'],
    queryFn: async () => {
      const channel = supabase
        .channel('proposal-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dispatch_action_proposals' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['dispatch-proposals'] });
          }
        )
        .subscribe();

      return { channel };
    },
    staleTime: Infinity,
  });
}
