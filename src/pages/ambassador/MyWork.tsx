import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Phone } from 'lucide-react';
import { WorkTimelineItem } from '@/components/ambassador/WorkTimelineItem';
import { money, nyDate, rangeDates, rpc, todayLine, type RangeKey, type WorkItem, type WorkSummary } from '@/lib/myWork';

const PAGE = 50;
const TYPES = [{ v: 'all', l: 'Everything' }, { v: 'visit', l: 'Visits & counts' }, { v: 'order', l: 'Orders' }, { v: 'money', l: 'Money' }, { v: 'note', l: 'Notes' }, { v: 'new_store', l: 'New stores' }, { v: 'contact', l: 'Contacts' }, { v: 'voice', l: 'Voice updates' }];

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-muted/50 p-2 text-center"><div className="text-xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}

export default function MyWork() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['my-work', 'me'], queryFn: async () => { const { data, error } = await rpc('ambassador_work_me'); if (error) throw error; return data as { is_owner: boolean; my_ambassador_id: string | null; ambassadors: { id: string; name: string }[] }; } });
  const [picked, setPicked] = useState<string>('');
  const ambId = picked || me.data?.my_ambassador_id || '';
  const [range, setRange] = useState<RangeKey>('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [hood, setHood] = useState('');
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const { from, to } = rangeDates(range, custom);

  const summary = useQuery({
    enabled: !!ambId, queryKey: ['my-work', 'summary', ambId, period],
    queryFn: async () => {
      const { data, error } = await rpc('ambassador_work_summary', { p_ambassador_id: ambId, p_from: nyDate(period === 'week' ? -6 : -29), p_to: nyDate(0) });
      if (error) throw error; return data as WorkSummary;
    },
  });

  const feed = useInfiniteQuery({
    enabled: !!ambId, queryKey: ['my-work', 'feed', ambId, from, to, type, search, hood],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await rpc('ambassador_work_feed', { p_ambassador_id: ambId, p_from: from, p_to: to, p_type: type === 'all' ? null : type, p_search: search || null, p_neighborhood: hood || null, p_before: pageParam, p_limit: PAGE });
      if (error) throw error; return (data?.items || []) as WorkItem[];
    },
    getNextPageParam: (last) => (last.length < PAGE ? undefined : last[last.length - 1].at),
  });
  const items = useMemo(() => {
    const seen = new Set<string>(); const out: WorkItem[] = [];
    for (const p of feed.data?.pages || []) for (const i of p) if (!seen.has(i.item_id + i.at)) { seen.add(i.item_id + i.at); out.push(i); }
    return out;
  }, [feed.data]);
  const days = useMemo(() => { const m = new Map<string, WorkItem[]>(); for (const i of items) m.set(i.day, [...(m.get(i.day) || []), i]); return [...m.entries()]; }, [items]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const ob = new IntersectionObserver(e => { if (e[0].isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }, { rootMargin: '400px' });
    ob.observe(el); return () => ob.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed]);

  const openStore = (id: string) => navigate(me.data?.is_owner && !me.data?.my_ambassador_id ? `/stores/${id}` : `/ambassador/stores/${id}`);
  const t = summary.data?.today_counts; const c = summary.data?.counts;
  const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  if (me.isLoading) return <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (me.error) return <div className="p-4 text-destructive">{(me.error as Error).message}</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-3 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">My Work</h1>
        <Button variant="outline" className="h-11" onClick={() => navigate('/ambassador/order-requests')}>Today's orders</Button>
      </div>

      {me.data?.is_owner && (
        <Select value={ambId} onValueChange={setPicked}>
          <SelectTrigger className="h-12"><SelectValue placeholder="Pick an ambassador to review" /></SelectTrigger>
          <SelectContent>{me.data.ambassadors.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {!ambId && <p className="text-muted-foreground">{me.data?.is_owner ? 'Pick an ambassador above.' : 'Your login is not linked to an ambassador yet. Ask Ching to send your invite.'}</p>}

      {ambId && <>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Today</CardTitle><p className="font-medium">{summary.isLoading ? 'Loading…' : todayLine(t)}</p></CardHeader>
          <CardContent className="grid grid-cols-4 gap-2">
            <Stat label="Stores" value={t?.stores_visited ?? '–'} /><Stat label="New stores" value={t?.new_stores ?? '–'} />
            <Stat label="Counts" value={t?.counts ?? '–'} /><Stat label="Orders" value={t?.orders ?? '–'} />
            <Stat label="Collected" value={t ? money(t.money) : '–'} /><Stat label="Contacts" value={t?.contacts ?? '–'} />
            <Stat label="Notes" value={t?.notes ?? '–'} /><Stat label="Follow-ups" value={summary.data?.follow_ups.length ?? '–'} />
          </CardContent>
        </Card>

        {!!summary.data?.follow_ups.length && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg">Upcoming follow-ups</CardTitle><p className="text-xs text-muted-foreground">Notes that mention a time to come back, with no visit since.</p></CardHeader>
            <CardContent className="space-y-2">
              {summary.data.follow_ups.slice(0, 15).map(f => (
                <div key={f.id} className="rounded-lg border p-3 space-y-1">
                  <button type="button" className="text-left w-full" onClick={() => openStore(f.store_id)}><div className="font-semibold text-primary">{f.store_name}</div><div className="text-xs text-muted-foreground">{f.store_address}</div></button>
                  <p className="text-sm">{f.note}</p>
                  <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Noted {new Date(f.at).toLocaleDateString()}</span>
                    {f.phone && <Button asChild size="sm" className="h-11"><a href={`tel:${f.phone}`}><Phone className="h-4 w-4" />Call</a></Button>}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{period === 'week' ? 'Last 7 days' : 'Last 30 days'}</CardTitle>
            <div className="flex gap-1"><Button size="sm" variant={period === 'week' ? 'default' : 'outline'} onClick={() => setPeriod('week')}>Week</Button><Button size="sm" variant={period === 'month' ? 'default' : 'outline'} onClick={() => setPeriod('month')}>Month</Button></div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Stores" value={c?.stores_visited ?? '–'} /><Stat label="New" value={c?.new_stores ?? '–'} /><Stat label="Orders" value={c?.orders ?? '–'} /><Stat label="Collected" value={c ? money(c.money) : '–'} />
            </div>
            <div>
              <div className="text-sm font-medium">Boxes ordered by brand</div>
              {summary.data && Object.keys(summary.data.boxes).length ? (
                <ul className="text-sm">{Object.entries(summary.data.boxes).map(([n, b]) => <li key={n}>{n}: {b} box{Number(b) === 1 ? '' : 'es'}</li>)}</ul>
              ) : <p className="text-sm text-muted-foreground">No order requests in this period.</p>}
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-sm">Your earnings estimate</div>
              <div className="text-2xl font-bold">{money(summary.data?.earnings_estimate || 0)}</div>
              <p className="text-xs text-muted-foreground">Half of (store price − ambassador price) on delivered order requests. Estimate only, not a payout.</p>
            </div>
            <div>
              <div className="text-sm font-medium">Go back to these ({summary.data?.go_back.length ?? 0}{summary.data?.go_back.length === 60 ? '+' : ''})</div>
              <p className="text-xs text-muted-foreground">Your stores not visited in 14+ days.</p>
              <div className="mt-2 max-h-80 overflow-y-auto space-y-1">
                {summary.data?.go_back.map(g => (
                  <div key={g.store_id} className="flex items-center justify-between gap-2 rounded border p-2">
                    <button type="button" className="text-left min-w-0" onClick={() => openStore(g.store_id)}><div className="font-medium truncate">{g.store_name}</div><div className="text-xs text-muted-foreground truncate">{g.store_address} · {g.last_visit_at ? `last seen ${new Date(g.last_visit_at).toLocaleDateString()}` : 'never visited'}</div></button>
                    {g.phone && <Button asChild size="icon" variant="outline" className="h-11 w-11 shrink-0"><a href={`tel:${g.phone}`} aria-label="Call store"><Phone className="h-4 w-4" /></a></Button>}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Everything I did</h2>
          <div className="grid grid-cols-2 gap-2">
            <Select value={range} onValueChange={v => setRange(v as RangeKey)}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All time</SelectItem><SelectItem value="today">Today</SelectItem><SelectItem value="week">This week</SelectItem><SelectItem value="month">This month</SelectItem><SelectItem value="custom">Pick dates</SelectItem></SelectContent></Select>
            <Select value={type} onValueChange={setType}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(x => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent></Select>
          </div>
          {range === 'custom' && <div className="grid grid-cols-2 gap-2"><Input type="date" className="h-11" value={custom.from} onChange={e => setCustom(s => ({ ...s, from: e.target.value }))} /><Input type="date" className="h-11" value={custom.to} onChange={e => setCustom(s => ({ ...s, to: e.target.value }))} /></div>}
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-11" placeholder="Search store" value={search} onChange={e => setSearch(e.target.value)} />
            <Input className="h-11" placeholder="Neighborhood" value={hood} onChange={e => setHood(e.target.value)} />
          </div>
        </div>

        {feed.error && <p className="text-destructive">{(feed.error as Error).message}</p>}
        {feed.isLoading && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        {!feed.isLoading && !items.length && <p className="text-muted-foreground">Nothing found for these filters.</p>}
        {days.map(([d, list]) => (
          <section key={d} className="space-y-2">
            <h3 className="sticky top-0 z-10 bg-background py-1 text-sm font-semibold text-muted-foreground">{dayLabel(d)} · {list.length}</h3>
            {list.map(i => <WorkTimelineItem key={i.item_id + i.at} item={i} onOpenStore={openStore} />)}
          </section>
        ))}
        <div ref={sentinel} />
        {feed.isFetchingNextPage && <div className="flex justify-center p-2"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!feed.hasNextPage && items.length > 0 && <p className="text-center text-xs text-muted-foreground">That's everything — back to day one.</p>}
      </>}
    </div>
  );
}
