import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Plus, CheckCircle2, Store } from 'lucide-react';
import { UNITS_PER_BOX, money } from '@/lib/storePortal';
import { orderTotal, buildBatchPayload, type StoreOrder } from '@/lib/multiStoreOrder';

const sb = supabase as any;

export type OwnerStore = {
  store_id: string; store_name: string; address: string | null; city: string | null; state: string | null; zip: string | null;
  approval: 'linked' | 'pending' | 'rejected' | 'approved'; orderable: boolean;
};
type CatalogItem = { product_id: string; name: string; brand: string; unit_price: number };

const fullAddr = (s: Pick<OwnerStore, 'address' | 'city' | 'state' | 'zip'>) => [s.address, s.city, s.state, s.zip].filter(Boolean).join(', ');
const CHIPS = [{ label: 'Half box', q: 0.5 }, { label: '1 box', q: 1 }, { label: '2 boxes', q: 2 }];
const emptyOrder = (): StoreOrder => ({ qty: {}, note: '', deliverBy: 'asap', date: format(addDays(new Date(), 1), 'yyyy-MM-dd') });

export function useOwnerStores() {
  return useQuery({
    queryKey: ['store-portal-owner-stores'],
    queryFn: async () => {
      const { data, error } = await sb.rpc('store_portal_owner_stores');
      if (error) throw error;
      return data as OwnerStore[];
    },
  });
}

