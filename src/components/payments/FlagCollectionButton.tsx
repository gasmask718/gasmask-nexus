import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flag, FlagOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * FlagCollectionButton — marks a store as "collect payment" so it lands in the
 * gasmask_visit_triggers pool (trigger_type='collect_payment'). Urgency derives
 * from the open balance and oldest-unpaid age supplied by the caller.
 *
 * Idempotent: if a pending collect_payment trigger already exists for the
 * store, the button shows "Flagged" and offers to clear it (archived).
 */
interface Props {
  storeId: string;
  storeName: string;
  owedAmount: number;
  oldestDays?: number | null;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'destructive' | 'default' | 'secondary' | 'ghost';
  className?: string;
}

function urgencyFor(amount: number, days: number | null | undefined): string {
  if (amount >= 500 || (days != null && days >= 30)) return 'critical';
  if (amount >= 200 || (days != null && days >= 14)) return 'high';
  return 'normal';
}

function priorityFor(amount: number, days: number | null | undefined): number {
  let score = 5;
  if (amount >= 100) score += 1;
  if (amount >= 250) score += 1;
  if (amount >= 500) score += 2;
  if ((days ?? 0) >= 14) score += 1;
  if ((days ?? 0) >= 30) score += 2;
  return Math.min(score, 10);
}

export function FlagCollectionButton({
  storeId,
  storeName,
  owedAmount,
  oldestDays,
  size = 'sm',
  variant = 'outline',
  className,
}: Props) {
  const qc = useQueryClient();
  const { data: existing, isLoading } = useQuery({
    queryKey: ['collect-payment-trigger', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gasmask_visit_triggers')
        .select('id, status, urgency, priority_score')
        .eq('store_id', storeId)
        .eq('trigger_type', 'collect_payment')
        .in('status', ['pending', 'in_progress'])
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });

  const flagged = useMemo(() => !!existing?.id, [existing]);

  const flag = useMutation({
    mutationFn: async () => {
      const urgency = urgencyFor(owedAmount, oldestDays ?? null);
      const priority = priorityFor(owedAmount, oldestDays ?? null);
      const { error } = await supabase.from('gasmask_visit_triggers').insert({
        store_id: storeId,
        store_name: storeName,
        trigger_source: 'collections_ui',
        trigger_type: 'collect_payment',
        floor_source: 'billing',
        urgency,
        priority_score: priority,
        ai_recommendation: `Collect $${owedAmount.toFixed(2)} owed${
          oldestDays != null ? ` (oldest ${oldestDays}d)` : ''
        }.`,
        visit_duration_minutes: 15,
        status: 'pending',
        trigger_notes: `Flagged for in-person collection — outstanding $${owedAmount.toFixed(2)}`,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${storeName} flagged for collection`);
      qc.invalidateQueries({ queryKey: ['collect-payment-trigger', storeId] });
      qc.invalidateQueries({ queryKey: ['collections-pool'] });
      qc.invalidateQueries({ queryKey: ['gasmask-visit-triggers'] });
    },
    onError: (e: Error) => toast.error('Failed to flag', { description: e.message }),
  });

  const clear = useMutation({
    mutationFn: async () => {
      if (!existing?.id) return;
      const { error } = await supabase
        .from('gasmask_visit_triggers')
        .update({ status: 'archived', completed_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Collection flag cleared');
      qc.invalidateQueries({ queryKey: ['collect-payment-trigger', storeId] });
      qc.invalidateQueries({ queryKey: ['collections-pool'] });
    },
    onError: (e: Error) => toast.error('Failed to clear', { description: e.message }),
  });

  if (isLoading) {
    return (
      <Button size={size} variant="ghost" disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (flagged) {
    return (
      <div className="inline-flex items-center gap-1">
        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 gap-1 text-[10px]">
          <Flag className="h-3 w-3" /> Flagged
        </Badge>
        <Button
          size={size}
          variant="ghost"
          onClick={() => clear.mutate()}
          disabled={clear.isPending}
          className={className}
          title="Clear collection flag"
        >
          <FlagOff className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={() => flag.mutate()}
      disabled={flag.isPending || owedAmount <= 0}
      className={className}
      title="Flag this store for in-person payment collection"
    >
      {flag.isPending ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Flag className="h-4 w-4 mr-1" />
      )}
      Flag Collection
    </Button>
  );
}
