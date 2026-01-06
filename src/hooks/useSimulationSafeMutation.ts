/**
 * Simulation-Safe Mutation Hook
 * Wraps useMutation to allow writes with is_simulation flag based on current mode
 * RLS policies in the database handle data isolation automatically
 */
import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';

interface SimulationSafeMutationOptions<TData, TError, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'> {
  mutationFn: (variables: TVariables, isSimulation: boolean) => Promise<TData>;
  /** Custom message to show when saving in simulation mode */
  simulationMessage?: string;
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
  const { mutationFn, simulationMessage, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: async (variables: TVariables) => {
      // Show info toast in simulation mode
      if (simulationMode && simulationMessage) {
        toast.info(simulationMessage);
      }
      
      // Execute the mutation with the simulation flag
      // The mutation function is responsible for including is_simulation in the insert
      return mutationFn(variables, simulationMode);
    },
  });
}
