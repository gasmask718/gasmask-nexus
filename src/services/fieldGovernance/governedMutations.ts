/**
 * Governed Field Mutations
 * 
 * Wrappers that route field role mutations through the governance pipeline.
 * These are used by useBrandStickers and useTubeIntelligence when the
 * current user is a field role (driver, biker, ambassador).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseRLSError } from '@/lib/rls-error-handler';
import {
  isFieldRole,
  FieldRole,
  getSubmissionSource,
} from './types';

/**
 * Fetch current state before mutation for diff tracking
 */
async function fetchCurrentState(
  table: string,
  id: string
): Promise<Record<string, unknown> | null> {
  if (!id) return null;
  
  try {
    const { data, error } = await supabase
      .from(table as 'store_brand_stickers' | 'store_tube_inventory_status')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Create a field submission record
 */
async function createFieldSubmission(params: {
  userId: string;
  role: FieldRole;
  storeId: string;
  entityType: 'brand_sticker' | 'tube_inventory';
  entityId?: string;
  actionType: 'create' | 'update';
  payloadBefore: Record<string, unknown> | null;
  payloadAfter: Record<string, unknown>;
}): Promise<{ id: string } | null> {
  try {
    const insertData = {
      submitted_by_user_id: params.userId,
      submitted_by_role: params.role,
      store_id: params.storeId,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      action_type: params.actionType,
      payload_before: params.payloadBefore as unknown,
      payload_after: params.payloadAfter as unknown,
      submission_source: getSubmissionSource(params.role),
      submission_status: 'auto_approved' as const,
      is_applied: true,
    };

    const { data, error } = await supabase
      .from('field_submissions')
      // @ts-expect-error - columns match DB schema but types are strict
      .insert([insertData])
      .select('id')
      .single();
    
    if (error) {
      console.error('Failed to create field submission:', error);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('Field submission error:', e);
    return null;
  }
}

export interface GovernedBrandStickerUpdate {
  id?: string;
  store_id: string;
  brand_name: string;
  sticker_type: string;
  value: boolean;
  role?: string;
  updateData: Record<string, unknown>;
}

/**
 * Hook for governed brand sticker updates
 * Creates a field_submission record before/after the mutation
 */
export function useGovernedBrandStickerUpdate(storeId: string | null) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: GovernedBrandStickerUpdate) => {
      const { id, store_id, sticker_type, value, updateData } = payload;
      
      // Fetch current state for diff
      const payloadBefore = id ? await fetchCurrentState('store_brand_stickers', id) : null;
      
      // Prepare payload_after
      const payloadAfter = {
        sticker_type,
        value,
        ...updateData,
      };
      
      // If user is a field role, create submission record
      if (user?.id && isFieldRole(role)) {
        await createFieldSubmission({
          userId: user.id,
          role: role as FieldRole,
          storeId: store_id,
          entityType: 'brand_sticker',
          entityId: id,
          actionType: id ? 'update' : 'create',
          payloadBefore,
          payloadAfter,
        });
      }
      
      // Execute the actual mutation
      if (id) {
        const { error } = await supabase
          .from('store_brand_stickers')
          .update(updateData)
          .eq('id', id);
        
        if (error) throw error;
      } else {
        // Insert handled by caller
        throw new Error('Insert not supported through governed update');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-stickers', storeId] });
      toast.success('Sticker status updated');
    },
    onError: (error: Error) => {
      const parsed = parseRLSError(error);
      toast.error(parsed.title, { description: parsed.description });
    },
  });
}

export interface GovernedTubeIntelUpdate {
  id?: string;
  store_id: string;
  brand_id: string;
  brand_name?: string;
  field: string;
  value: boolean | null;
  role?: string;
}

/**
 * Hook for governed tube intelligence updates
 * Creates a field_submission record before/after the mutation
 */
export function useGovernedTubeIntelUpdate(storeId: string | null) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: GovernedTubeIntelUpdate) => {
      const { id, store_id, brand_id, brand_name, field, value, role: payloadRole } = payload;
      
      // Fetch current state for diff
      const payloadBefore = id ? await fetchCurrentState('store_tube_inventory_status', id) : null;
      
      // Prepare payload_after
      const payloadAfter = {
        brand_id,
        field,
        value,
      };
      
      // If user is a field role, create submission record
      const effectiveRole = payloadRole || role;
      if (user?.id && isFieldRole(effectiveRole)) {
        await createFieldSubmission({
          userId: user.id,
          role: effectiveRole as FieldRole,
          storeId: store_id,
          entityType: 'tube_inventory',
          entityId: id,
          actionType: id ? 'update' : 'create',
          payloadBefore,
          payloadAfter,
        });
      }
      
      // Execute the actual mutation
      if (id) {
        const { error } = await supabase
          .from('store_tube_inventory_status')
          .update({ 
            [field]: value,
            last_updated_by_role: effectiveRole || null,
          })
          .eq('id', id);
        
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('store_tube_inventory_status')
          .insert({
            store_id,
            brand_id,
            brand_name: brand_name || brand_id,
            [field]: value,
            last_updated_by_role: effectiveRole || null,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
      toast.success('Updated');
    },
    onError: (error: Error) => {
      const parsed = parseRLSError(error);
      toast.error(parsed.title, { description: parsed.description });
    },
  });
}
