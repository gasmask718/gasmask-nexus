/**
 * SIMULATION MODE CONTEXT — GLOBAL SYSTEM CONTROL
 * 
 * 🧠👑 MASTER GENIUS PROMPT — LEVEL-10 EMPIRE-SAFE IMPLEMENTATION
 * 
 * SYSTEM LAW (NON-NEGOTIABLE):
 * - This is NOT a UI feature. This is a system-level control law.
 * - Simulation mode is stored in the DATABASE as the source of truth.
 * - ONLY owner/admin roles may change the mode.
 * - Live businesses are ALWAYS forced to live mode.
 * - All mode changes are audited.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SimScenario, getSimulationScenario, SimulationState } from '@/lib/simulation/scenarioData';
import { isLiveBusiness, LIVE_BUSINESSES } from '@/config/liveBusinesses';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

// System mode (database enforced)
export type SystemMode = 'simulation' | 'live';

// Legacy type for backwards compatibility
export type SimulationModeState = 'on' | 'off' | 'auto';

// Source of the simulation state decision
export type SimulationSource = 'database' | 'forced_live' | 'loading';

interface SimulationModeSettings {
  mode: SystemMode;
  locked_for_non_admins: boolean;
}

interface SimulationModeContextType {
  // Core state (synced with database)
  simulationMode: boolean;
  systemMode: SystemMode;
  source: SimulationSource;
  isLoading: boolean;
  
  // Controls (admin only)
  setSystemMode: (mode: SystemMode) => Promise<boolean>;
  toggleSystemMode: () => Promise<boolean>;
  setLockedForNonAdmins: (locked: boolean) => Promise<boolean>;
  
  // Status
  lockedForNonAdmins: boolean;
  canToggle: boolean;
  lastChangedBy: string | null;
  lastChangedAt: Date | null;
  
  // Business awareness
  currentBusinessSlug: string | null;
  setCurrentBusinessSlug: (slug: string | null) => void;
  isLiveBusinessActive: boolean;
  
  // Scenario (for simulation content selection)
  scenario: SimScenario;
  setScenario: (scenario: SimScenario) => void;
  simulationData: SimulationState;
  
  // Legacy compatibility
  modeState: 'on' | 'off' | 'auto';
  setModeState: (state: 'on' | 'off' | 'auto') => void;
  setSimulationMode: (value: boolean) => void;
  toggleSimulationMode: () => void;
}

const SimulationModeContext = createContext<SimulationModeContextType | undefined>(undefined);

export function SimulationModeProvider({ children }: { children: ReactNode }) {
  // Database-synced state
  const [settings, setSettings] = useState<SimulationModeSettings>({ mode: 'live', locked_for_non_admins: false });
  const [isLoading, setIsLoading] = useState(true);
  const [lastChangedBy, setLastChangedBy] = useState<string | null>(null);
  const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null);
  
  // Get user role for permission checks
  const { isAdmin, role, loading: roleLoading } = useUserRole();

  // Current business slug for enforcement
  const [currentBusinessSlug, setCurrentBusinessSlug] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('sim:businessSlug') || null;
  });

  // Scenario selection (local state for demo content)
  const [scenario, setScenario] = useState<SimScenario>(() => {
    if (typeof window === 'undefined') return 'normal';
    const stored = window.localStorage.getItem('sim:scenario') as SimScenario | null;
    return stored === 'normal' || stored === 'heavy_issue' || stored === 'low_volume' ? stored : 'normal';
  });

  // Persist business slug to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentBusinessSlug) {
      window.localStorage.setItem('sim:businessSlug', currentBusinessSlug);
    }
  }, [currentBusinessSlug]);

  // Persist scenario to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sim:scenario', scenario);
  }, [scenario]);

  // Fetch settings from database
  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value, last_changed_by, last_changed_at')
        .eq('setting_key', 'simulation_mode')
        .single();

      if (error) {
        console.error('[SIMULATION] Error fetching settings:', error);
        // Default to live mode on error (safety first)
        setSettings({ mode: 'live', locked_for_non_admins: false });
      } else if (data) {
        const rawValue = data.setting_value as Record<string, unknown> | null;
        const mode = (rawValue?.mode as SystemMode) || 'live';
        const locked = (rawValue?.locked_for_non_admins as boolean) || false;
        setSettings({ mode, locked_for_non_admins: locked });
        setLastChangedBy(data.last_changed_by);
        setLastChangedAt(data.last_changed_at ? new Date(data.last_changed_at) : null);
      }
    } catch (err) {
      console.error('[SIMULATION] Failed to fetch settings:', err);
      setSettings({ mode: 'live', locked_for_non_admins: false });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchSettings();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('simulation_mode_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
          filter: 'setting_key=eq.simulation_mode'
        },
        (payload) => {
          console.log('[SIMULATION] Mode changed via realtime:', payload.new);
          const value = payload.new.setting_value as SimulationModeSettings;
          setSettings({
            mode: value.mode || 'live',
            locked_for_non_admins: value.locked_for_non_admins || false
          });
          setLastChangedBy(payload.new.last_changed_by);
          setLastChangedAt(payload.new.last_changed_at ? new Date(payload.new.last_changed_at) : null);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchSettings]);

  // Check if current business is live (protected)
  const isLiveBusinessActive = useMemo(() => {
    return isLiveBusiness(currentBusinessSlug);
  }, [currentBusinessSlug]);

  // Compute final simulation state and source
  const { simulationMode, source } = useMemo((): { simulationMode: boolean; source: SimulationSource } => {
    if (isLoading) {
      return { simulationMode: false, source: 'loading' };
    }
    
    // RULE 1: Live businesses ALWAYS get real data, no override allowed
    if (isLiveBusinessActive) {
      return { simulationMode: false, source: 'forced_live' };
    }

    // RULE 2: Database is the source of truth
    return { 
      simulationMode: settings.mode === 'simulation', 
      source: 'database' 
    };
  }, [settings.mode, isLiveBusinessActive, isLoading]);

  // Can user toggle the mode?
  const canToggle = useMemo(() => {
    if (roleLoading) return false;
    if (isLiveBusinessActive) return false;
    if (!isAdmin()) return false;
    return true;
  }, [isAdmin, isLiveBusinessActive, roleLoading]);

  // Update system mode in database
  const setSystemMode = useCallback(async (mode: SystemMode): Promise<boolean> => {
    // Check permissions
    if (!canToggle) {
      console.warn('[SIMULATION] User does not have permission to change mode');
      return false;
    }

    // Block enabling simulation on live business
    if (mode === 'simulation' && isLiveBusinessActive) {
      console.warn(`[SIMULATION] Cannot enable simulation for live business "${currentBusinessSlug}"`);
      return false;
    }

    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: {
            mode,
            locked_for_non_admins: settings.locked_for_non_admins
          }
        })
        .eq('setting_key', 'simulation_mode');

      if (error) {
        console.error('[SIMULATION] Failed to update mode:', error);
        return false;
      }

      // Log the audit entry (columns: action, user_role, previous_mode, new_mode, reason, metadata)
      await supabase.from('simulation_mode_audit').insert({
        action: 'mode_change',
        user_role: role,
        previous_mode: settings.mode,
        new_mode: mode,
        reason: `User switched mode from ${settings.mode} to ${mode}`
      });

      return true;
    } catch (err) {
      console.error('[SIMULATION] Error updating mode:', err);
      return false;
    }
  }, [canToggle, isLiveBusinessActive, currentBusinessSlug, settings, role]);

  // Toggle between simulation and live
  const toggleSystemMode = useCallback(async (): Promise<boolean> => {
    const newMode = settings.mode === 'simulation' ? 'live' : 'simulation';
    return setSystemMode(newMode);
  }, [settings.mode, setSystemMode]);

  // Set admin lock
  const setLockedForNonAdmins = useCallback(async (locked: boolean): Promise<boolean> => {
    if (!canToggle) {
      console.warn('[SIMULATION] User does not have permission to change lock');
      return false;
    }

    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: {
            mode: settings.mode,
            locked_for_non_admins: locked
          }
        })
        .eq('setting_key', 'simulation_mode');

      if (error) {
        console.error('[SIMULATION] Failed to update lock:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[SIMULATION] Error updating lock:', err);
      return false;
    }
  }, [canToggle, settings.mode]);

  // Get scenario data
  const simulationData = useMemo(() => {
    return getSimulationScenario(scenario);
  }, [scenario]);

  // Legacy compatibility: modeState
  const modeState = useMemo((): 'on' | 'off' | 'auto' => {
    if (isLoading) return 'auto';
    return settings.mode === 'simulation' ? 'on' : 'off';
  }, [settings.mode, isLoading]);

  // Legacy: setModeState
  const setModeState = useCallback((state: 'on' | 'off' | 'auto') => {
    if (state === 'on') {
      setSystemMode('simulation');
    } else if (state === 'off') {
      setSystemMode('live');
    }
    // 'auto' is ignored in the new system
  }, [setSystemMode]);

  // Legacy: setSimulationMode
  const setSimulationMode = useCallback((value: boolean) => {
    setSystemMode(value ? 'simulation' : 'live');
  }, [setSystemMode]);

  // Legacy: toggleSimulationMode (sync version for compat)
  const toggleSimulationMode = useCallback(() => {
    toggleSystemMode();
  }, [toggleSystemMode]);

  return (
    <SimulationModeContext.Provider value={{ 
      simulationMode,
      systemMode: settings.mode,
      source,
      isLoading,
      setSystemMode,
      toggleSystemMode,
      setLockedForNonAdmins,
      lockedForNonAdmins: settings.locked_for_non_admins,
      canToggle,
      lastChangedBy,
      lastChangedAt,
      currentBusinessSlug,
      setCurrentBusinessSlug,
      isLiveBusinessActive,
      scenario,
      setScenario,
      simulationData,
      // Legacy
      modeState,
      setModeState,
      setSimulationMode,
      toggleSimulationMode
    }}>
      {children}
    </SimulationModeContext.Provider>
  );
}

export function useSimulationMode() {
  const context = useContext(SimulationModeContext);
  // Return safe defaults if not in provider
  if (context === undefined) {
    return {
      simulationMode: false,
      systemMode: 'live' as SystemMode,
      source: 'loading' as SimulationSource,
      isLoading: true,
      setSystemMode: async () => false,
      toggleSystemMode: async () => false,
      setLockedForNonAdmins: async () => false,
      lockedForNonAdmins: false,
      canToggle: false,
      lastChangedBy: null,
      lastChangedAt: null,
      currentBusinessSlug: null,
      setCurrentBusinessSlug: () => {},
      isLiveBusinessActive: false,
      scenario: 'normal' as SimScenario,
      setScenario: () => {},
      simulationData: getSimulationScenario('normal'),
      // Legacy
      modeState: 'off' as const,
      setModeState: () => {},
      setSimulationMode: () => {},
      toggleSimulationMode: () => {},
    };
  }
  return context;
}

/**
 * Hook for components that need to know if simulation is allowed
 */
