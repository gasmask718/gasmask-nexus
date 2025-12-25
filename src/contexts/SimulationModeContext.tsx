import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SimScenario, getSimulationScenario, SimulationState } from '@/lib/simulation/scenarioData';

interface SimulationModeContextType {
  simulationMode: boolean;
  setSimulationMode: (value: boolean) => void;
  toggleSimulationMode: () => void;
  scenario: SimScenario;
  setScenario: (scenario: SimScenario) => void;
  simulationData: SimulationState;
}

const SimulationModeContext = createContext<SimulationModeContextType | undefined>(undefined);

export function SimulationModeProvider({ children }: { children: ReactNode }) {
  const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('lovable'));

  const [simulationMode, setSimulationMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('sim:mode');
    if (stored === '1') return true;
    if (stored === '0') return false;
    // Force demo data ON by default in Lovable preview/dev
    return isDev;
  });

  const [scenario, setScenario] = useState<SimScenario>(() => {
    if (typeof window === 'undefined') return 'normal';
    const stored = window.localStorage.getItem('sim:scenario') as SimScenario | null;
    return stored === 'normal' || stored === 'heavy_issue' || stored === 'low_volume' ? stored : 'normal';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sim:mode', simulationMode ? '1' : '0');
  }, [simulationMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sim:scenario', scenario);
  }, [scenario]);

  const toggleSimulationMode = useCallback(() => {
    setSimulationMode(prev => !prev);
  }, []);

  const simulationData = useMemo(() => {
    return getSimulationScenario(scenario);
  }, [scenario]);

  return (
    <SimulationModeContext.Provider value={{ 
      simulationMode, 
      setSimulationMode, 
      toggleSimulationMode,
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
  // Return default values if not in provider (graceful fallback for edge cases)
  if (context === undefined) {
    return {
      simulationMode: false,
      setSimulationMode: () => {},
      toggleSimulationMode: () => {},
      scenario: 'normal' as SimScenario,
      setScenario: () => {},
      simulationData: getSimulationScenario('normal'),
    };
  }
  return context;
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
