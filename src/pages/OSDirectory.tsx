import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Map, Search, AlertTriangle } from 'lucide-react';

type Row = {
  id: string;
  floor: string;
  section: string | null;
  page_route: string;
  page_name: string;
  purpose: string | null;
  status: 'ready' | 'needs_work' | 'stub' | 'kill_pending' | 'dormant';
  gaps_count: number;
  audit_pass: string | null;
  last_audited: string;
};

const STATUS_STYLES: Record<Row['status'], string> = {
  ready: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  needs_work: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  stub: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  kill_pending: 'bg-red-500/15 text-red-400 border-red-500/30',
  dormant: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const STATUS_LABEL: Record<Row['status'], string> = {
  ready: 'Ready',
  needs_work: 'Needs Work',
  stub: 'Stub',
  kill_pending: 'Kill Pending',
  dormant: 'Dormant',
};

export default function OSDirectory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('floor_directory')
        .select('*')
        .order('floor', { ascending: true })
        .order('page_route', { ascending: true });
      if (error) setError(error.message);
      else setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        r.page_name.toLowerCase().includes(needle) ||
        r.page_route.toLowerCase().includes(needle) ||
        r.floor.toLowerCase().includes(needle) ||
        (r.section ?? '').toLowerCase().includes(needle) ||
        (r.purpose ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, statusFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of filtered) {
      const arr = m.get(r.floor) ?? [];
      arr.push(r);
      m.set(r.floor, arr);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const tallies = useMemo(() => {
    const t: Record<string, number> = { ready: 0, needs_work: 0, stub: 0, kill_pending: 0, dormant: 0 };
    for (const r of rows) t[r.status]++;
    return t;
  }, [rows]);

  const totalGaps = rows.reduce((s, r) => s + r.gaps_count, 0);

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Map className="h-7 w-7" /> OS Directory
        </h1>
        <p className="text-muted-foreground">
          The OS's map of itself — every audited page, its purpose, status, and open gaps.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Audited pages</div>
          <div className="text-2xl font-bold">{rows.length}</div>
        </Card>
        {(['ready', 'needs_work', 'stub', 'kill_pending', 'dormant'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`text-left ${statusFilter === s ? 'ring-2 ring-primary rounded-lg' : ''}`}
          >
            <Card className="p-3 hover:bg-muted/40 transition">
              <div className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</div>
              <div className="text-2xl font-bold">{tallies[s]}</div>
            </Card>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search route, page, floor, or purpose…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" />
          {totalGaps} open gaps across {rows.length} pages
        </div>
      </div>

      {loading && <div className="text-muted-foreground">Loading directory…</div>}
      {error && (
        <Card className="p-4 border-red-500/30 bg-red-500/10 text-red-300">
          Failed to load floor_directory: {error}
        </Card>
      )}

      {!loading && !error && grouped.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">No pages match your filters.</Card>
      )}

      <div className="space-y-6">
        {grouped.map(([floor, items]) => (
          <section key={floor}>
            <h2 className="text-xl font-semibold mb-2">{floor}</h2>
            <Card className="divide-y">
              {items.map((r) => (
                <Link
                  key={r.id}
                  to={r.page_route}
                  className="flex items-start gap-4 p-3 hover:bg-muted/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.page_name}</span>
                      <Badge variant="outline" className={STATUS_STYLES[r.status]}>
                        {STATUS_LABEL[r.status]}
                      </Badge>
                      {r.gaps_count > 0 && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                          {r.gaps_count} gap{r.gaps_count > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {r.audit_pass && (
                        <Badge variant="outline" className="text-xs">
                          {r.audit_pass}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.page_route}</div>
                    {r.purpose && (
                      <div className="text-sm text-muted-foreground mt-1">{r.purpose}</div>
                    )}
                  </div>
                </Link>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
