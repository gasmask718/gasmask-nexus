// Phase 8: Confidence Correction Hook
// Fetch and apply human-approved confidence correction profiles
// Display-only (no effect on scoring, sorting, or dispatch logic)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';

export interface ConfidenceCorrection {
  id: string;
  scope_type: 'global' | 'sla' | 'risk' | 'territory';
  scope_value: string | null;
  confidence_min: number;
  confidence_max: number;
  display_offset: number;
  status: 'draft' | 'approved' | 'rejected' | 'rolled_back';
  notes: string | null;
  created_at: string;
  created_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rolled_back_at: string | null;
  rolled_back_by: string | null;
}

export interface TranslatedConfidence {
  raw: number;
  displayed: number;
  corrected: boolean;
  appliedCorrectionId?: string;
}

export function useConfidenceCorrections() {
  const queryClient = useQueryClient();

  // Fetch approved corrections (display translation)
  const { data: approvedCorrections = [], isLoading: isLoadingApproved } = useQuery({
    queryKey: ['confidence-corrections-approved'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_confidence_corrections')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ConfidenceCorrection[];
    },
  });

  // Fetch all corrections (admin view)
  const { data: allCorrections = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['confidence-corrections-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_confidence_corrections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ConfidenceCorrection[];
    },
  });

  // Translate raw confidence to display confidence using approved corrections
  const translateConfidence = useCallback(
    (
      raw: number,
      ctx?: { sla?: string; risk?: string; territory?: string }
    ): TranslatedConfidence => {
      // Deterministic matching: exact scope first, then global
      // Within scope: smallest range (more specific) wins
      let bestMatch: ConfidenceCorrection | null = null;
      let matchPriority = -1;

      for (const correction of approvedCorrections) {
        // Check if raw confidence is in range
        if (raw < correction.confidence_min || raw > correction.confidence_max) {
          continue;
        }

        let priority = 0;

        // Exact scope matches get highest priority
        if (correction.scope_type === 'sla' && ctx?.sla === correction.scope_value) {
          priority = 100;
        } else if (correction.scope_type === 'risk' && ctx?.risk === correction.scope_value) {
          priority = 100;
        } else if (correction.scope_type === 'territory' && ctx?.territory === correction.scope_value) {
          priority = 100;
        } else if (correction.scope_type === 'global') {
          priority = 50;
        }

        // Within same priority, prefer smaller range (more specific)
        const rangeSize = correction.confidence_max - correction.confidence_min;

        if (priority > matchPriority || (priority === matchPriority && (!bestMatch || rangeSize < (bestMatch.confidence_max - bestMatch.confidence_min)))) {
          matchPriority = priority;
          bestMatch = correction;
        }
      }

      if (!bestMatch) {
        return { raw, displayed: raw, corrected: false };
      }

      // Apply offset and clamp to 0–100
      const displayed = Math.max(0, Math.min(100, raw + bestMatch.display_offset));

      return {
        raw,
        displayed,
        corrected: true,
        appliedCorrectionId: bestMatch.id,
      };
    },
    [approvedCorrections]
  );

  // Create draft correction
  const createDraft = useMutation({
    mutationFn: async (correction: Omit<ConfidenceCorrection, 'id' | 'created_at' | 'created_by' | 'status' | 'approved_at' | 'approved_by' | 'rejected_at' | 'rejected_by' | 'rolled_back_at' | 'rolled_back_by'>) => {
      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('ai_confidence_corrections')
        .insert({
          ...correction,
          status: 'draft',
          created_by: user.user?.id || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidence-corrections-all'] });
    },
  });

  // Approve correction
  const approveDraft = useMutation({
    mutationFn: async (id: string) => {
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ai_confidence_corrections')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.user?.id || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidence-corrections-all'] });
      queryClient.invalidateQueries({ queryKey: ['confidence-corrections-approved'] });
    },
  });

  // Reject correction
  const rejectDraft = useMutation({
    mutationFn: async (id: string) => {
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ai_confidence_corrections')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: user.user?.id || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidence-corrections-all'] });
    },
  });

  // Rollback approved correction
  const rollbackApproved = useMutation({
    mutationFn: async (id: string) => {
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ai_confidence_corrections')
        .update({
          status: 'rolled_back',
          rolled_back_at: new Date().toISOString(),
          rolled_back_by: user.user?.id || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidence-corrections-all'] });
      queryClient.invalidateQueries({ queryKey: ['confidence-corrections-approved'] });
    },
  });

  const draftCorrections = useMemo(
    () => allCorrections.filter(c => c.status === 'draft'),
    [allCorrections]
  );

  const rejectedCorrections = useMemo(
    () => allCorrections.filter(c => c.status === 'rejected'),
    [allCorrections]
  );

  const rolledBackCorrections = useMemo(
    () => allCorrections.filter(c => c.status === 'rolled_back'),
    [allCorrections]
  );

  return {
    // Data
    approvedCorrections,
    allCorrections,
    draftCorrections,
    rejectedCorrections,
    rolledBackCorrections,

    // Loading states
    isLoading: isLoadingApproved || isLoadingAll,
    isLoadingApproved,
    isLoadingAll,

    // Display translation (no writes, read-only)
    translateConfidence,

    // Admin mutations
    createDraft,
    approveDraft,
    rejectDraft,
    rollbackApproved,
  };
}

export default useConfidenceCorrections;
