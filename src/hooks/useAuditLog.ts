import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'export';

interface AuditLogParams {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = async ({ action, entityType, entityId, metadata }: AuditLogParams) => {
    try {
      await (supabase as any).from("audit_logs").insert({
        user_id: user?.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      });
    } catch (error) {
      console.error("Failed to log audit action:", error);
    }
  };

  return { logAction };
}
