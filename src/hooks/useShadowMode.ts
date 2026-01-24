import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Types
export interface ShadowPrediction {
  id: string;
  session_id: string | null;
  business_id: string;
  human_operator_id: string | null;
  predicted_intent: string;
  predicted_response: string;
  predicted_next_action: string | null;
  predicted_escalation: boolean;
  predicted_route: string | null;
  confidence_score: number;
  reasoning: string | null;
  risk_flags: string[];
  transcript_snapshot: string | null;
  prediction_timestamp: string;
  processing_time_ms: number | null;
  human_actual_response: string | null;
  human_actual_action: string | null;
  human_escalated: boolean | null;
  human_response_timestamp: string | null;
  would_have_matched: boolean | null;
  comparison_notes: string | null;
  created_at: string;
}

export interface TrustCalibrationScore {
  id: string;
  business_id: string;
  scope_type: string;
  scope_id: string | null;
  overall_trust_score: number;
  resolution_accuracy: number;
  escalation_timing: number;
  compliance_adherence: number;
  efficiency_score: number;
  total_comparisons: number;
  ai_would_have_matched: number;
  ai_would_have_been_better: number;
  ai_would_have_been_worse: number;
  ai_would_have_violated_rules: number;
  score_trend: 'improving' | 'stable' | 'declining' | null;
  consecutive_good_predictions: number;
  consecutive_bad_predictions: number;
  last_calibrated_at: string;
}

export interface AIVsHumanDiff {
  id: string;
  shadow_prediction_id: string | null;
  business_id: string;
  session_id: string | null;
  comparison_type: string;
  ai_decision: string;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  human_decision: string;
  human_context: string | null;
  verdict: 'ai_correct' | 'human_correct' | 'both_valid' | 'ai_violation' | 'inconclusive';
  verdict_reason: string | null;
  impact_severity: string | null;
  would_have_caused_escalation: boolean;
  would_have_violated_compliance: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
}

export interface GraduationEvent {
  id: string;
  business_id: string;
  from_mode: string;
  to_mode: string;
  event_type: 'promotion' | 'demotion' | 'manual_override' | 'emergency_stop' | 'scheduled_review';
  trigger_reason: string;
  trust_score_at_event: number | null;
  calibration_data: Record<string, unknown>;
  thresholds_checked: Record<string, unknown>;
  thresholds_passed: boolean;
  requested_by: string | null;
  approved_by: string | null;
  approval_notes: string | null;
  is_reversible: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  created_at: string;
}

export interface GraduationThresholds {
  id: string;
  business_id: string;
  shadow_to_assisted_min_predictions: number;
  shadow_to_assisted_min_accuracy: number;
  shadow_to_assisted_max_violations: number;
  shadow_to_assisted_min_days: number;
  assisted_to_canary_min_suggestions: number;
  assisted_to_canary_min_acceptance_rate: number;
  assisted_to_canary_min_trust_score: number;
  assisted_to_canary_min_days: number;
  canary_to_live_min_calls: number;
  canary_to_live_min_success_rate: number;
  canary_to_live_min_trust_score: number;
  canary_to_live_max_escalation_rate: number;
  canary_to_live_min_days: number;
  demotion_consecutive_failures: number;
  demotion_trust_score_floor: number;
  demotion_violation_threshold: number;
  require_human_approval_for_promotion: boolean;
  require_human_approval_for_demotion: boolean;
}

// Hook: Shadow Predictions
export function useShadowPredictions(businessId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['shadow-predictions', businessId, limit],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('call_shadow_predictions')
        .select('*')
        .eq('business_id', businessId)
        .order('prediction_timestamp', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as ShadowPrediction[];
    },
    enabled: !!businessId,
  });
}

// Hook: Trust Calibration Scores
export function useTrustCalibration(businessId: string | null) {
  return useQuery({
    queryKey: ['trust-calibration', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data, error } = await supabase
        .from('trust_calibration_scores')
        .select('*')
        .eq('business_id', businessId)
        .eq('scope_type', 'global')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as TrustCalibrationScore | null;
    },
    enabled: !!businessId,
  });
}

// Hook: AI vs Human Diffs
export function useAIVsHumanDiffs(businessId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['ai-vs-human-diffs', businessId, limit],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('ai_vs_human_diff_logs')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as AIVsHumanDiff[];
    },
    enabled: !!businessId,
  });
}

// Hook: Graduation Events
export function useGraduationEvents(businessId: string | null) {
  return useQuery({
    queryKey: ['graduation-events', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('ai_graduation_events')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as GraduationEvent[];
    },
    enabled: !!businessId,
  });
}

// Hook: Graduation Thresholds
export function useGraduationThresholds(businessId: string | null) {
  return useQuery({
    queryKey: ['graduation-thresholds', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data, error } = await supabase
        .from('ai_graduation_thresholds')
        .select('*')
        .eq('business_id', businessId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as GraduationThresholds | null;
    },
    enabled: !!businessId,
  });
}

// Mutation: Update Graduation Thresholds
export function useUpdateGraduationThresholds() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      businessId, 
      thresholds 
    }: { 
      businessId: string; 
      thresholds: Partial<GraduationThresholds>;
    }) => {
      const { data, error } = await supabase
        .from('ai_graduation_thresholds')
        .upsert({
          business_id: businessId,
          ...thresholds,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'business_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['graduation-thresholds', variables.businessId] });
      toast({ title: "Graduation thresholds updated" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to update thresholds", 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive" 
      });
    },
  });
}

