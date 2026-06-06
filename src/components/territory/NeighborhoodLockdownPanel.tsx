import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Lock, LockOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Props { neighborhood: string }

interface LockdownRow {
  id: string;
  neighborhood_name: string;
  started_at: string;
  cleared_at: string | null;
  baseline_have: number | null;
  baseline_total: number | null;
}

export function NeighborhoodLockdownPanel({ neighborhood }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const lockdown = useQuery({
    queryKey: ['neigh-lockdown', neighborhood],
    enabled: !!neighborhood,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('neighborhood_lockdowns' as any)
        .select('*')
        .eq('neighborhood_name', neighborhood)
        .is('cleared_at', null)
        .maybeSingle();
      if (error) throw error;
      return (data as any as LockdownRow) ?? null;
    },
  });

  // Live "have" counter (status='active') for progress since baseline
  const counts = useQuery({
    queryKey: ['neigh-lockdown-counts', neighborhood],
    enabled: !!neighborhood,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('id,status')
        .eq('neighborhood', neighborhood)
        .is('deleted_at', null);
      const all = data ?? [];
      const have = all.filter((s: any) => s.status === 'active').length;
      return { total: all.length, have };
    },
  });

  // Pending lockdown_sweep triggers in this neighborhood
  const triggers = useQuery({
    queryKey: ['neigh-lockdown-triggers', neighborhood],
    enabled: !!neighborhood && !!lockdown.data,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('gasmask_visit_triggers')
        .select('id', { count: 'exact', head: true })
        .eq('trigger_type', 'lockdown_sweep')
        .eq('status', 'pending')
        .ilike('trigger_notes', `%neighborhood:${neighborhood}%`);
      return count ?? 0;
    },
  });

  const toggle = useMutation({
    mutationFn: async (action: 'start' | 'stop') => {
      setBusy(true);
      const { data, error } = await supabase.functions.invoke('neighborhood-lockdown-engine', {
        body: { action, neighborhood },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, action) => {
      if (action === 'start') {
        toast.success(`Lockdown active — ${data?.triggers_created ?? 0} sweep triggers created`);
      } else {
        toast.success(`Lockdown cleared — ${data?.cancelled ?? 0} pending triggers cancelled`);
      }
      qc.invalidateQueries({ queryKey: ['neigh-lockdown', neighborhood] });
      qc.invalidateQueries({ queryKey: ['neigh-lockdown-counts', neighborhood] });
      qc.invalidateQueries({ queryKey: ['neigh-lockdown-triggers', neighborhood] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Lockdown action failed'),
    onSettled: () => setBusy(false),
  });

  const active = !!lockdown.data;
  const baselineHave = lockdown.data?.baseline_have ?? 0;
  const total = counts.data?.total ?? lockdown.data?.baseline_total ?? 0;
  const currentHave = counts.data?.have ?? baselineHave;
  const gained = Math.max(0, currentHave - baselineHave);
  const dontHave = Math.max(0, total - currentHave);
  const pct = total > 0 ? Math.round((currentHave / total) * 100) : 0;

  return (
    <Card className={active ? 'border-red-500/40 bg-red-500/[0.03]' : ''}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {active ? (
              <Badge className="bg-red-600 hover:bg-red-600 text-white gap-1">
                <Lock className="h-3 w-3" /> LOCKDOWN
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <LockOpen className="h-3 w-3" /> Open
              </Badge>
            )}
            <span className="font-semibold">{neighborhood}</span>
            {active && lockdown.data && (
              <span className="text-xs text-muted-foreground">
                since {formatDistanceToNow(new Date(lockdown.data.started_at), { addSuffix: true })}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant={active ? 'outline' : 'destructive'}
            disabled={busy}
            onClick={() => toggle.mutate(active ? 'stop' : 'start')}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            {active ? 'Clear lockdown' : 'Start lockdown'}
          </Button>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>
              {currentHave} have / {dontHave} don't have / {total} total
              {active && gained > 0 && (
                <span className="text-emerald-600 font-medium"> · +{gained} since lockdown</span>
              )}
            </span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {active && (
          <div className="text-xs text-muted-foreground">
            {triggers.data ?? 0} pending lockdown_sweep triggers queued for the field team.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
