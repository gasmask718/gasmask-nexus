/**
 * SIMULATION MODE CONTEXT
 * 
 * Production-grade simulation toggle with business-aware controls.
 * 
 * SYSTEM LAW (DO NOT VIOLATE):
 * - Simulation mode is a tool, not a default.
 * - Live businesses must NEVER be simulated.
 * - Production environment defaults to OFF.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SimScenario, getSimulationScenario, SimulationState } from '@/lib/simulation/scenarioData';
import { isLiveBusiness, LIVE_BUSINESSES } from '@/config/liveBusinesses';

// Simulation mode can be: ON, OFF, or AUTO (environment-based)
export type SimulationModeState = 'on' | 'off' | 'auto';

// Source of the simulation state decision
export type SimulationSource = 'env' | 'admin' | 'forced_off';

interface SimulationModeContextType {
  // Core state
  simulationMode: boolean;
  modeState: SimulationModeState;
  source: SimulationSource;
  
  // Controls
  setModeState: (state: SimulationModeState) => void;
  setSimulationMode: (value: boolean) => void;
  toggleSimulationMode: () => void;
  
  // Business awareness
  currentBusinessSlug: string | null;
  setCurrentBusinessSlug: (slug: string | null) => void;
  isLiveBusinessActive: boolean;
  
  // Scenario
  scenario: SimScenario;
  setScenario: (scenario: SimScenario) => void;
  simulationData: SimulationState;
}

const SimulationModeContext = createContext<SimulationModeContextType | undefined>(undefined);

// Environment check
const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('lovable'));

export function SimulationModeProvider({ children }: { children: ReactNode }) {
  // Admin-controlled mode state (on/off/auto)
  const [modeState, setModeStateInternal] = useState<SimulationModeState>(() => {
    if (typeof window === 'undefined') return 'auto';
    const stored = window.localStorage.getItem('sim:modeState') as SimulationModeState | null;
    return stored === 'on' || stored === 'off' || stored === 'auto' ? stored : 'auto';
  });

  // Current business slug for enforcement
  const [currentBusinessSlug, setCurrentBusinessSlug] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('sim:businessSlug') || null;
  });

  // Scenario selection
  const [scenario, setScenario] = useState<SimScenario>(() => {
    if (typeof window === 'undefined') return 'normal';
    const stored = window.localStorage.getItem('sim:scenario') as SimScenario | null;
    return stored === 'normal' || stored === 'heavy_issue' || stored === 'low_volume' ? stored : 'normal';
  });

  // Persist state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sim:modeState', modeState);
  }, [modeState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentBusinessSlug) {
      window.localStorage.setItem('sim:businessSlug', currentBusinessSlug);
    }
  }, [currentBusinessSlug]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sim:scenario', scenario);
  }, [scenario]);

  // Check if current business is live (protected)
  const isLiveBusinessActive = useMemo(() => {
    return isLiveBusiness(currentBusinessSlug);
  }, [currentBusinessSlug]);

  // Compute final simulation state and source
  const { simulationMode, source } = useMemo((): { simulationMode: boolean; source: SimulationSource } => {
    // RULE 1: Live businesses ALWAYS get real data, no override allowed
    if (isLiveBusinessActive) {
      return { simulationMode: false, source: 'forced_off' };
    }

    // RULE 2: Admin explicit control
    if (modeState === 'on') {
      return { simulationMode: true, source: 'admin' };
    }
    if (modeState === 'off') {
      return { simulationMode: false, source: 'admin' };
    }

    // RULE 3: AUTO mode - environment-based
    // Development/Lovable preview = ON, Production = OFF
    return { simulationMode: isDev, source: 'env' };
  }, [modeState, isLiveBusinessActive]);

  // Wrapper to set mode state with logging
  const setModeState = useCallback((state: SimulationModeState) => {
    // Log attempt to enable simulation on live business
    if (state === 'on' && isLiveBusinessActive) {
      console.warn(
        `⚠️ [SIMULATION] Attempted to enable simulation for live business "${currentBusinessSlug}". ` +
        `This is blocked. Live businesses: ${LIVE_BUSINESSES.join(', ')}`
      );
      return; // Block the change
    }
    setModeStateInternal(state);
  }, [isLiveBusinessActive, currentBusinessSlug]);

  // Legacy toggle support
  const toggleSimulationMode = useCallback(() => {
    if (isLiveBusinessActive) {
      console.warn('⚠️ [SIMULATION] Cannot toggle simulation for live business');
      return;
    }
    setModeStateInternal(prev => prev === 'on' ? 'off' : 'on');
  }, [isLiveBusinessActive]);

  // Legacy setter support
  const setSimulationMode = useCallback((value: boolean) => {
    if (isLiveBusinessActive && value) {
      console.warn('⚠️ [SIMULATION] Cannot enable simulation for live business');
      return;
    }
    setModeStateInternal(value ? 'on' : 'off');
  }, [isLiveBusinessActive]);

  // Get scenario data
  const simulationData = useMemo(() => {
    return getSimulationScenario(scenario);
  }, [scenario]);

  return (
    <SimulationModeContext.Provider value={{ 
      simulationMode,
      modeState,
      source,
      setModeState,
      setSimulationMode, 
      toggleSimulationMode,
      currentBusinessSlug,
      setCurrentBusinessSlug,
      isLiveBusinessActive,
      scenario,
      setScenario,
      simulationData
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
      modeState: 'auto' as SimulationModeState,
      source: 'env' as SimulationSource,
      setModeState: () => {},
      setSimulationMode: () => {},
      toggleSimulationMode: () => {},
      currentBusinessSlug: null,
      setCurrentBusinessSlug: () => {},
      isLiveBusinessActive: false,
      scenario: 'normal' as SimScenario,
      setScenario: () => {},
      simulationData: getSimulationScenario('normal'),
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
