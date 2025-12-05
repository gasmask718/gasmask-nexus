// ═══════════════════════════════════════════════════════════════════════════════
// USE STORE AI INSIGHTS HOOK — React Query hooks for Customer Memory Core V3
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getStoreInsights, refreshStoreInsights, StoreAIInsights } from '@/services/storeInsightsService';

/**
 * Hook to fetch store AI insights
 */
export function useStoreAIInsights(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-ai-insights', storeId],
    queryFn: () => getStoreInsights(storeId!),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to refresh store AI insights
 */
export function useRefreshStoreAIInsights(storeId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error('Store ID required');
      return refreshStoreInsights(storeId);
    },
    onMutate: () => {
      toast.info('Refreshing AI insights...', { duration: 2000 });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('AI insights updated for this store');
        queryClient.invalidateQueries({ queryKey: ['store-ai-insights', storeId] });
      } else {
        toast.error(result.error || 'Failed to refresh AI insights');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to refresh AI insights: ${error.message}`);
    },
  });
}

export type { StoreAIInsights };
