/**
 * useResolvedData Hook
 * 
 * Simple hook to resolve between real data and simulation data.
 * Re-exports from useSimulationData for backwards compatibility.
 */

import { useMemo } from 'react';
import { useSimulationMode, useCanSimulate } from '@/contexts/SimulationModeContext';

/**
 * Hook to resolve between real data and simulation data
 * Returns simulation data when:
 * - Simulation mode is ON AND real data is empty AND business allows simulation
 * Returns real data when:
 * - Real data has content
 * - Business is a live/protected business
 */
export function useResolvedData<T>(
  realData: T[] | undefined | null,
  simulationData: T[],
  businessSlug?: string | null
): { data: T[]; isSimulated: boolean; isEmpty: boolean } {
  const { simulationMode } = useSimulationMode();
  const { canSimulate } = useCanSimulate(businessSlug);

  return useMemo(() => {
    const hasRealData = Array.isArray(realData) && realData.length > 0;
    
    // Always return real data if available
    if (hasRealData) {
      return { data: realData, isSimulated: false, isEmpty: false };
    }
    
    // Only use simulation if allowed and mode is on
    if (canSimulate && simulationMode) {
      return { data: simulationData, isSimulated: true, isEmpty: false };
    }
    
    return { data: [], isSimulated: false, isEmpty: true };
  }, [realData, simulationData, simulationMode, canSimulate]);
}

/**
 * Hook for single value resolution (not arrays)
 */
export function useResolvedValue<T>(
  realValue: T | undefined | null,
  simulationValue: T,
  businessSlug?: string | null
): { value: T; isSimulated: boolean } {
  const { simulationMode } = useSimulationMode();
  const { canSimulate } = useCanSimulate(businessSlug);

  return useMemo(() => {
    const hasRealValue = realValue !== undefined && realValue !== null;
    
    if (hasRealValue) {
      return { value: realValue, isSimulated: false };
    }
    
    if (canSimulate && simulationMode) {
      return { value: simulationValue, isSimulated: true };
    }
    
    return { value: simulationValue, isSimulated: !canSimulate || !simulationMode };
  }, [realValue, simulationValue, simulationMode, canSimulate]);
}
