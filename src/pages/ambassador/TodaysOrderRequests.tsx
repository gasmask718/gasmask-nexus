import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy, Printer, Route as RouteIcon, Loader2, Phone, Truck } from 'lucide-react';
import { boxLabel, brandTotals, itemsText, type OrderItem } from '@/lib/orders/fieldOrders';
import { nearestNext } from '@/lib/routes/nearMe';

type Req = { id: string; store_id: string; store_name: string; address: string; lat: number | null; lng: number | null; items: OrderItem[]; notes: string | null; status: string;
  deliver_by: string | null; requested_date: string | null; created_at: string; requested_by: string; requested_by_name: string | null; contact: { name: string; phone: string } | null; store_phone: string | null; route_id: string | null };

const STATUS_LABEL: Record<string, string> = { new: 'requested', confirmed: 'requested', scheduled: 'scheduled', delivered: 'delivered', cancelled: 'cancelled' };

export default function TodaysOrderRequests() {
  const qc = useQueryClient(); const navigate = useNavigate();
  const [date, setDate] = useState<string>('');
  const [who, setWho] = useState('all');
  const q = useQuery({
    queryKey: ['field-order-requests', 'day', date, who],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('field_order_requests_list', { p_from: date || null, p_to: date || null, p_requested_by: who === 'all' ? null : who });
      if (error) throw error; return data as { is_owner: boolean; today: string; requests: Req[]; requesters: { id: string; name: string }[] };
    },
  });
  const reqs = q.data?.requests || [];
  const live = reqs.filter(r => r.status !== 'cancelled');
  const totals = useMemo(() => brandTotals(live), [live]);
  const groups = useMemo(() => { const m = new Map<string, Req[]>(); for (const r of live) m.set(r.store_id, [...(m.get(r.store_id) || []), r]); return [...m.values()]; }, [live]);
  const day = date || q.data?.today || '';

  const shareText = () => [`Order requests ${day}`, 'LOAD SHEET: ' + (Object.entries(totals).map(([n, b]) => `${n}: ${boxLabel(b)}`).join(' | ') || 'none'), '',
    ...groups.map(g => `${g[0].store_name} — ${g[0].address}\n${g.map(r => `  ${itemsText(r.items)}${r.notes ? ` (${r.notes})` : ''} [${STATUS_LABEL[r.status]}]`).join('\n')}${g[0].contact?.phone || g[0].store_phone ? `\n  Contact: ${g[0].contact?.name || ''} ${g[0].contact?.phone || g[0].store_phone}` : ''}`)].join('\n');

  const share = async () => { const text = shareText(); try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast.success('List copied'); } } catch { await navigator.clipboard.writeText(text).catch(() => {}); toast.success('List copied'); } };

  const build = useMutation({
    mutationFn: async () => {
      const open = live.filter(r => r.status === 'new' || r.status === 'confirmed');
      const people = new Set(open.map(r => r.requested_by));
      if (!open.length) throw new Error('No open requests to put on a route');
      if (people.size > 1) throw new Error('Pick one ambassador in the filter first');
      const byStore = new Map<string, Req>(); open.forEach(r => { if (!byStore.has(r.store_id)) byStore.set(r.store_id, r); });
      const stops = [...byStore.values()].map((r, i) => ({ id: r.store_id, status: 'pending', planned_order: i, store_lat: r.lat, store_lng: r.lng }));
      const located = stops.filter(s => s.store_lat != null && s.store_lng != null);
      const ordered = located.length ? nearestNext(located, { lat: located[0].store_lat!, lng: located[0].store_lng! }, located.length) : [];
      const storeOrder = [...ordered.map(s => s.id), ...stops.filter(s => !ordered.some(o => o.id === s.id)).map(s => s.id)];
      const ids = storeOrder.flatMap(sid => open.filter(r => r.store_id === sid).map(r => r.id));
      const { data, error } = await (supabase.rpc as any)('field_order_build_route', { p_request_ids: ids });
      if (error) throw error; return data;
    },
    onSuccess: (d: any) => { toast.success(`Draft route for tomorrow created with ${d.stops} stops`); qc.invalidateQueries({ queryKey: ['field-order-requests'] }); qc.invalidateQueries({ queryKey: ['ambassador-routes'] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const deliver = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase.rpc as any)('field_order_mark_delivered', { p_request_id: id }); if (error) throw error; },
    onSuccess: () => { toast.success('Marked delivered'); qc.invalidateQueries({ queryKey: ['field-order-requests'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl p-3 space-y-4 print:p-0">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Today's order requests</h1>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Input type="date" value={day} onChange={e => setDate(e.target.value)} className="w-40" aria-label="Day" />
          {q.data?.is_owner && <Select value={who} onValueChange={setWho}><SelectTrigger className="w-44" aria-label="Ambassador"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All ambassadors</SelectItem>{q.data.requesters.map(r => <SelectItem key={r.id} value={r.id}>{r.name || 'Unnamed'}</SelectItem>)}</SelectContent></Select>}
        </div>
      </header>
      {q.error && <p className="text-destructive">{(q.error as Error).message}</p>}
      {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}

      <section className="rounded-lg border bg-card p-3" data-testid="load-sheet">
        <h2 className="font-semibold mb-2">Load sheet — boxes to bring</h2>
        {Object.keys(totals).length ? <div className="grid grid-cols-2 gap-2">{Object.entries(totals).map(([n, b]) => (
          <div key={n} className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">{n}</p><p className="text-xl font-bold">{b}</p><p className="text-xs">{boxLabel(b)}</p></div>))}</div>
          : <p className="text-sm text-muted-foreground">No order requests for this day.</p>}
        <p className="text-xs text-muted-foreground mt-2">{groups.length} stores · {live.length} requests</p>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 print:hidden">
        <Button variant="outline" className="h-12" onClick={() => void share()}><Copy className="h-4 w-4" />Copy / share</Button>
        <Button variant="outline" className="h-12" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
        <Button className="h-12 col-span-2 sm:col-span-1" disabled={build.isPending} onClick={() => build.mutate()}>{build.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RouteIcon className="h-4 w-4" />}Build tomorrow's route</Button>
      </div>

      {groups.map(g => (
        <article key={g[0].store_id} className="rounded-lg border bg-card p-3 space-y-2 break-inside-avoid" data-testid="order-store-group">
          <button className="text-left" onClick={() => navigate(`/stores/${g[0].store_id}`)}><h3 className="font-semibold break-words">{g[0].store_name}</h3></button>
          <p className="text-sm text-muted-foreground break-words">{g[0].address || 'No address'}</p>
          {(g[0].contact?.phone || g[0].store_phone) && <a className="text-sm inline-flex items-center gap-1 text-primary" href={`tel:${g[0].contact?.phone || g[0].store_phone}`}><Phone className="h-3 w-3" />{g[0].contact?.name ? `${g[0].contact.name} · ` : ''}{g[0].contact?.phone || g[0].store_phone}</a>}
          {g.map(r => (
            <div key={r.id} className="rounded-md bg-muted/50 p-2 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2"><Badge variant={r.status === 'delivered' ? 'default' : 'outline'}>{STATUS_LABEL[r.status] || r.status}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{r.requested_by_name ? ` · ${r.requested_by_name}` : ''}
                  {r.deliver_by === 'tomorrow' ? ' · deliver tomorrow' : r.deliver_by === 'date' && r.requested_date ? ` · by ${r.requested_date}` : ' · next visit'}</span></div>
              <p className="font-medium break-words">{itemsText(r.items)}</p>
              {r.notes && <p className="break-words">Note: {r.notes}</p>}
              {['new', 'confirmed', 'scheduled'].includes(r.status) && <Button size="sm" variant="outline" className="print:hidden" disabled={deliver.isPending} onClick={() => deliver.mutate(r.id)}><Truck className="h-3 w-3" />Mark delivered</Button>}
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
