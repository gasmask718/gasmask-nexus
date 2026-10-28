import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Home, Package, Truck, ClipboardList, Loader2, Phone, ArrowLeft, Minus, Plus, LogOut,
} from 'lucide-react';
import {
  STORE_PORTAL_BRANDS, QUICK_COUNTS, LOW_STOCK_THRESHOLD, UNITS_PER_BOX, money, readFunctionError,
} from '@/lib/storePortal';

const sb = supabase as any;

type PortalStore = { store_id: string; store_name: string; address: string | null; city: string | null; state: string | null; zip: string | null };

const StoreCtx = createContext<{ storeId: string; store: PortalStore } | null>(null);
const useStore = () => {
  const v = useContext(StoreCtx);
  if (!v) throw new Error('store context missing');
  return v;
};

function Shell({ children, title, back }: { children: React.ReactNode; title?: string; back?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-28">
      {title && (
        <div className="flex items-center gap-2">
          {back && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/portal/mystore')} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
      )}
      {children}
    </div>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { to: '/portal/mystore', label: 'Home', icon: Home },
    { to: '/portal/mystore/inventory', label: 'Inventory', icon: Package },
    { to: '/portal/mystore/delivery', label: 'Delivery', icon: Truck },
    { to: '/portal/mystore/requests', label: 'Requests', icon: ClipboardList },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} className={`flex flex-col items-center gap-1 py-3 text-xs ${active ? 'text-primary' : 'text-muted-foreground'}`}>
              <Icon className="h-6 w-6" />{label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Home ────────────────────────────────────────────────────────────────────
function HomeScreen() {
  const { storeId } = useStore();
  const { data, isLoading, error } = useQuery({
    queryKey: ['store-portal-home', storeId],
    queryFn: async () => {
      const { data, error } = await sb.rpc('store_portal_home', { p_store_id: storeId });
      if (error) throw error;
      return data as any;
    },
  });
  if (isLoading) return <Shell><Loader2 className="mx-auto h-6 w-6 animate-spin" /></Shell>;
  if (error) return <Shell><p className="text-destructive">{(error as any).message}</p></Shell>;
  const s = data.store;
  return (
    <Shell>
      <div className="rounded-2xl border bg-card p-5">
        <h1 className="text-2xl font-bold">{s.store_name}</h1>
        <p className="text-muted-foreground">{[s.address, s.city, s.state, s.zip].filter(Boolean).join(', ')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Balance owed</div>
          <div className="text-2xl font-bold">{money(data.balance_owed)}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Last order</div>
          <div className="text-2xl font-bold">{data.last_order_date ? format(new Date(data.last_order_date + 'T12:00:00'), 'MMM d') : '—'}</div>
        </div>
      </div>
      {data.ambassador_name && (
        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Your GasMask rep</div>
            <div className="text-lg font-semibold">{data.ambassador_name}</div>
          </div>
          {data.ambassador_phone && (
            <Button asChild size="lg" variant="secondary"><a href={`tel:${data.ambassador_phone}`}><Phone className="mr-2 h-5 w-5" />Call</a></Button>
          )}
        </div>
      )}
      <div className="grid gap-3">
        <Button asChild className="h-16 text-lg"><Link to="/portal/mystore/inventory"><Package className="mr-2 h-6 w-6" />Update inventory</Link></Button>
        <Button asChild className="h-16 text-lg" variant="secondary"><Link to="/portal/mystore/delivery"><Truck className="mr-2 h-6 w-6" />Request a delivery</Link></Button>
        <Button asChild className="h-14" variant="outline">
          <Link to="/portal/mystore/requests"><ClipboardList className="mr-2 h-5 w-5" />My requests {data.open_requests > 0 && <Badge className="ml-2">{data.open_requests} open</Badge>}</Link>
        </Button>
      </div>
    </Shell>
  );
}

// ─── Inventory ───────────────────────────────────────────────────────────────
function InventoryScreen() {
  const { storeId } = useStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number | ''>>({});
  const [lowPrompt, setLowPrompt] = useState(false);
  const { data: current = [], isLoading } = useQuery({
    queryKey: ['store-portal-inventory', storeId],
    queryFn: async () => {
      const { data, error } = await sb.rpc('store_portal_inventory', { p_store_id: storeId });
      if (error) throw error;
      return data as any[];
    },
  });
  const byBrand = useMemo(() => Object.fromEntries(current.map((r) => [r.brand_id, r])), [current]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(counts)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([brand_id, count]) => ({ brand_id, count: Number(count) }));
      if (payload.length === 0) throw new Error('Enter at least one count');
      const { data, error } = await sb.rpc('store_portal_save_inventory', { p_store_id: storeId, p_counts: payload });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      toast.success('Inventory saved. Thank you!');
      setCounts({});
      qc.invalidateQueries({ queryKey: ['store-portal-inventory', storeId] });
      if (res?.any_low) setLowPrompt(true);
    },
    onError: (e: any) => toast.error(e.message || String(e)),
  });

  const setVal = (b: string, v: number | '') => setCounts((c) => ({ ...c, [b]: v === '' ? '' : Math.max(0, v) }));

  return (
    <Shell title="Update inventory" back>
      <p className="text-sm text-muted-foreground">How many are left on your shelf? Only fill in what you carry.</p>
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      {STORE_PORTAL_BRANDS.map((b) => {
        const cur = byBrand[b.brand_id];
        const v = counts[b.brand_id];
        const num = v === '' || v === undefined ? null : Number(v);
        return (
          <div key={b.brand_id} className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-semibold">{b.label}</div>
              <div className="text-xs text-muted-foreground">
                {cur ? `Last: ${cur.current_tubes_left ?? '—'} ${b.unit}${cur.tubes_updated_at ? ` · ${format(new Date(cur.tubes_updated_at), 'MMM d')}` : ''}` : 'No count yet'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setVal(b.brand_id, Math.max(0, (num ?? 0) - 1))} aria-label="Less"><Minus /></Button>
              <Input
                type="number" inputMode="numeric" min={0} placeholder={`${b.unit} left`}
                className="h-12 text-center text-xl"
                value={v ?? ''} onChange={(e) => setVal(b.brand_id, e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
              />
              <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setVal(b.brand_id, (num ?? 0) + 1)} aria-label="More"><Plus /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_COUNTS.map((q) => (
                <Button key={q.label} variant={num === q.value ? 'default' : 'secondary'} className="h-11" onClick={() => setVal(b.brand_id, q.value)}>
                  {q.label}
                </Button>
              ))}
            </div>
            {num !== null && num <= LOW_STOCK_THRESHOLD && <p className="text-sm text-destructive">Running low</p>}
          </div>
        );
      })}
      <Button className="h-14 w-full text-lg" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />} Save inventory
      </Button>
      <AlertDialog open={lowPrompt} onOpenChange={setLowPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Running low</AlertDialogTitle>
            <AlertDialogDescription>Running low - want us to bring a delivery?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/portal/mystore/delivery')}>Request delivery</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}

// ─── Delivery request ────────────────────────────────────────────────────────
type Pick = { product_id: string; name: string; unit: 'box' | 'half_box'; quantity: number; unit_price: number };

function DeliveryScreen() {
  const { storeId } = useStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [type, setType] = useState<'asap' | 'scheduled'>('asap');
  const [date, setDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [windowSel, setWindowSel] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [notes, setNotes] = useState('');
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['store-portal-catalog'],
    queryFn: async () => {
      const { data, error } = await sb.rpc('store_portal_catalog');
      if (error) throw error;
      return data as { product_id: string; name: string; brand: string; unit_price: number }[];
    },
  });

  const dates = useMemo(() => Array.from({ length: 30 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd')), []);

  const bump = (p: { product_id: string; name: string; unit_price: number }, unit: 'box' | 'half_box', d: number) => {
    const key = `${p.product_id}:${unit}`;
    setPicks((cur) => {
      const q = Math.max(0, (cur[key]?.quantity ?? 0) + d);
      const next = { ...cur };
      if (q === 0) delete next[key];
      else next[key] = {
        product_id: p.product_id, name: p.name, unit, quantity: q,
        unit_price: Number(p.unit_price) * (unit === 'box' ? UNITS_PER_BOX : UNITS_PER_BOX / 2),
      };
      return next;
    });
  };

  const items = Object.values(picks);
  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const submit = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error('Pick at least one product');
      const { data: id, error } = await sb.rpc('store_portal_request_delivery', {
        p_store_id: storeId, p_request_type: type,
        p_requested_date: type === 'scheduled' ? date : null,
        p_time_window: type === 'scheduled' ? windowSel : null,
        p_items: items.map((i) => ({ ...i, unit: i.unit === 'half_box' ? 'half box' : 'box' })),
        p_notes: notes || null,
      });
      if (error) throw error;
      const { error: nErr } = await supabase.functions.invoke('store-portal-notify', { body: { request_id: id, event: 'created' } });
      if (nErr) console.error('notify failed', await readFunctionError(nErr));
      return id;
    },
    onSuccess: () => {
      toast.success('Request sent! We will confirm by text.');
      qc.invalidateQueries({ queryKey: ['store-portal-requests', storeId] });
      qc.invalidateQueries({ queryKey: ['store-portal-home', storeId] });
      navigate('/portal/mystore/requests');
    },
    onError: (e: any) => toast.error(e.message || String(e)),
  });

  return (
    <Shell title="Request a delivery" back>
      <div className="grid grid-cols-2 gap-2">
        <Button className="h-16 text-base" variant={type === 'asap' ? 'default' : 'secondary'} onClick={() => setType('asap')}>As soon as possible</Button>
        <Button className="h-16 text-base" variant={type === 'scheduled' ? 'default' : 'secondary'} onClick={() => setType('scheduled')}>Schedule for a date</Button>
      </div>
      {type === 'scheduled' && (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <Select value={date} onValueChange={setDate}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>
              {dates.map((d) => <SelectItem key={d} value={d}>{format(new Date(d + 'T12:00:00'), 'EEEE, MMM d')}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-3 gap-2">
            {(['morning', 'afternoon', 'evening'] as const).map((w) => (
              <Button key={w} className="h-12 capitalize" variant={windowSel === w ? 'default' : 'secondary'} onClick={() => setWindowSel(w)}>{w}</Button>
            ))}
          </div>
        </div>
      )}
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      {catalog.map((p) => {
        const isBag = /bag/i.test(p.name);
        const units: ('box' | 'half_box')[] = isBag ? ['box'] : ['box', 'half_box'];
        return (
          <div key={p.product_id} className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="font-semibold">{p.name}</div>
            {units.map((u) => {
              const q = picks[`${p.product_id}:${u}`]?.quantity ?? 0;
              const price = Number(p.unit_price) * (u === 'box' ? UNITS_PER_BOX : UNITS_PER_BOX / 2);
              return (
                <div key={u} className="flex items-center justify-between">
                  <div className="text-sm">{u === 'box' ? 'Box' : 'Half box'} · {money(price)}</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => bump(p, u, -1)} aria-label="Less"><Minus /></Button>
                    <span className="w-6 text-center text-lg font-semibold">{q}</span>
                    <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => bump(p, u, 1)} aria-label="More"><Plus /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <Textarea placeholder="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      <div className="flex items-center justify-between text-lg font-semibold">
        <span>Estimated total</span><span>{money(total)}</span>
      </div>
      <Button className="h-14 w-full text-lg" onClick={() => submit.mutate()} disabled={submit.isPending || items.length === 0}>
        {submit.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />} Send request
      </Button>
    </Shell>
  );
}

// ─── Requests ────────────────────────────────────────────────────────────────
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  new: 'default', confirmed: 'default', scheduled: 'secondary', delivered: 'outline', cancelled: 'destructive',
};

function RequestsScreen() {
  const { storeId } = useStore();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['store-portal-requests', storeId],
    queryFn: async () => {
      const { data, error } = await sb.rpc('store_portal_requests', { p_store_id: storeId });
      if (error) throw error;
      return data as any[];
    },
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.rpc('store_portal_cancel_request', { p_request_id: id });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Could not cancel');
    },
    onSuccess: () => {
      toast.success('Request cancelled');
      qc.invalidateQueries({ queryKey: ['store-portal-requests', storeId] });
      qc.invalidateQueries({ queryKey: ['store-portal-home', storeId] });
    },
    onError: (e: any) => toast.error(e.message || String(e)),
  });
  const open = data.filter((r) => ['new', 'confirmed', 'scheduled'].includes(r.status));
  const past = data.filter((r) => !['new', 'confirmed', 'scheduled'].includes(r.status));
  const Row = (r: any) => (
    <div key={r.id} className="space-y-2 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">
          {r.request_type === 'asap' ? 'ASAP' : `${format(new Date(r.requested_date + 'T12:00:00'), 'EEE, MMM d')}${r.time_window ? ` · ${r.time_window}` : ''}`}
        </div>
        <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'} className="capitalize">{r.status}</Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        {(r.items || []).map((i: any) => `${i.quantity} × ${i.name}${i.unit ? ` (${i.unit})` : ''}`).join(', ')}
      </div>
      {r.notes && <div className="text-sm">“{r.notes}”</div>}
      <div className="text-xs text-muted-foreground">Requested {format(new Date(r.created_at), 'MMM d, h:mma')}</div>
      {['new', 'confirmed'].includes(r.status) && (
        <Button variant="outline" className="w-full" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>Cancel request</Button>
      )}
    </div>
  );
  return (
    <Shell title="My requests" back>
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      <h2 className="font-semibold">Open</h2>
      {open.length === 0 ? <p className="text-sm text-muted-foreground">No open requests.</p> : open.map(Row)}
      <h2 className="pt-2 font-semibold">Past</h2>
      {past.length === 0 ? <p className="text-sm text-muted-foreground">No past requests.</p> : past.map(Row)}
    </Shell>
  );
}

// ─── App root ────────────────────────────────────────────────────────────────
const LS_KEY = 'gm-store-portal-store';

export default function StorePortalApp() {
  const navigate = useNavigate();
  const { data: stores, isLoading, error } = useQuery({
    queryKey: ['store-portal-stores'],
    queryFn: async () => {
      const { data, error } = await sb.rpc('store_portal_stores');
      if (error) throw error;
      return data as PortalStore[];
    },
  });
  const [storeId, setStoreId] = useState<string | null>(() => localStorage.getItem(LS_KEY));
  useEffect(() => {
    if (!stores?.length) return;
    if (!storeId || !stores.some((s) => s.store_id === storeId)) setStoreId(stores[0].store_id);
  }, [stores, storeId]);
  useEffect(() => { if (storeId) localStorage.setItem(LS_KEY, storeId); }, [storeId]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (error || !stores?.length) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-semibold">No store linked to this sign-in</h1>
          <p className="text-sm text-muted-foreground">Ask your GasMask rep to text you a new portal link.</p>
          {error && <p className="text-sm text-destructive">{(error as any).message}</p>}
        </div>
      </div>
    );
  }
  const store = stores.find((s) => s.store_id === storeId) ?? stores[0];

  return (
    <StoreCtx.Provider value={{ storeId: store.store_id, store }}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b bg-card">
          <div className="mx-auto flex max-w-lg items-center gap-2 p-3">
            {stores.length > 1 ? (
              <Select value={store.store_id} onValueChange={setStoreId}>
                <SelectTrigger className="h-11 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => <SelectItem key={s.store_id} value={s.store_id}>{s.store_name} — {s.address}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex-1 truncate font-semibold">GasMask · {store.store_name}</div>
            )}
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <Routes>
          <Route index element={<HomeScreen />} />
          <Route path="inventory" element={<InventoryScreen />} />
          <Route path="delivery" element={<DeliveryScreen />} />
          <Route path="requests" element={<RequestsScreen />} />
          <Route path="*" element={<Navigate to="/portal/mystore" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </StoreCtx.Provider>
  );
}