function OrderEditor({ catalog, order, onChange }: { catalog: CatalogItem[]; order: StoreOrder; onChange: (o: StoreOrder) => void }) {
  const [customFor, setCustomFor] = useState<string | null>(null);
  const setQty = (pid: string, q: number) => {
    const next = { ...order.qty };
    if (!q || q <= 0 || next[pid] === q) delete next[pid]; else next[pid] = q;
    onChange({ ...order, qty: next });
  };
  const dates = Array.from({ length: 30 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd'));
  return (
    <div className="space-y-3">
      {catalog.map((p) => {
        const q = order.qty[p.product_id];
        const isCustom = q !== undefined && !CHIPS.some((c) => c.q === q);
        return (
          <div key={p.product_id} className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{p.name}</span>
              <span className="text-muted-foreground">{money(Number(p.unit_price) * UNITS_PER_BOX)}/box</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {CHIPS.map((c) => (
                <Button key={c.label} type="button" className="h-12 px-1 text-sm" variant={q === c.q ? 'default' : 'secondary'} onClick={() => setQty(p.product_id, c.q)}>{c.label}</Button>
              ))}
              <Button type="button" className="h-12 px-1 text-sm" variant={isCustom ? 'default' : 'secondary'} onClick={() => setCustomFor(customFor === p.product_id ? null : p.product_id)}>
                {isCustom ? `${q} box` : '+ Custom'}
              </Button>
            </div>
            {customFor === p.product_id && (
              <Input type="number" inputMode="decimal" min={0.5} step={0.5} placeholder="How many boxes?" className="h-12 text-lg"
                defaultValue={isCustom ? q : ''} onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = { ...order.qty };
                  if (!v || v <= 0) delete next[p.product_id]; else next[p.product_id] = Math.min(v, 200);
                  onChange({ ...order, qty: next });
                }} />
            )}
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-12" variant={order.deliverBy === 'asap' ? 'default' : 'secondary'} onClick={() => onChange({ ...order, deliverBy: 'asap' })}>As soon as possible</Button>
        <Button type="button" className="h-12" variant={order.deliverBy === 'scheduled' ? 'default' : 'secondary'} onClick={() => onChange({ ...order, deliverBy: 'scheduled' })}>Pick a date</Button>
      </div>
      {order.deliverBy === 'scheduled' && (
        <select className="h-12 w-full rounded-md border bg-background px-3" value={order.date} onChange={(e) => onChange({ ...order, date: e.target.value })}>
          {dates.map((d) => <option key={d} value={d}>{format(new Date(d + 'T12:00:00'), 'EEEE, MMM d')}</option>)}
        </select>
      )}
      <Textarea placeholder="Note for this store (optional)" value={order.note} maxLength={500} onChange={(e) => onChange({ ...order, note: e.target.value })} />
    </div>
  );
}

export function MultiStoreOrderScreen() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: stores = [], isLoading } = useOwnerStores();
  const { data: catalog = [] } = useQuery({
    queryKey: ['store-portal-catalog'],
    queryFn: async () => {
      const { data, error } = await sb.rpc('store_portal_catalog');
      if (error) throw error;
      return data as CatalogItem[];
    },
  });
  const [checked, setChecked] = useState<string[]>([]);
  const [same, setSame] = useState(true);
  const [shared, setShared] = useState<StoreOrder>(emptyOrder());
  const [perStore, setPerStore] = useState<Record<string, StoreOrder>>({});
  const [step, setStep] = useState<'pick' | 'review' | 'done'>('pick');
  const [result, setResult] = useState<{ batch_id: string; requests: { store_id: string; request_id: string }[] } | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const orderable = stores.filter((s) => s.orderable);
  const waiting = stores.filter((s) => !s.orderable);
  const priceOf = useMemo(() => Object.fromEntries(catalog.map((c) => [c.product_id, Number(c.unit_price) * UNITS_PER_BOX])), [catalog]);
  const orderFor = (id: string) => (same ? shared : perStore[id] ?? emptyOrder());
  const selected = orderable.filter((s) => checked.includes(s.store_id));
  const grand = selected.reduce((sum, s) => sum + orderTotal(orderFor(s.store_id), priceOf), 0);
  const allHaveItems = selected.length > 0 && selected.every((s) => Object.keys(orderFor(s.store_id).qty).length > 0);

  const send = useMutation({
    mutationFn: async () => {
      const payload = buildBatchPayload(selected.map((s) => s.store_id), orderFor, catalog);
      const { data, error } = await sb.rpc('store_portal_send_order_batch', { p_orders: payload });
      if (error) throw error;
      for (const r of data.requests) {
        const { error: nErr } = await supabase.functions.invoke('store-portal-notify', { body: { request_id: r.request_id, event: 'created' } });
        if (nErr) console.error('notify failed', nErr);
      }
      return data;
    },
    onSuccess: (data) => {
      setResult(data); setStep('done');
      toast.success(`${data.requests.length} orders sent`);
      qc.invalidateQueries({ queryKey: ['store-portal-owner-requests'] });
      qc.invalidateQueries({ queryKey: ['store-portal-requests'] });
      qc.invalidateQueries({ queryKey: ['store-portal-home'] });
    },
    onError: (e: any) => toast.error(e.message || String(e)),
  });

  if (isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;

  if (step === 'done' && result) {
    const name = (id: string) => stores.find((s) => s.store_id === id);
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-4 text-lg font-semibold"><CheckCircle2 className="h-6 w-6 text-primary" />All orders sent</div>
        {result.requests.map((r) => {
          const s = name(r.store_id);
          return (
            <div key={r.request_id} className="rounded-2xl border bg-card p-4">
              <div className="font-semibold">{s?.store_name}</div>
              <div className="text-sm text-muted-foreground">{s && fullAddr(s)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Request #{r.request_id.slice(0, 8)} · we will confirm by text</div>
            </div>
          );
        })}
        <Button className="h-14 w-full text-lg" onClick={() => navigate('/portal/mystore/requests')}>See my requests</Button>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Check each store. Nothing is sent until you tap “Send all orders”.</p>
        {selected.map((s) => {
          const o = orderFor(s.store_id);
          return (
            <div key={s.store_id} className="space-y-1 rounded-2xl border bg-card p-4">
              <div className="font-semibold">{s.store_name}</div>
              <div className="text-sm text-muted-foreground">{fullAddr(s)}</div>
              <ul className="pt-1 text-sm">
                {catalog.filter((c) => o.qty[c.product_id]).map((c) => (
                  <li key={c.product_id} className="flex justify-between"><span>{o.qty[c.product_id]} box · {c.name}</span><span>{money(o.qty[c.product_id] * priceOf[c.product_id])}</span></li>
                ))}
              </ul>
              <div className="text-xs text-muted-foreground">{o.deliverBy === 'asap' ? 'As soon as possible' : format(new Date(o.date + 'T12:00:00'), 'EEE, MMM d')}{o.note ? ` · “${o.note}”` : ''}</div>
              <div className="flex justify-between pt-1 font-semibold"><span>Estimated</span><span>{money(orderTotal(o, priceOf))}</span></div>
            </div>
          );
        })}
        <div className="flex justify-between rounded-2xl border bg-card p-4 text-xl font-bold"><span>Grand total</span><span>{money(grand)}</span></div>
        <p className="text-xs text-muted-foreground">Estimated at store price. Your invoice shows the final amount.</p>
        <Button className="h-14 w-full text-lg" disabled={send.isPending} onClick={() => send.mutate()}>
          {send.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}Send all orders ({selected.length})
        </Button>
        <Button variant="outline" className="h-12 w-full" disabled={send.isPending} onClick={() => setStep('pick')}>Back and change</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {orderable.map((s) => {
          const on = checked.includes(s.store_id);
          return (
            <label key={s.store_id} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border bg-card p-4 ${on ? 'border-primary' : ''}`}>
              <Checkbox className="h-6 w-6" checked={on} onCheckedChange={(v) => setChecked((c) => (v ? [...c, s.store_id] : c.filter((x) => x !== s.store_id)))} />
              <div className="min-w-0">
                <div className="font-semibold">{s.store_name}</div>
                <div className="truncate text-sm text-muted-foreground">{fullAddr(s)}</div>
              </div>
            </label>
          );
        })}
        {waiting.map((s) => (
          <div key={s.store_id} className="flex items-center gap-3 rounded-2xl border border-dashed bg-card p-4 opacity-80">
            <Store className="h-6 w-6 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{s.store_name}</div>
              <div className="truncate text-sm text-muted-foreground">{fullAddr(s)}</div>
            </div>
            <Badge variant={s.approval === 'rejected' ? 'destructive' : 'secondary'}>{s.approval === 'rejected' ? 'Not approved' : 'Pending approval'}</Badge>
          </div>
        ))}
        {orderable.length > 1 && (
          <Button variant="ghost" className="w-full" onClick={() => setChecked(checked.length === orderable.length ? [] : orderable.map((s) => s.store_id))}>
            {checked.length === orderable.length ? 'Uncheck all' : 'Check all stores'}
          </Button>
        )}
        <Button variant="outline" className="h-12 w-full" onClick={() => setShowAdd((v) => !v)}><Plus className="mr-2 h-5 w-5" />Add another store I own</Button>
        {showAdd && <AddOwnerStore onDone={() => setShowAdd(false)} />}
      </div>

      {selected.length > 0 && (
        <>
          {selected.length > 1 && (
            <label className="flex items-center justify-between rounded-2xl border bg-card p-4">
              <span className="font-semibold">Same order for all checked stores</span>
              <Switch checked={same} onCheckedChange={setSame} />
            </label>
          )}
          {same || selected.length === 1 ? (
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 font-semibold">{selected.length > 1 ? `Order for each of ${selected.length} stores` : selected[0].store_name}</div>
              <OrderEditor catalog={catalog} order={shared} onChange={(o) => { setShared(o); }} />
            </div>
          ) : selected.map((s) => (
            <div key={s.store_id} className="rounded-2xl border bg-card p-4">
              <div className="font-semibold">{s.store_name}</div>
              <div className="mb-3 text-sm text-muted-foreground">{fullAddr(s)}</div>
              <OrderEditor catalog={catalog} order={perStore[s.store_id] ?? emptyOrder()} onChange={(o) => setPerStore((p) => ({ ...p, [s.store_id]: o }))} />
            </div>
          ))}
          <div className="flex justify-between text-lg font-semibold"><span>Estimated total</span><span>{money(grand)}</span></div>
          <Button className="h-14 w-full text-lg" disabled={!allHaveItems} onClick={() => setStep('review')}>
            {allHaveItems ? 'Review orders' : 'Pick items for every checked store'}
          </Button>
        </>
      )}
    </div>
  );
}

function AddOwnerStore({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { data: stores = [] } = useOwnerStores();
  const anchor = stores.find((s) => s.orderable);
  const [f, setF] = useState({ address: '', city: '', state: 'NY', zip: '', name: '', phone: '' });
  const add = useMutation({
    mutationFn: async () => {
      if (!anchor) throw new Error('No linked store');
      const { data, error } = await sb.rpc('store_portal_add_owner_store', {
        p_anchor_store_id: anchor.store_id, p_address: f.address, p_city: f.city, p_state: f.state, p_zip: f.zip,
        p_store_name: f.name || null, p_phone: f.phone || null,
      });
      if (error) throw error;
      return data as { result: string; store_name?: string };
    },
    onSuccess: (d) => {
      const msg: Record<string, string> = {
        already_linked: `${d.store_name ?? 'That store'} is already on your list.`,
        already_pending: 'That store is already waiting for approval.',
        linked_existing: 'We found that store. Ching will approve it, then you can order for it.',
        created: 'Store added. Ching will approve it, then you can order for it.',
        created_from_prospect: 'Store added. Ching will approve it, then you can order for it.',
      };
      toast.success(msg[d.result] ?? 'Sent for approval');
      qc.invalidateQueries({ queryKey: ['store-portal-owner-stores'] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message || String(e)),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4">
      <Input className="h-12" placeholder="Street address *" value={f.address} onChange={set('address')} />
      <div className="grid grid-cols-3 gap-2">
        <Input className="col-span-2 h-12" placeholder="City" value={f.city} onChange={set('city')} />
        <Input className="h-12" placeholder="State" maxLength={2} value={f.state} onChange={set('state')} />
      </div>
      <Input className="h-12" placeholder="ZIP code *" inputMode="numeric" maxLength={10} value={f.zip} onChange={set('zip')} />
      <Input className="h-12" placeholder="Store name (optional)" value={f.name} onChange={set('name')} />
      <Input className="h-12" placeholder="Store phone (optional)" inputMode="tel" value={f.phone} onChange={set('phone')} />
      <Button className="h-12 w-full" disabled={add.isPending || f.address.trim().length < 5} onClick={() => add.mutate()}>
        {add.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}Send for approval
      </Button>
    </div>
  );
}
