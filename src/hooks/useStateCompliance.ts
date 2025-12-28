import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type SupportedState = 'NY' | 'GA' | 'CA';
export type FormatTag = 'sportsbook_prop' | 'same_game_parlay' | 'fantasy_pickem' | 'live_bet';
export type PlatformKey = 'draftkings' | 'fanduel' | 'betmgm' | 'caesars' | 'underdog' | 'prizepicks' | 'betr';

export interface StateRules {
  id: string;
  state_code: string;
  enabled_platforms: PlatformKey[];
  enabled_formats: FormatTag[];
  disabled_platforms: PlatformKey[];
  disabled_formats: FormatTag[];
  tooltip_text: string | null;
  is_active: boolean;
  version: number;
}

export interface Platform {
  platform_key: PlatformKey;
  platform_name: string;
  platform_type: 'sportsbook' | 'fantasy_pickem';
  is_active: boolean;
}

export interface UserStateProfile {
  user_id: string;
  user_state: SupportedState;
  last_state_update: string;
  state_source: string;
}

export interface Bankroll {
  id: string;
  user_id: string;
  global_bankroll: number;
  state_bankrolls: Record<SupportedState, number>;
  max_pct_per_entry: number;
  max_pct_per_state_per_day: number;
}

export function useStateCompliance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's state profile
  const { data: userStateProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['user-state-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_state_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserStateProfile | null;
    },
  });

  // Fetch all state rules
  const { data: stateRules, isLoading: isLoadingRules } = useQuery({
    queryKey: ['state-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('state_rules')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      return (data || []).map(rule => ({
        ...rule,
        enabled_platforms: rule.enabled_platforms as PlatformKey[],
        enabled_formats: rule.enabled_formats as FormatTag[],
        disabled_platforms: rule.disabled_platforms as PlatformKey[],
        disabled_formats: rule.disabled_formats as FormatTag[],
      })) as StateRules[];
    },
  });

  // Fetch all platforms
  const { data: platforms, isLoading: isLoadingPlatforms } = useQuery({
    queryKey: ['platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      return data as Platform[];
    },
  });

  // Fetch user's bankroll
  const { data: bankroll, isLoading: isLoadingBankroll } = useQuery({
    queryKey: ['user-bankroll'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('bankrolls')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data ? {
        ...data,
        state_bankrolls: data.state_bankrolls as Record<SupportedState, number>,
      } as Bankroll : null;
    },
  });

  // Current user state (defaults to NY if not set)
  const currentState: SupportedState = userStateProfile?.user_state || 'NY';

  // Get rules for current state
  const currentStateRules = useMemo(() => {
    return stateRules?.find(r => r.state_code === currentState) || null;
  }, [stateRules, currentState]);

  // Get active rules for a specific state
  const getActiveStateRules = useCallback((stateCode: SupportedState): StateRules | null => {
    return stateRules?.find(r => r.state_code === stateCode) || null;
  }, [stateRules]);

  // Check if platform is allowed in current state
  const isPlatformAllowed = useCallback((platformKey: PlatformKey, stateCode?: SupportedState): boolean => {
    const rules = stateCode ? getActiveStateRules(stateCode) : currentStateRules;
    if (!rules) return false;
    return rules.enabled_platforms.includes(platformKey);
  }, [currentStateRules, getActiveStateRules]);

  // Check if format is allowed in current state
  const isFormatAllowed = useCallback((formatTag: FormatTag, stateCode?: SupportedState): boolean => {
    const rules = stateCode ? getActiveStateRules(stateCode) : currentStateRules;
    if (!rules) return false;
    return rules.enabled_formats.includes(formatTag);
  }, [currentStateRules, getActiveStateRules]);

  // Get allowed platforms for current state
  const allowedPlatforms = useMemo(() => {
    if (!platforms || !currentStateRules) return [];
    return platforms.filter(p => currentStateRules.enabled_platforms.includes(p.platform_key));
  }, [platforms, currentStateRules]);

  // Get disabled platforms for current state
  const disabledPlatforms = useMemo(() => {
    if (!platforms || !currentStateRules) return [];
    return platforms.filter(p => currentStateRules.disabled_platforms.includes(p.platform_key));
  }, [platforms, currentStateRules]);

  // Get allowed formats for current state
  const allowedFormats = useMemo(() => {
    return currentStateRules?.enabled_formats || [];
  }, [currentStateRules]);

  // Update user state mutation
  const updateUserStateMutation = useMutation({
    mutationFn: async (newState: SupportedState) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('user_state_profile')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_state_profile')
          .update({
            user_state: newState,
            last_state_update: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_state_profile')
          .insert({
            user_id: user.id,
            user_state: newState,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-state-profile'] });
      toast({
        title: 'State Updated',
        description: 'Your state preference has been saved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update state preference.',
        variant: 'destructive',
      });
    },
  });

  // Update bankroll mutation
  const updateBankrollMutation = useMutation({
    mutationFn: async (updates: Partial<Omit<Bankroll, 'id' | 'user_id'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('bankrolls')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('bankrolls')
          .update(updates)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bankrolls')
          .insert({
            user_id: user.id,
            ...updates,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-bankroll'] });
    },
  });

  // Validate stake against bankroll limits
  const validateStake = useCallback((
    stake: number,
    dailyTotalForState: number = 0
  ): { valid: boolean; error?: string } => {
    if (!bankroll) {
      return { valid: true }; // No bankroll set, allow
    }

    const maxPerEntry = bankroll.global_bankroll * bankroll.max_pct_per_entry;
    if (stake > maxPerEntry) {
      return {
        valid: false,
        error: `Stake exceeds max per entry (${(bankroll.max_pct_per_entry * 100).toFixed(0)}% = $${maxPerEntry.toFixed(2)})`,
      };
    }

    const stateBankroll = bankroll.state_bankrolls[currentState] || 0;
    const maxPerDay = stateBankroll * bankroll.max_pct_per_state_per_day;
    if (dailyTotalForState + stake > maxPerDay) {
      return {
        valid: false,
        error: `Daily state limit exceeded (${(bankroll.max_pct_per_state_per_day * 100).toFixed(0)}% = $${maxPerDay.toFixed(2)})`,
      };
    }

    return { valid: true };
  }, [bankroll, currentState]);

  return {
    // Loading states
    isLoading: isLoadingProfile || isLoadingRules || isLoadingPlatforms || isLoadingBankroll,
    
    // Current state
    currentState,
    userStateProfile,
    
    // Rules
    currentStateRules,
    stateRules,
    getActiveStateRules,
    
    // Platforms
    platforms,
    allowedPlatforms,
    disabledPlatforms,
    
    // Formats
    allowedFormats,
    
    // Gating functions
    isPlatformAllowed,
    isFormatAllowed,
    
    // Bankroll
    bankroll,
    validateStake,
    
    // Mutations
    updateUserState: updateUserStateMutation.mutate,
    isUpdatingState: updateUserStateMutation.isPending,
    updateBankroll: updateBankrollMutation.mutate,
    isUpdatingBankroll: updateBankrollMutation.isPending,
  };
}

// Format display names
export const FORMAT_LABELS: Record<FormatTag, string> = {
  sportsbook_prop: 'Sportsbook Prop',
  same_game_parlay: 'Same Game Parlay',
  fantasy_pickem: 'Fantasy Pick\'em',
  live_bet: 'Live Position',
};

// State display names
export const STATE_LABELS: Record<SupportedState, string> = {
  NY: 'New York',
  GA: 'Georgia',
  CA: 'California',
};
