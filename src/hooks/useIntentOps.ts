/**
 * Hook for Intent Operations & Governance Console
 * Phase 4: Controlled Autonomy & Intent Resolution
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// Intent Review Queue item
export interface IntentReviewItem {
  id: string;
  intent_id: string;
  intent_type: string;
  portal_type: string;
  user_id: string;
  device_id: string;
  assignment_id: string | null;
  status: string;
  confidence_level: number | null;
  proposed_effect: Record<string, unknown>;
  constraints_seen: string[];
  client_timestamp: string;
  created_at: string;
  priority: number;
  review_reason: string | null;
}

// Conflict log entry
export interface ConflictLogEntry {
  id: string;
  conflict_class: string;
  primary_intent_id: string;
  conflicting_intent_ids: string[];
  explanation: string;
  resolution_action: string | null;
  resolved_at: string | null;
  created_at: string;
}

// Intent resolution details for inspector
export interface IntentResolutionDetail {
  id: string;
  intent_id: string;
  outcome: string;
  reason_codes: string[];
  explanation: string;
  was_auto_resolved: boolean;
  override_by: string | null;
  override_reason: string | null;
  autonomy_envelope_id: string | null;
  created_at: string;
}

// Autonomy envelope for resolution inspector
export interface AutonomyEnvelopeDetail {
  id: string;
  envelope_name: string;
  allowed_intent_types: string[];
  max_impact: Record<string, number>;
  required_evidence: string[];
  valid_until: string | null;
  is_active: boolean;
}

export function useIntentOps() {
  const queryClient = useQueryClient();
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);

  // Fetch pending/escalated intents for review queue (join with intent_envelopes)
  const {
    data: reviewQueue,
    isLoading: isLoadingQueue,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ['intent-review-queue'],
    queryFn: async () => {
      // Fetch from intent_envelopes directly with escalated/pending status
      const { data, error } = await supabase
        .from('intent_envelopes')
        .select('*')
        .in('status', ['pending', 'escalated'])
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        intent_id: row.intent_id,
        intent_type: row.intent_type,
        portal_type: row.portal_type,
        user_id: row.user_id,
        device_id: row.device_id,
        assignment_id: row.assignment_id,
        status: row.status,
        confidence_level: row.confidence_level,
        proposed_effect: (row.proposed_effect as Record<string, unknown>) || {},
        constraints_seen: row.constraints_seen || [],
        client_timestamp: row.client_timestamp,
        created_at: row.created_at || row.client_timestamp,
        priority: row.status === 'escalated' ? 8 : 3,
        review_reason: row.status === 'escalated' ? 'Escalated for review' : null,
      })) as IntentReviewItem[];
    },
  });

  // Fetch conflict logs
  const {
    data: conflictLogs,
    isLoading: isLoadingConflicts,
    refetch: refetchConflicts,
  } = useQuery({
    queryKey: ['intent-conflict-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conflict_logs')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        conflict_class: row.conflict_class,
        primary_intent_id: row.primary_intent_id,
        conflicting_intent_ids: row.secondary_intent_ids || [],
        explanation: row.description || '',
        resolution_action: row.resolution_strategy,
        resolved_at: row.resolved_at,
        created_at: row.detected_at,
      })) as ConflictLogEntry[];
    },
  });

  // Fetch resolution details for a specific intent
  const fetchResolutionDetail = useCallback(async (intentId: string) => {
    const { data, error } = await supabase
      .from('intent_resolutions')
      .select('*')
      .eq('intent_id', intentId)
      .single();

    if (error) throw error;

    // Fetch autonomy envelope separately if exists
    let envelope: AutonomyEnvelopeDetail | null = null;
    if (data.used_envelope_id) {
      const { data: envData } = await supabase
        .from('autonomy_envelopes')
        .select('*')
        .eq('id', data.used_envelope_id)
        .single();

      if (envData) {
        envelope = {
          id: envData.id,
          envelope_name: envData.envelope_name,
          allowed_intent_types: envData.allowed_intent_types || [],
          max_impact: (envData.max_impact as Record<string, number>) || {},
          required_evidence: envData.required_evidence || [],
          valid_until: envData.valid_until,
          is_active: envData.is_active ?? true,
        };
      }
    }

    return {
      resolution: {
        id: data.id,
        intent_id: data.intent_id,
        outcome: data.outcome,
        reason_codes: data.reason_codes || [],
        explanation: data.explanation || '',
        was_auto_resolved: data.was_auto_resolved ?? true,
        override_by: data.override_by,
        override_reason: data.override_reason,
        autonomy_envelope_id: data.used_envelope_id,
        created_at: data.resolved_at || data.intent_id,
      } as IntentResolutionDetail,
      autonomyEnvelope: envelope,
    };
  }, []);

  // Approve intent mutation
  const approveMutation = useMutation({
    mutationFn: async ({ intentId, notes }: { intentId: string; notes?: string }) => {
      const { error: intentError } = await supabase
        .from('intent_envelopes')
        .update({ status: 'accepted' })
        .eq('intent_id', intentId);

      if (intentError) throw intentError;
      return intentId;
    },
    onSuccess: () => {
      toast.success('Intent approved');
      queryClient.invalidateQueries({ queryKey: ['intent-review-queue'] });
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  // Reject intent mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ intentId, reason }: { intentId: string; reason: string }) => {
      const { error: intentError } = await supabase
        .from('intent_envelopes')
        .update({ status: 'rejected' })
        .eq('intent_id', intentId);

      if (intentError) throw intentError;
      return intentId;
    },
    onSuccess: () => {
      toast.success('Intent rejected');
      queryClient.invalidateQueries({ queryKey: ['intent-review-queue'] });
    },
    onError: (error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  // Amend intent mutation
  const amendMutation = useMutation({
    mutationFn: async ({
      intentId,
      amendedEffect,
      notes,
    }: {
      intentId: string;
      amendedEffect: Record<string, unknown>;
      notes: string;
    }) => {
      const { error: intentError } = await supabase
        .from('intent_envelopes')
        .update({
          status: 'modified',
          proposed_effect: amendedEffect as Json,
        })
        .eq('intent_id', intentId);

      if (intentError) throw intentError;
      return intentId;
    },
    onSuccess: () => {
      toast.success('Intent amended and applied');
      queryClient.invalidateQueries({ queryKey: ['intent-review-queue'] });
    },
    onError: (error) => {
      toast.error(`Failed to amend: ${error.message}`);
    },
  });

  return {
    reviewQueue: reviewQueue || [],
    isLoadingQueue,
    refetchQueue,
    conflictLogs: conflictLogs || [],
    isLoadingConflicts,
    refetchConflicts,
    selectedIntentId,
    setSelectedIntentId,
    fetchResolutionDetail,
    approveIntent: approveMutation.mutate,
    rejectIntent: rejectMutation.mutate,
    amendIntent: amendMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isAmending: amendMutation.isPending,
  };
}
