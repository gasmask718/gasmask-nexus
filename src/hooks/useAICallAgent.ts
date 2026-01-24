import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AICallAgentConfig {
  id: string;
  business_id: string;
  enabled: boolean;
  mode: 'off' | 'shadow' | 'assisted' | 'canary' | 'live';
  confidence_threshold: number;
  require_callable_fallback: boolean;
  require_resolved_queue: boolean;
  max_consecutive_failures: number;
  auto_downgrade_on_failure: boolean;
  canary_kill_switch: boolean;
  canary_max_concurrent: number;
  canary_allowed_call_types: string[];
  canary_blocked_intents: string[];
  created_at: string;
  updated_at: string;
}

export interface AITrustScore {
  id: string;
  business_id: string;
  route_id: string | null;
  current_mode: string;
  trust_score: number;
  total_predictions: number;
  accurate_predictions: number;
  accuracy_rate: number;
  human_override_count: number;
  consecutive_successes: number;
  consecutive_failures: number;
  last_evaluated_at: string | null;
  promoted_at: string | null;
  demoted_at: string | null;
}

export interface AIPrediction {
  id: string;
  session_id: string | null;
  call_log_id: string | null;
  business_id: string;
  caller_phone: string | null;
  predicted_intent: string | null;
  predicted_route: string | null;
  drafted_response: string | null;
  confidence_score: number | null;
  actual_outcome: string | null;
  human_overrode: boolean | null;
  override_reason: string | null;
  was_accurate: boolean | null;
  processing_time_ms: number | null;
  created_at: string;
}

export function useAICallAgentConfig(businessId: string | null) {
  return useQuery({
    queryKey: ['ai-call-agent-config', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      
      const { data, error } = await supabase
        .from('ai_call_agent_config')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) throw error;
      return data as AICallAgentConfig | null;
    },
    enabled: !!businessId,
  });
}

export function useAITrustScore(businessId: string | null) {
  return useQuery({
    queryKey: ['ai-trust-score', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      
      const { data, error } = await supabase
        .from('ai_trust_scores')
        .select('*')
        .eq('business_id', businessId)
        .is('route_id', null)
        .maybeSingle();

      if (error) throw error;
      return data as AITrustScore | null;
    },
    enabled: !!businessId,
  });
}

export function useAIPredictions(businessId: string | null, limit = 20) {
  return useQuery({
    queryKey: ['ai-predictions', businessId, limit],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('ai_call_predictions')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as AIPrediction[];
    },
    enabled: !!businessId,
  });
}

export function useUpdateAIConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ businessId, updates }: { businessId: string; updates: Partial<AICallAgentConfig> }) => {
      // Check if config exists
      const { data: existing } = await supabase
        .from('ai_call_agent_config')
        .select('id')
        .eq('business_id', businessId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('ai_call_agent_config')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('business_id', businessId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_call_agent_config')
          .insert({ business_id: businessId, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: (_, { businessId }) => {
      queryClient.invalidateQueries({ queryKey: ['ai-call-agent-config', businessId] });
      toast({ title: "AI Agent configuration updated" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to update AI config", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useEvaluatePrediction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      predictionId, 
      wasAccurate, 
      humanOverrode, 
      overrideReason,
      actualOutcome 
    }: { 
      predictionId: string; 
      wasAccurate: boolean; 
      humanOverrode?: boolean;
      overrideReason?: string;
      actualOutcome?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-ai-trust-evaluator', {
        body: {
          prediction_id: predictionId,
          was_accurate: wasAccurate,
          human_overrode: humanOverrode,
          override_reason: overrideReason,
          actual_outcome: actualOutcome,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['ai-trust-score'] });
      queryClient.invalidateQueries({ queryKey: ['ai-call-agent-config'] });
      
      if (data.mode_change) {
        toast({
          title: data.mode_change.is_promotion ? "AI Agent Promoted!" : "AI Agent Demoted",
          description: `Mode changed from ${data.mode_change.previous_mode} to ${data.mode_change.new_mode}`,
          variant: data.mode_change.is_promotion ? "default" : "destructive",
        });
      } else {
        toast({ title: "Prediction evaluated" });
      }
    },
    onError: (error) => {
      toast({ 
        title: "Failed to evaluate prediction", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useRealtimeTrustScore(businessId: string | null) {
  const queryClient = useQueryClient();

  // Subscribe to realtime updates
  useQuery({
    queryKey: ['ai-trust-score-realtime', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const channel = supabase
        .channel(`ai-trust-${businessId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_trust_scores',
            filter: `business_id=eq.${businessId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['ai-trust-score', businessId] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
    enabled: !!businessId,
    staleTime: Infinity,
  });
}
