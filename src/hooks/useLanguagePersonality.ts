import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LanguageProfile {
  id: string;
  code: string;
  dialect_code: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface PersonalityProfile {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  base_tone: string;
  formality: string;
  emoji_style: string | null;
  slang_level: string | null;
  language_profile_id: string | null;
  created_at: string;
}

export interface RegionCommunicationStyle {
  id: string;
  boro: string | null;
  neighborhood: string | null;
  recommended_personality_id: string | null;
  default_formality: string | null;
  notes: string | null;
  created_at: string;
}

export interface MessageLanguageDetection {
  id: string;
  message_id: string | null;
  detected_language: string | null;
  detected_dialect: string | null;
  detected_formality: string | null;
  confidence: number | null;
  created_at: string;
}

export interface AgentToneCorrection {
  id: string;
  agent_id: string | null;
  message_id: string | null;
  previous_tone: string | null;
  corrected_tone: string | null;
  reason: string | null;
  created_at: string;
}

export function useLanguagePersonality(businessId?: string) {
  const queryClient = useQueryClient();

  // Fetch language profiles
  const { data: languageProfiles, isLoading: loadingLanguages } = useQuery({
    queryKey: ['language-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('language_profiles')
        .select('*')
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data as LanguageProfile[];
    }
  });

  // Fetch personality profiles
  const { data: personalityProfiles, isLoading: loadingPersonalities } = useQuery({
    queryKey: ['personality-profiles', businessId],
    queryFn: async () => {
      let query = supabase
        .from('personality_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (businessId) {
        query = query.or(`business_id.eq.${businessId},business_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PersonalityProfile[];
    }
  });

  // Fetch region communication styles
  const { data: regionStyles, isLoading: loadingRegionStyles } = useQuery({
    queryKey: ['region-communication-styles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('region_communication_styles')
        .select('*')
        .order('boro');
      if (error) throw error;
      return data as RegionCommunicationStyle[];
    }
  });

  // Fetch language detection stats
  const { data: languageStats } = useQuery({
    queryKey: ['language-detection-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_language_detection')
        .select('detected_language, confidence')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      
      // Calculate distribution
      const distribution: Record<string, number> = {};
      data?.forEach((d) => {
        if (d.detected_language) {
          distribution[d.detected_language] = (distribution[d.detected_language] || 0) + 1;
        }
      });
      
      return {
        total: data?.length || 0,
        distribution
      };
    }
  });

  // Fetch tone corrections
  const { data: toneCorrections, isLoading: loadingCorrections } = useQuery({
    queryKey: ['agent-tone-corrections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_tone_corrections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AgentToneCorrection[];
    }
  });

  // Create personality profile mutation
  const createPersonalityMutation = useMutation({
    mutationFn: async (profile: Omit<PersonalityProfile, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('personality_profiles')
        .insert(profile)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personality-profiles'] });
    }
  });

  // Update personality profile mutation
  const updatePersonalityMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PersonalityProfile> & { id: string }) => {
      const { data, error } = await supabase
        .from('personality_profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personality-profiles'] });
    }
  });

  // Create region style mutation
  const createRegionStyleMutation = useMutation({
    mutationFn: async (style: Omit<RegionCommunicationStyle, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('region_communication_styles')
        .insert(style)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['region-communication-styles'] });
    }
  });

  return {
    languageProfiles,
    personalityProfiles,
    regionStyles,
    languageStats,
    toneCorrections,
    isLoading: loadingLanguages || loadingPersonalities || loadingRegionStyles || loadingCorrections,
    createPersonality: createPersonalityMutation.mutate,
    updatePersonality: updatePersonalityMutation.mutate,
    createRegionStyle: createRegionStyleMutation.mutate,
  };
}
