/**
 * Simulation-Safe Mutation Hook
 * Wraps useMutation to block database writes when in simulation mode
 */
import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';

interface SimulationSafeMutationOptions<TData, TError, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Custom message to show when blocked in simulation mode */
  simulationMessage?: string;
  /** Mock data to return in simulation mode (optional) */
  mockResponse?: (variables: TVariables) => TData;
}

export function useSimulationSafeMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  options: SimulationSafeMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { simulationMode } = useSimulationMode();
  const { mutationFn, simulationMessage, mockResponse, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: async (variables: TVariables) => {
      if (simulationMode) {
        toast.info(simulationMessage || 'Simulation Mode: Changes not saved to database');
        
        // Return mock response if provided, otherwise return a generic mock
        if (mockResponse) {
          return mockResponse(variables);
        }
        
        // Return a generic mock with the input data
        return {
          id: `sim-${Date.now()}`,
          ...((typeof variables === 'object' && variables !== null) ? variables : {}),
          _simulated: true,
        } as TData;
      }
      
      // In live mode, execute the real mutation
      return mutationFn(variables);
    },
  });
}
