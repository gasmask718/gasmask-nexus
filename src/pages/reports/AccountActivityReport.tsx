import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export interface ActivityRow {
  kind: 'review' | 'call' | 'text' | 'visit';
  id: string;
  store_id: string | null;
  actor_id: string | null;
  occurred_at: string | null;
  subtype: string | null;
  detail: string | null;
  body: string | null;
}

const kindColor: Record<string, string> = {
  review: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  call:   'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  text:   'bg-green-500/10 text-green-700 dark:text-green-300',
  visit:  'bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

interface Props {
  storeId?: string;      // when set, embedded per-store mode
  compact?: boolean;
  limit?: number;
  /** When provided, replaces the internal date inputs and hides them. */
  dateFrom?: string;
  dateTo?: string;
}

export function AccountActivityTable({ storeId, compact, limit = 500, dateFrom, dateTo }: Props) {
  const [kind, setKind] = useState<string>('all');
  const [actor, setActor] = useState<string>('all');
  const [store, setStore] = useState<string>('all');
  const [q, setQ] = useState('');
  const [fromLocal, setFromLocal] = useState('');
  const [toLocal, setToLocal] = useState('');
  const dateControlled = dateFrom !== undefined || dateTo !== undefined;
  const from = dateControlled ? (dateFrom ?? '') : fromLocal;
  const to = dateControlled ? (dateTo ?? '') : toLocal;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['account-activity', storeId, limit],
    queryFn: async () => {
      let query = (supabase as any)
        .from('store_activity_feed_v')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (storeId) query = query.eq('store_id', storeId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ActivityRow[];
    },
  });

  const actorIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[],
    [rows]
  );
  const storeIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.store_id).filter(Boolean))) as string[],
    [rows]
  );

  const { data: actors = [] } = useQuery({
    queryKey: ['actor-directory', actorIds],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('actor_directory_v')
        .select('actor_id, actor_name, actor_kind')
        .in('actor_id', actorIds);
      if (error) throw error;
      return data as { actor_id: string; actor_name: string; actor_kind: string }[];
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['activity-stores', storeIds],
    enabled: !storeId && storeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('id, name').in('id', storeIds);
      if (error) throw error;
      return data as { id: string; name: string | null }[];
    },
  });

  const actorMap = useMemo(() => {
    const m = new Map<string, string>();
    actors.forEach((a) => m.set(a.actor_id, a.actor_name));
    return m;
  }, [actors]);
  const storeMap = useMemo(() => {
    const m = new Map<string, string>();
    stores.forEach((s) => m.set(s.id, s.name || 'Unnamed store'));
    return m;
  }, [stores]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (actor !== 'all' && r.actor_id !== actor) return false;
      if (store !== 'all' && r.store_id !== store) return false;
      if (from && r.occurred_at && new Date(r.occurred_at) < new Date(from)) return false;
      if (to && r.occurred_at && new Date(r.occurred_at) > new Date(to + 'T23:59:59')) return false;
      if (q) {
        const hay = `${r.subtype ?? ''} ${r.detail ?? ''} ${r.body ?? ''}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, kind, actor, store, from, to, q]);

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue placeholder="Kind" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              <SelectItem value="review">Reviews</SelectItem>
              <SelectItem value="call">Calls</SelectItem>
              <SelectItem value="text">Texts</SelectItem>
              <SelectItem value="visit">Visits</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger><SelectValue placeholder="Actor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              {actorIds.map((id) => (
                <SelectItem key={id} value={id}>{actorMap.get(id) || id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!storeId && (
            <Select value={store} onValueChange={setStore}>
              <SelectTrigger><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {storeIds.map((id) => (
                  <SelectItem key={id} value={id}>{storeMap.get(id) || id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!dateControlled && (
            <>
              <Input type="date" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} placeholder="From" />
              <Input type="date" value={toLocal} onChange={(e) => setToLocal(e.target.value)} placeholder="To" />
            </>
          )}
          <Input placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">No activity for these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">When</th>
                {!storeId && <th className="py-2 pr-3">Store</th>}
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Detail</th>
                <th className="py-2 pr-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                    {r.occurred_at ? format(new Date(r.occurred_at), 'MMM d, yyyy HH:mm') : '—'}
                  </td>
                  {!storeId && (
                    <td className="py-2 pr-3">
                      {r.store_id ? (storeMap.get(r.store_id) || r.store_id.slice(0, 8)) : '—'}
                    </td>
                  )}
                  <td className="py-2 pr-3">{r.actor_id ? (actorMap.get(r.actor_id) || r.actor_id.slice(0, 8)) : '—'}</td>
                  <td className="py-2 pr-3">
                    <Badge className={kindColor[r.kind] || ''} variant="secondary">
                      {r.kind}{r.subtype ? ` · ${r.subtype}` : ''}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs">{r.detail || '—'}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground max-w-md truncate">{r.body || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AccountActivityReport() {
  return (
    <div className="container max-w-6xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" /> Account Activity Feed
        </h1>
        <p className="text-sm text-muted-foreground">
          Unified stream of reviews, calls, texts, and visits across every account.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">All activity</CardTitle></CardHeader>
        <CardContent><AccountActivityTable /></CardContent>
      </Card>
    </div>
  );
}
