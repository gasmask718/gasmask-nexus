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
import { ChevronDown, ChevronUp, Loader2, Route as RouteIcon, CalendarClock, Package, PackagePlus, Sparkles, Save, Receipt, DollarSign, CheckCircle2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useStoreInventoryBySku } from '@/hooks/useStoreInventoryBySku';
import { getSkuStatusIcon, brandForProductId } from '@/lib/inventory/skuDisplay';
import { invalidateStoreInventoryQueries } from '@/lib/inventory/invalidation';
import { useStoreRecentInvoices } from '@/hooks/useStoreRecentInvoices';
import { StoreCardContactsQuickSection } from './StoreCardContactsQuickSection';
import { StoreQuickNotes } from './StoreQuickNotes';
import { SamplesGivenSection } from './SamplesGivenSection';

interface StoreCardQuickViewProps {
  storeId: string;
  storeName: string;
}

interface TaskRow {
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

  // Lazy: only load open opportunities/follow-ups for THIS store when expanded
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['store-opportunities', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_opportunities')
        .select('id,opportunity_text,due_date,priority,is_completed,route_flag,store_id,created_at')
        .eq('store_id', storeId)
        .eq('is_completed', false)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as TaskRow[];
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

      const { error } = await supabase.from('store_opportunities').insert({
        store_id: targetStoreId,
        opportunity_text: trimmed,
        source: 'follow_up',
        is_completed: false,
        due_date: dueIso,
        priority,
        route_flag: routeFlag,
        assignee: user?.id ?? null,
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
      qc.invalidateQueries({ queryKey: ['store-opportunities', targetStoreId] });
      qc.invalidateQueries({ queryKey: ['store-opportunities', storeId] });
      qc.invalidateQueries({ queryKey: ['store-opportunities'] });
      qc.invalidateQueries({ queryKey: ['opportunities-summary'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save follow-up'),
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('store_opportunities')
        .update({
          is_completed: true,
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
      qc.invalidateQueries({ queryKey: ['store-opportunities', storeId] });
      qc.invalidateQueries({ queryKey: ['store-opportunities'] });
      qc.invalidateQueries({ queryKey: ['opportunities-summary'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to complete task'),
  });

  return (
    <div className="mt-2 space-y-3 rounded-md border border-border/50 bg-muted/30 p-3">
      <InventorySection storeId={storeId} />
      <StoreFlagsSection storeId={storeId} />
      <StoreCardContactsQuickSection storeId={storeId} storeName={storeName} />
      <StoreQuickNotes storeId={storeId} compact />
      <QuickOrderSection storeId={storeId} storeName={storeName} />
      <PaymentSection storeId={storeId} storeName={storeName} />
      <SamplesGivenSection storeId={storeId} variant="compact" />







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
                    <span className="font-medium text-foreground">{t.opportunity_text}</span>
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
                  {t.due_date && (
                    <p className="text-[10px] text-muted-foreground">
                      Due {format(new Date(t.due_date), 'MMM d, yyyy')}
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
        const brand = brandForProductId(productId);
        if (!brand) throw new Error(`Unknown product ${productId} — no brand mapping`);
        const { error } = await supabase.from('store_tube_inventory').insert({
          store_id: storeId,
          product_id: productId,
          brand,
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
// Store flags — needs_order + bring_samples toggles.
// SOURCE OF TRUTH: store_tube_inventory_status (per-brand rows).
// The delivery scheduling page (OrdersDeliveriesPage Tab 1) and
// useSLAAlerts + useDispatchIntakeView all read from this table.
// Read  = ANY row for this store has the flag true.
// Write = UPDATE all existing rows for the store; if none exist,
//         INSERT one placeholder row (GasMask) so the flag surfaces.
// NOTE: store_master.needs_order / bring_samples columns are legacy
// and no longer written from here — nothing else reads them.
// ────────────────────────────────────────────────────────────────
function StoreFlagsSection({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['store-flags', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .select('needs_order, bring_samples')
        .eq('store_id', storeId);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ needs_order: boolean | null; bring_samples: boolean | null }>;
      return {
        needs_order: rows.some((r) => !!r.needs_order),
        bring_samples: rows.some((r) => !!r.bring_samples),
      };
    },
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: async ({ field, value }: { field: 'needs_order' | 'bring_samples'; value: boolean }) => {
      const nowIso = new Date().toISOString();
      // Update any existing per-brand rows first.
      const { data: updated, error: updErr } = await supabase
        .from('store_tube_inventory_status')
        .update({
          [field]: value,
          last_updated_at: nowIso,
          last_updated_by: user?.id ?? null,
          last_updated_method: 'quickview',
        } as any)
        .eq('store_id', storeId)
        .select('id');
      if (updErr) throw updErr;

      // No rows yet — create a placeholder so the flag surfaces on delivery/SLA views.
      if ((updated?.length ?? 0) === 0 && value === true) {
        const { error: insErr } = await supabase
          .from('store_tube_inventory_status')
          .insert({
            store_id: storeId,
            brand_id: 'gasmask',
            brand_name: 'GasMask',
            [field]: true,
            last_updated_at: nowIso,
            last_updated_by: user?.id ?? null,
            last_updated_method: 'quickview',
          } as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-flags', storeId] });
      qc.invalidateQueries({ queryKey: ['orders-requested'] });
      qc.invalidateQueries({ queryKey: ['dispatch-intake'] });
      qc.invalidateQueries({ queryKey: ['sla-alerts'] });
      qc.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
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

// ────────────────────────────────────────────────────────────────
// Shared: resolve textable recipient for a store.
// Priority: primary store_contacts.phone (unless opted out / sms_opt_in=false)
// → store_master.phone → store_master.alt_phone.
// ────────────────────────────────────────────────────────────────
function useTextableRecipient(storeId: string) {
  return useQuery({
    queryKey: ['textable-recipient', storeId],
    staleTime: 60_000,
    queryFn: async (): Promise<{ phone: string | null; source: string; blocked: boolean; reason: string | null }> => {
      const { data: contact } = await supabase
        .from('store_contacts')
        .select('phone, opted_out, can_receive_sms, name')
        .eq('store_id', storeId)
        .eq('is_primary', true)
        .maybeSingle();
      if (contact) {
        if (contact.opted_out) return { phone: null, source: 'contact', blocked: true, reason: 'Primary contact opted out' };
        if (contact.can_receive_sms === false) return { phone: null, source: 'contact', blocked: true, reason: 'Primary contact SMS off' };
        if (contact.phone) return { phone: contact.phone, source: `contact:${contact.name || 'primary'}`, blocked: false, reason: null };
      }
      const { data: store } = await supabase
        .from('store_master')
        .select('phone')
        .eq('id', storeId)
        .maybeSingle();
      const fallback = store?.phone || null;
      if (fallback) return { phone: fallback, source: 'store_master', blocked: false, reason: null };
      return { phone: null, source: 'none', blocked: false, reason: 'No phone on file' };
    },
  });
}

function TextReceiptButton({
  storeId,
  storeName,
  invoiceId,
  invoiceNumber,
  totalAmount,
  label = 'Text receipt',
}: {
  storeId: string;
  storeName: string;
  invoiceId: string;
  invoiceNumber: string | null;
  totalAmount: number;
  label?: string;
}) {
  const { data: recipient, isLoading } = useTextableRecipient(storeId);
  const send = useMutation({
    mutationFn: async () => {
      if (!recipient?.phone) throw new Error(recipient?.reason || 'No textable number');
      const { data, error } = await supabase.functions.invoke('send-invoice-receipt', {
        body: {
          invoice_id: invoiceId,
          store_id: storeId,
          invoice_number: invoiceNumber || invoiceId.slice(0, 8),
          total_amount: totalAmount,
          store_name: storeName,
          recipient_phone: recipient.phone,
          manual_resend: true,
        },
      });
      if (error) throw error;
      if (data && (data as any).sent === false) throw new Error((data as any).reason || 'Send skipped');
      return data;
    },
    onSuccess: () => toast.success('Receipt texted'),
    onError: (e: any) => toast.error(e?.message || 'Failed to text receipt'),
  });
  const disabled = isLoading || send.isPending || !recipient?.phone || recipient?.blocked;
  const title = recipient?.blocked
    ? recipient.reason || 'Opted out'
    : !recipient?.phone
    ? 'No textable number'
    : `Text to ${recipient.phone}`;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={() => send.mutate()}
      className="h-7 px-2 text-[11px] gap-1"
      title={title}
    >
      {send.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
      {label}
    </Button>
  );
}

// ────────────────────────────────────────────────────────────────
// PHASE 2E QuickOrderSection — Unit picker (Box / Half-box / Loose),
// price derives from product + unit, unit label follows the product
// (bags for GasMask Bags, tubes for the rest via track_by/unit_type),
// paid/unpaid toggle at creation, optional "text receipt on create".
// ────────────────────────────────────────────────────────────────

type UnitMode = 'box' | 'half' | 'loose';

const BOX_UNITS = 100;
const HALF_UNITS = 50;

interface ProductRow {
  id: string;
  name: string;
  brand_id: string | null;
  track_by: string | null;
  unit_type: string | null;
  units_per_box: number | null;
  price_per_unit: number | null;
  price_per_tube: number | null;
  price_per_box: number | null;
  store_price: number | null;
}

function productUnitLabel(p: ProductRow | null | undefined): 'bags' | 'tubes' {
  if (!p) return 'tubes';
  const t = (p.track_by || p.unit_type || '').toLowerCase();
  return t.startsWith('bag') ? 'bags' : 'tubes';
}

function QuickOrderSection({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: skus = [] } = useStoreInventoryBySku(storeId);

  const [productId, setProductId] = useState<string>('');
  const [unitMode, setUnitMode] = useState<UnitMode>('box');
  const [looseQty, setLooseQty] = useState<string>('');
  // R7 — explicit Paid/Unpaid choice at creation (default Unpaid).
  const [paymentChoice, setPaymentChoice] = useState<'unpaid' | 'paid'>('unpaid');
  const [textOnCreate, setTextOnCreate] = useState<boolean>(false);
  const [lastCreated, setLastCreated] = useState<{ id: string; number: string; total: number } | null>(null);

  // Textable recipient — used to gate the "text on create" checkbox
  const { data: recipient } = useTextableRecipient(storeId);

  const { data: product } = useQuery({
    queryKey: ['quickorder-product', productId],
    enabled: !!productId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, brand_id, track_by, unit_type, units_per_box, price_per_unit, price_per_tube, price_per_box, store_price')
        .eq('id', productId)
        .maybeSingle();
      if (error) throw error;
      return data as ProductRow | null;
    },
  });

  const unitLabel = productUnitLabel(product);
  const unitSingular = unitLabel === 'bags' ? 'bag' : 'tube';

  // Derive units + unit price + total live from product + unit mode
  const derived = (() => {
    if (!product) return { units: 0, unitPrice: 0, total: 0, lineDescriptor: '' };
    const pricePerUnit = Number(
      product.store_price ?? product.price_per_unit ?? product.price_per_tube ?? 0
    );
    const pricePerBox = Number(product.price_per_box ?? pricePerUnit * BOX_UNITS);
    if (unitMode === 'box') {
      return {
        units: BOX_UNITS,
        unitPrice: pricePerUnit,
        total: pricePerBox,
        lineDescriptor: `1 box (${BOX_UNITS} ${unitLabel})`,
      };
    }
    if (unitMode === 'half') {
      return {
        units: HALF_UNITS,
        unitPrice: pricePerUnit,
        total: pricePerUnit * HALF_UNITS,
        lineDescriptor: `Half box (${HALF_UNITS} ${unitLabel})`,
      };
    }
    const n = parseInt(looseQty, 10);
    const qty = isNaN(n) || n < 0 ? 0 : n;
    return {
      units: qty,
      unitPrice: pricePerUnit,
      total: pricePerUnit * qty,
      lineDescriptor: `${qty} ${qty === 1 ? unitSingular : unitLabel} loose`,
    };
  })();

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}-${random}`;
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error('Pick a product');
      if (!product) throw new Error('Product not loaded yet');
      const qty = derived.units;
      const price = derived.unitPrice;
      if (!qty || qty <= 0) throw new Error('Enter a quantity');
      if (isNaN(price) || price < 0) throw new Error('No valid unit price');

      const productName = product.name || 'Product';
      const total = Number(derived.total.toFixed(2));
      const nowIso = new Date().toISOString();
      const invoiceNumber = generateInvoiceNumber();
      const sku = skus.find((s) => s.product_id === productId);

      // R6 — always insert the invoice as a DRAFT/UNPAID shell first so the
      // finalize-on-paid trigger cannot fire before line items exist.
      // Sequence: (1) draft invoice, (2) line items, (3) flip payment_status to paid.
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          store_id: storeId,
          entity_type: 'store',
          entity_id: storeId,
          pricing_mode: 'retail',
          invoice_number: invoiceNumber,
          subtotal: total,
          tax: 0,
          total,
          total_amount: total,
          payment_status: 'unpaid',
          paid_at: null,
          brand: sku?.parent_brand || null,
          created_by: user?.id || 'quickview',
          created_at: nowIso,
          status: 'draft',
          entry_mode: 'live',
        } as any)
        .select('id')
        .single();
      if (invErr) throw invErr;

      // For bag products, computed_tubes_total still tracks "units" for downstream
      // aggregate logic (its column is unit-agnostic despite the name).
      const { error: liErr } = await supabase.from('invoice_line_items').insert({
        invoice_id: invoice!.id,
        brand_id: product.brand_id ?? null,
        product_id: productId,
        product_name: productName,
        product_name_snapshot: productName,
        quantity: qty,
        unit_price: price,
        total,
        sale_channel: 'retail',
        sale_unit: unitLabel === 'bags' ? 'bag' : 'unit',
        quantity_tubes: qty,
        computed_tubes_total: qty,
        list_unit_price: price,
        unit_price_used: price,
        line_subtotal: total,
        pricing_mode: 'retail',
      } as any);
      if (liErr) throw liErr;

      // R6/R7 — only NOW mark paid, after line items exist.
      if (paymentChoice === 'paid') {
        const { error: payErr } = await supabase
          .from('invoices')
          .update({ payment_status: 'paid', paid_at: nowIso } as any)
          .eq('id', invoice!.id);
        if (payErr) throw payErr;
      }


      await supabase
        .from('store_master')
        .update({ updated_at: nowIso, updated_by: user?.id ?? null } as any)
        .eq('id', storeId);

      // Optional: text receipt on create (respects phone/opt-out gate)
      let textSent = false;
      if (textOnCreate && recipient?.phone && !recipient.blocked) {
        try {
          const { data, error } = await supabase.functions.invoke('send-invoice-receipt', {
            body: {
              invoice_id: invoice!.id,
              store_id: storeId,
              invoice_number: invoiceNumber,
              total_amount: total,
              store_name: storeName,
              recipient_phone: recipient.phone,
              manual_resend: false,
            },
          });
          if (!error && !(data && (data as any).sent === false)) textSent = true;
        } catch {
          textSent = false;
        }
      }

      return { id: invoice!.id, number: invoiceNumber, total, textSent };
    },
    onSuccess: (result) => {
      toast.success(result.textSent ? 'Order created · receipt texted' : 'Order created');
      setLooseQty('');
      setPaymentChoice('unpaid');
      setTextOnCreate(false);
      setLastCreated({ id: result.id, number: result.number, total: result.total });
      qc.invalidateQueries({ queryKey: ['store-recent-invoices-sku', storeId] });
      qc.invalidateQueries({ queryKey: ['store-invoices', 'store', storeId] });
      qc.invalidateQueries({ queryKey: ['unified-invoice-feed'] });
      qc.invalidateQueries({ queryKey: ['store-last-order-line-items', storeId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create order'),
  });

  const canCreate = !!productId && !!product && derived.units > 0 && !create.isPending;
  const textOnCreateBlocked = !recipient?.phone || !!recipient?.blocked;

  return (
    <div className="space-y-1.5 border-t border-border/50 pt-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Receipt className="h-3 w-3" /> Quick order
      </p>

      <Select value={productId} onValueChange={(v) => { setProductId(v); setLooseQty(''); }}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Pick product" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {skus.map((s) => (
            <SelectItem key={s.product_id} value={s.product_id} className="text-xs">
              {s.display}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Unit picker */}
      <div className="grid grid-cols-3 gap-1">
        {(['box', 'half', 'loose'] as UnitMode[]).map((mode) => {
          const active = unitMode === mode;
          const label = mode === 'box' ? 'Box' : mode === 'half' ? 'Half-box' : 'Loose';
          return (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="h-7 text-[11px]"
              onClick={() => setUnitMode(mode)}
              disabled={!productId}
            >
              {label}
            </Button>
          );
        })}
      </div>

      {unitMode === 'loose' && (
        <div className="space-y-1">
          <Label className="text-[10px]">Loose {unitLabel}</Label>
          <Input
            type="number"
            min={1}
            value={looseQty}
            onChange={(e) => setLooseQty(e.target.value)}
            placeholder={`e.g. 25`}
            className="h-8 text-xs"
          />
        </div>
      )}

      {/* Live totals */}
      <div className="flex items-center justify-between rounded border border-border/40 bg-background/40 px-2 py-1.5 text-xs">
        <span className="text-muted-foreground">
          {productId ? derived.lineDescriptor || `— ${unitLabel}` : 'Select a product'}
        </span>
        <div className="text-right">
          <div className="font-mono font-semibold text-foreground">
            ${derived.total.toFixed(2)}
          </div>
          {derived.units > 0 && (
            <div className="text-[10px] text-muted-foreground">
              ${derived.unitPrice.toFixed(2)}/{unitSingular}
            </div>
          )}
        </div>
      </div>

      {/* R7 — explicit Paid / Unpaid choice at create (default Unpaid) */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Payment status
        </Label>
        <div className="grid grid-cols-2 gap-1">
          {(['unpaid', 'paid'] as const).map((choice) => {
            const active = paymentChoice === choice;
            const label = choice === 'unpaid' ? 'Unpaid' : 'Paid';
            return (
              <Button
                key={choice}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                className={cn(
                  'h-7 text-[11px]',
                  active && choice === 'paid' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                  active && choice === 'unpaid' && 'bg-amber-600 hover:bg-amber-700 text-white',
                )}
                onClick={() => setPaymentChoice(choice)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label
          className={cn(
            'flex items-center gap-1.5 text-xs select-none',
            textOnCreateBlocked ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer'
          )}
          title={
            textOnCreateBlocked
              ? recipient?.reason || 'No textable number on file'
              : `Will text ${recipient?.phone}`
          }
        >
          <Checkbox
            checked={textOnCreate}
            onCheckedChange={(v) => setTextOnCreate(v === true)}
            disabled={textOnCreateBlocked}
            className="h-3.5 w-3.5"
          />
          <MessageSquare className="h-3 w-3" />
          Text receipt on create
          {recipient?.phone && !recipient.blocked && (
            <span className="text-[10px] text-muted-foreground truncate">→ {recipient.phone}</span>
          )}
        </label>
      </div>

      <Button
        type="button"
        size="sm"
        className="w-full h-8 text-xs"
        disabled={!canCreate}
        onClick={() => create.mutate()}
      >
        {create.isPending ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Creating…
          </>
        ) : (
          'Create order'
        )}
      </Button>

      {lastCreated && (
        <div className="flex items-center justify-between gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1">
          <span className="text-[11px] text-emerald-700 truncate">
            Created {lastCreated.number} · ${lastCreated.total.toFixed(2)}
          </span>
          <TextReceiptButton
            storeId={storeId}
            storeName={storeName}
            invoiceId={lastCreated.id}
            invoiceNumber={lastCreated.number}
            totalAmount={lastCreated.total}
            label="Resend"
          />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// PHASE 2D-1: Resolve payment — lists open (unpaid/partial) invoices
// from useStoreRecentInvoices and marks paid using the same shape
// as InvoiceHistoryCard's togglePaymentStatusMutation.
// ────────────────────────────────────────────────────────────────
function PaymentSection({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Server-side open-only filter (payment_status IN ('unpaid','partial')).
  // Nulls are excluded — treated as legacy/unknown, not "open".
  const { data: open = [], isLoading } = useStoreRecentInvoices(storeId, 100, { openOnly: true });


  const markPaid = useMutation({
    mutationFn: async (invoiceId: string) => {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('invoices')
        .update({ payment_status: 'paid', paid_at: nowIso } as any)
        .eq('id', invoiceId);
      if (error) throw error;
      await supabase
        .from('store_master')
        .update({ updated_at: nowIso, updated_by: user?.id ?? null } as any)
        .eq('id', storeId);
    },
    onSuccess: () => {
      toast.success('Payment recorded');
      qc.invalidateQueries({ queryKey: ['store-recent-invoices-sku', storeId] });
      qc.invalidateQueries({ queryKey: ['store-invoices', 'store', storeId] });
      qc.invalidateQueries({ queryKey: ['all-invoices'] });
      qc.invalidateQueries({ queryKey: ['unified-invoice-feed'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to mark paid'),
  });

  return (
    <div className="space-y-1.5 border-t border-border/50 pt-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <DollarSign className="h-3 w-3" /> Resolve payment
      </p>
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : open.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">No open invoices</p>
      ) : (
        <ul className="space-y-1">
          {open.map((inv) => {
            const balance =
              inv.payment_status === 'partial' && inv.partial_amount != null
                ? Math.max(0, inv.total - inv.partial_amount)
                : inv.total;
            const pending = markPaid.isPending && markPaid.variables === inv.id;
            return (
              <li
                key={inv.id}
                className="flex items-center gap-2 rounded border border-border/50 bg-background/40 px-2 py-1 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">
                      {inv.invoice_number || inv.id.slice(0, 8)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'h-4 px-1 text-[9px] capitalize',
                        inv.payment_status === 'partial'
                          ? 'border-amber-500/50 text-amber-600'
                          : 'border-red-500/50 text-red-600'
                      )}
                    >
                      {inv.payment_status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(inv.created_at), 'MMM d')} · Balance ${balance.toFixed(2)}
                  </p>
                </div>
                <TextReceiptButton
                  storeId={storeId}
                  storeName={storeName}
                  invoiceId={inv.id}
                  invoiceNumber={inv.invoice_number}
                  totalAmount={inv.total}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => markPaid.mutate(inv.id)}
                  className="h-7 px-2 text-[11px] gap-1"
                >
                  {pending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  Mark paid
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


export default StoreCardQuickView;
