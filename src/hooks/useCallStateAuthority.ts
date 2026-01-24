import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * CALL STATE AUTHORITY HOOK
 * ==========================
 * Single source of truth for call state in the UI.
 * 
 * This hook provides:
 * - Real-time state subscription
 * - State transition requests
 * - Speech permission checks
 * - Active speaker information
 */

export type CallState = 
  | 'ringing'
  | 'ai_listening'
  | 'ai_speaking'
  | 'handoff_pending'
  | 'human_active'
  | 'ai_muted'
  | 'escalated'
  | 'ended';

export interface CallStateMachine {
  id: string;
  session_id: string;
  business_id: string;
  current_state: CallState;
  previous_state: CallState | null;
  ai_speech_allowed: boolean;
  human_speech_active: boolean;
  state_locked_by: string | null;
  lock_reason: string | null;
  active_speaker: 'ai' | 'human' | 'caller' | 'none';
  confidence_at_state: number | null;
  created_at: string;
  updated_at: string;
}

export interface StateTransition {
  id: string;
  session_id: string;
  from_state: CallState | null;
  to_state: CallState;
  transition_trigger: string;
  triggered_by: string;
  trigger_details: Record<string, unknown>;
  ai_was_speaking: boolean;
  speech_interrupted: boolean;
  confidence_at_transition: number | null;
  latency_ms: number;
  created_at: string;
}

interface TransitionRequest {
  to_state: CallState;
  trigger: string;
  triggered_by?: string;
  trigger_details?: Record<string, unknown>;
  confidence?: number;
}

// States where AI speech is blocked
const AI_BLOCKED_STATES: CallState[] = ['human_active', 'ai_muted', 'escalated', 'ended', 'handoff_pending'];

