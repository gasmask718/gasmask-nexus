import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

/**
 * "Mark Handled Today" — the operator's daily done-marker for an account.
 *
 * Reuses the canonical store_review_events history (review_type = 'handled')
 * via mark_store_handled_today(). It is NOT a claim, territory assignment,
 * physical check-in, delivery, route or call completion — it writes nothing
 * outside the review-event history.
 */
interface Props {
  storeId: string;
  compact?: boolean;
}

const nyToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export function MarkHandledTodayButton({ storeId, compact = false }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const today = nyToday();

  const { data: handled, isLoading } = useQuery({
    queryKey: ['store-handled-today', storeId, today],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_review_events')
        .select('id, reviewed_at, reviewed_by, handled_on')
        .eq('store_id', storeId)
        .eq('review_type', 'handled')
        .eq('handled_on', today)
        .order('reviewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as
        | { id: string; reviewed_at: string; reviewed_by: string | null; handled_on: string }
        | null;
    },
  });

  const { data: handlerName } = useQuery({
    queryKey: ['profile-name', handled?.reviewed_by],
    enabled: !!handled?.reviewed_by,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', handled!.reviewed_by!)
        .maybeSingle();
      return (data as any)?.name || (data as any)?.email || 'Unknown user';
    },
  });

  const mark = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc('mark_store_handled_today', {
        _store_id: storeId,
      });
      if (error) throw error;
      return data as { created: boolean };
    },
    onSuccess: (res) => {
      toast.success(res?.created ? 'Marked handled today' : 'Already marked handled today');
      qc.invalidateQueries({ queryKey: ['store-handled-today', storeId] });
    },
    onError: (e: any) => toast.error(e.message || 'Could not mark this account handled'),
  });

  const isHandled = !!handled;
  const stamp = handled?.reviewed_at
    ? new Date(handled.reviewed_at).toLocaleString('en-US', { timeZone: 'America/New_York' })
    : null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      <Button
        type="button"
        size={compact ? 'sm' : 'default'}
        variant={isHandled ? 'default' : 'outline'}
        disabled={isLoading || mark.isPending}
        onClick={() => mark.mutate()}
        className={cn('gap-2', isHandled && 'bg-emerald-600 hover:bg-emerald-700 text-white')}
        data-testid="mark-handled-today"
      >
        {mark.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isHandled ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <ClipboardCheck className="h-4 w-4" />
        )}
        <span>{isHandled ? 'Handled Today' : 'Mark Handled Today'}</span>
      </Button>
      {isHandled && (
        <span className="text-muted-foreground" data-testid="handled-stamp">
          {stamp}
          {handlerName ? ` · by ${handlerName}` : ''}
        </span>
      )}
    </div>
  );
}
