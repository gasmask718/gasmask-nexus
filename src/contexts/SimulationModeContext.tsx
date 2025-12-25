import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SimulationModeContextType {
  simulationMode: boolean;
  setSimulationMode: (value: boolean) => void;
  toggleSimulationMode: () => void;
}

const SimulationModeContext = createContext<SimulationModeContextType | undefined>(undefined);

export function SimulationModeProvider({ children }: { children: ReactNode }) {
  const [simulationMode, setSimulationMode] = useState(false);

  const toggleSimulationMode = useCallback(() => {
    setSimulationMode(prev => !prev);
  }, []);

  return (
    <SimulationModeContext.Provider value={{ simulationMode, setSimulationMode, toggleSimulationMode }}>
      {children}
    </SimulationModeContext.Provider>
  );
}

export function useSimulationMode() {
  const context = useContext(SimulationModeContext);
  if (context === undefined) {
    throw new Error('useSimulationMode must be used within a SimulationModeProvider');
  }
  return context;
}

// Simulation badge component for marking simulated data
export function SimulationBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      Simulated Data
    </span>
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
