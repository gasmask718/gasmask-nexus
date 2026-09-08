import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const PAGE = 50;

const ACTION_LABELS: Record<string, string> = {
  reviewed: 'Reviewed',
  unreviewed: 'Marked unreviewed',
  note_added: 'Note added',
  address_corrected: 'Address corrected',
  name_changed: 'Store name changed',
  phone_updated: 'Phone updated',
  status_changed: 'Status changed',
  store_removed: 'Store removed',
  record_updated: 'Record updated',
  invoice_created: 'Invoice created',
  payment_recorded: 'Payment recorded',
  invoice_removed: 'Invoice removed',
  route_assigned: 'Added to route',
};

const ACTION_STYLES: Record<string, string> = {
  reviewed: 'bg-primary/15 text-primary border-primary/30',
  unreviewed: 'bg-muted text-muted-foreground border-border',
  note_added: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  address_corrected: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  name_changed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  phone_updated: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  status_changed: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  store_removed: 'bg-destructive/15 text-destructive border-destructive/30',
  record_updated: 'bg-muted text-muted-foreground border-border',
  invoice_created: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  payment_recorded: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  invoice_removed: 'bg-destructive/15 text-destructive border-destructive/30',
  route_assigned: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

function ActionBadge({ action }: { action: string }) {
  return (
    <Badge variant="outline" className={ACTION_STYLES[action] ?? 'bg-muted text-muted-foreground border-border'}>
      {ACTION_LABELS[action] ?? action}
    </Badge>
  );
}


export interface AuditFeedRow {
  row_id: string;
  row_kind: string;
  store_id: string | null;
  store_name: string | null;
  occurred_at: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string;
  action: string | null;
  note_text: string | null;
  detail_text: string | null;

  route_id: string | null;
  route_name: string | null;
  route_date: string | null;
  route_type: string | null;
  stop_status: string | null;
  total_count: number;
}

interface RowDetail {
  invoices: {
    open_balance: number;
    paid_count: number;
    unpaid_count: number;
    total_count: number;
    total_billed: number;
  } | null;
  route: {
    route_id: string;
    name: string | null;
    date: string | null;
    type: string | null;
    status: string | null;
    stop_status: string | null;
    planned_order: number | null;
  } | null;
  comms: {
    total: number;
    calls: number;
    texts: number;
    inbound: number;
    last_at: string | null;
    recent: { created_at: string; channel: string | null; direction: string | null; outcome: string | null; summary: string | null }[];
  } | null;
  notes: { id: string; at: string; note_text: string | null; source: string | null }[];
  corrections: { acted_at: string; table_name: string; action: string; changed_fields: string[] | null; old_data: any; new_data: any }[];
  deleted_invoices: { id: string; invoice_number: string | null; total_amount: number | null; deleted_at: string; delete_reason: string | null }[];
}

const money = (n: number | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ActorBadge({ role, name }: { role: string; name: string | null }) {
  const styles: Record<string, string> = {
    admin: 'bg-primary/15 text-primary border-primary/30',
    va: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
    unattributed: 'bg-muted text-muted-foreground border-border',
  };
  const label = role === 'admin' ? 'Admin' : role === 'va' ? 'VA' : role === 'unattributed' ? 'Unattributed' : 'Other';
  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline" className={styles[role] ?? styles.unattributed}>{label}</Badge>
      <span className="text-xs text-muted-foreground">{name ?? '—'}</span>
    </div>
  );
}

/** Corrections are only meaningful when the field list excludes bookkeeping columns. */
const NOISE_FIELDS = new Set(['updated_at', 'created_at', 'last_synced_at']);

function ExpandedDetail({ storeId, at }: { storeId: string; at: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['account-audit-detail', storeId, at],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('account_activity_row_detail', {
        p_store_id: storeId,
        p_at: at,
      });
      if (error) throw error;
      return data as RowDetail;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading account detail…
      </div>
    );
  }
  if (error) {
    return <div className="p-4 text-sm text-destructive">Could not load detail: {(error as Error).message}</div>;
  }
  if (!data) return null;

  const inv = data.invoices;
  const comms = data.comms;
  const responsiveness =
    !comms || comms.total === 0 ? 'Never contacted' : comms.inbound > 0 ? 'Responsive' : 'Unresponsive';
  const corrections = (data.corrections ?? []).map((c) => ({
    ...c,
    fields: (c.changed_fields ?? []).filter((f) => !NOISE_FIELDS.has(f)),
  }));

  return (
    <div className="grid gap-4 bg-muted/30 p-4 md:grid-cols-2">
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">What was written</h4>
        {data.notes.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No note text recorded for this review.</p>
        ) : (
          <ul className="space-y-2">
            {data.notes.map((n) => (
              <li key={n.id} className="rounded-md border bg-background p-2">
                <div className="text-xs text-muted-foreground">
                  {format(new Date(n.at), 'MMM d, yyyy HH:mm')}{n.source ? ` · ${n.source}` : ''}
                </div>
                <div className="whitespace-pre-wrap text-sm">{n.note_text || '—'}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Invoices</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border bg-background p-2">
            <div className="text-xs text-muted-foreground">Open balance</div>
            <div className="text-lg font-semibold">{money(inv?.open_balance)}</div>
          </div>
          <div className="rounded-md border bg-background p-2">
            <div className="text-xs text-muted-foreground">Total billed</div>
            <div className="text-lg font-semibold">{money(inv?.total_billed)}</div>
          </div>
          <div className="rounded-md border bg-background p-2">
            <div className="text-xs text-muted-foreground">Paid</div>
            <div className="text-lg font-semibold">{inv?.paid_count ?? 0}</div>
          </div>
          <div className="rounded-md border bg-background p-2">
            <div className="text-xs text-muted-foreground">Unpaid</div>
            <div className="text-lg font-semibold">{inv?.unpaid_count ?? 0}</div>
          </div>
        </div>
        {data.deleted_invoices.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Removed invoices</div>
            <ul className="mt-1 space-y-1 text-sm">
              {data.deleted_invoices.map((d) => (
                <li key={d.id} className="rounded-md border bg-background p-2">
                  #{d.invoice_number ?? d.id.slice(0, 8)} · {money(d.total_amount)} · removed{' '}
                  {format(new Date(d.deleted_at), 'MMM d, yyyy')}
                  {d.delete_reason ? ` — ${d.delete_reason}` : ' — no reason recorded'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Route assignment</h4>
        {data.route ? (
          <div className="rounded-md border bg-background p-2 text-sm">
            <div className="font-medium">{data.route.name || 'Unnamed route'}</div>
            <div className="text-xs text-muted-foreground">
              {data.route.date ? format(new Date(data.route.date), 'MMM d, yyyy') : 'No date'} ·{' '}
              {data.route.type ?? 'unspecified type'} · route {data.route.status ?? '—'} · stop{' '}
              {data.route.stop_status ?? '—'}
              {data.route.planned_order != null ? ` · stop #${data.route.planned_order}` : ''}
            </div>
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">Not assigned to any route.</p>
        )}

        <h4 className="mb-2 mt-4 text-xs font-semibold uppercase text-muted-foreground">Calls &amp; texts</h4>
        <div className="rounded-md border bg-background p-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{responsiveness}</Badge>
            <span className="text-xs text-muted-foreground">
              {comms?.total ?? 0} logged · {comms?.calls ?? 0} calls · {comms?.texts ?? 0} texts ·{' '}
              {comms?.inbound ?? 0} inbound
              {comms?.last_at ? ` · last ${format(new Date(comms.last_at), 'MMM d, yyyy')}` : ''}
            </span>
          </div>
          {comms && comms.recent.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {comms.recent.map((c, i) => (
                <li key={i}>
                  {format(new Date(c.created_at), 'MMM d HH:mm')} · {c.channel ?? '—'} · {c.direction ?? '—'}
                  {c.outcome ? ` · ${c.outcome}` : ''}
                  {c.summary ? ` — ${c.summary}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Corrections made</h4>
        {corrections.length === 0 || corrections.every((c) => c.fields.length === 0) ? (
          <p className="text-sm italic text-muted-foreground">No name or address changes recorded around this review.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {corrections
              .filter((c) => c.fields.length > 0)
              .map((c, i) => (
                <li key={i} className="rounded-md border bg-background p-2">
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(c.acted_at), 'MMM d, yyyy HH:mm')} · {c.table_name} · {c.action}
                  </div>
                  <div className="text-sm">Changed: {c.fields.join(', ')}</div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AccountAuditFeed() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [actorKind, setActorKind] = useState('all');
  const [action, setAction] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandAll, setExpandAll] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = useInfiniteQuery({
    queryKey: ['account-audit-feed', debounced, actorKind, action, routeFilter, from, to],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await (supabase as any).rpc('account_activity_feed', {
        p_search: debounced || null,
        p_actor_kind: actorKind,
        p_from: from ? `${from}T00:00:00Z` : null,
        p_to: to ? `${to}T23:59:59Z` : null,
        p_limit: PAGE,
        p_offset: pageParam as number,
        p_action: action,
        p_route: routeFilter,
      });
      if (error) throw error;
      return { rows: (data ?? []) as AuditFeedRow[], offset: pageParam as number };
    },
    getNextPageParam: (last) => (last.rows.length < PAGE ? undefined : last.offset + PAGE),
  });


  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);
  const total = rows[0]?.total_count ?? 0;

  /**
   * One store + one calendar day = ONE top-level row. Every individual action that
   * day stays visible as a sub-action underneath, so nothing is hidden by grouping.
   * Grouping runs over every loaded page, so a store's day never splits across pages.
   */
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; store_id: string | null; store_name: string | null; day: string; latest_at: string | null; items: AuditFeedRow[] }>();
    for (const r of rows) {
      const day = r.occurred_at ? r.occurred_at.slice(0, 10) : 'unknown';
      const key = `${r.store_id ?? r.store_name ?? 'unknown'}|${day}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(r);
        if (r.occurred_at && (!existing.latest_at || r.occurred_at > existing.latest_at)) {
          existing.latest_at = r.occurred_at;
        }
      } else {
        map.set(key, {
          key,
          store_id: r.store_id,
          store_name: r.store_name,
          day,
          latest_at: r.occurred_at,
          items: [r],
        });
      }
    }
    return Array.from(map.values()).map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? '')),
    }));
  }, [rows]);


  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  }, [query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, rows.length]);

  const isOpen = (id: string) => expandAll || !!expanded[id];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Input
          className="md:col-span-2"
          placeholder="Search notes, stores, people, corrections…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={actorKind} onValueChange={setActorKind}>
          <SelectTrigger><SelectValue placeholder="Who" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="admin">Admin reviewed</SelectItem>
            <SelectItem value="va">VA reviewed</SelectItem>
            <SelectItem value="unattributed">Unattributed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={routeFilter} onValueChange={setRouteFilter}>
          <SelectTrigger><SelectValue placeholder="Route" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Route: any</SelectItem>
            <SelectItem value="on_route">On a route</SelectItem>
            <SelectItem value="off_route">Not on a route</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>


      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {query.isLoading ? 'Loading…' : `Showing ${rows.length} of ${total.toLocaleString()} activities`}
        </span>
        <Button variant="outline" size="sm" onClick={() => { setExpandAll((v) => !v); setExpanded({}); }}>
          {expandAll ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>

      {query.error && (
        <p className="text-sm text-destructive">Could not load activity: {(query.error as Error).message}</p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="w-12 py-2 pl-3">#</th>
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Store</th>
              <th className="py-2 pr-3">Who</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Route</th>
              <th className="py-2 pr-3">Detail</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const open = isOpen(r.row_id);
              return (
                <Fragment key={r.row_id}>
                  <tr
                    className="cursor-pointer border-b align-top hover:bg-muted/40"
                    onClick={() => setExpanded((s) => ({ ...s, [r.row_id]: !isOpen(r.row_id) }))}
                  >
                    <td className="py-2 pl-3 text-xs font-mono text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
                      {r.occurred_at ? format(new Date(r.occurred_at), 'MMM d, yyyy HH:mm') : '—'}
                    </td>
                    <td className="py-2 pr-3">{r.store_name || (r.store_id ? r.store_id.slice(0, 8) : '—')}</td>
                    <td className="py-2 pr-3"><ActorBadge role={r.actor_role} name={r.actor_name} /></td>
                    <td className="py-2 pr-3">
                      <ActionBadge action={r.action || r.row_kind} />
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {r.route_id ? (
                        <Badge variant="outline">
                          {(r.route_name || 'Route')}{r.route_type ? ` · ${r.route_type}` : ''}
                          {r.route_date ? ` · ${format(new Date(r.route_date), 'MMM d')}` : ''}
                          {r.stop_status ? ` · ${r.stop_status}` : ''}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Not on a route</span>
                      )}
                    </td>
                    <td className="max-w-md py-2 pr-3 text-xs">
                      {r.detail_text && <div className="text-foreground">{r.detail_text}</div>}
                      {r.note_text && <div className="text-muted-foreground">{r.note_text}</div>}
                      {!r.detail_text && !r.note_text && <span className="text-muted-foreground">—</span>}
                    </td>

                    <td className="py-2 pr-2 text-muted-foreground">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                  </tr>
                  {open && r.store_id && (
                    <tr className="border-b">
                      <td colSpan={8} className="p-0">
                        <ExpandedDetail storeId={r.store_id} at={r.occurred_at ?? new Date().toISOString()} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!query.isLoading && rows.length === 0 && (
        <p className="text-sm italic text-muted-foreground">No activity matches these filters.</p>
      )}

      <div ref={sentinel} className="h-4" />
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
