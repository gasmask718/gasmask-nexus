// ═══════════════════════════════════════════════════════════════
// Hook: Generate & persist visit summaries + follow-up actions
// Triggered when a delivery checklist is completed
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateVisitSummary } from '@/lib/delivery/visitSummaryEngine';
import { evaluateFollowUpRules } from '@/lib/delivery/followupRulesEngine';
import type { DeliveryChecklist } from '@/hooks/useDeliveryChecklist';
import { toast } from 'sonner';

export function useVisitSummaries(storeId: string | undefined) {
  return useQuery({
    queryKey: ['visit-summaries', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await (supabase
        .from('delivery_visit_summaries' as any)
        .select('*')
        .eq('store_id', storeId)
        .order('visit_date', { ascending: false })
        .limit(20) as any);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!storeId,
  });
}

export function useFollowUpActions(storeId: string | undefined) {
  return useQuery({
    queryKey: ['followup-actions', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await (supabase
        .from('delivery_followup_actions' as any)
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50) as any);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!storeId,
  });
}

export function useGeneratePostVisitIntelligence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checklist: DeliveryChecklist) => {
      // 1. Generate deterministic summary
      const { summaryText, sections } = generateVisitSummary(checklist);

      // 2. Persist summary
      const { error: summaryError } = await (supabase
        .from('delivery_visit_summaries' as any)
        .upsert({
          checklist_id: checklist.id,
          store_id: checklist.store_id,
          user_id: checklist.user_id,
          visit_date: checklist.visit_date,
          summary_text: summaryText,
          summary_sections: sections as any,
          source: 'checklist_derived',
        }, {
          onConflict: 'checklist_id',
          ignoreDuplicates: false,
        }) as any);

      if (summaryError) throw summaryError;

      // 3. Evaluate follow-up rules
      const followUpActions = evaluateFollowUpRules(checklist);

      // 4. Persist follow-up actions (batch insert)
      if (followUpActions.length > 0) {
        const rows = followUpActions.map(action => ({
          checklist_id: checklist.id,
          store_id: checklist.store_id,
          ...action,
        }));

        const { error: followUpError } = await (supabase
          .from('delivery_followup_actions' as any)
          .insert(rows) as any);

        if (followUpError) throw followUpError;
      }

      return { summaryText, followUpCount: followUpActions.length };
    },
    onSuccess: (result, checklist) => {
      queryClient.invalidateQueries({ queryKey: ['visit-summaries', checklist.store_id] });
      queryClient.invalidateQueries({ queryKey: ['followup-actions', checklist.store_id] });
      toast.success(`Visit summary generated with ${result.followUpCount} follow-up action(s)`);
    },
    onError: (error: Error) => {
      console.error('Failed to generate post-visit intelligence:', error);
      toast.error('Failed to generate visit summary');
    },
  });
}
