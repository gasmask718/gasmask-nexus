import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, Loader2, Route as RouteIcon, CalendarClock, Package, PackagePlus, Sparkles, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useStoreInventoryBySku } from '@/hooks/useStoreInventoryBySku';
import { getSkuStatusIcon } from '@/lib/inventory/skuDisplay';
import { invalidateStoreInventoryQueries } from '@/lib/inventory/invalidation';

interface StoreCardQuickViewProps {
  storeId: string;
  storeName: string;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: string | null;
  status: string | null;
  route_flag: boolean | null;
  store_id: string | null;
  created_at: string | null;
}

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export function StoreCardQuickView({ storeId, storeName }: StoreCardQuickViewProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-between h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          Quick View · Follow-ups
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </Button>
      {expanded && <QuickViewPanel storeId={storeId} storeName={storeName} />}
    </div>
  );
}

function QuickViewPanel({ storeId, storeName }: { storeId: string; storeName: string }) {
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

  // Lazy: only load open follow-ups for THIS store when expanded
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['store-followups', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relationship_tasks')
        .select('id,title,description,due_at,priority,status,route_flag,store_id,created_at')
        .eq('store_id', storeId)
        .eq('status', 'open')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as TaskRow[];
    },
    staleTime: 30_000,
  });

  // Lazy store list for the target picker (only when panel is expanded)
  const { data: storeOptions = [] } = useQuery({
    queryKey: ['store-picker-quickview', storeSearch],
    queryFn: async () => {
      let q = supabase
        .from('store_master')
        .select('id, store_name')
        .is('deleted_at', null)
        .order('store_name')
        .limit(50);
      if (storeSearch.trim()) {
        q = q.ilike('store_name', `%${storeSearch.trim()}%`);
      }
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

  const createTask = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      if (!trimmed) throw new Error('Please enter follow-up text');
      const dueIso = dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null;

      const { error } = await supabase.from('relationship_tasks').insert({
        title: trimmed.slice(0, 120),
        description: trimmed,
        due_at: dueIso,
        status: 'open',
        priority,
        task_type: 'follow_up',
        store_id: targetStoreId,
        route_flag: routeFlag,
        created_by: user?.id ?? null,
        created_at: new Date().toISOString(),
      } as any);
      if (error) throw error;

      // Stamp store's updated_at so downstream freshness signals move.
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
      qc.invalidateQueries({ queryKey: ['store-followups', targetStoreId] });
      qc.invalidateQueries({ queryKey: ['store-followups', storeId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save follow-up'),
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('relationship_tasks')
        .update({
          status: 'completed',
          completed_at: nowIso,
          completed_by: user?.id ?? null,
        } as any)
        .eq('id', taskId);
      if (error) throw error;
      await supabase
        .from('store_master')
        .update({ updated_at: nowIso } as any)
        .eq('id', storeId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-followups', storeId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to complete task'),
  });

  return (
    <div className="mt-2 space-y-3 rounded-md border border-border/50 bg-muted/30 p-3">
      <InventorySection storeId={storeId} />
      <StoreFlagsSection storeId={storeId} />

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
          <ul className="space-y-1">
            {tasks.map((t) => (
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
                    <span className="font-medium text-foreground">{t.title}</span>
                    {t.route_flag && (
                      <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[9px]">
                        <RouteIcon className="h-2.5 w-2.5" /> route
                      </Badge>
                    )}
                    {t.priority && t.priority !== 'normal' && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'h-4 px-1 text-[9px]',
                          t.priority === 'urgent' && 'border-red-500/40 text-red-600',
                          t.priority === 'high' && 'border-orange-500/40 text-orange-600'
                        )}
                      >
                        {t.priority}
                      </Badge>
                    )}
                  </div>
                  {t.due_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Due {format(new Date(t.due_at), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add follow-up form */}
      <div className="space-y-2 border-t border-border/50 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Add follow-up
        </p>

        <div className="space-y-1">
          <Label className="text-[10px]">About store</Label>
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
              {/* Always include current store as an option even if filtered out */}
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
            <Label className="text-[10px]">Due date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Priority</Label>
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
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Inventory section — reuses useStoreInventoryBySku (same source
// the Store Profile tube card uses). Lazy: query only fires when
// the parent panel is expanded (this component only mounts then).
// Inline edit writes back to store_tube_inventory using the same
// find-or-insert pattern as UpdateInventoryModal.
// ────────────────────────────────────────────────────────────────
function InventorySection({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: skus = [], isLoading } = useStoreInventoryBySku(storeId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const saveSku = useMutation({
    mutationFn: async ({ productId, count }: { productId: string; count: number }) => {
      if (isNaN(count) || count < 0) throw new Error('Invalid count');

      const { data: existing } = await supabase
        .from('store_tube_inventory')
        .select('id')
        .eq('store_id', storeId)
        .eq('product_id', productId)
        .eq('is_simulation', false)
        .maybeSingle();

      const nowIso = new Date().toISOString();
      const actor = user?.email || user?.id || 'quickview';

      if (existing) {
        const { error } = await supabase
          .from('store_tube_inventory')
          .update({
            current_tubes_left: count,
            last_updated: nowIso,
            created_by: actor,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('store_tube_inventory').insert({
          store_id: storeId,
          product_id: productId,
          current_tubes_left: count,
          created_by: actor,
        } as any);
        if (error) throw error;
      }

      // Stamp store updated_at + updated_by
      await supabase
        .from('store_master')
        .update({ updated_at: nowIso, updated_by: user?.id ?? null } as any)
        .eq('id', storeId);
    },
    onSuccess: (_d, vars) => {
      toast.success('Inventory updated');
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.productId];
        return next;
      });
      invalidateStoreInventoryQueries(qc, storeId);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update inventory'),
  });

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Package className="h-3 w-3" /> Tube inventory
      </p>
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : (
        <ul className="space-y-1">
          {skus.map((sku) => {
            const draft = drafts[sku.product_id];
            const currentValue = draft ?? String(sku.tubes_remaining);
            const dirty = draft !== undefined && draft !== String(sku.tubes_remaining);
            const pending = saveSku.isPending && saveSku.variables?.productId === sku.product_id;
            return (
              <li key={sku.product_id} className="flex items-center gap-2 text-xs">
                <span className="text-sm leading-none" aria-hidden>{getSkuStatusIcon(sku.status)}</span>
                <span className="flex-1 truncate">{sku.display}</span>
                <Input
                  type="number"
                  min={0}
                  value={currentValue}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [sku.product_id]: e.target.value }))
                  }
                  className="h-7 w-16 text-xs px-1.5 font-mono"
                />
                <Button
                  type="button"
                  size="icon"
                  variant={dirty ? 'default' : 'ghost'}
                  disabled={!dirty || pending}
                  onClick={() =>
                    saveSku.mutate({
                      productId: sku.product_id,
                      count: parseInt(currentValue, 10),
                    })
                  }
                  className="h-7 w-7 shrink-0"
                  aria-label="Save"
                >
                  {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Store flags — needs_order + bring_samples toggles on store_master.
// ────────────────────────────────────────────────────────────────
function StoreFlagsSection({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['store-flags', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('needs_order, bring_samples')
        .eq('id', storeId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { needs_order: false, bring_samples: false }) as {
        needs_order: boolean | null;
        bring_samples: boolean | null;
      };
    },
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: async ({ field, value }: { field: 'needs_order' | 'bring_samples'; value: boolean }) => {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('store_master')
        .update({
          [field]: value,
          updated_at: nowIso,
          updated_by: user?.id ?? null,
        } as any)
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-flags', storeId] });
      qc.invalidateQueries({ queryKey: ['stores-server-page'] });
      qc.invalidateQueries({ queryKey: ['stores-server-page-hydration'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update flag'),
  });

  const needs = !!flags?.needs_order;
  const samples = !!flags?.bring_samples;

  return (
    <div className="space-y-1.5 border-t border-border/50 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Flags
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label
          className={cn(
            'flex items-center gap-2 rounded border px-2 py-1.5 text-xs cursor-pointer select-none transition-colors',
            needs ? 'border-orange-500/50 bg-orange-500/10 text-orange-700' : 'border-border/60 hover:bg-muted/50'
          )}
        >
          <Checkbox
            checked={needs}
            disabled={isLoading || toggle.isPending}
            onCheckedChange={(v) => toggle.mutate({ field: 'needs_order', value: v === true })}
            className="h-3.5 w-3.5"
          />
          <PackagePlus className="h-3 w-3" />
          Needs order
        </label>
        <label
          className={cn(
            'flex items-center gap-2 rounded border px-2 py-1.5 text-xs cursor-pointer select-none transition-colors',
            samples ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-700' : 'border-border/60 hover:bg-muted/50'
          )}
        >
          <Checkbox
            checked={samples}
            disabled={isLoading || toggle.isPending}
            onCheckedChange={(v) => toggle.mutate({ field: 'bring_samples', value: v === true })}
            className="h-3.5 w-3.5"
          />
          <Sparkles className="h-3 w-3" />
          Bring samples
        </label>
      </div>
    </div>
  );
}

export default StoreCardQuickView;
