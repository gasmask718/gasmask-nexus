/**
 * useSimulationData Hook
 * 
 * Centralized hook for resolving simulation vs real data across all delivery pages.
 * 
 * DATA RESOLUTION RULE:
 * IF realData.length > 0: render realData
 * ELSE IF simulationMode === true: render simulationData
 * ELSE: render empty-state guidance UI
 */

import { useMemo } from 'react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { getSimulationScenario, type SimulationState } from '@/lib/simulation/scenarioData';

export interface SimulationDataResult<T> {
  data: T[];
  isSimulated: boolean;
  isEmpty: boolean;
  showEmptyState: boolean;
}

/**
 * Resolves data based on simulation mode
 * - Returns real data if available
 * - Returns simulation data if simulation mode is ON and real data is empty
 * - Returns empty with showEmptyState=true if simulation mode is OFF and no real data
 */
export function useResolvedData<T>(
  realData: T[] | undefined | null,
  simulatedData: T[]
): SimulationDataResult<T> {
  const { simulationMode } = useSimulationMode();
  
  return useMemo(() => {
    const realArray = realData ?? [];
    const hasRealData = realArray.length > 0;
    
    if (hasRealData) {
      return {
        data: realArray,
        isSimulated: false,
        isEmpty: false,
        showEmptyState: false,
      };
    }
    
    if (simulationMode) {
      return {
        data: simulatedData,
        isSimulated: true,
        isEmpty: false,
        showEmptyState: false,
      };
    }
    
    return {
      data: [],
      isSimulated: false,
      isEmpty: true,
      showEmptyState: true,
    };
  }, [realData, simulatedData, simulationMode]);
}

/**
 * Resolves a single value based on simulation mode
 */
export function useResolvedValue<T>(
  realValue: T | undefined | null,
  simulatedValue: T,
  hasRealData: boolean = false
): { value: T | null; isSimulated: boolean } {
  const { simulationMode } = useSimulationMode();
  
  return useMemo(() => {
    // If real value exists and is truthy, use it
    if (realValue !== undefined && realValue !== null && hasRealData) {
      return { value: realValue, isSimulated: false };
    }
    
    // If simulation mode is on, use simulated value
    if (simulationMode) {
      return { value: simulatedValue, isSimulated: true };
    }
    
    // Otherwise return null (for empty state handling)
    return { value: null, isSimulated: false };
  }, [realValue, simulatedValue, simulationMode, hasRealData]);
}

/**
 * Full simulation data hook - returns scenario-based data
 */
export function useSimulationData(): SimulationState & { isActive: boolean } {
  const { simulationMode, scenario } = useSimulationMode();
  
  const data = useMemo(() => getSimulationScenario(scenario), [scenario]);
  
  return {
    ...data,
    isActive: simulationMode,
  };
}

/**
 * Hook to get simulation drivers data
 */
export function useSimulationDrivers() {
  const { simulationMode, simulationData } = useSimulationMode();
  return {
    drivers: simulationMode ? simulationData.drivers : [],
    isActive: simulationMode,
  };
}

/**
 * Hook to get simulation bikers data
 */
export function useSimulationBikers() {
  const { simulationMode, simulationData } = useSimulationMode();
  return {
    bikers: simulationMode ? simulationData.bikers : [],
    isActive: simulationMode,
  };
}

/**
 * Hook to get simulation routes data
 */
export function useSimulationRoutes() {
  const { simulationMode, simulationData } = useSimulationMode();
  return {
    routes: simulationMode ? simulationData.routes : [],
    isActive: simulationMode,
  };
}

/**
 * Hook to get simulation issues data
 */
export function useSimulationIssues() {
  const { simulationMode, simulationData } = useSimulationMode();
  return {
    issues: simulationMode ? simulationData.issues : [],
    isActive: simulationMode,
  };
}

/**
 * Hook to get simulation payouts data
 */
export function useSimulationPayouts() {
  const { simulationMode, simulationData } = useSimulationMode();
  return {
    payouts: simulationMode ? simulationData.payouts : [],
    isActive: simulationMode,
  };
}

/**
 * Hook to get simulation debts data
 */
export function useSimulationDebts() {
  const { simulationMode, simulationData } = useSimulationMode();
  return {
    debts: simulationMode ? simulationData.debts : [],
    isActive: simulationMode,
  };
}

/**
 * Hook to get simulation KPIs
 */
export function useSimulationKPIs() {
  const { simulationMode, simulationData } = useSimulationMode();
  return {
    kpis: simulationMode ? simulationData.kpis : null,
    isActive: simulationMode,
  };
}

/**
 * Hook to get simulation activity feed
 */
export function useSimulationActivityFeed() {
  const { simulationMode, simulationData } = useSimulationMode();
  return {
    activityFeed: simulationMode ? simulationData.activityFeed : [],
    isActive: simulationMode,
  };
}
