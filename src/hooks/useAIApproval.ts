// src/hooks/useAIApproval.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type ApprovalRequestType = 'automation' | 'payout' | 'schema_change' | 'permission_change';
export type ApprovalSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

interface ApprovalRequest {
  id: string;
  request_type: string;
  action_description: string;
  requested_by: string | null;
  ai_worker_id: string | null;
  payload: Json;
  severity: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  expires_at: string | null;
  created_at: string;
}

export function useAIApprovalQueue() {
  return useQuery({
    queryKey: ['ai-approval-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_approval_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ApprovalRequest[];
    },
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['ai-approval-queue', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_approval_queue')
        .select('*')
        .eq('status', 'pending')
        .order('severity', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ApprovalRequest[];
    },
    refetchInterval: 30000, // Check every 30 seconds
  });
}

export function useRequestAIApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requestType: ApprovalRequestType;
      actionDescription: string;
      payload?: Json;
      severity?: ApprovalSeverity;
      aiWorkerId?: string;
    }) => {
      const { data, error } = await supabase.rpc('request_ai_approval', {
        p_request_type: params.requestType,
        p_action_description: params.actionDescription,
        p_payload: params.payload ?? {},
        p_severity: params.severity ?? 'medium',
        p_ai_worker_id: params.aiWorkerId ?? null,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-approval-queue'] });
      toast.success('Approval request submitted');
    },
    onError: (error) => {
      console.error('Failed to request approval:', error);
      toast.error('Failed to submit approval request');
    },
  });
}

export function useProcessApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requestId: string;
      approved: boolean;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('process_ai_approval', {
        p_request_id: params.requestId,
        p_approved: params.approved,
        p_notes: params.notes ?? null,
      });

      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-approval-queue'] });
      toast.success(variables.approved ? 'Request approved' : 'Request rejected');
    },
    onError: (error) => {
      console.error('Failed to process approval:', error);
      toast.error('Failed to process approval');
    },
  });
}

// Helper to check if action requires approval
export function requiresApproval(actionType: string): boolean {
  const requiresApprovalTypes = [
    'payout',
    'schema_change',
    'permission_change',
    'bulk_delete',
    'data_migration',
    'financial_adjustment',
  ];
  return requiresApprovalTypes.includes(actionType);
}