export function useCallStateAuthority(sessionId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [realtimeState, setRealtimeState] = useState<CallStateMachine | null>(null);

  // Fetch current state
  const { data: state, isLoading, error } = useQuery({
    queryKey: ['call-state', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      
      const { data, error } = await supabase
        .from('call_state_machine')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;
      return data as CallStateMachine;
    },
    enabled: !!sessionId,
    refetchInterval: 1000, // Fallback polling
  });

  // Real-time subscription
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`call-state-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_state_machine',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setRealtimeState(payload.new as CallStateMachine);
            queryClient.invalidateQueries({ queryKey: ['call-state', sessionId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  // Use realtime state if available, otherwise use query data
  const currentState = realtimeState || state;

  // Initialize state machine
  const initializeMutation = useMutation({
    mutationFn: async ({ businessId }: { businessId: string }) => {
      const { data, error } = await supabase.functions.invoke('call-state-orchestrator', {
        body: {
          action: 'initialize',
          session_id: sessionId,
          business_id: businessId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-state', sessionId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to initialize call state",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Transition state
  const transitionMutation = useMutation({
    mutationFn: async (request: TransitionRequest) => {
      const { data, error } = await supabase.functions.invoke('call-state-orchestrator', {
        body: {
          action: 'transition',
          session_id: sessionId,
          to_state: request.to_state,
          trigger: request.trigger,
          triggered_by: request.triggered_by || 'operator',
          trigger_details: request.trigger_details || {},
          confidence: request.confidence,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['call-state', sessionId] });
      
      // Show toast for important transitions
      if (data.speech_interrupted) {
        toast({
          title: "AI Speech Interrupted",
          description: `Transitioned to ${data.current_state}`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "State transition failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check speech permission
  const checkSpeechPermission = useCallback(async (): Promise<{
    allowed: boolean;
    blocked_reason?: string;
  }> => {
    if (!sessionId) return { allowed: false, blocked_reason: "No session" };

    const { data, error } = await supabase.functions.invoke('call-state-orchestrator', {
      body: {
        action: 'check_speech_permission',
        session_id: sessionId,
      },
    });

    if (error) {
      return { allowed: false, blocked_reason: error.message };
    }

    return {
      allowed: data.ai_speech_allowed,
      blocked_reason: data.blocked_reason,
    };
  }, [sessionId]);

  // Helper functions
  const isAISpeechAllowed = currentState?.ai_speech_allowed ?? false;
  const isHumanActive = currentState?.current_state === 'human_active';
  const isAIMuted = currentState?.current_state === 'ai_muted';
  const isEscalated = currentState?.current_state === 'escalated';
  const isEnded = currentState?.current_state === 'ended';
  const isLocked = !!currentState?.state_locked_by;

  // Convenience transition functions
  const startAISpeaking = useCallback(() => {
    return transitionMutation.mutateAsync({
      to_state: 'ai_speaking',
      trigger: 'ai_response_ready',
      triggered_by: 'ai',
    });
  }, [transitionMutation]);

  const stopAISpeaking = useCallback(() => {
    return transitionMutation.mutateAsync({
      to_state: 'ai_listening',
      trigger: 'ai_finished_speaking',
      triggered_by: 'ai',
    });
  }, [transitionMutation]);

  const humanTakeover = useCallback(() => {
    return transitionMutation.mutateAsync({
      to_state: 'human_active',
      trigger: 'operator_takeover',
      triggered_by: 'operator',
    });
  }, [transitionMutation]);

  const muteAI = useCallback(() => {
    return transitionMutation.mutateAsync({
      to_state: 'ai_muted',
      trigger: 'manual_mute',
      triggered_by: 'operator',
    });
  }, [transitionMutation]);

  const unmuteAI = useCallback(() => {
    return transitionMutation.mutateAsync({
      to_state: 'ai_listening',
      trigger: 'manual_unmute',
      triggered_by: 'operator',
      trigger_details: { unmute_authorized: true },
    });
  }, [transitionMutation]);

  const escalateCall = useCallback(() => {
    return transitionMutation.mutateAsync({
      to_state: 'escalated',
      trigger: 'manual_escalation',
      triggered_by: 'operator',
    });
  }, [transitionMutation]);

  const endCall = useCallback(() => {
    return transitionMutation.mutateAsync({
      to_state: 'ended',
      trigger: 'call_ended',
      triggered_by: 'system',
    });
  }, [transitionMutation]);

  const triggerKillSwitch = useCallback((reason: string) => {
    return transitionMutation.mutateAsync({
      to_state: 'ai_muted',
      trigger: 'kill_switch',
      triggered_by: 'operator',
      trigger_details: { reason },
    });
  }, [transitionMutation]);

  const triggerConfidenceBreach = useCallback((confidence: number) => {
    return transitionMutation.mutateAsync({
      to_state: 'ai_muted',
      trigger: 'confidence_breach',
      triggered_by: 'system',
      confidence,
    });
  }, [transitionMutation]);

  return {
    // State
    state: currentState,
    isLoading,
    error,
    
    // Status flags
    isAISpeechAllowed,
    isHumanActive,
    isAIMuted,
    isEscalated,
    isEnded,
    isLocked,
    activeSpeaker: currentState?.active_speaker || 'none',
    lockReason: currentState?.lock_reason,
    
    // Actions
    initialize: initializeMutation.mutateAsync,
    transition: transitionMutation.mutateAsync,
    checkSpeechPermission,
    
    // Convenience actions
    startAISpeaking,
    stopAISpeaking,
    humanTakeover,
    muteAI,
    unmuteAI,
    escalateCall,
    endCall,
    triggerKillSwitch,
    triggerConfidenceBreach,
    
    // Loading states
    isTransitioning: transitionMutation.isPending,
    isInitializing: initializeMutation.isPending,
  };
}

// Hook to fetch state transition history
export function useCallStateHistory(sessionId: string | null) {
  return useQuery({
    queryKey: ['call-state-history', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      
      const { data, error } = await supabase
        .from('call_state_transitions')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as StateTransition[];
    },
    enabled: !!sessionId,
  });
}

// Hook for monitoring all active calls (for dashboards)
export function useActiveCallStates(businessId: string | null) {
  const queryClient = useQueryClient();

  const { data: states, isLoading } = useQuery({
    queryKey: ['active-call-states', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('call_state_machine')
        .select('*')
        .eq('business_id', businessId)
        .neq('current_state', 'ended')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as CallStateMachine[];
    },
    enabled: !!businessId,
    refetchInterval: 2000,
  });

  // Real-time subscription for all business calls
  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel(`business-calls-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_state_machine',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['active-call-states', businessId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient]);

  return { states: states || [], isLoading };
}
