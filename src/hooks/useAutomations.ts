import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to subscribe to realtime automation logs
 * Automatically refreshes queries when new automation logs are created
 */
export const useAutomationRealtime = (businessId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!businessId) return;

    console.log('🔄 Setting up automation realtime subscription...');

    const channel = supabase
      .channel('automation-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'automation_logs',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          console.log('🎯 Automation log event:', payload);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
          queryClient.invalidateQueries({ queryKey: ['communication-logs-crm'] });
          queryClient.invalidateQueries({ queryKey: ['communication-all-logs'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient]);
};
