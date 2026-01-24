import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export interface CanaryCallLog {
  id: string;
  session_id: string | null;
  business_id: string | null;
  prediction_id: string | null;
  entry_confidence: number;
  entry_trust_score: number;
  entry_accuracy_rate: number;
  callable_users_count: number;
  unresolved_calls_count: number;
  entry_reason: string;
  entry_conditions: Record<string, any>;
  call_risk_level: 'low' | 'medium' | 'high';
  call_type: string | null;
  outcome: string | null;
  outcome_reason: string | null;
  handoff_requested_at: string | null;
  handoff_completed_at: string | null;
  handoff_latency_ms: number | null;
  initial_sentiment: string | null;
  final_sentiment: string | null;
  sentiment_changed: boolean;
  ai_active_duration_seconds: number | null;
  total_duration_seconds: number | null;
  human_overrode: boolean;
  override_user_id: string | null;
  override_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanaryEscapeEvent {
  id: string;
  canary_log_id: string | null;
  session_id: string | null;
  business_id: string | null;
  escape_type: string;
  escape_trigger: string | null;
  escape_details: Record<string, any>;
  triggered_at: string;
  resolved_at: string | null;
  resolution_latency_ms: number | null;
  was_successful: boolean;
  failure_reason: string | null;
}

export interface CanaryStats {
  totalCanarycalls: number;
  successRate: number;
  avgHandoffLatency: number;
  escapesByType: Record<string, number>;
  activeCanaryCalls: number;
}

export function useCanaryCallLogs(businessId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['canary-call-logs', businessId, limit],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('canary_call_log')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as CanaryCallLog[];
    },
    enabled: !!businessId,
  });
}

export function useActiveCanaryCalls(businessId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['active-canary-calls', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('canary_call_log')
        .select(`
          *,
          session:ai_call_sessions(
            id, status, transcript, sentiment_trend, 
            store:store_master(id, store_name),
            persona:voice_personas(id, name, tone)
          )
        `)
        .eq('business_id', businessId)
        .is('outcome', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
    refetchInterval: 3000, // Poll every 3 seconds for active calls
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel(`canary-calls-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'canary_call_log',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['active-canary-calls', businessId] });
          queryClient.invalidateQueries({ queryKey: ['canary-call-logs', businessId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient]);

  return query;
}

export function useCanaryEscapeEvents(businessId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['canary-escape-events', businessId, limit],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('canary_escape_events')
        .select('*')
        .eq('business_id', businessId)
        .order('triggered_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as CanaryEscapeEvent[];
    },
    enabled: !!businessId,
  });
}

export function useCanaryStats(businessId: string | null) {
  return useQuery({
    queryKey: ['canary-stats', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      
      // Get all canary calls
      const { data: calls } = await supabase
        .from('canary_call_log')
        .select('outcome, handoff_latency_ms')
        .eq('business_id', businessId);

      // Get active calls
      const { data: activeCalls } = await supabase
        .from('canary_call_log')
        .select('id')
        .eq('business_id', businessId)
        .is('outcome', null);

      // Get escape events by type
      const { data: escapes } = await supabase
        .from('canary_escape_events')
        .select('escape_type')
        .eq('business_id', businessId);

      const total = calls?.length || 0;
      const successes = calls?.filter(c => c.outcome === 'success').length || 0;
      const latencies = calls?.filter(c => c.handoff_latency_ms).map(c => c.handoff_latency_ms!) || [];
      const avgLatency = latencies.length > 0 
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;

      const escapesByType: Record<string, number> = {};
      escapes?.forEach(e => {
        escapesByType[e.escape_type] = (escapesByType[e.escape_type] || 0) + 1;
      });

      return {
        totalCanarycalls: total,
        successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
        avgHandoffLatency: avgLatency,
        escapesByType,
        activeCanaryCalls: activeCalls?.length || 0,
      } as CanaryStats;
    },
    enabled: !!businessId,
  });
}

export function useTriggerCanaryEscape() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      sessionId,
      businessId,
      escapeType,
      escapeTrigger,
      escapeDetails,
      overrideUserId,
      overrideReason,
    }: {
      sessionId: string;
      businessId: string;
      escapeType: 'human_takeover' | 'caller_keyword' | 'timeout' | 'sentiment_drop' | 'confidence_drop' | 'admin_kill_switch' | 'system_error';
      escapeTrigger?: string;
      escapeDetails?: Record<string, any>;
      overrideUserId?: string;
      overrideReason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-ai-canary-escape', {
        body: {
          session_id: sessionId,
          business_id: businessId,
          escape_type: escapeType,
          escape_trigger: escapeTrigger,
          escape_details: escapeDetails,
          override_user_id: overrideUserId,
          override_reason: overrideReason,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-canary-calls'] });
      queryClient.invalidateQueries({ queryKey: ['canary-call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['canary-escape-events'] });
      queryClient.invalidateQueries({ queryKey: ['live-call-sessions'] });
      
      toast({
        title: "Call Transferred to Human",
        description: `Handoff completed in ${data.resolution_latency_ms}ms`,
      });
    },
    onError: (error) => {
      toast({
        title: "Escape Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useActivateKillSwitch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (businessId: string) => {
      // Activate kill switch
      const { error: configError } = await supabase
        .from('ai_call_agent_config')
        .update({ 
          canary_kill_switch: true,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId);

      if (configError) throw configError;

      // Get all active canary calls and escape them
      const { data: activeCalls } = await supabase
        .from('canary_call_log')
        .select('session_id')
        .eq('business_id', businessId)
        .is('outcome', null);

      // Trigger escape for each active call
      for (const call of activeCalls || []) {
        if (call.session_id) {
          await supabase.functions.invoke('call-ai-canary-escape', {
            body: {
              session_id: call.session_id,
              business_id: businessId,
              escape_type: 'admin_kill_switch',
              escape_trigger: 'Admin activated global kill switch',
            },
          });
        }
      }

      return { escapedCalls: activeCalls?.length || 0 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-call-agent-config'] });
      queryClient.invalidateQueries({ queryKey: ['active-canary-calls'] });
      
      toast({
        title: "Kill Switch Activated",
        description: `${data.escapedCalls} active calls transferred to humans`,
        variant: "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Kill Switch Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeactivateKillSwitch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (businessId: string) => {
      const { error } = await supabase
        .from('ai_call_agent_config')
        .update({ 
          canary_kill_switch: false,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-call-agent-config'] });
      toast({ title: "Kill Switch Deactivated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to Deactivate",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
