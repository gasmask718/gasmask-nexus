/**
 * Governed Field Mutations (DEPRECATED - USE submitFieldChange ONLY)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * WARNING: These hooks call submitFieldChange() as the SINGLE entry point.
 * Do NOT add any direct inserts to field_submissions in this file.
 * ═══════════════════════════════════════════════════════════════════════════════
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
} from './types';
import { submitFieldChange, GOVERNANCE_STRICT_MODE } from './submitFieldChange';

/**
 * Fetch current state before mutation for payload_before diff tracking
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
 * Routes through submitFieldChange as SINGLE entry point
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
      
      // If user is a field role, route through governance
      if (user?.id && isFieldRole(role)) {
        const result = await submitFieldChange(
          {
            store_id,
            entity_type: 'brand_sticker',
            action_type: id ? 'update' : 'create',
            entity_id: id,
            payload_before: payloadBefore || undefined,
            payload_after: payloadAfter,
          },
          user.id,
          role as FieldRole
        );
        
        // In STRICT mode, do NOT execute mutation - return early
        if (GOVERNANCE_STRICT_MODE) {
          if (!result.success) {
            throw new Error(result.error || 'Governance submission failed');
          }
          return { governed: true, submissionId: result.submissionId };
        }
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
      queryClient.invalidateQueries({ queryKey: ['field-submissions'] });
      if (GOVERNANCE_STRICT_MODE) {
        toast.info('Change submitted for review');
      } else {
        toast.success('Sticker status updated');
      }
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
 * Routes through submitFieldChange as SINGLE entry point
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
      
      // If user is a field role, route through governance
      const effectiveRole = payloadRole || role;
      if (user?.id && isFieldRole(effectiveRole)) {
        const result = await submitFieldChange(
          {
            store_id,
            entity_type: 'tube_inventory',
            action_type: id ? 'update' : 'create',
            entity_id: id,
            payload_before: payloadBefore || undefined,
            payload_after: payloadAfter,
          },
          user.id,
          effectiveRole as FieldRole
        );
        
        // In STRICT mode, do NOT execute mutation - return early
        if (GOVERNANCE_STRICT_MODE) {
          if (!result.success) {
            throw new Error(result.error || 'Governance submission failed');
          }
          return { governed: true, submissionId: result.submissionId };
        }
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
      queryClient.invalidateQueries({ queryKey: ['field-submissions'] });
      if (GOVERNANCE_STRICT_MODE) {
        toast.info('Change submitted for review');
      } else {
        toast.success('Updated');
      }
    },
    onError: (error: Error) => {
      const parsed = parseRLSError(error);
      toast.error(parsed.title, { description: parsed.description });
    },
  });
}