export function useCanSimulate(businessSlug?: string | null) {
  const { isLiveBusinessActive, simulationMode, source } = useSimulationMode();
  
  const canSimulate = useMemo(() => {
    // Check passed business slug or context
    if (businessSlug && isLiveBusiness(businessSlug)) {
      return false;
    }
    return !isLiveBusinessActive;
  }, [businessSlug, isLiveBusinessActive]);

  return {
    canSimulate,
    isSimulating: simulationMode && canSimulate,
    source,
  };
}

// Simulation badge component for marking simulated data
export function SimulationBadge({
  className = '',
  text = 'Simulated Data',
  tooltip = 'Demo-only data for preview. No simulated data is written to the database.',
}: {
  className?: string;
  text?: string;
  tooltip?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex cursor-help items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// Wrapper component for simulated content sections
export function SimulatedSection({ children, label = 'Simulated Data' }: { children: ReactNode; label?: string }) {
  return (
    <div className="relative border border-dashed border-amber-300 dark:border-amber-700 rounded-lg p-4">
      <div className="absolute -top-2.5 left-3 px-2 bg-background">
        <SimulationBadge />
      </div>
      {children}
    </div>
  );
}

// Empty state with guidance for low-volume scenario
export function EmptyStateWithGuidance({ 
  title, 
  description, 
  actionLabel, 
  onAction,
  icon: Icon
}: { 
  title: string; 
  description: string; 
  actionLabel?: string; 
  onAction?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && (
        <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">{description}</p>
      {actionLabel && onAction && (
        <button 
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
