import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConversationMemory {
  id: string;
  contact_id: string;
  associated_businesses: string[];
  first_interaction_at: string | null;
  last_interaction_at: string | null;
  status: 'active' | 'dormant' | 'escalated' | 'closed';
  memory_summary_current: string | null;
  memory_summary_versions: any[];
  sentiment_trend: string;
  risk_flags: string[];
  preferences: Record<string, any>;
  unresolved_items: any[];
  ai_confidence_score: number;
  is_frozen: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemoryEvent {
  id: string;
  conversation_id: string;
  business_id: string | null;
  channel: 'call' | 'text' | 'email' | 'ai_action' | 'human_note' | 'system';
  actor: 'human' | 'ai' | 'system';
  actor_name: string | null;
  direction: 'inbound' | 'outbound' | 'internal' | null;
  raw_content: string | null;
  ai_extracted_summary: string | null;
  sentiment_score: number | null;
  tags: string[];
  linked_tasks: string[];
  escalation_flag: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

// Get or create conversation memory for a contact
export function useConversationMemory(contactId: string | null) {
  return useQuery({
    queryKey: ['conversation-memory', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      
      const { data, error } = await supabase
        .from('conversation_memories')
        .select('*')
        .eq('contact_id', contactId)
        .maybeSingle();
      
      if (error) throw error;
      return data as ConversationMemory | null;
    },
    enabled: !!contactId,
  });
}

// Get memory events for a conversation
export function useMemoryEvents(conversationId: string | null) {
  return useQuery({
    queryKey: ['memory-events', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('memory_events')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as MemoryEvent[];
    },
    enabled: !!conversationId,
  });
}

// Create conversation memory
export function useCreateConversationMemory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data, error } = await supabase
        .from('conversation_memories')
        .insert({ contact_id: contactId })
        .select()
        .single();
      
      if (error) throw error;
      return data as ConversationMemory;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-memory', data.contact_id] });
    },
  });
}

// Add memory event
export function useAddMemoryEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (event: Omit<MemoryEvent, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('memory_events')
        .insert(event)
        .select()
        .single();
      
      if (error) throw error;
      return data as MemoryEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['memory-events', data.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversation-memory'] });
    },
  });
}

// Update conversation memory (for freeze, status, summary updates)
export function useUpdateConversationMemory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ConversationMemory> }) => {
      const { data, error } = await supabase
        .from('conversation_memories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as ConversationMemory;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-memory', data.contact_id] });
      toast.success("Memory updated");
    },
  });
}

// Search conversation memories
export function useSearchConversationMemories(filters: {
  businessId?: string;
  status?: string;
  sentiment?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['conversation-memories', filters],
    queryFn: async () => {
      let query = supabase
        .from('conversation_memories')
        .select('*')
        .order('last_interaction_at', { ascending: false })
        .limit(100);
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.sentiment) {
        query = query.eq('sentiment_trend', filters.sentiment);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ConversationMemory[];
    },
  });
}
