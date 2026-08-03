/**
 * SHARED FOLLOW-UPS / OPPORTUNITIES PANEL
 *
 * ONE component for the store KPI quick-view AND the store profile
 * (OpportunitiesSection). Same table (`store_opportunities`), same write
 * path, same actions: complete, URGENT (priority), ADD TO ROUTE (route_flag),
 * due date, and cross-store targeting.
 *
 * Never fork this markup — import it with `compact` for the quick-view.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Route as RouteIcon, Trash2 } from 'lucide-react';
import { verifiedInsert, verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface StoreFollowUpTask {
  id: string;
  opportunity_text: string;
  due_date: string | null;
  priority: string | null;
  is_completed: boolean;
  route_flag: boolean | null;
  store_id: string | null;
  created_at: string | null;
}

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

interface Props {
  storeId: string;
  storeName: string;
  /** compact = KPI quick-view styling */
  compact?: boolean;
}

export function StoreFollowUpsPanel({ storeId, storeName, compact = false }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [targetStoreId, setTargetStoreId] = useState<string>(storeId);
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState<string>(() =>
    format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [routeFlag, setRouteFlag] = useState(false);
  const [priority, setPriority] = useState<string>('normal');
  const [storeSearch, setStoreSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<StoreFollowUpTask | null>(null);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['store-opportunities', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_opportunities')
        .select('id,opportunity_text,due_date,priority,is_completed,route_flag,store_id,created_at')
        .eq('store_id', storeId)
        .eq('is_completed', false)
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as StoreFollowUpTask[];
    },
    staleTime: 30_000,
  });

  const { data: storeOptions = [] } = useQuery({
    queryKey: ['store-picker-quickview', storeSearch],
    queryFn: async () => {
      let q = supabase
        .from('store_master')
        .select('id, store_name')
        .is('deleted_at', null)
        .order('store_name')
        .limit(50);
      if (storeSearch.trim()) q = q.ilike('store_name', `%${storeSearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as { id: string; store_name: string | null }[];
    },
    staleTime: 60_000,
  });

  const currentInPicker = useMemo(
    () => storeOptions.some((s) => s.id === targetStoreId),
    [storeOptions, targetStoreId]
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['store-opportunities'] });
    qc.invalidateQueries({ queryKey: ['opportunities-summary'] });
  };

  const createTask = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      if (!trimmed) throw new Error('Please enter follow-up text');
      const dueIso = dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null;

      // business_id + created_by are stamped server-side by
      // trg_stamp_store_opportunity from auth.uid() — never sent by the client.
      await verifiedInsert('Add follow-up', () =>
        supabase
          .from('store_opportunities')
          .insert({
            store_id: targetStoreId,
            opportunity_text: trimmed,
            source: 'follow_up',
            is_completed: false,
            due_date: dueIso,
            priority,
            route_flag: routeFlag,
            assignee: user?.id ?? null,
          } as any)
          .select('id') as never,
      );

      await supabase
        .from('store_master')
        .update({ updated_at: new Date().toISOString() } as any)
        .eq('id', targetStoreId);
    },
    onSuccess: () => {
      toast.success('Follow-up added');
      setText('');
      setRouteFlag(false);
      setPriority('normal');
      invalidate();
    },
    onError: (e: any) => toast.error(mutationErrorMessage(e)),
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const nowIso = new Date().toISOString();
      await verifiedUpdate('Complete follow-up', () =>
        supabase
          .from('store_opportunities')
          .update({
            is_completed: true,
            completed_at: nowIso,
            completed_by: user?.id ?? null,
          } as any)
          .eq('id', taskId)
          .select('id') as never,
      );
      await supabase
        .from('store_master')
        .update({ updated_at: nowIso } as any)
        .eq('id', storeId);
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(mutationErrorMessage(e)),
  });

  /** Inline edit of URGENT / ROUTE on an existing follow-up. */
  const patchTask = useMutation({
    mutationFn: async (vars: { id: string; patch: Record<string, any> }) => {
      await verifiedUpdate('Update follow-up', () =>
        supabase
          .from('store_opportunities')
          .update(vars.patch as any)
          .eq('id', vars.id)
          .select('id') as never,
      );
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(mutationErrorMessage(e)),
  });

  /** Soft delete — row kept, hidden everywhere. RLS: author/assignee or admin. */
  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await verifiedUpdate('Delete follow-up', () =>
        supabase
          .from('store_opportunities')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id ?? null,
          } as any)
          .eq('id', id)
          .is('deleted_at', null)
          .select('id') as never,
      );
    },
    onSuccess: () => {
      toast.success('Follow-up deleted');
      invalidate();
    },
    onError: (e: any) => toast.error(mutationErrorMessage(e)),
  });

  const labelClass = compact ? 'text-[10px]' : 'text-xs';
  const bodyText = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Open follow-ups list */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Open follow-ups
        </p>
        {tasksLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">None open</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t) => {
              const isUrgent = t.priority === 'urgent';
              return (
                <li key={t.id} className="flex items-start gap-2 text-xs">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => completeTask.mutate(t.id)}
                    disabled={completeTask.isPending}
                    className="mt-0.5 h-3.5 w-3.5"
                    aria-label="Mark complete"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'min-w-0 break-words font-medium leading-relaxed text-foreground [overflow-wrap:anywhere]',
                          bodyText,
                        )}
                      >
                        {t.opportunity_text}
                      </span>
                      {t.route_flag && (
                        <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[9px]">
                          <RouteIcon className="h-2.5 w-2.5" /> route
                        </Badge>
                      )}
                      {t.priority && t.priority !== 'normal' && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-4 px-1 text-[9px] capitalize',
                            isUrgent && 'border-red-500/40 text-red-600',
                            t.priority === 'high' && 'border-orange-500/40 text-orange-600'
                          )}
                        >
                          {t.priority}
                        </Badge>
                      )}
                    </div>
                    {t.due_date && (
                      <p className="text-[10px] text-muted-foreground">
                        Due {format(new Date(t.due_date), 'MMM d, yyyy')}
                      </p>
                    )}
                    {/* Inline actions — identical on quick-view and profile */}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={isUrgent ? 'destructive' : 'outline'}
                        className="h-6 px-2 text-[10px]"
                        disabled={patchTask.isPending}
                        onClick={() =>
                          patchTask.mutate({
                            id: t.id,
                            patch: { priority: isUrgent ? 'normal' : 'urgent' },
                          })
                        }
                      >
                        {isUrgent ? 'Urgent ✓' : 'Mark urgent'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={t.route_flag ? 'default' : 'outline'}
                        className="h-6 px-2 text-[10px]"
                        disabled={patchTask.isPending}
                        onClick={() =>
                          patchTask.mutate({ id: t.id, patch: { route_flag: !t.route_flag } })
                        }
                      >
                        <RouteIcon className="mr-1 h-2.5 w-2.5" />
                        {t.route_flag ? 'On route' : 'Add to route'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label="Delete follow-up"
                        className="h-6 px-2 text-[10px] text-destructive"
                        onClick={() => setPendingDelete(t)}
                      >
                        <Trash2 className="mr-1 h-2.5 w-2.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add follow-up form */}
      <div className="space-y-2 border-t border-border/50 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Add follow-up
        </p>

        <div className="space-y-1">
          <Label className={labelClass}>About store</Label>
          <Select value={targetStoreId} onValueChange={setTargetStoreId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <div className="p-1">
                <Input
                  placeholder="Search stores…"
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="h-7 text-xs"
                />
              </div>
              {!currentInPicker && (
                <SelectItem value={storeId} className="text-xs">
                  {storeName} (current)
                </SelectItem>
              )}
              {storeOptions.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.store_name || 'Unnamed'}
                  {s.id === storeId ? ' (current)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What needs following up?"
          rows={2}
          className="text-xs"
        />

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className={labelClass}>Due date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className={labelClass}>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <Checkbox
            checked={routeFlag}
            onCheckedChange={(v) => setRouteFlag(v === true)}
            className="h-3.5 w-3.5"
          />
          <RouteIcon className="h-3 w-3 text-muted-foreground" />
          <span>Add to route / come back</span>
        </label>

        <Button
          type="button"
          size="sm"
          className="w-full h-8 text-xs"
          disabled={createTask.isPending || !text.trim()}
          onClick={() => createTask.mutate()}
        >
          {createTask.isPending ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving…
            </>
          ) : (
            'Save follow-up'
          )}
        </Button>
      </div>

      <DeleteConfirmModal
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete follow-up"
        description="This follow-up will be removed from the store profile. The record is kept for audit and can be restored by an admin."
        itemName={pendingDelete?.opportunity_text?.slice(0, 60)}
        onConfirm={async () => {
          if (pendingDelete) await deleteTask.mutateAsync(pendingDelete.id);
        }}
      />
    </div>
  );
}
