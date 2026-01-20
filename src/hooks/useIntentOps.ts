/**
 * Hook for Intent Operations & Governance Console
 * Phase 4: Controlled Autonomy & Intent Resolution
 * Phase 5 Integration: Shadow Mode observation
 * 
 * Schema-aligned with actual database structure
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import {
  recordHumanDecision,
  getLatestRecommendationForIntent,
} from '@/lib/phase5Engine';

// Intent Review Queue item - aligned with intent_envelopes schema
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
  autonomy_envelope_id: string | null;
}

// Conflict log entry - aligned with conflict_logs schema
export interface ConflictLogEntry {
  id: string;
  conflict_class: string;
  conflict_type: string;
  primary_intent_id: string | null;
  intent_ids: string[];
  description: string;
  conflicting_values: Record<string, unknown>;
  resolution_method: string | null;
  resolution_explanation: string | null;
  winning_intent_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  requires_human_review: boolean;
  severity: string | null;
  detected_at: string;
}

// Intent resolution details - aligned with intent_resolutions schema
export interface IntentResolutionDetail {
  id: string;
  intent_id: string;
  outcome: string;
  reason_codes: string[];
  explanation: string | null;
  was_auto_resolved: boolean;
  override_by: string | null;
  override_reason: string | null;
  override_at: string | null;
  resolved_at: string | null;
  competing_intent_ids: string[];
  confidence_score: number | null;
  evidence_score: number | null;
  trust_score: number | null;
  conflict_resolution_method: string | null;
  resolution_rules_applied: string[];
  why_this_intent_won: string | null;
  original_effect: Record<string, unknown> | null;
  modified_effect: Record<string, unknown> | null;
}

// Autonomy envelope - aligned with autonomy_envelopes schema
export interface AutonomyEnvelopeDetail {
  id: string;
  envelope_name: string;
  description: string | null;
  portal_type: string;
  allowed_intent_types: string[];
  max_impact: Record<string, unknown>;
  required_evidence: string[];
  decision_thresholds: Record<string, unknown>;
  escalation_rules: Record<string, unknown>;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  core_signature: string | null;
}

export function useIntentOps() {
  const queryClient = useQueryClient();
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);

  // Fetch pending/escalated intents for review queue
  const {
    data: reviewQueue,
    isLoading: isLoadingQueue,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ['intent-review-queue'],
    queryFn: async () => {
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
        autonomy_envelope_id: row.autonomy_envelope_id,
      })) as IntentReviewItem[];
    },
  });

  // Fetch conflict logs - using actual schema fields
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
        conflict_type: row.conflict_type,
        primary_intent_id: row.primary_intent_id,
        intent_ids: row.intent_ids || [],
        description: row.description,
        conflicting_values: (row.conflicting_values as Record<string, unknown>) || {},
        resolution_method: row.resolution_method,
        resolution_explanation: row.resolution_explanation,
        winning_intent_id: row.winning_intent_id,
        resolved_at: row.resolved_at,
        resolved_by: row.resolved_by,
        requires_human_review: row.requires_human_review ?? false,
        severity: row.severity,
        detected_at: row.detected_at || new Date().toISOString(),
      })) as ConflictLogEntry[];
    },
  });

  // Fetch resolution details for a specific intent
  const fetchResolutionDetail = useCallback(async (intentId: string): Promise<{
    resolution: IntentResolutionDetail;
    autonomyEnvelope: AutonomyEnvelopeDetail | null;
  }> => {
    // First get the resolution
    const { data: resolutionData, error: resolutionError } = await supabase
      .from('intent_resolutions')
      .select('*')
      .eq('intent_id', intentId)
      .single();

    if (resolutionError) throw resolutionError;

    // Get the intent envelope to find the autonomy_envelope_id
    const { data: intentData } = await supabase
      .from('intent_envelopes')
      .select('autonomy_envelope_id')
      .eq('intent_id', intentId)
      .single();

    // Fetch autonomy envelope if linked
    let envelope: AutonomyEnvelopeDetail | null = null;
    const envelopeId = intentData?.autonomy_envelope_id;
    
    if (envelopeId) {
      const { data: envData } = await supabase
        .from('autonomy_envelopes')
        .select('*')
        .eq('id', envelopeId)
        .single();

      if (envData) {
        envelope = {
          id: envData.id,
          envelope_name: envData.envelope_name,
          description: envData.description,
          portal_type: envData.portal_type,
          allowed_intent_types: envData.allowed_intent_types || [],
          max_impact: (envData.max_impact as Record<string, unknown>) || {},
          required_evidence: envData.required_evidence || [],
          decision_thresholds: (envData.decision_thresholds as Record<string, unknown>) || {},
          escalation_rules: (envData.escalation_rules as Record<string, unknown>) || {},
          valid_from: envData.valid_from,
          valid_until: envData.valid_until,
          is_active: envData.is_active ?? true,
          core_signature: envData.core_signature,
        };
      }
    }

    return {
      resolution: {
        id: resolutionData.id,
        intent_id: resolutionData.intent_id,
        outcome: resolutionData.outcome,
        reason_codes: resolutionData.reason_codes || [],
        explanation: resolutionData.explanation,
        was_auto_resolved: resolutionData.was_auto_resolved ?? true,
        override_by: resolutionData.override_by,
        override_reason: resolutionData.override_reason,
        override_at: resolutionData.override_at,
        resolved_at: resolutionData.resolved_at,
        competing_intent_ids: resolutionData.competing_intent_ids || [],
        confidence_score: resolutionData.confidence_score,
        evidence_score: resolutionData.evidence_score,
        trust_score: resolutionData.trust_score,
        conflict_resolution_method: resolutionData.conflict_resolution_method,
        resolution_rules_applied: resolutionData.resolution_rules_applied || [],
        why_this_intent_won: resolutionData.why_this_intent_won,
        original_effect: (resolutionData.original_effect as Record<string, unknown>) || null,
        modified_effect: (resolutionData.modified_effect as Record<string, unknown>) || null,
      },
      autonomyEnvelope: envelope,
    };
  }, []);

  // Approve intent mutation - with Phase 5 tracking
  const approveMutation = useMutation({
    mutationFn: async ({ intentId, notes }: { intentId: string; notes?: string }) => {
      const { error: intentError } = await supabase
        .from('intent_envelopes')
        .update({ status: 'accepted' })
        .eq('intent_id', intentId);

      if (intentError) throw intentError;

      // Phase 5: Record human decision for agreement tracking
      const recommendation = await getLatestRecommendationForIntent(intentId);
      if (recommendation) {
        await recordHumanDecision(recommendation.id, intentId, 'approve', notes);
      }

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

  // Reject intent mutation - with Phase 5 tracking
  const rejectMutation = useMutation({
    mutationFn: async ({ intentId, reason }: { intentId: string; reason: string }) => {
      const { error: intentError } = await supabase
        .from('intent_envelopes')
        .update({ status: 'rejected' })
        .eq('intent_id', intentId);

      if (intentError) throw intentError;

      // Phase 5: Record human decision for agreement tracking
      const recommendation = await getLatestRecommendationForIntent(intentId);
      if (recommendation) {
        await recordHumanDecision(recommendation.id, intentId, 'reject', reason);
      }

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

  // Amend intent mutation - with Phase 5 tracking
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

      // Phase 5: Record human decision for agreement tracking
      const recommendation = await getLatestRecommendationForIntent(intentId);
      if (recommendation) {
        await recordHumanDecision(recommendation.id, intentId, 'amend', notes);
      }

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
