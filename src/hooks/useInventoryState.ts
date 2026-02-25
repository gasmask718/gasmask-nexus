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

/** Validate batch data meets requirements for the target state */
export async function validateTransitionRequirements(
  batchId: string,
  toState: InventoryState,
): Promise<{ valid: boolean; error?: string }> {
  const { data: batch, error } = await supabase
    .from('production_batches')
    .select('tobacco_lbs, boxes_produced, waste_lbs, product_type, product_output_units, production_time_minutes')
    .eq('id', batchId)
    .single();

  if (error || !batch) return { valid: false, error: 'Batch not found' };

  const productType = (batch as any).product_type || 'tubes';
  const outputUnits = (batch as any).product_output_units || 0;

  if (toState === 'in_production') {
    if (!batch.tobacco_lbs || batch.tobacco_lbs <= 0) {
      return { valid: false, error: 'Tobacco LBS must be entered before starting production.' };
    }
  }

  if (toState === 'boxed') {
    if (!outputUnits || outputUnits <= 0) {
      return { valid: false, error: `${productType === 'bags' ? 'Bags' : 'Tubes'} produced must be entered before marking as boxed (boxes auto-calculated from units).` };
    }
  }

  if (toState === 'approved') {
    if (!batch.tobacco_lbs || batch.tobacco_lbs <= 0) {
      return { valid: false, error: 'Cannot approve: tobacco LBS is missing.' };
    }
    if (outputUnits <= 0) {
      return { valid: false, error: 'Cannot approve: product units produced must be > 0.' };
    }
    if (!(batch as any).product_type) {
      return { valid: false, error: 'Cannot approve: product type not selected.' };
    }
    const timeMins = (batch as any).production_time_minutes || 0;
    if (timeMins <= 0) {
      return { valid: false, error: 'Cannot approve: production time must be > 0.' };
    }
    const boxesEquiv = outputUnits / 100.0;
    if (boxesEquiv <= 0) {
      return { valid: false, error: 'Cannot approve: boxes equivalent must be > 0.' };
    }
  }

  return { valid: true };
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
      conversionConfirmed,
    }: {
      batchId: string;
      fromState: InventoryState;
      toState: InventoryState;
      reason?: string;
      officeId: string;
      conversionConfirmed?: boolean;
    }) => {
      // Validate transition
      const valid = VALID_TRANSITIONS[fromState];
      if (!valid || !valid.includes(toState)) {
        throw new Error(`Invalid transition: ${fromState} → ${toState}`);
      }

      // Validate field requirements
      const fieldCheck = await validateTransitionRequirements(batchId, toState);
      if (!fieldCheck.valid) {
        throw new Error(fieldCheck.error);
      }

      // Require confirmation for approval
      if (toState === 'approved' && !conversionConfirmed) {
        throw new Error('Manager must confirm material-to-output accuracy before approval.');
      }

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || null;

      // Build update payload
      const updatePayload: Record<string, any> = { inventory_state: toState };

      // Lock fields and snapshot on approval
      if (toState === 'approved') {
        updatePayload.is_locked = true;
        updatePayload.locked_at = new Date().toISOString();
        updatePayload.locked_by = userId;
        updatePayload.conversion_confirmed_by = userId;
        updatePayload.conversion_confirmed_at = new Date().toISOString();
      }

      // 1) Update batch state
      const { error: updateError } = await supabase
        .from('production_batches')
        .update(updatePayload)
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
          transitioned_by: userId,
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
        performed_by: userId,
      });

      return { batchId, toState, officeId };
    },
    onSuccess: (result) => {
      const stateLabel = getStateConfig(result.toState as InventoryState).label;
      queryClient.invalidateQueries({ queryKey: ['production-batches'] });
      queryClient.invalidateQueries({ queryKey: ['today-batches', result.officeId] });
      queryClient.invalidateQueries({ queryKey: ['conversion-intelligence'] });
      queryClient.invalidateQueries({ queryKey: ['conversion-baseline'] });
      toast({
        title: `Batch → ${stateLabel}`,
        description: result.toState === 'approved'
          ? 'Conversion ratios locked permanently. Batch approved for distribution.'
          : 'Inventory state updated successfully.',
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
