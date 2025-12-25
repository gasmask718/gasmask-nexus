import { useMemo } from 'react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

/**
 * Hook to resolve between real data and simulation data
 * Returns simulation data when:
 * - Simulation mode is ON AND real data is empty
 * Returns real data when:
 * - Simulation mode is OFF OR real data has content
 */
export function useResolvedData<T>(
  realData: T[] | undefined | null,
  simulationData: T[]
): { data: T[]; isSimulated: boolean; isEmpty: boolean } {
  const { simulationMode } = useSimulationMode();

  return useMemo(() => {
    const hasRealData = Array.isArray(realData) && realData.length > 0;
    
    if (hasRealData) {
      return { data: realData, isSimulated: false, isEmpty: false };
    }
    
    if (simulationMode) {
      return { data: simulationData, isSimulated: true, isEmpty: false };
    }
    
    return { data: [], isSimulated: false, isEmpty: true };
  }, [realData, simulationData, simulationMode]);
}

/**
 * Hook for single value resolution (not arrays)
 */
export function useResolvedValue<T>(
  realValue: T | undefined | null,
  simulationValue: T
): { value: T; isSimulated: boolean } {
  const { simulationMode } = useSimulationMode();

  return useMemo(() => {
    const hasRealValue = realValue !== undefined && realValue !== null;
    
    if (hasRealValue) {
      return { value: realValue, isSimulated: false };
    }
    
    if (simulationMode) {
      return { value: simulationValue, isSimulated: true };
    }
    
    return { value: simulationValue, isSimulated: simulationMode };
  }, [realValue, simulationValue, simulationMode]);
}
