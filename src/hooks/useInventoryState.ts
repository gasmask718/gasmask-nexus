/**
 * INVENTORY STATE MACHINE HOOKS
 * Controls batch state transitions: raw → in_production → boxed → approved → sent_to_office
 * Every transition is audited in production_inventory_transitions.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type InventoryState = 'raw' | 'in_production' | 'boxed' | 'approved' | 'sent_to_office';

export interface InventoryTransition {
  id: string;
  batch_id: string;
  from_state: string;
  to_state: string;
  transitioned_by: string | null;
  reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

/** Valid transitions — enforced client-side before DB write */
const VALID_TRANSITIONS: Record<InventoryState, InventoryState[]> = {
  raw: ['in_production'],
  in_production: ['boxed'],
  boxed: ['approved'],
  approved: ['sent_to_office'],
  sent_to_office: [], // terminal state
};

export const INVENTORY_STATES: { value: InventoryState; label: string; color: string; icon: string }[] = [
  { value: 'raw', label: 'Raw', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: '🍂' },
  { value: 'in_production', label: 'In Production', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: '⚙️' },
  { value: 'boxed', label: 'Boxed', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: '📦' },
  { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '✅' },
  { value: 'sent_to_office', label: 'Sent to Office', color: 'bg-sky-100 text-sky-800 border-sky-300', icon: '🚚' },
];

export function getNextStates(currentState: InventoryState): InventoryState[] {
  return VALID_TRANSITIONS[currentState] || [];
}

export function getStateConfig(state: InventoryState) {
  return INVENTORY_STATES.find(s => s.value === state) || INVENTORY_STATES[0];
}

export function useTransitionBatchState() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      batchId,
      fromState,
      toState,
      reason,
      officeId,
    }: {
      batchId: string;
      fromState: InventoryState;
      toState: InventoryState;
      reason?: string;
      officeId: string;
    }) => {
      // Validate transition
      const valid = VALID_TRANSITIONS[fromState];
      if (!valid || !valid.includes(toState)) {
        throw new Error(`Invalid transition: ${fromState} → ${toState}`);
      }

      // Get current user
      const { data: userData } = await supabase.auth.getUser();

      // 1) Update batch state
      const { error: updateError } = await supabase
        .from('production_batches')
        .update({ inventory_state: toState })
        .eq('id', batchId)
        .eq('inventory_state', fromState); // optimistic concurrency check

      if (updateError) throw updateError;

      // 2) Log transition
      const { error: logError } = await supabase
        .from('production_inventory_transitions')
        .insert({
          batch_id: batchId,
          from_state: fromState,
          to_state: toState,
          transitioned_by: userData.user?.id || null,
          reason: reason || null,
        });

      if (logError) {
        console.error('Failed to log transition:', logError);
        // Don't throw — the state change already succeeded
      }

      // 3) Log to production_history
      await supabase.from('production_history').insert({
        batch_id: batchId,
        office_id: officeId,
        event_type: 'state_transition',
        event_data: { from_state: fromState, to_state: toState, reason },
        performed_by: userData.user?.id || null,
      });

      return { batchId, toState, officeId };
    },
    onSuccess: (result) => {
      const stateLabel = getStateConfig(result.toState as InventoryState).label;
      queryClient.invalidateQueries({ queryKey: ['production-batches'] });
      queryClient.invalidateQueries({ queryKey: ['today-batches', result.officeId] });
      toast({
        title: `Batch → ${stateLabel}`,
        description: `Inventory state updated successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'State transition failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