// Mutation: Request Graduation Evaluation
export function useRequestGraduationEvaluation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      businessId,
      checkPromotion = true,
      checkDemotion = true,
    }: { 
      businessId: string;
      checkPromotion?: boolean;
      checkDemotion?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-graduation-evaluator', {
        body: {
          business_id: businessId,
          check_promotion: checkPromotion,
          check_demotion: checkDemotion,
          requested_by: 'user',
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['graduation-events', variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ['ai-call-agent-config', variables.businessId] });
      
      if (data.evaluation?.action !== 'none') {
        toast({ 
          title: `${data.evaluation.action === 'promote' ? 'Promotion' : 'Demotion'} ${data.evaluation.requires_approval ? 'Requested' : 'Executed'}`,
          description: data.evaluation.reason,
        });
      } else {
        toast({ title: "Evaluation complete", description: data.evaluation.reason });
      }
    },
    onError: (error) => {
      toast({ 
        title: "Evaluation failed", 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive" 
      });
    },
  });
}

// Mutation: Approve Graduation
export function useApproveGraduation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      eventId,
      businessId,
      approvalNotes,
    }: { 
      eventId: string;
      businessId: string;
      approvalNotes?: string;
    }) => {
      // Get the pending event
      const { data: event, error: fetchError } = await supabase
        .from('ai_graduation_events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!event.trigger_reason.startsWith('PENDING:')) {
        throw new Error('Event is not pending approval');
      }

      // Update config
      const { error: configError } = await supabase
        .from('ai_call_agent_config')
        .update({
          mode: event.to_mode,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId);

      if (configError) throw configError;

      // Update event
      const { error: eventError } = await supabase
        .from('ai_graduation_events')
        .update({
          trigger_reason: event.trigger_reason.replace('PENDING: ', 'APPROVED: '),
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approval_notes: approvalNotes,
        })
        .eq('id', eventId);

      if (eventError) throw eventError;

      return { from: event.from_mode, to: event.to_mode };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['graduation-events', variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ['ai-call-agent-config', variables.businessId] });
      toast({ 
        title: "Graduation approved",
        description: `Mode changed from ${data.from} to ${data.to}`,
      });
    },
    onError: (error) => {
      toast({ 
        title: "Approval failed", 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive" 
      });
    },
  });
}

// Mutation: Reverse Graduation
export function useReverseGraduation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      eventId,
      businessId,
      reason,
    }: { 
      eventId: string;
      businessId: string;
      reason: string;
    }) => {
      const { data: event, error: fetchError } = await supabase
        .from('ai_graduation_events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!event.is_reversible) {
        throw new Error('This graduation cannot be reversed');
      }

      // Revert config
      const { error: configError } = await supabase
        .from('ai_call_agent_config')
        .update({
          mode: event.from_mode,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId);

      if (configError) throw configError;

      // Update event
      const { error: eventError } = await supabase
        .from('ai_graduation_events')
        .update({
          reversed_at: new Date().toISOString(),
          reversed_by: (await supabase.auth.getUser()).data.user?.id,
          reversal_reason: reason,
        })
        .eq('id', eventId);

      if (eventError) throw eventError;

      // Create reversal event
      await supabase
        .from('ai_graduation_events')
        .insert({
          business_id: businessId,
          from_mode: event.to_mode,
          to_mode: event.from_mode,
          event_type: 'manual_override',
          trigger_reason: `Reversal: ${reason}`,
          thresholds_checked: {},
          thresholds_passed: false,
          requested_by: (await supabase.auth.getUser()).data.user?.id,
        });

      return { from: event.to_mode, to: event.from_mode };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['graduation-events', variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ['ai-call-agent-config', variables.businessId] });
      toast({ 
        title: "Graduation reversed",
        description: `Mode reverted from ${data.from} to ${data.to}`,
      });
    },
    onError: (error) => {
      toast({ 
        title: "Reversal failed", 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive" 
      });
    },
  });
}

// Mutation: Trigger Shadow Prediction
export function useTriggerShadowPrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      sessionId,
      businessId,
      transcript,
      humanOperatorId,
      callContext,
    }: { 
      sessionId: string;
      businessId: string;
      transcript: string;
      humanOperatorId?: string;
      callContext?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-shadow-predictor', {
        body: {
          session_id: sessionId,
          business_id: businessId,
          transcript,
          human_operator_id: humanOperatorId,
          call_context: callContext,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shadow-predictions', variables.businessId] });
    },
  });
}

// Mutation: Submit Human Response (for calibration)
export function useSubmitHumanResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      businessId,
      shadowPredictionId,
      humanResponse,
      humanAction,
      humanEscalated,
      callOutcome,
    }: { 
      businessId: string;
      shadowPredictionId: string;
      humanResponse: string;
      humanAction?: string;
      humanEscalated?: boolean;
      callOutcome?: {
        resolved: boolean;
        satisfaction_score?: number;
        escalation_needed?: boolean;
      };
    }) => {
      const { data, error } = await supabase.functions.invoke('trust-calibration-engine', {
        body: {
          business_id: businessId,
          shadow_prediction_id: shadowPredictionId,
          human_response: humanResponse,
          human_action: humanAction,
          human_escalated: humanEscalated,
          call_outcome: callOutcome,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shadow-predictions', variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ['trust-calibration', variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ['ai-vs-human-diffs', variables.businessId] });
    },
  });
}
