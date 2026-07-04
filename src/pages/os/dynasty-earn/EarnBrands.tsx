/**
 * Dynasty Earn — Brand accounts management
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { earnDb } from '@/lib/dynastyEarnClient';

type Brand = {
  id: string;
  brand_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  plan: string | null;
  plan_price: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  created_at: string;
};

const fmtMoney = (n: number | null | undefined) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const planClass = (p: string | null) => {
  switch (p) {
    case 'starter': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'growth': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'scale': return 'bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/40';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
};

const statusClass = (s: string | null) => {
  switch (s) {
    case 'pending': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'active': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'paused': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'cancelled': return 'bg-red-500/20 text-red-300 border-red-500/40';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
};

const Badge = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>{children}</span>
);

const truncate = (s: string | null, len = 14) => {
  if (!s) return '—';
  return s.length <= len ? s : `${s.slice(0, len)}…`;
};

const TABS = ['All', 'Pending', 'Active', 'Paused', 'Cancelled'] as const;
type Tab = typeof TABS[number];

export default function EarnBrands() {
  const [rows, setRows] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('All');
  const [selected, setSelected] = useState<Brand | null>(null);
  const [campaignCount, setCampaignCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!earnDb) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await earnDb
      .from('brand_accounts')
      .select('id, brand_name, contact_name, email, phone, industry, plan, plan_price, stripe_customer_id, stripe_subscription_id, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Failed to load brands: ${error.message}`);
      setRows([]);
    } else {
      setRows((data ?? []) as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected || !earnDb) { setCampaignCount(null); return; }
    let cancelled = false;
    (async () => {
      const { count, error } = await earnDb
        .from('brand_campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', selected.id);
      if (cancelled) return;
      if (error) {
        console.error('[EarnBrands] campaign count error', error);
        setCampaignCount(null);
      } else {
        setCampaignCount(count ?? 0);
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const stats = useMemo(() => {
    const active = rows.filter(r => r.status === 'active');
    return {
      totalActive: active.length,
      mrr: active.reduce((s, r) => s + (Number(r.plan_price) || 0), 0),
      total: rows.length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === 'All') return rows;
    return rows.filter(r => r.status === tab.toLowerCase());
  }, [rows, tab]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-[#C9A84C]/30 pb-4">
          <h1 className="text-3xl font-bold text-[#C9A84C]">🏢 Brands</h1>
          <p className="text-sm text-white/60 mt-1">Brand accounts, subscriptions, and campaign counts.</p>
        </header>

        {!earnDb && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Dynasty Earn database not connected.</div>
              <div className="text-sm text-amber-100/80">
                Add <code>VITE_DYNASTY_EARN_SUPABASE_URL</code> and{' '}
                <code>VITE_DYNASTY_EARN_SUPABASE_KEY</code> to Dynasty OS project secrets.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Active Brands', value: stats.totalActive.toLocaleString(), color: 'text-green-400' },
            { label: 'Monthly Recurring Revenue', value: fmtMoney(stats.mrr), color: 'text-[#C9A84C]' },
            { label: 'Total Brands', value: stats.total.toLocaleString() },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wider text-white/50">{s.label}</div>
              <div className={`mt-2 text-2xl font-bold ${s.color ?? 'text-white'}`}>{loading ? '—' : s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-sm border transition ${
                tab === t ? 'bg-[#C9A84C] text-black border-[#C9A84C]' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
              }`}
            >{t}</button>
          ))}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-2 text-left">Brand</th>
                  <th className="px-4 py-2 text-left">Contact</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Plan</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Monthly</th>
                  <th className="px-4 py-2 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-white/40">
                    No brands yet. Brands apply at dynastyearn.com/brands
                  </td></tr>
                )}
                {!loading && filtered.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="border-t border-white/5 hover:bg-white/5 cursor-pointer">
                    <td className="px-4 py-3 font-medium">{r.brand_name ?? '—'}</td>
                    <td className="px-4 py-3 text-white/70">{r.contact_name ?? '—'}</td>
                    <td className="px-4 py-3 text-white/70">{r.email ?? '—'}</td>
                    <td className="px-4 py-3"><Badge className={planClass(r.plan)}>{r.plan ?? '—'}</Badge></td>
                    <td className="px-4 py-3"><Badge className={statusClass(r.status)}>{r.status ?? '—'}</Badge></td>
                    <td className="px-4 py-3 text-right font-mono text-[#C9A84C]">{fmtMoney(r.plan_price)}</td>
                    <td className="px-4 py-3 text-white/60">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSelected(null)} />
          <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-[#111] border-l border-white/10 z-50 overflow-y-auto">
            <div className="p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#C9A84C]">{selected.brand_name ?? 'Unnamed brand'}</h2>
                  <p className="text-xs text-white/50">Since {fmtDate(selected.created_at)}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/60 hover:text-white"><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white/50">Contact</span><span>{selected.contact_name ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Email</span><span>{selected.email ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Phone</span><span>{selected.phone ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Industry</span><span>{selected.industry ?? '—'}</span></div>
                <div className="flex justify-between items-center"><span className="text-white/50">Plan</span><Badge className={planClass(selected.plan)}>{selected.plan ?? '—'}</Badge></div>
                <div className="flex justify-between"><span className="text-white/50">Plan price</span><span className="font-mono text-[#C9A84C]">{fmtMoney(selected.plan_price)}</span></div>
                <div className="flex justify-between items-center"><span className="text-white/50">Status</span><Badge className={statusClass(selected.status)}>{selected.status ?? '—'}</Badge></div>
                <div className="flex justify-between"><span className="text-white/50">Campaigns</span><span className="font-mono">{campaignCount ?? '…'}</span></div>
              </div>

              <div className="rounded border border-white/10 p-3 space-y-1.5 bg-white/[0.02]">
                <div className="text-xs uppercase tracking-wider text-white/50">Stripe</div>
                <div className="flex justify-between text-xs"><span className="text-white/50">Customer</span><span className="font-mono" title={selected.stripe_customer_id ?? ''}>{truncate(selected.stripe_customer_id, 20)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/50">Subscription</span><span className="font-mono" title={selected.stripe_subscription_id ?? ''}>{truncate(selected.stripe_subscription_id, 20)}</span></div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
