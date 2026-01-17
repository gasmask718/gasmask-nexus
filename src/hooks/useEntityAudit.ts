import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * OS-Grade Entity Audit Hook
 * Logs all entity changes to the entity_audit_log table for complete traceability.
 */

interface AuditEntry {
  entity_type: string;
  entity_id: string;
  field_changed: string;
  old_value: any;
  new_value: any;
}

export function useEntityAudit() {
  const { user } = useAuth();

  const logChange = useCallback(async (entry: AuditEntry) => {
    try {
      await supabase.from('entity_audit_log').insert({
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        field_changed: entry.field_changed,
        old_value: entry.old_value,
        new_value: entry.new_value,
        edited_by: user?.id || null,
      });
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }, [user?.id]);

  const logMultipleChanges = useCallback(async (
    entityType: string,
    entityId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>
  ) => {
    const changes: AuditEntry[] = [];
    
    for (const key of Object.keys(newData)) {
      const oldValue = oldData[key];
      const newValue = newData[key];
      
      // Only log if value actually changed
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          entity_type: entityType,
          entity_id: entityId,
          field_changed: key,
          old_value: oldValue ?? null,
          new_value: newValue ?? null,
        });
      }
    }

    if (changes.length > 0) {
      try {
        await supabase.from('entity_audit_log').insert(
          changes.map(c => ({
            entity_type: c.entity_type,
            entity_id: c.entity_id,
            field_changed: c.field_changed,
            old_value: c.old_value,
            new_value: c.new_value,
            edited_by: user?.id || null,
          }))
        );
      } catch (error) {
        console.error('Failed to log audit entries:', error);
      }
    }

    return changes.length;
  }, [user?.id]);

  const getEntityHistory = useCallback(async (entityType: string, entityId: string) => {
    const { data, error } = await supabase
      .from('entity_audit_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to fetch entity history:', error);
      return [];
    }

    return data || [];
  }, []);

  return {
    logChange,
    logMultipleChanges,
    getEntityHistory,
  };
}
