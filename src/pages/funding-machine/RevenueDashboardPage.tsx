import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, Users, Award, CheckCircle2, TrendingUp, Layers, Activity, FileText,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';

const GOLD = '#C9A84C';
const GOLD_DIM = '#8a7332';
const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n: number) => new Intl.NumberFormat('en-US').format(n || 0);

type StatCardProps = {
  label: string; value: string; icon: React.ElementType; accent?: string; loading?: boolean;
};
const StatCard = ({ label, value, icon: Icon, accent = GOLD, loading }: StatCardProps) => (
  <Card className="bg-zinc-900 border-zinc-800">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-32 mt-2 bg-zinc-800" />
          ) : (
            <p className="text-2xl font-bold mt-2 truncate" style={{ color: accent }}>{value}</p>
          )}
        </div>
        <div className="ml-3 p-2 rounded-lg" style={{ background: `${accent}20` }}>
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
      </div>
    </CardContent>
  </Card>
);

type RecentRow = {
  id: string; full_name: string | null; first_name: string; last_name: string;
  funding_received: number | null; funding_target: number | null; stage: string | null; updated_at: string;
};
type GrantRow = { status: string; count: number; total_awarded: number };

export default function RevenueDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFunding: 0, activeClients: 0, totalAwards: 0, clientsFunded: 0,
    mtdFunding: 0, prevMonthFunding: 0, growthPct: 0,
  });
  const [trend, setTrend] = useState<{ month: string; funding: number }[]>([]);
  const [pipelineValue, setPipelineValue] = useState({ target: 0, received: 0 });
  const [stageDist, setStageDist] = useState<{ stage: string; count: number }[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [grantPipeline, setGrantPipeline] = useState<GrantRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since180 = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();

      const [clientsRes, awardsRes, trendRes, recentRes, grantsRes] = await Promise.all([
        supabase
          .from('funding_clients')
          .select('id, status, funding_received, funding_target, stage'),
        supabase
          .from('grant_applications')
          .select('amount_awarded, status'),
        supabase
          .from('funding_clients')
          .select('funding_received, updated_at')
          .gte('updated_at', since180)
          .gt('funding_received', 0),
        supabase
          .from('funding_clients')
          .select('id, full_name, first_name, last_name, funding_received, funding_target, stage, updated_at')
          .gt('funding_received', 0)
          .order('updated_at', { ascending: false })
          .limit(10),
        supabase
          .from('grant_applications')
          .select('status, amount_awarded'),
      ]);

      // Headline stats
      const clients = clientsRes.data || [];
      const totalFunding = clients.reduce((s, c: any) => s + Number(c.funding_received || 0), 0);
      const activeClients = clients.filter((c: any) => c.status === 'active').length;
      const clientsFunded = clients.filter((c: any) => Number(c.funding_received || 0) > 0).length;
      const totalAwards = (awardsRes.data || []).reduce(
        (s, g: any) => s + Number(g.amount_awarded || 0), 0);
      // MTD funding = sum of funding_received on clients updated this calendar month
      const _now = new Date();
      const monthStart = new Date(_now.getFullYear(), _now.getMonth(), 1);
      const prevMonthStart = new Date(_now.getFullYear(), _now.getMonth() - 1, 1);
      let mtdFunding = 0;
      let prevMonthFunding = 0;
      for (const r of trendRes.data || []) {
        const d = new Date((r as any).updated_at);
        const amt = Number((r as any).funding_received || 0);
        if (d >= monthStart) mtdFunding += amt;
        else if (d >= prevMonthStart && d < monthStart) prevMonthFunding += amt;
      }
      const growthPct = prevMonthFunding > 0
        ? Math.round(((mtdFunding - prevMonthFunding) / prevMonthFunding) * 100)
        : (mtdFunding > 0 ? 100 : 0);
      setStats({ totalFunding, activeClients, totalAwards, clientsFunded, mtdFunding, prevMonthFunding, growthPct });

      // Trend (last 6 months)
      const monthMap = new Map<string, number>();
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, 0);
      }
      for (const r of trendRes.data || []) {
        const d = new Date((r as any).updated_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + Number((r as any).funding_received || 0));
      }
      setTrend(Array.from(monthMap.entries()).map(([month, funding]) => ({ month, funding })));

      // Pipeline value
      setPipelineValue({
        target: clients.reduce((s, c: any) => s + Number(c.funding_target || 0), 0),
        received: totalFunding,
      });

      // Stage distribution
      const stageMap = new Map<string, number>();
      for (const c of clients) {
        const s = (c as any).stage || 'unspecified';
        stageMap.set(s, (stageMap.get(s) || 0) + 1);
      }
      setStageDist(Array.from(stageMap.entries()).map(([stage, count]) => ({ stage, count })));

      // Recent
      setRecent((recentRes.data || []) as RecentRow[]);

      // Grant pipeline aggregation
      const grantMap = new Map<string, { count: number; total_awarded: number }>();
      for (const g of grantsRes.data || []) {
        const st = (g as any).status || 'unknown';
        const cur = grantMap.get(st) || { count: 0, total_awarded: 0 };
        cur.count += 1;
        cur.total_awarded += Number((g as any).amount_awarded || 0);
        grantMap.set(st, cur);
      }
      setGrantPipeline(
        Array.from(grantMap.entries()).map(([status, v]) => ({ status, ...v }))
      );

      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <DollarSign className="h-7 w-7" style={{ color: GOLD }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GOLD }}>Revenue Dashboard</h1>
            <p className="text-sm text-zinc-400">Funding pipeline, awards, and momentum</p>
          </div>
        </header>

        {/* SECTION A — Headline Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Revenue MTD" value={fmtUsd(stats.mtdFunding)} icon={DollarSign} accent={GOLD} loading={loading} />
          <StatCard label="Previous Month" value={fmtUsd(stats.prevMonthFunding)} icon={DollarSign} accent="#8a7332" loading={loading} />
          <StatCard
            label="Growth %"
            value={`${stats.growthPct >= 0 ? '+' : ''}${stats.growthPct}%`}
            icon={TrendingUp}
            accent={stats.growthPct >= 0 ? '#22C55E' : '#EF4444'}
            loading={loading}
          />
          <StatCard label="Total Funding Received" value={fmtUsd(stats.totalFunding)} icon={DollarSign} accent={GOLD} loading={loading} />
          <StatCard label="Active Clients" value={fmtNum(stats.activeClients)} icon={Users} accent="#3B82F6" loading={loading} />
          <StatCard label="Total Grant Awards" value={fmtUsd(stats.totalAwards)} icon={Award} accent="#22C55E" loading={loading} />
          <StatCard label="Clients Funded" value={fmtNum(stats.clientsFunded)} icon={CheckCircle2} accent="#10B981" loading={loading} />
        </div>

        {/* SECTION B — Trend */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <TrendingUp className="h-5 w-5" style={{ color: GOLD }} />
              Funding Received — Last 6 Months
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full bg-zinc-800" />
            ) : trend.every(t => t.funding === 0) ? (
              <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">
                No funding activity in the last 180 days yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" stroke="#a1a1aa" fontSize={12} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickFormatter={(v) => fmtUsd(Number(v))} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: `1px solid ${GOLD_DIM}`, borderRadius: 8 }}
                    labelStyle={{ color: GOLD }}
                    formatter={(v: any) => fmtUsd(Number(v))}
                  />
                  <Line type="monotone" dataKey="funding" stroke={GOLD} strokeWidth={2} dot={{ fill: GOLD, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* SECTION C — Pipeline Value */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Layers className="h-5 w-5" style={{ color: GOLD }} />
              Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full bg-zinc-800" />
            ) : pipelineValue.target === 0 && pipelineValue.received === 0 ? (
              <div className="text-sm text-zinc-500">No pipeline data yet — add funding targets to clients.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs uppercase text-zinc-400">Target</p>
                    <p className="text-xl font-bold" style={{ color: GOLD }}>{fmtUsd(pipelineValue.target)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-zinc-400">Received</p>
                    <p className="text-xl font-bold text-emerald-400">{fmtUsd(pipelineValue.received)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-zinc-400">Progress</p>
                    <p className="text-xl font-bold text-zinc-100">
                      {pipelineValue.target > 0
                        ? `${Math.round((pipelineValue.received / pipelineValue.target) * 100)}%`
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 w-full bg-zinc-800 rounded overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: pipelineValue.target > 0
                        ? `${Math.min(100, (pipelineValue.received / pipelineValue.target) * 100)}%`
                        : '0%',
                      background: GOLD,
                    }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* SECTION D — Stage Distribution */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Layers className="h-5 w-5" style={{ color: GOLD }} />
              Clients by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full bg-zinc-800" />
            ) : stageDist.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-zinc-500 text-sm">
                No clients yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stageDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="stage" stroke="#a1a1aa" fontSize={12} />
                  <YAxis stroke="#a1a1aa" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: `1px solid ${GOLD_DIM}`, borderRadius: 8 }}
                    labelStyle={{ color: GOLD }}
                  />
                  <Legend wrapperStyle={{ color: '#a1a1aa' }} />
                  <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* SECTION E — Recent Funding Activity */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Activity className="h-5 w-5" style={{ color: GOLD }} />
              Recent Funding Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="text-sm text-zinc-500">No recent funding activity.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-zinc-800 text-zinc-400">
                      <th className="py-2 pr-4">Client</th>
                      <th className="py-2 pr-4">Stage</th>
                      <th className="py-2 pr-4 text-right">Received</th>
                      <th className="py-2 pr-4 text-right">Target</th>
                      <th className="py-2 pr-4">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-800/60">
                        <td className="py-2 pr-4 text-zinc-100">
                          {r.full_name || `${r.first_name} ${r.last_name}`}
                        </td>
                        <td className="py-2 pr-4 text-zinc-400">{r.stage || '—'}</td>
                        <td className="py-2 pr-4 text-right" style={{ color: GOLD }}>
                          {fmtUsd(Number(r.funding_received || 0))}
                        </td>
                        <td className="py-2 pr-4 text-right text-zinc-400">
                          {fmtUsd(Number(r.funding_target || 0))}
                        </td>
                        <td className="py-2 pr-4 text-zinc-400">
                          {new Date(r.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECTION F — Grant Pipeline */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <FileText className="h-5 w-5" style={{ color: GOLD }} />
              Grant Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full bg-zinc-800" />
            ) : grantPipeline.length === 0 ? (
              <div className="text-sm text-zinc-500">No grant applications yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-zinc-800 text-zinc-400">
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">Count</th>
                      <th className="py-2 pr-4 text-right">Total Awarded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grantPipeline.map((g) => (
                      <tr key={g.status} className="border-b border-zinc-800/60">
                        <td className="py-2 pr-4 text-zinc-100 capitalize">{g.status}</td>
                        <td className="py-2 pr-4 text-right text-zinc-100">{fmtNum(g.count)}</td>
                        <td className="py-2 pr-4 text-right" style={{ color: GOLD }}>
                          {fmtUsd(g.total_awarded)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
