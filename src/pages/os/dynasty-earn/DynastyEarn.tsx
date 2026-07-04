/**
 * Dynasty Earn — Monetization Engine Dashboard
 *
 * Reads exclusively from the Dynasty Earn Supabase project via `earnDb`.
 * If the connection is not configured, renders an amber banner instead of querying.
 */
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Users,
  Building2,
  Layers,
  DollarSign,
  Megaphone,
  Wallet,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { earnDb, isEarnConnected } from '@/lib/dynastyEarnClient';

const fmtMoney = (n: number) =>
  '$' +
  (n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

type Stats = {
  earners: number;
  brands: number;
  programs: number;
  commissionsPaid: number;
  activeCampaigns: number;
  pendingPayouts: number;
};

type RecentApp = {
  id: string;
  kind: 'earner' | 'brand' | 'program';
  name: string;
  created_at: string;
  status?: string | null;
};

type TopEarner = {
  id: string;
  name: string;
  total_earned: number;
  tier?: string | null;
};

type ProgramRow = {
  id: string;
  business_name: string;
  category?: string | null;
  commission_rate?: number | null;
};

export default function DynastyEarn() {
  const [stats, setStats] = useState<Stats>({
    earners: 0,
    brands: 0,
    programs: 0,
    commissionsPaid: 0,
    activeCampaigns: 0,
    pendingPayouts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [topEarners, setTopEarners] = useState<TopEarner[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);

  // Stats fetch — 6 queries in parallel
  useEffect(() => {
    if (!earnDb) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [
          earners,
          brands,
          programs,
          commissionsPaid,
          activeCampaigns,
          pendingPayouts,
        ] = await Promise.all([
          earnDb.from('earners').select('id', { count: 'exact', head: true }),
          earnDb.from('brands').select('id', { count: 'exact', head: true }),
          earnDb.from('programs').select('id', { count: 'exact', head: true }),
          earnDb.from('commissions').select('amount').eq('status', 'paid'),
          earnDb
            .from('campaigns')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active'),
          earnDb
            .from('payouts')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ]);

        if (cancelled) return;

        const paidSum =
          (commissionsPaid.data ?? []).reduce(
            (acc: number, r: any) => acc + Number(r.amount || 0),
            0,
          ) || 0;

        setStats({
          earners: earners.count ?? 0,
          brands: brands.count ?? 0,
          programs: programs.count ?? 0,
          commissionsPaid: paidSum,
          activeCampaigns: activeCampaigns.count ?? 0,
          pendingPayouts: pendingPayouts.count ?? 0,
        });
      } catch (err) {
        console.error('[DynastyEarn] stats error', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Recent applications — 3 parallel fetches merged client-side
  useEffect(() => {
    if (!earnDb) return;
    let cancelled = false;

    (async () => {
      try {
        const [earnerRes, brandRes, programRes] = await Promise.all([
          earnDb
            .from('earners')
            .select('id, name, created_at, status')
            .order('created_at', { ascending: false })
            .limit(10),
          earnDb
            .from('brands')
            .select('id, business_name, created_at, status')
            .order('created_at', { ascending: false })
            .limit(10),
          earnDb
            .from('programs')
            .select('id, business_name, created_at, status')
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        if (cancelled) return;

        const merged: RecentApp[] = [
          ...((earnerRes.data ?? []) as any[]).map((r) => ({
            id: r.id,
            kind: 'earner' as const,
            name: r.name ?? 'Unnamed earner',
            created_at: r.created_at,
            status: r.status,
          })),
          ...((brandRes.data ?? []) as any[]).map((r) => ({
            id: r.id,
            kind: 'brand' as const,
            name: r.business_name ?? 'Unnamed brand',
            created_at: r.created_at,
            status: r.status,
          })),
          ...((programRes.data ?? []) as any[]).map((r) => ({
            id: r.id,
            kind: 'program' as const,
            name: r.business_name ?? 'Unnamed program',
            created_at: r.created_at,
            status: r.status,
          })),
        ]
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )
          .slice(0, 15);

        setRecent(merged);
      } catch (err) {
        console.error('[DynastyEarn] recent apps error', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Top 5 earners leaderboard
  useEffect(() => {
    if (!earnDb) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await earnDb
          .from('earners')
          .select('id, name, total_earned, tier')
          .order('total_earned', { ascending: false })
          .limit(5);
        if (error) throw error;
        if (!cancelled) setTopEarners((data ?? []) as any);
      } catch (err) {
        console.error('[DynastyEarn] top earners error', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Active programs grid
  useEffect(() => {
    if (!earnDb) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await earnDb
          .from('programs')
          .select('id, business_name, category, commission_rate')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(12);
        if (error) throw error;
        if (!cancelled) setPrograms((data ?? []) as any);
      } catch (err) {
        console.error('[DynastyEarn] programs error', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Connection banner ----------
  if (!isEarnConnected()) {
    return (
      <div className="p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-emerald-400">
            💰 Dynasty Earn
          </h1>
          <p className="text-muted-foreground mt-1">
            Monetization engine — earners, brands, programs & payouts.
          </p>
        </header>

        <Card className="border-amber-500/40 bg-amber-500/10 p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-200">
                Connect Dynasty Earn database
              </h2>
              <p className="text-sm text-amber-100/80">
                The Dynasty Earn Supabase project is not connected. Set the
                following environment variables to enable this dashboard:
              </p>
              <ul className="text-xs font-mono text-amber-100/70 list-disc list-inside space-y-1">
                <li>VITE_DYNASTY_EARN_SUPABASE_URL</li>
                <li>VITE_DYNASTY_EARN_SUPABASE_KEY</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ---------- Stat cards ----------
  const statCards = [
    {
      label: 'Earners',
      value: stats.earners.toLocaleString(),
      icon: Users,
      accent: 'text-emerald-400',
    },
    {
      label: 'Brands',
      value: stats.brands.toLocaleString(),
      icon: Building2,
      accent: 'text-sky-400',
    },
    {
      label: 'Programs',
      value: stats.programs.toLocaleString(),
      icon: Layers,
      accent: 'text-violet-400',
    },
    {
      label: 'Commissions Paid',
      value: fmtMoney(stats.commissionsPaid),
      icon: DollarSign,
      accent: 'text-amber-400',
    },
    {
      label: 'Active Campaigns',
      value: stats.activeCampaigns.toLocaleString(),
      icon: Megaphone,
      accent: 'text-pink-400',
    },
    {
      label: 'Pending Payouts',
      value: stats.pendingPayouts.toLocaleString(),
      icon: Wallet,
      accent: 'text-orange-400',
    },
  ];

  return (
    <div className="p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-emerald-400">💰 Dynasty Earn</h1>
        <p className="text-muted-foreground mt-1">
          Monetization engine — earners, brands, programs & payouts.
        </p>
      </header>

      {/* 6 stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-5 bg-card/60 border-border/60">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
                <Icon className={`w-5 h-5 ${s.accent}`} />
              </div>
              <div className={`mt-3 text-2xl font-bold ${s.accent}`}>
                {loading ? <Skeleton className="h-7 w-24" /> : s.value}
              </div>
            </Card>
          );
        })}
      </section>

      {/* Recent applications feed */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Applications</h2>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-4 py-3" colSpan={4}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))}
                {!loading && recent.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No recent applications.
                    </td>
                  </tr>
                )}
                {!loading &&
                  recent.map((r) => (
                    <tr
                      key={`${r.kind}-${r.id}`}
                      className="border-t border-border/40"
                    >
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">
                          {r.kind}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">
                        {r.status ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {fmtDate(r.created_at)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Top 5 earners leaderboard */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Top Earners</h2>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left w-12">#</th>
                <th className="px-4 py-2 text-left">Earner</th>
                <th className="px-4 py-2 text-left">Tier</th>
                <th className="px-4 py-2 text-right">Total Earned</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="px-4 py-3" colSpan={4}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading && topEarners.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No earners yet.
                  </td>
                </tr>
              )}
              {!loading &&
                topEarners.map((e, idx) => (
                  <tr key={e.id} className="border-t border-border/40">
                    <td className="px-4 py-3 text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium">{e.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="capitalize">
                        {e.tier ?? 'standard'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">
                      {fmtMoney(Number(e.total_earned || 0))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Active programs grid */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Active Programs</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : programs.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No active programs.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {programs.map((p) => (
              <Card
                key={p.id}
                className="p-4 bg-card/60 border-border/60 hover:border-emerald-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold truncate">
                    {p.business_name}
                  </div>
                  {p.category && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {p.category}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 text-lg font-bold text-amber-400">
                  {p.commission_rate != null
                    ? `${Number(p.commission_rate).toFixed(1)}%`
                    : '—'}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Commission
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
