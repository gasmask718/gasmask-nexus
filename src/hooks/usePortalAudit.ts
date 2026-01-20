import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type PortalActionType = 
  | 'login' 
  | 'logout' 
  | 'visit_start' 
  | 'visit_complete' 
  | 'delivery_start'
  | 'delivery_complete' 
  | 'proof_upload'
  | 'shift_start'
  | 'shift_end'
  | 'portal_access';

interface AuditLogParams {
  portalType: 'driver' | 'biker';
  actionType: PortalActionType;
  entityType?: 'store' | 'route' | 'delivery' | 'session';
  entityId?: string;
  metadata?: { [key: string]: string | number | boolean | null };
}

/**
 * Hook for logging portal audit events
 * All driver/biker actions are tracked for governance
 */
export function usePortalAudit() {
  const { user } = useAuth();

  const logAction = useCallback(async (params: AuditLogParams) => {
    if (!user) return;

    try {
      await supabase.from('portal_audit_log').insert([{
        user_id: user.id,
        portal_type: params.portalType,
        action_type: params.actionType,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        metadata: (params.metadata || null) as { [key: string]: string | number | boolean | null } | null
      }]);
    } catch (error) {
      console.error('Audit log failed:', error);
    }
  }, [user]);

  return { logAction };
}
