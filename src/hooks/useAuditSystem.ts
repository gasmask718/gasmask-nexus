import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  actor_user_id: string | null;
  actor_role: string | null;
  changed_fields: string[] | null;
  source: string | null;
  created_at: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
}

interface IntegrityCheck {
  table_name: string;
  rows_checked: number;
  broken_links: number;
}

interface SearchParams {
  tableName?: string;
  action?: string;
  actorRole?: string;
  actorUserId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export function useAuditSearch(params: SearchParams) {
  return useQuery({
    queryKey: ['audit-search', params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_audit_logs', {
        p_table_name: params.tableName || null,
        p_action: params.action || null,
        p_actor_role: params.actorRole || null,
        p_actor_user_id: params.actorUserId || null,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_limit: params.limit || 100,
        p_offset: params.offset || 0,
      });
      if (error) throw error;
      return (data as AuditLogEntry[]) || [];
    },
  });
}

export function useAuditTrail(tableName: string, recordId: string) {
  return useQuery({
    queryKey: ['audit-trail', tableName, recordId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_audit_trail', {
        p_table_name: tableName,
        p_record_id: recordId,
      });
      if (error) throw error;
      return (data as AuditLogEntry[]) || [];
    },
    enabled: !!tableName && !!recordId,
  });
}

export function useAuditIntegrity() {
  return useQuery({
    queryKey: ['audit-integrity'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_audit_integrity');
      if (error) throw error;
      return (data as IntegrityCheck[]) || [];
    },
  });
}

export function useAuditTables() {
  return useQuery({
    queryKey: ['audit-tables'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_audit_logs', {
        p_limit: 1000,
        p_offset: 0,
      });
      if (error) throw error;
      const tables = [...new Set((data || []).map((d: any) => d.table_name))];
      return tables.sort();
    },
  });
}
