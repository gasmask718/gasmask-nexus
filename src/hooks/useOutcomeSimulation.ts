import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OutcomeSimulation {
  id: string;
  conversation_id: string;
  triggering_context: Record<string, any>;
  triggering_type: string;
  generated_at: string;
  recommended_scenario_id: string | null;
  confidence_index: number;
  expiry_timestamp: string;
  status: string;
  human_override_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SimulationScenario {
  id: string;
  simulation_id: string;
  scenario_name: string;
  scenario_rank: number;
  initiating_action_type: string;
  tone_profile: string;
  predicted_contact_response: string | null;
  predicted_intent_shift: Record<string, any>;
  predicted_sentiment_shift: string | null;
  predicted_outcomes: any[];
  risk_score: number;
  opportunity_score: number;
  trust_impact_score: number;
  time_to_resolution_estimate: string | null;
  confidence_level: number;
  supporting_evidence: any[];
  is_recommended: boolean;
  is_pinned: boolean;
  is_dismissed: boolean;
  recommendation_reasoning: string | null;
  warnings: string[] | null;
  signals_to_watch: string[] | null;
  created_at: string;
}

export interface SimulationFeedback {
  id: string;
  simulation_id: string;
  scenario_id: string | null;
  executed_scenario_id: string | null;
  actual_outcome: Record<string, any>;
  predicted_vs_actual_accuracy: number | null;
  feedback_type: string;
  feedback_notes: string | null;
  human_intuition_note: string | null;
  created_by: string | null;
  created_at: string;
}

// Fetch active simulations for a conversation
export function useOutcomeSimulations(conversationId: string | null) {
  return useQuery({
    queryKey: ['outcome-simulations', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('outcome_simulations')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OutcomeSimulation[];
    },
    enabled: !!conversationId,
  });
}

// Fetch scenarios for a simulation
export function useSimulationScenarios(simulationId: string | null) {
  return useQuery({
    queryKey: ['simulation-scenarios', simulationId],
    queryFn: async () => {
      if (!simulationId) return [];
      const { data, error } = await supabase
        .from('simulation_scenarios')
        .select('*')
        .eq('simulation_id', simulationId)
        .eq('is_dismissed', false)
        .order('scenario_rank', { ascending: true });
      if (error) throw error;
      return data as SimulationScenario[];
    },
    enabled: !!simulationId,
  });
}

// Generate new simulation via edge function
export function useGenerateSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      triggeringContext, 
      constraints 
    }: { 
      conversationId: string; 
      triggeringContext?: Record<string, any>;
      constraints?: Record<string, any>;
    }) => {
      const { data, error } = await supabase.functions.invoke('simulate-outcomes', {
        body: { conversationId, triggeringContext, constraints },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outcome-simulations', variables.conversationId] });
    },
  });
}

// Update scenario (pin, dismiss, etc.)
export function useUpdateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      scenarioId, 
      updates 
    }: { 
      scenarioId: string; 
      updates: Partial<SimulationScenario>;
    }) => {
      const { data, error } = await supabase
        .from('simulation_scenarios')
        .update(updates)
        .eq('id', scenarioId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['simulation-scenarios', data.simulation_id] });
    },
  });
}

// Update simulation status
export function useUpdateSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      simulationId, 
      updates 
    }: { 
      simulationId: string; 
      updates: Partial<OutcomeSimulation>;
    }) => {
      const { data, error } = await supabase
        .from('outcome_simulations')
        .update(updates)
        .eq('id', simulationId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['outcome-simulations', data.conversation_id] });
    },
  });
}

// Add feedback for learning loop
export function useAddSimulationFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedback: Omit<SimulationFeedback, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('simulation_feedback')
        .insert(feedback)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['simulation-feedback', variables.simulation_id] });
    },
  });
}

// Get feedback for a simulation
export function useSimulationFeedback(simulationId: string | null) {
  return useQuery({
    queryKey: ['simulation-feedback', simulationId],
    queryFn: async () => {
      if (!simulationId) return [];
      const { data, error } = await supabase
        .from('simulation_feedback')
        .select('*')
        .eq('simulation_id', simulationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SimulationFeedback[];
    },
    enabled: !!simulationId,
  });
}

// Compare scenarios side by side
export function useCompareScenarios(scenarioIds: string[]) {
  return useQuery({
    queryKey: ['compare-scenarios', scenarioIds],
    queryFn: async () => {
      if (scenarioIds.length === 0) return [];
      const { data, error } = await supabase
        .from('simulation_scenarios')
        .select('*')
        .in('id', scenarioIds);
      if (error) throw error;
      return data as SimulationScenario[];
    },
    enabled: scenarioIds.length > 0,
  });
}

// Lock scenario for execution
export function useLockScenarioForExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      simulationId, 
      scenarioId 
    }: { 
      simulationId: string; 
      scenarioId: string;
    }) => {
      // Update simulation status to executed
      const { error: simError } = await supabase
        .from('outcome_simulations')
        .update({ 
          status: 'executed',
          recommended_scenario_id: scenarioId,
        })
        .eq('id', simulationId);
      if (simError) throw simError;

      // Pin the executed scenario
      const { data, error } = await supabase
        .from('simulation_scenarios')
        .update({ is_pinned: true })
        .eq('id', scenarioId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['simulation-scenarios', data.simulation_id] });
      queryClient.invalidateQueries({ queryKey: ['outcome-simulations'] });
    },
  });
}
