/**
 * useSimulationData Hook
 * 
 * Centralized hook for resolving simulation vs real data across all pages.
 * 
 * SYSTEM LAW:
 * - Live businesses NEVER get simulated data
 * - Simulation mode is a tool, not a default
 * 
 * DATA RESOLUTION RULE:
 * IF isLiveBusiness: render realData (always)
 * ELSE IF realData.length > 0: render realData
 * ELSE IF simulationMode === true: render simulationData
 * ELSE: render empty-state guidance UI
 */

import { useMemo } from 'react';
import { useSimulationMode, useCanSimulate } from '@/contexts/SimulationModeContext';
import { getSimulationScenario, type SimulationState } from '@/lib/simulation/scenarioData';
import { isLiveBusiness } from '@/config/liveBusinesses';

export interface SimulationDataResult<T> {
  data: T[];
  isSimulated: boolean;
  isEmpty: boolean;
  showEmptyState: boolean;
}

/**
 * Resolves data based on simulation mode with business awareness
 * - Live businesses ALWAYS get real data
 * - Returns real data if available
 * - Returns simulation data if simulation mode is ON and real data is empty
 * - Returns empty with showEmptyState=true if simulation mode is OFF and no real data
 */
export function useResolvedData<T>(
  realData: T[] | undefined | null,
  simulatedData: T[],
  businessSlug?: string | null
): SimulationDataResult<T> {
  const { simulationMode } = useSimulationMode();
  const { canSimulate } = useCanSimulate(businessSlug);
  
  return useMemo(() => {
    const realArray = realData ?? [];
    const hasRealData = realArray.length > 0;
    
    // RULE 1: Always return real data if available
    if (hasRealData) {
      return {
        data: realArray,
        isSimulated: false,
        isEmpty: false,
        showEmptyState: false,
      };
    }
    
    // RULE 2: Only use simulation data if allowed AND mode is on
    if (canSimulate && simulationMode) {
      return {
        data: simulatedData,
        isSimulated: true,
        isEmpty: false,
        showEmptyState: false,
      };
    }
    
    // RULE 3: No data and no simulation = empty state
    return {
      data: [],
      isSimulated: false,
      isEmpty: true,
      showEmptyState: true,
    };
  }, [realData, simulatedData, simulationMode, canSimulate]);
}

/**
 * Resolves a single value based on simulation mode
 */
export function useResolvedValue<T>(
  realValue: T | undefined | null,
  simulatedValue: T,
  hasRealData: boolean = false,
  businessSlug?: string | null
): { value: T | null; isSimulated: boolean } {
  const { simulationMode } = useSimulationMode();
  const { canSimulate } = useCanSimulate(businessSlug);
  
  return useMemo(() => {
    // If real value exists and is truthy, use it
    if (realValue !== undefined && realValue !== null && hasRealData) {
      return { value: realValue, isSimulated: false };
    }
    
    // If simulation mode is on AND allowed, use simulated value
    if (simulationMode && canSimulate) {
      return { value: simulatedValue, isSimulated: true };
    }
    
    // Otherwise return null (for empty state handling)
    return { value: null, isSimulated: false };
  }, [realValue, simulatedValue, simulationMode, hasRealData, canSimulate]);
}

/**
 * Full simulation data hook - returns scenario-based data
 */
export function useSimulationData(): SimulationState & { isActive: boolean } {
  const { simulationMode, scenario, isLiveBusinessActive } = useSimulationMode();
  
  const data = useMemo(() => getSimulationScenario(scenario), [scenario]);
  
  // Simulation is only active if mode is on AND not a live business
  const isActive = simulationMode && !isLiveBusinessActive;
  
  return {
    ...data,
    isActive,
  };
}

/**
 * Hook to get simulation drivers data
 */
export function useSimulationDrivers() {
  const { simulationMode, simulationData, isLiveBusinessActive } = useSimulationMode();
  const isActive = simulationMode && !isLiveBusinessActive;
  return {
    drivers: isActive ? simulationData.drivers : [],
    isActive,
  };
}

/**
 * Hook to get simulation bikers data
 */
export function useSimulationBikers() {
  const { simulationMode, simulationData, isLiveBusinessActive } = useSimulationMode();
  const isActive = simulationMode && !isLiveBusinessActive;
  return {
    bikers: isActive ? simulationData.bikers : [],
    isActive,
  };
}

/**
 * Hook to get simulation routes data
 */
export function useSimulationRoutes() {
  const { simulationMode, simulationData, isLiveBusinessActive } = useSimulationMode();
  const isActive = simulationMode && !isLiveBusinessActive;
  return {
    routes: isActive ? simulationData.routes : [],
    isActive,
  };
}

/**
 * Hook to get simulation issues data
 */
export function useSimulationIssues() {
  const { simulationMode, simulationData, isLiveBusinessActive } = useSimulationMode();
  const isActive = simulationMode && !isLiveBusinessActive;
  return {
    issues: isActive ? simulationData.issues : [],
    isActive,
  };
}

/**
 * Hook to get simulation payouts data
 */
export function useSimulationPayouts() {
  const { simulationMode, simulationData, isLiveBusinessActive } = useSimulationMode();
  const isActive = simulationMode && !isLiveBusinessActive;
  return {
    payouts: isActive ? simulationData.payouts : [],
    isActive,
  };
}

/**
 * Hook to get simulation debts data
 */
export function useSimulationDebts() {
  const { simulationMode, simulationData, isLiveBusinessActive } = useSimulationMode();
  const isActive = simulationMode && !isLiveBusinessActive;
  return {
    debts: isActive ? simulationData.debts : [],
    isActive,
  };
}

/**
 * Hook to get simulation KPIs
 */
export function useSimulationKPIs() {
  const { simulationMode, simulationData, isLiveBusinessActive } = useSimulationMode();
  const isActive = simulationMode && !isLiveBusinessActive;
  return {
    kpis: isActive ? simulationData.kpis : null,
    isActive,
  };
}

/**
 * Hook to get simulation activity feed
 */
export function useSimulationActivityFeed() {
  const { simulationMode, simulationData, isLiveBusinessActive } = useSimulationMode();
  const isActive = simulationMode && !isLiveBusinessActive;
  return {
    activityFeed: isActive ? simulationData.activityFeed : [],
    isActive,
  };
}
