import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  STORE_RELATIONSHIP_STATUSES,
  RELATIONSHIP_STATUS_COLORS,
  DEFAULT_RELATIONSHIP_STATUS,
  type StoreRelationshipStatus,
} from '@/config/storeRelationshipStatus';
import { submitFieldChange } from '@/services/fieldGovernance/submitFieldChange';
import { isFieldRole } from '@/services/fieldGovernance/types';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  storeId: string;
  value: string | null | undefined;
  /** When provided, also fire field-submission governance for field roles. */
  role?: string | null;
  disabled?: boolean;
  className?: string;
  onChanged?: (next: StoreRelationshipStatus) => void;
}

/**
 * Colored 9-state selector for store_master.relationship_status.
 * - Admins/VAs: writes directly to store_master.
 * - Field roles (driver/biker/ambassador): routes through field_submissions
 *   via submitFieldChange (entity_type='store_update').
 */
export function RelationshipStatusSelect({
  storeId, value, role, disabled, className, onChanged,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const current = (value as StoreRelationshipStatus) || DEFAULT_RELATIONSHIP_STATUS;

  const mutation = useMutation({
    mutationFn: async (next: StoreRelationshipStatus) => {
      if (isFieldRole(role) && user?.id) {
        const r = await submitFieldChange(
          {
            store_id: storeId,
            entity_type: 'store_update',
            action_type: 'update',
            payload_before: { relationship_status: current },
            payload_after:  { relationship_status: next },
          },
          user.id,
          role,
        );
        if (!r.success) throw new Error(r.error || 'Submission failed');
        return next;
      }
      const { error } = await supabase
        .from('store_master')
        .update({ relationship_status: next })
        .eq('id', storeId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(`Status: ${next}`);
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-master'] });
      queryClient.invalidateQueries({ queryKey: ['store-relationship-rollup'] });
      onChanged?.(next);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Select
      value={current}
      onValueChange={(v) => mutation.mutate(v as StoreRelationshipStatus)}
      disabled={disabled || mutation.isPending || !user}
    >
      <SelectTrigger
        className={cn(
          'h-9 w-full max-w-[280px] border',
          RELATIONSHIP_STATUS_COLORS[current],
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STORE_RELATIONSHIP_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className={cn('inline-block px-2 py-0.5 rounded-md border text-xs', RELATIONSHIP_STATUS_COLORS[s])}>
              {s}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
