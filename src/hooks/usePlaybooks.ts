import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * SALES PLAYBOOK HOOKS
 * ====================
 * Manage sales playbooks and their usage.
 */

export interface SalesPlaybook {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  target_intents: string[];
  trigger_keywords: string[];
  structure: Record<string, unknown>[] | null;
  allowed_tactics: string[];
  forbidden_tactics: string[];
  max_duration_seconds: number;
  escalation_triggers: string[];
  confidence_floor: number;
  times_used: number;
  avg_outcome_score: number | null;
  conversion_rate: number | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpeakerStyleProfile {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  tone: string;
  pacing: string;
  energy_level: string;
  greeting_examples: string[];
  closing_examples: string[];
  objection_handling_examples: string[];
  empathy_expressions: string[];
  uses_humor: boolean;
  uses_stories: boolean;
  uses_questions: boolean;
  mirroring_enabled: boolean;
  max_enthusiasm_level: number;
  formality_level: number;
  derived_from_human_id: string | null;
  human_exemplar_calls: string[];
  times_used: number;
  avg_caller_satisfaction: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TechniqueExtraction {
  id: string;
  business_id: string;
  source_session_id: string | null;
  human_exemplar_id: string;
  human_name: string;
  technique_type: string;
  technique_name: string;
  technique_description: string | null;
  transcript_excerpt: string | null;
  phrasing_pattern: string | null;
  context_triggers: string[];
  outcome_score: number | null;
  extraction_confidence: number;
  human_validated: boolean;
  is_approved_for_ai: boolean;
  approval_notes: string | null;
  times_adopted: number;
  adoption_success_rate: number | null;
  extracted_at: string;
}

// ============================================
// PLAYBOOKS
// ============================================

export function usePlaybooks(businessId: string | null) {
  return useQuery({
    queryKey: ['playbooks', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('sales_playbooks')
        .select('*')
        .eq('business_id', businessId)
        .order('is_default', { ascending: false })
        .order('avg_outcome_score', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as SalesPlaybook[];
    },
    enabled: !!businessId,
  });
}

export function useCreatePlaybook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (playbook: { business_id: string; name: string; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from('sales_playbooks')
        .insert(playbook as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['playbooks', variables.business_id] });
      toast({ title: "Playbook created" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to create playbook", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useUpdatePlaybook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('sales_playbooks')
        .update(updates as never)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      toast({ title: "Playbook updated" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to update playbook", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

// ============================================
// SPEAKER STYLES
// ============================================

export function useSpeakerStyles(businessId: string | null) {
  return useQuery({
    queryKey: ['speaker-styles', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('speaker_style_profiles')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('avg_caller_satisfaction', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as SpeakerStyleProfile[];
    },
    enabled: !!businessId,
  });
}

export function useCreateSpeakerStyle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (style: Partial<SpeakerStyleProfile> & { business_id: string; name: string }) => {
      const { data, error } = await supabase
        .from('speaker_style_profiles')
        .insert(style)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['speaker-styles', variables.business_id] });
      toast({ title: "Style profile created" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to create style", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

// ============================================
// TECHNIQUE EXTRACTIONS
// ============================================

export function useTechniqueExtractions(businessId: string | null, approvedOnly = false) {
  return useQuery({
    queryKey: ['technique-extractions', businessId, approvedOnly],
    queryFn: async () => {
      if (!businessId) return [];
      
      let query = supabase
        .from('technique_extractions')
        .select('*')
        .eq('business_id', businessId)
        .order('extracted_at', { ascending: false });

      if (approvedOnly) {
        query = query.eq('is_approved_for_ai', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TechniqueExtraction[];
    },
    enabled: !!businessId,
  });
}

export function useApproveTechnique() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      techniqueId, 
      approved, 
      approvalNotes,
      approvedBy 
    }: { 
      techniqueId: string; 
      approved: boolean;
      approvalNotes?: string;
      approvedBy?: string;
    }) => {
      const { error } = await supabase
        .from('technique_extractions')
        .update({
          is_approved_for_ai: approved,
          human_validated: true,
          validated_at: new Date().toISOString(),
          validated_by: approvedBy,
          approval_notes: approvalNotes,
          approved_by: approved ? approvedBy : null,
          approved_at: approved ? new Date().toISOString() : null,
        })
        .eq('id', techniqueId);

      if (error) throw error;
    },
    onSuccess: (_, { approved }) => {
      queryClient.invalidateQueries({ queryKey: ['technique-extractions'] });
      toast({ 
        title: approved ? "Technique approved for AI" : "Technique rejected",
        variant: approved ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to update technique", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

// ============================================
// PLAYBOOK SELECTION (FOR CALLS)
// ============================================

export function useSelectPlaybook() {
  return useMutation({
    mutationFn: async ({
      sessionId,
      businessId,
      detectedIntent,
      callerKeywords,
      callerSentiment,
    }: {
      sessionId: string;
      businessId: string;
      detectedIntent?: string;
      callerKeywords?: string[];
      callerSentiment?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-playbook-selector', {
        body: {
          session_id: sessionId,
          business_id: businessId,
          detected_intent: detectedIntent,
          caller_keywords: callerKeywords,
          caller_sentiment: callerSentiment,
        },
      });

      if (error) throw error;
      return data;
    },
  });
}

// ============================================
// OUTCOME SCORING
// ============================================

export function useScoreOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      callLogId?: string;
      businessId: string;
      conversionAchieved?: boolean;
      conversionType?: string;
      conversionValue?: number;
      durationSeconds?: number;
      finalSentiment?: string;
      explicitFeedback?: string;
      aiParticipated?: boolean;
      playbookId?: string;
      styleProfileId?: string;
      humanHandled?: boolean;
      humanUserId?: string;
      escalationOccurred?: boolean;
      escalationReason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-outcome-scorer', {
        body: {
          session_id: params.sessionId,
          call_log_id: params.callLogId,
          business_id: params.businessId,
          conversion_achieved: params.conversionAchieved,
          conversion_type: params.conversionType,
          conversion_value: params.conversionValue,
          duration_seconds: params.durationSeconds,
          final_sentiment: params.finalSentiment,
          explicit_feedback: params.explicitFeedback,
          ai_participated: params.aiParticipated,
          playbook_id: params.playbookId,
          style_profile_id: params.styleProfileId,
          human_handled: params.humanHandled,
          human_user_id: params.humanUserId,
          escalation_occurred: params.escalationOccurred,
          escalation_reason: params.escalationReason,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-outcome-scores'] });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      queryClient.invalidateQueries({ queryKey: ['speaker-styles'] });
    },
  });
}

// ============================================
// TECHNIQUE EXTRACTION
// ============================================

export function useExtractTechniques() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      callLogId: string;
      sessionId: string;
      businessId: string;
      humanUserId: string;
      humanName?: string;
      transcript: string;
      outcomeScore: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-technique-extractor', {
        body: {
          call_log_id: params.callLogId,
          session_id: params.sessionId,
          business_id: params.businessId,
          human_user_id: params.humanUserId,
          human_name: params.humanName,
          transcript: params.transcript,
          outcome_score: params.outcomeScore,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['technique-extractions'] });
      toast({ 
        title: `${data.techniques_extracted} techniques extracted`,
        description: "Human approval required before AI can use them.",
      });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to extract techniques", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}
