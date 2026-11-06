import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, PackagePlus, Pencil, X, CheckCircle2 } from 'lucide-react';
import { BRAND_ROWS, isValidQuantity, itemsText, type BrandKey, type OrderItem } from '@/lib/orders/fieldOrders';

type Product = { id: string; name: string; store_price: number | null; price_per_box: number | null };
type DeliverBy = 'next_visit' | 'tomorrow' | 'date';
const CHIPS = [{ q: 0.5, label: '½ box' }, { q: 1, label: '1 box' }, { q: 2, label: '2 boxes' }];

export function useOrderCatalog() {
  return useQuery({
    queryKey: ['field-order-catalog'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id,name,store_price,price_per_box')
        .eq('is_active', true).or('is_deleted.is.null,is_deleted.eq.false').order('name');
      if (error) throw error;
      return BRAND_ROWS.map(row => ({ ...row, products: ((data || []) as Product[]).filter(p => row.match(p.name)) }));
    },
  });
}

export function BringOrderBar({ storeId, storeName, className }: { storeId: string; storeName?: string; className?: string }) {
  const qc = useQueryClient();
  const catalog = useOrderCatalog();
  const today = useQuery({
    queryKey: ['field-order-requests', 'store', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('field_order_requests_list', { p_store_id: storeId });
      if (error) throw error;
      return (data?.requests || []).filter((r: any) => r.status !== 'cancelled') as any[];
    },
  });
  const [qty, setQty] = useState<Partial<Record<BrandKey, number>>>({});
  const [variant, setVariant] = useState<Partial<Record<BrandKey, string>>>({});
  const [custom, setCustom] = useState<BrandKey | null>(null);
  const [customVal, setCustomVal] = useState('');
  const [note, setNote] = useState('');
  const [deliverBy, setDeliverBy] = useState<DeliverBy>('next_visit');
  const [date, setDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const items: OrderItem[] = useMemo(() => (catalog.data || []).flatMap(row => {
    const q = qty[row.key]; if (!q) return [];
    const p = row.products.find(x => x.id === variant[row.key]) || row.products[0];
    return [{ brand_key: row.key, product_id: p?.id || null, name: p?.name || row.label, quantity: q, store_price: p?.store_price ?? null }];
  }), [catalog.data, qty, variant]);

  const reset = () => { setQty({}); setNote(''); setDeliverBy('next_visit'); setDate(''); setEditingId(null); setCustom(null); };
  const refresh = () => { qc.invalidateQueries({ queryKey: ['field-order-requests'] }); };

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)('field_order_request_save', {
        p_store_id: storeId, p_items: items, p_note: note || null, p_deliver_by: deliverBy,
        p_deliver_date: deliverBy === 'date' ? date || null : null, p_request_id: editingId,
      });
      if (error) throw error; return data;
    },
    onSuccess: (d: any) => { toast.success(`Order requested: ${d?.summary || ''}`); reset(); refresh(); },
    onError: (e: any) => toast.error(e.message || 'Could not save order request'),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase.rpc as any)('field_order_request_cancel', { p_request_id: id }); if (error) throw error; },
    onSuccess: () => { toast.success('Order request cancelled'); reset(); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (r: any) => {
    const nq: Partial<Record<BrandKey, number>> = {}; const nv: Partial<Record<BrandKey, string>> = {};
    for (const i of r.items as OrderItem[]) { nq[i.brand_key] = Number(i.quantity); if (i.product_id) nv[i.brand_key] = i.product_id; }
    setQty(nq); setVariant(nv); setNote(r.notes || ''); setDeliverBy(r.deliver_by || 'next_visit'); setDate(r.requested_date || ''); setEditingId(r.id);
  };

  return (
    <section data-testid="bring-order-bar" aria-label={`Bring order${storeName ? ` for ${storeName}` : ''}`}
      className={cn('rounded-lg border-2 border-primary/40 bg-primary/5 p-3 space-y-2 min-w-0', className)}>
      <div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-primary" /><h4 className="font-bold tracking-wide">BRING ORDER</h4>
        {editingId && <Badge variant="outline">Editing</Badge>}</div>

      {(today.data || []).map(r => (
        <div key={r.id} className="rounded-md bg-primary/15 border border-primary/30 p-2 text-sm space-y-1" data-testid="order-requested-badge">
          <div className="flex items-center gap-1 font-semibold text-primary"><CheckCircle2 className="h-4 w-4" />Order requested · {r.status === 'new' ? 'requested' : r.status}</div>
          <p className="break-words">{itemsText(r.items)}{r.notes ? ` — ${r.notes}` : ''}</p>
          <p className="text-xs text-muted-foreground">{r.requested_by_name ? `${r.requested_by_name} · ` : ''}{new Date(r.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          {r.can_edit && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(r)}><Pencil className="h-3 w-3" />Edit</Button>
            <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}><X className="h-3 w-3" />Cancel</Button></div>}
        </div>
      ))}
      {today.error && <p className="text-xs text-destructive">{(today.error as Error).message}</p>}
      {catalog.error && <p className="text-xs text-destructive">{(catalog.error as Error).message}</p>}
      {catalog.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}

      {(catalog.data || []).map(row => {
        const p = row.products.find(x => x.id === variant[row.key]) || row.products[0];
        const missing = row.products.length === 0;
        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="text-xs text-muted-foreground">{missing ? 'Not in catalog' : p?.price_per_box != null ? `$${Number(p.price_per_box).toFixed(0)}/box · $${Number(p.store_price ?? 0).toFixed(2)} ea` : ''}</span>
            </div>
            {row.products.length > 1 && <div className="flex flex-wrap gap-1">{row.products.map(v => (
              <button key={v.id} type="button" onClick={() => setVariant(s => ({ ...s, [row.key]: v.id }))}
                className={cn('rounded-full border px-2 py-0.5 text-xs', (p?.id === v.id) ? 'bg-secondary border-primary' : 'border-border')}>
                {v.name.replace(/^hotscolatti\s*/i, '') || v.name}</button>))}</div>}
            <div className="grid grid-cols-4 gap-1">
              {CHIPS.map(c => (
                <Button key={c.q} type="button" disabled={missing} variant={qty[row.key] === c.q ? 'default' : 'outline'} className="h-11 px-1 text-sm"
                  aria-pressed={qty[row.key] === c.q} aria-label={`${row.label} ${c.label}`}
                  onClick={() => setQty(s => ({ ...s, [row.key]: s[row.key] === c.q ? undefined : c.q }))}>{c.label}</Button>
              ))}
              <Button type="button" disabled={missing} variant={qty[row.key] && !CHIPS.some(c => c.q === qty[row.key]) ? 'default' : 'outline'} className="h-11 px-1 text-sm"
                aria-label={`${row.label} custom quantity`} onClick={() => { setCustom(row.key); setCustomVal(String(qty[row.key] || '')); }}>
                {qty[row.key] && !CHIPS.some(c => c.q === qty[row.key]) ? `${qty[row.key]}` : '+'}</Button>
            </div>
            {custom === row.key && <div className="flex gap-2">
              <Input inputMode="decimal" autoFocus placeholder="Boxes (e.g. 3 or 1.5)" value={customVal} onChange={e => setCustomVal(e.target.value)} className="h-11" />
              <Button className="h-11" onClick={() => { const n = Number(customVal); if (!isValidQuantity(n)) { toast.error('Use half-box steps, up to 100'); return; } setQty(s => ({ ...s, [row.key]: n })); setCustom(null); }}>OK</Button>
            </div>}
          </div>
        );
      })}

      <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Quick note (optional) — tap mic to talk" className="h-11" aria-label="Order note" />
      <div className="grid grid-cols-3 gap-1">
        {([['next_visit', 'Next visit'], ['tomorrow', 'Tomorrow'], ['date', 'Pick date']] as const).map(([v, l]) => (
          <Button key={v} type="button" size="sm" variant={deliverBy === v ? 'secondary' : 'ghost'} className={cn('h-9', deliverBy === v && 'border border-primary')} onClick={() => setDeliverBy(v)}>{l}</Button>
        ))}
      </div>
      {deliverBy === 'date' && <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-11" aria-label="Deliver by date" />}
      <div className="flex gap-2">
        <Button className="h-12 flex-1 text-base font-bold" disabled={!items.length || save.isPending || (deliverBy === 'date' && !date)} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? 'Save changes' : 'Save order request'}{items.length ? ` (${items.length})` : ''}</Button>
        {editingId && <Button variant="ghost" className="h-12" onClick={reset}>Stop editing</Button>}
      </div>
    </section>
  );
}
