import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface IntentGraph {
  id: string;
  conversation_id: string;
  active_intents: string[];
  dormant_intents: string[];
  resolved_intents: string[];
  conflicting_intents: string[];
  intent_velocity_score: number;
  confidence_score: number;
  risk_index: number;
  opportunity_index: number;
  predictions: any[];
  suggestions: any[];
  last_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntentNode {
  id: string;
  intent_graph_id: string;
  intent_type: string;
  origin_event_id: string | null;
  supporting_event_ids: string[];
  intent_strength: number;
  intent_direction: 'positive' | 'neutral' | 'negative';
  emotional_charge: string;
  blockers: string[];
  dependencies: string[];
  likelihood_to_convert: number;
  urgency_score: number;
  status: 'active' | 'dormant' | 'resolved' | 'escalated';
  ai_reasoning: string | null;
  human_override_note: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

// Get intent graph for a conversation
export function useIntentGraph(conversationId: string | null) {
  return useQuery({
    queryKey: ['intent-graph', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      
      const { data, error } = await supabase
        .from('intent_graphs')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();
      
      if (error) throw error;
      return data as IntentGraph | null;
    },
    enabled: !!conversationId,
  });
}

// Get intent nodes for a graph
export function useIntentNodes(intentGraphId: string | null) {
  return useQuery({
    queryKey: ['intent-nodes', intentGraphId],
    queryFn: async () => {
      if (!intentGraphId) return [];
      
      const { data, error } = await supabase
        .from('intent_nodes')
        .select('*')
        .eq('intent_graph_id', intentGraphId)
        .order('intent_strength', { ascending: false });
      
      if (error) throw error;
      return data as IntentNode[];
    },
    enabled: !!intentGraphId,
  });
}

// Trigger intent extraction
export function useExtractIntents() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase.functions.invoke('intent-extraction', {
        body: { conversation_id: conversationId },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['intent-graph', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['intent-nodes'] });
      toast.success(`Detected ${data.intents_detected} intents`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to extract intents');
    },
  });
}

// Update intent node
export function useUpdateIntentNode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<IntentNode> }) => {
      const { data, error } = await supabase
        .from('intent_nodes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as IntentNode;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['intent-nodes', data.intent_graph_id] });
      toast.success('Intent updated');
    },
  });
}

// Add training feedback
export function useAddIntentFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (feedback: {
      intent_node_id: string;
      feedback_type: 'approve' | 'reject' | 'adjust_strength' | 'change_type' | 'add_context';
      original_value?: any;
      corrected_value?: any;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('intent_training_feedback')
        .insert(feedback)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intent-nodes'] });
      toast.success('Feedback recorded');
    },
  });
}

// Search high-risk/opportunity conversations
export function useIntentGraphSearch(filters: {
  minRisk?: number;
  minOpportunity?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['intent-graph-search', filters],
    queryFn: async () => {
      let query = supabase
        .from('intent_graphs')
        .select('*, conversation_memories(*)')
        .order('updated_at', { ascending: false })
        .limit(filters.limit || 50);
      
      if (filters.minRisk) {
        query = query.gte('risk_index', filters.minRisk);
      }
      if (filters.minOpportunity) {
        query = query.gte('opportunity_index', filters.minOpportunity);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
