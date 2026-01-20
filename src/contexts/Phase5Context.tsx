/**
 * PHASE 5 CONTEXT — SHADOW MODE CONTROL
 * 
 * Predictive Autonomy & Adaptive Governance
 * 
 * MODE RULES (NON-NEGOTIABLE):
 * - OFF: Phase 5 is disabled. No recommendations generated.
 * - SHADOW: Phase 5 observes, recommends, but NEVER acts. Humans decide.
 * - ACTIVE: Phase 5 can auto-approve within strict bounds. (FUTURE - NOT YET IMPLEMENTED)
 * 
 * KILL SWITCH: Immediately disables all Phase 5 activity.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useQueryClient } from '@tanstack/react-query';

export type Phase5Mode = 'off' | 'shadow' | 'active';

interface Phase5Settings {
  mode: Phase5Mode;
  enabled: boolean;
  kill_switch: boolean;
}

interface Phase5Stats {
  totalRecommendations: number;
  agreementRate: number;
  pendingReview: number;
  patternsDetected: number;
}

interface Phase5ContextType {
  // Core state
  mode: Phase5Mode;
  enabled: boolean;
  killSwitchActive: boolean;
  isLoading: boolean;
  
  // Controls (admin only)
  setMode: (mode: Phase5Mode) => Promise<boolean>;
  toggleKillSwitch: () => Promise<boolean>;
  
  // Status
  canControl: boolean;
  stats: Phase5Stats | null;
  
  // Helpers
  isShadowMode: boolean;
  isActiveMode: boolean;
  isObserving: boolean; // true if shadow or active
  
  // Refresh
  refreshStats: () => Promise<void>;
}

const Phase5Context = createContext<Phase5ContextType | undefined>(undefined);

const DEFAULT_STATS: Phase5Stats = {
  totalRecommendations: 0,
  agreementRate: 0,
  pendingReview: 0,
  patternsDetected: 0,
};

export function Phase5Provider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Phase5Settings>({ 
    mode: 'shadow', 
    enabled: true, 
    kill_switch: false 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Phase5Stats | null>(null);
  
  const { isAdmin, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();

  // Fetch settings from database
  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_phase5_mode');
      
      if (error) {
        console.error('[PHASE5] Error fetching settings:', error);
        setSettings({ mode: 'off', enabled: false, kill_switch: false });
      } else if (data) {
        const parsed = data as unknown as Phase5Settings;
        setSettings({
          mode: parsed.mode || 'off',
          enabled: parsed.enabled ?? false,
          kill_switch: parsed.kill_switch ?? false,
        });
      }
    } catch (err) {
      console.error('[PHASE5] Failed to fetch settings:', err);
      setSettings({ mode: 'off', enabled: false, kill_switch: false });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch stats
  const refreshStats = useCallback(async () => {
    try {
      // Get total recommendations
      const { count: totalRecs } = await supabase
        .from('phase5_recommendations')
        .select('*', { count: 'exact', head: true });

      // Get agreement count
      const { data: agreements } = await supabase
        .from('phase5_agreement_log')
        .select('agreed');

      const agreedCount = agreements?.filter(a => a.agreed).length || 0;
      const totalAgreements = agreements?.length || 0;
      const agreementRate = totalAgreements > 0 ? (agreedCount / totalAgreements) * 100 : 0;

      // Get pending reviews
      const { count: pending } = await supabase
        .from('phase5_recommendations')
        .select('*', { count: 'exact', head: true })
        .is('resolved_at', null);

      // Get patterns count
      const { count: patterns } = await supabase
        .from('phase5_pattern_observations')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalRecommendations: totalRecs || 0,
        agreementRate: Math.round(agreementRate * 10) / 10,
        pendingReview: pending || 0,
        patternsDetected: patterns || 0,
      });
    } catch (err) {
      console.error('[PHASE5] Failed to fetch stats:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSettings();
    refreshStats();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('phase5_mode_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
          filter: 'setting_key=eq.phase5_mode'
        },
        (payload) => {
          console.log('[PHASE5] Mode changed via realtime:', payload.new);
          const value = payload.new.setting_value as Phase5Settings;
          setSettings({
            mode: value.mode || 'off',
            enabled: value.enabled ?? false,
            kill_switch: value.kill_switch ?? false,
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchSettings, refreshStats]);

  // Can user control Phase 5?
  const canControl = useMemo(() => {
    if (roleLoading) return false;
    return isAdmin();
  }, [isAdmin, roleLoading]);

  // Set mode
  const setMode = useCallback(async (newMode: Phase5Mode): Promise<boolean> => {
    if (!canControl) {
      console.warn('[PHASE5] User does not have permission to change mode');
      return false;
    }

    // SAFETY: Active mode is not yet implemented
    if (newMode === 'active') {
      console.warn('[PHASE5] Active mode is not yet implemented');
      return false;
    }

    try {
      const { error } = await supabase.rpc('set_phase5_mode', {
        p_mode: newMode,
        p_enabled: true,
        p_kill_switch: settings.kill_switch,
      });

      if (error) {
        console.error('[PHASE5] Failed to set mode:', error);
        return false;
      }

      queryClient.invalidateQueries();
      console.log('[PHASE5] Mode changed to', newMode);
      return true;
    } catch (err) {
      console.error('[PHASE5] Error setting mode:', err);
      return false;
    }
  }, [canControl, settings.kill_switch, queryClient]);

  // Toggle kill switch
  const toggleKillSwitch = useCallback(async (): Promise<boolean> => {
    if (!canControl) {
      console.warn('[PHASE5] User does not have permission to toggle kill switch');
      return false;
    }

    try {
      const newKillSwitch = !settings.kill_switch;
      const { error } = await supabase.rpc('set_phase5_mode', {
        p_mode: newKillSwitch ? 'off' : settings.mode,
        p_enabled: !newKillSwitch,
        p_kill_switch: newKillSwitch,
      });

      if (error) {
        console.error('[PHASE5] Failed to toggle kill switch:', error);
        return false;
      }

      console.log('[PHASE5] Kill switch', newKillSwitch ? 'ACTIVATED' : 'deactivated');
      return true;
    } catch (err) {
      console.error('[PHASE5] Error toggling kill switch:', err);
      return false;
    }
  }, [canControl, settings]);

  // Derived state
  const isShadowMode = settings.mode === 'shadow' && settings.enabled && !settings.kill_switch;
  const isActiveMode = settings.mode === 'active' && settings.enabled && !settings.kill_switch;
  const isObserving = (isShadowMode || isActiveMode) && !settings.kill_switch;

  return (
    <Phase5Context.Provider value={{
      mode: settings.mode,
      enabled: settings.enabled,
      killSwitchActive: settings.kill_switch,
      isLoading,
      setMode,
      toggleKillSwitch,
      canControl,
      stats,
      isShadowMode,
      isActiveMode,
      isObserving,
      refreshStats,
    }}>
      {children}
    </Phase5Context.Provider>
  );
}

export function usePhase5() {
  const context = useContext(Phase5Context);
  if (context === undefined) {
    // Safe defaults if not in provider
    return {
      mode: 'off' as Phase5Mode,
      enabled: false,
      killSwitchActive: false,
      isLoading: true,
      setMode: async () => false,
      toggleKillSwitch: async () => false,
      canControl: false,
      stats: null,
      isShadowMode: false,
      isActiveMode: false,
      isObserving: false,
      refreshStats: async () => {},
    };
  }
  return context;
}
