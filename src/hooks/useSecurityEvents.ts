import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SecurityEvent {
  id: string;
  user_id: string | null;
  device_id: string | null;
  session_id: string | null;
  portal_type: 'driver' | 'biker' | null;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  event_message: string;
  ip_address: string | null;
  location: { lat: number; lng: number; accuracy: number } | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
}

interface SecurityEventsFilters {
  severity?: 'info' | 'warning' | 'critical';
  eventType?: string;
  portalType?: 'driver' | 'biker';
  userId?: string;
  acknowledged?: boolean;
  limit?: number;
}

/**
 * Hook for fetching and managing security events
 * Used by the Security Console in the core OS
 */
export function useSecurityEvents(filters?: SecurityEventsFilters) {
  const { user } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      let query = supabase
        .from('portal_security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }
      if (filters?.portalType) {
        query = query.eq('portal_type', filters.portalType);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.acknowledged !== undefined) {
        query = filters.acknowledged
          ? query.not('acknowledged_at', 'is', null)
          : query.is('acknowledged_at', null);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;
      setEvents(data as SecurityEvent[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch security events');
    } finally {
      setIsLoading(false);
    }
  }, [user, filters]);

  // Acknowledge an event
  const acknowledgeEvent = useCallback(async (eventId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('portal_security_events')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id,
        })
        .eq('id', eventId);

      if (error) throw error;
      
      // Refresh events
      await fetchEvents();
      return true;
    } catch (err) {
      console.error('Failed to acknowledge event:', err);
      return false;
    }
  }, [user, fetchEvents]);

  // Get event counts by severity
  const getEventCounts = useCallback(() => {
    return {
      total: events.length,
      critical: events.filter(e => e.severity === 'critical').length,
      warning: events.filter(e => e.severity === 'warning').length,
      info: events.filter(e => e.severity === 'info').length,
      unacknowledged: events.filter(e => !e.acknowledged_at).length,
    };
  }, [events]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('security-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'portal_security_events',
        },
        (payload) => {
          setEvents(prev => [payload.new as SecurityEvent, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    events,
    isLoading,
    error,
    fetchEvents,
    acknowledgeEvent,
    getEventCounts,
  };
}
