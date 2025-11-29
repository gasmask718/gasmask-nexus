import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityLog {
  id: string;
  org_id: string;
  user_id: string | null;
  activity_type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export function useActivityLogs(orgId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['activity-logs', orgId, limit],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('org_activity_logs')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(log => ({
        ...log,
        metadata: (log.metadata as Record<string, unknown>) || {},
      })) as ActivityLog[];
    },
    enabled: !!orgId,
  });
}

export function useLogActivity(orgId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      activity_type: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!orgId) throw new Error('No organization');

      const { error } = await (supabase as any)
        .from('org_activity_logs')
        .insert({
          org_id: orgId,
          user_id: user?.id,
          activity_type: data.activity_type,
          description: data.description,
          metadata: data.metadata || {},
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs', orgId] });
    },
  });
}
