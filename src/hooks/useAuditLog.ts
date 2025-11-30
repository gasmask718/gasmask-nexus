import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";
import type { Json } from "@/integrations/supabase/types";

type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'export' | 'login' | 'logout' | 'security';

interface AuditLogParams {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Json;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  role_type: string | null;
  metadata: Json | null;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = useCallback(async ({ action, entityType, entityId, metadata }: AuditLogParams) => {
    try {
      await supabase.from("audit_logs").insert([{
        user_id: user?.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata: metadata ?? null,
      }]);
    } catch (error) {
      console.error("Failed to log audit action:", error);
    }
  }, [user?.id]);

  const logSecurityEvent = useCallback(async (action: string, details?: Json) => {
    try {
      await supabase.rpc('log_security_event', {
        p_action: action,
        p_details: details ?? null
      });
    } catch (error) {
      console.error("Failed to log security event:", error);
    }
  }, []);

  const getAuditSummary = useCallback(async (limit = 100): Promise<AuditLogEntry[]> => {
    try {
      const { data, error } = await supabase.rpc('get_audit_summary', { p_limit: limit });
      if (error) throw error;
      return (data as AuditLogEntry[]) ?? [];
    } catch (error) {
      console.error("Failed to fetch audit summary:", error);
      return [];
    }
  }, []);

  return { logAction, logSecurityEvent, getAuditSummary };
}
