/**
 * useGovernedFieldMutation Hook
 * 
 * React hook for field governance mutations.
 * Provides a clean interface for components to submit governed changes.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { parseRLSError } from '@/lib/rls-error-handler';
import {
  FieldSubmissionPayload,
  FieldGovernanceResult,
  FieldRole,
  isFieldRole,
} from './types';
import { governedFieldMutation } from './submitFieldChange';

interface UseGovernedFieldMutationOptions<T> {
  /** Query keys to invalidate on success */
  invalidateKeys?: string[][];
  /** Callback on successful governance + mutation */
  onSuccess?: (result: T | null, governance: FieldGovernanceResult) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Whether to show toast notifications */
  showToast?: boolean;
}

/**
 * Hook for governed field mutations.
 * 
 * Usage:
 * ```tsx
 * const { mutate } = useGovernedFieldMutation(
 *   {
 *     entity_type: 'brand_sticker',
 *     action_type: 'update',
 *   },
 *   async (payload) => {
 *     // Your actual mutation logic
 *     await supabase.from('store_brand_stickers').update(payload.payload_after).eq('id', payload.entity_id);
 *   },
 *   { invalidateKeys: [['brand-stickers', storeId]] }
 * );
 * 
 * // Call the mutation
 * mutate({
 *   store_id: storeId,
 *   entity_id: stickerId,
 *   payload_before: { status: false },
 *   payload_after: { status: true },
 * });
 * ```
 */
export function useGovernedFieldMutation<T, P extends Partial<FieldSubmissionPayload>>(
  basePayload: Pick<FieldSubmissionPayload, 'entity_type' | 'action_type'>,
  mutationFn: (payload: FieldSubmissionPayload) => Promise<T>,
  options: UseGovernedFieldMutationOptions<T> = {}
) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  const { invalidateKeys = [], onSuccess, onError, showToast = true } = options;

  return useMutation({
    mutationFn: async (partialPayload: P & { store_id: string; payload_after: Record<string, unknown> }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Merge base payload with partial payload
      const fullPayload: FieldSubmissionPayload = {
        ...basePayload,
        store_id: partialPayload.store_id,
        payload_after: partialPayload.payload_after,
        entity_id: partialPayload.entity_id,
        payload_before: partialPayload.payload_before,
        submission_source: partialPayload.submission_source,
      };

      // Check if user is a field role
      if (!isFieldRole(role)) {
        // Non-field roles bypass governance (admin, va, etc.)
        const result = await mutationFn(fullPayload);
        return { result, governance: null };
      }

      // Field roles MUST go through governance
      const fieldRole = role as FieldRole;
      
      return governedFieldMutation(
        fullPayload,
        user.id,
        fieldRole,
        () => mutationFn(fullPayload)
      );
    },
    onSuccess: (data) => {
      // Invalidate related queries
      invalidateKeys.forEach((keys) => {
        queryClient.invalidateQueries({ queryKey: keys });
      });

      if (showToast) {
        if (data.governance?.status === 'pending_review') {
          toast.info('Change submitted for review');
        } else {
          toast.success('Updated');
        }
      }

      onSuccess?.(data.result, data.governance!);
    },
    onError: (error: Error) => {
      if (showToast) {
        const parsed = parseRLSError(error);
        toast.error(parsed.title, { description: parsed.description });
      }
      onError?.(error);
    },
  });
}

/**
 * Quick check if the current user needs governance
 */
export function useRequiresGovernance() {
  const { role } = useUserRole();
  return isFieldRole(role);
}
