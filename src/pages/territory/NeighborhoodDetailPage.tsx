import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, MessageSquare, Bot, ChevronRight, Users, Flame, Percent, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePriorCustomerSegmentMap, FLOW_STATUS_META, type FlowStatus } from '@/hooks/usePriorCustomerSegmentMap';

const fmt = (n: number) => Number(n || 0).toLocaleString();

export default function NeighborhoodDetailPage() {
  const { neighborhood: rawNeigh } = useParams<{ neighborhood: string }>();
  const neighborhood = decodeURIComponent(rawNeigh || '');
  const navigate = useNavigate();

  const intel = useQuery({
    queryKey: ['neigh-intel', neighborhood],
    enabled: !!neighborhood,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_neighborhood_tube_intel' as any)
        .select('*')
        .eq('neighborhood', neighborhood)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const stores = useQuery({
    queryKey: ['neigh-stores', neighborhood],
    enabled: !!neighborhood,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_store_tube_summary' as any)
        .select('*')
        .eq('neighborhood', neighborhood);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { map: segMap } = usePriorCustomerSegmentMap();

  const ledger = useQuery({
    queryKey: ['neigh-ledger', neighborhood],
    enabled: !!stores.data,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = (stores.data || []).map((s: any) => s.store_id);
      if (ids.length === 0) return [] as any[];
      const since = new Date(); since.setMonth(since.getMonth() - 12);
      const { data, error } = await supabase
        .from('tube_sale_ledger')
        .select('brand, tubes_delta, created_at')
        .in('store_id', ids)
        .gte('created_at', since.toISOString());
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const chartData = useMemo(() => {
    const buckets = new Map<string, Record<string, any>>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { month: key });
    }
    (ledger.data || []).forEach((r: any) => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = buckets.get(key);
      if (!row) return;
      const brand = (r.brand || 'other').toString();
      row[brand] = (row[brand] || 0) + Number(r.tubes_delta || 0);
      row.total = (row.total || 0) + Number(r.tubes_delta || 0);
    });
    return Array.from(buckets.values());
  }, [ledger.data]);

  const brandKeys = useMemo(() => {
    const set = new Set<string>();
    (ledger.data || []).forEach((r: any) => set.add((r.brand || 'other').toString()));
    return Array.from(set);
  }, [ledger.data]);

  const allStores = stores.data || [];
  const enriched = allStores.map((s: any) => ({ ...s, seg: segMap.get(s.store_id) }));
  const active = enriched.filter(s => s.seg?.flow_status === 'active_flow').sort((a, b) => Number(b.lifetime_tubes_delivered || 0) - Number(a.lifetime_tubes_delivered || 0));
  const targets = enriched.filter(s => ['cold', 'long_dormant', 'recently_quiet'].includes(s.seg?.flow_status || '')).sort((a, b) => Number(b.lifetime_tubes_delivered || 0) - Number(a.lifetime_tubes_delivered || 0));

  const n = intel.data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Link to="/territory" className="hover:underline">Territory Intelligence</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/territory/tube-intelligence" className="hover:underline">Tube Territory</Link>
        <ChevronRight className="h-3 w-3" />
        <span>{neighborhood}</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold">🏙️ {neighborhood}{n?.boro ? `, ${n.boro}` : ''}</h1>
        <p className="text-muted-foreground text-sm">
          {n ? `${fmt(n.total_known_stores)} stores • ${fmt(n.total_lifetime_tubes)} lifetime tubes` : 'Loading...'}
        </p>
      </div>

      {/* KPI strip */}
      {intel.isLoading ? <Skeleton className="h-20" /> : n && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center"><Users className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-emerald-600">{fmt(n.revenue_active_count)}</p><p className="text-xs text-muted-foreground">Active stores</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/15 flex items-center justify-center"><Flame className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-2xl font-bold text-red-600">{fmt(n.reactivation_target_count)}</p><p className="text-xs text-muted-foreground">Reactivation pool</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center"><Percent className="h-5 w-5 text-amber-600" /></div>
            <div className="flex-1">
              <p className="text-2xl font-bold">{Number(n.takeover_pct || 0).toFixed(1)}%</p>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, Number(n.takeover_pct || 0))}%` }} />
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/15 flex items-center justify-center"><Tag className="h-5 w-5 text-purple-600" /></div>
            <div><p className="text-lg font-bold capitalize">{n.top_brand || '—'}</p><p className="text-xs text-muted-foreground">Top brand</p></div>
          </CardContent></Card>
        </div>
      )}

      {/* Campaign launch */}
      <Card>
        <CardHeader><CardTitle>Launch Outreach Campaign</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => navigate(`/communication/dialer?neighborhood=${encodeURIComponent(neighborhood)}`)}>
            <Phone className="h-4 w-4" /> Manual Call List
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/communication/dialer/campaign?neighborhood=${encodeURIComponent(neighborhood)}&audience=prior_customers`)}>
            <Bot className="h-4 w-4" /> Bland AI Campaign
          </Button>
          <Button variant="outline" onClick={() => navigate(`/communication/messaging?neighborhood=${encodeURIComponent(neighborhood)}`)}>
            <MessageSquare className="h-4 w-4" /> SMS Blast
          </Button>
        </CardContent>
      </Card>

      {/* Side-by-side tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-base">🟢 Active Stores ({active.length})</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b">
                <tr className="text-left text-muted-foreground"><th className="py-2 px-3">Store</th><th className="px-3 text-right">Tubes</th><th className="px-3">Last Order</th><th className="px-3"></th></tr>
              </thead>
              <tbody>
                {active.map((s: any) => (
                  <tr key={s.store_id} className="border-b hover:bg-muted/20">
                    <td className="py-1.5 px-3 truncate max-w-[180px]">{s.store_name}</td>
                    <td className="px-3 text-right font-mono">{fmt(s.lifetime_tubes_delivered)}</td>
                    <td className="px-3 text-muted-foreground">{s.seg?.last_order_date ? new Date(s.seg.last_order_date).toLocaleDateString() : '—'}</td>
                    <td className="px-3"><Link to={`/stores/${s.store_id}`} className="text-primary text-xs">view</Link></td>
                  </tr>
                ))}
                {active.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground text-xs">No active stores</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">🔴 Reactivation Targets ({targets.length})</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b">
                <tr className="text-left text-muted-foreground"><th className="py-2 px-3">Store</th><th className="px-3 text-right">Tubes</th><th className="px-3 text-right">Days</th><th className="px-3">Status</th><th className="px-3"></th></tr>
              </thead>
              <tbody>
                {targets.map((s: any) => {
                  const flow = s.seg?.flow_status as FlowStatus;
                  const meta = FLOW_STATUS_META[flow];
                  return (
                    <tr key={s.store_id} className="border-b hover:bg-muted/20">
                      <td className="py-1.5 px-3 truncate max-w-[160px]">{s.store_name}</td>
                      <td className="px-3 text-right font-mono">{fmt(s.lifetime_tubes_delivered)}</td>
                      <td className="px-3 text-right font-mono text-muted-foreground">{s.seg?.days_since_last_order || '—'}</td>
                      <td className="px-3"><Badge variant="outline" className={meta?.color}>{meta?.emoji}</Badge></td>
                      <td className="px-3"><Link to={`/stores/${s.store_id}`} className="text-primary text-xs">view</Link></td>
                    </tr>
                  );
                })}
                {targets.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground text-xs">No reactivation targets</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Velocity chart */}
      <Card>
        <CardHeader><CardTitle>Tube Velocity — Last 12 Months</CardTitle></CardHeader>
        <CardContent>
          {ledger.isLoading ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                {brandKeys.slice(0, 6).map((b, i) => (
                  <Line key={b} type="monotone" dataKey={b} stroke={['#ef4444','#a855f7','#f59e0b','#10b981','#3b82f6','#ec4899'][i % 6]} strokeWidth={1.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
