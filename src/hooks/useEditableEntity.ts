import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useToast } from '@/hooks/use-toast';
import { getEntityTable, DrillDownEntity } from '@/lib/drilldown';

interface UseEditableEntityOptions {
  entity: DrillDownEntity;
  entityId: string;
  onUpdate?: () => void;
}

export function useEditableEntity({ entity, entityId, onUpdate }: UseEditableEntityOptions) {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const updateField = useCallback(async (
    field: string,
    newValue: string | number | boolean | null,
    oldValue?: string | number | boolean | null
  ) => {
    if (!entityId) return;
    
    setIsSaving(true);
    try {
      const tableName = getEntityTable(entity);
      
      const { error } = await (supabase as any)
        .from(tableName)
        .update({ [field]: newValue })
        .eq('id', entityId);

      if (error) throw error;

      // Log the audit event
      await logAction({
        action: 'update',
        entityType: entity,
        entityId,
        metadata: {
          field,
          old_value: oldValue,
          new_value: newValue,
        },
      });

      onUpdate?.();
      
      return true;
    } catch (error) {
      console.error('Failed to update field:', error);
      toast({
        title: 'Update failed',
        description: 'Could not save the change. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [entity, entityId, logAction, onUpdate, toast]);

  const updateMultipleFields = useCallback(async (
    updates: Record<string, { newValue: any; oldValue?: any }>
  ) => {
    if (!entityId) return false;
    
    setIsSaving(true);
    try {
      const tableName = getEntityTable(entity);
      const updatePayload = Object.fromEntries(
        Object.entries(updates).map(([field, { newValue }]) => [field, newValue])
      );
      
      const { error } = await (supabase as any)
        .from(tableName)
        .update(updatePayload)
        .eq('id', entityId);

      if (error) throw error;

      // Log audit events for each field
      for (const [field, { newValue, oldValue }] of Object.entries(updates)) {
        await logAction({
          action: 'update',
          entityType: entity,
          entityId,
          metadata: {
            field,
            old_value: oldValue,
            new_value: newValue,
          },
        });
      }

      onUpdate?.();
      toast({
        title: 'Saved',
        description: 'All changes have been saved.',
      });
      
      return true;
    } catch (error) {
      console.error('Failed to update fields:', error);
      toast({
        title: 'Update failed',
        description: 'Could not save changes. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [entity, entityId, logAction, onUpdate, toast]);

  return {
    updateField,
    updateMultipleFields,
    isSaving,
  };
}
