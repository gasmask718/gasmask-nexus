/**
 * Dynasty Earn — Earners management
 * Reads/writes exclusively via earnDb (Dynasty Earn Supabase project).
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Search, X, Check, Ban, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { earnDb } from '@/lib/dynastyEarnClient';

type Earner = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  rank: string | null;
  status: string | null;
  referral_code: string | null;
  total_earnings: number | null;
  total_sales: number | null;
  created_at: string;
};

type CommissionRow = {
  commission_amount: number | null;
  sale_amount: number | null;
  status: string | null;
  created_at: string;
  earn_programs?: { business_name: string | null } | null;
};

const fmtMoney = (n: number | null | undefined) =>
  '$' +
  (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const roleClass = (r: string | null) => {
  switch (r) {
    case 'affiliate': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'sales_agent': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'team_builder': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'creator': return 'bg-pink-500/20 text-pink-300 border-pink-500/40';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
};

const statusClass = (s: string | null) => {
  switch (s) {
    case 'pending': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'active': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'suspended': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'inactive': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
};

const Badge = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
    {children}
  </span>
);

const TABS = ['All', 'Pending', 'Active', 'Suspended', 'Inactive'] as const;
type Tab = typeof TABS[number];

export default function EarnEarners() {
  const [rows, setRows] = useState<Earner[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Earner | null>(null);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [commLoading, setCommLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspend, setShowSuspend] = useState(false);

  const load = useCallback(async () => {
    if (!earnDb) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await earnDb
      .from('earners')
      .select('id, full_name, email, phone, role, rank, status, referral_code, total_earnings, total_sales, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Failed to load earners: ${error.message}`);
      setRows([]);
    } else {
      setRows((data ?? []) as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadCommissions = useCallback(async (earnerId: string) => {
    if (!earnDb) return;
    setCommLoading(true);
    const { data, error } = await earnDb
      .from('commissions')
      .select('commission_amount, sale_amount, status, created_at, earn_programs!program_id(business_name)')
      .eq('earner_id', earnerId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) {
      toast.error(`Failed to load commissions: ${error.message}`);
      setCommissions([]);
    } else {
      setCommissions((data ?? []) as any);
    }
    setCommLoading(false);
  }, []);

  useEffect(() => {
    if (selected) {
      void loadCommissions(selected.id);
      setShowSuspend(false);
      setSuspendReason('');
    }
  }, [selected, loadCommissions]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(r => r.status === 'active').length;
    const pending = rows.filter(r => r.status === 'pending').length;
    const totalPaid = rows.reduce((s, r) => s + (Number(r.total_earnings) || 0), 0);
    return { total, active, pending, totalPaid };
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (tab !== 'All') out = out.filter(r => r.status === tab.toLowerCase());
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(r =>
        (r.full_name ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, tab, search]);

  const updateStatus = async (id: string, next: string, successMsg: string) => {
    if (!earnDb) return;
    setBusy(true);
    const { error } = await earnDb.from('earners').update({ status: next }).eq('id', id);
    setBusy(false);
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    toast.success(successMsg);
    setSelected(prev => prev ? { ...prev, status: next } : prev);
    void load();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-[#C9A84C]/30 pb-4">
          <h1 className="text-3xl font-bold text-[#C9A84C]">👥 Earners</h1>
          <p className="text-sm text-white/60 mt-1">
            Affiliates, sales agents, team builders and creators driving Dynasty revenue.
          </p>
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

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Earners', value: stats.total.toLocaleString() },
            { label: 'Active', value: stats.active.toLocaleString(), color: 'text-green-400' },
            { label: 'Pending', value: stats.pending.toLocaleString(), color: 'text-yellow-400' },
            { label: 'Total Earnings Paid', value: fmtMoney(stats.totalPaid), color: 'text-[#C9A84C]' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wider text-white/50">{s.label}</div>
              <div className={`mt-2 text-2xl font-bold ${s.color ?? 'text-white'}`}>
                {loading ? '—' : s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded text-sm border transition ${
                  tab === t
                    ? 'bg-[#C9A84C] text-black border-[#C9A84C]'
                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                }`}
              >{t}</button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="pl-8 pr-3 py-2 rounded bg-white/5 border border-white/10 text-sm w-full md:w-64 focus:outline-none focus:border-[#C9A84C]/60"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Rank</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Total Earnings</th>
                  <th className="px-4 py-2 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-white/40">
                    No earners yet. Applications will appear here when submitted at dynastyearn.com
                  </td></tr>
                )}
                {!loading && filtered.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium">{r.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-white/70">{r.email ?? '—'}</td>
                    <td className="px-4 py-3"><Badge className={roleClass(r.role)}>{r.role ?? '—'}</Badge></td>
                    <td className="px-4 py-3"><Badge className="bg-white/10 text-white/70 border-white/20">{r.rank ?? '—'}</Badge></td>
                    <td className="px-4 py-3"><Badge className={statusClass(r.status)}>{r.status ?? '—'}</Badge></td>
                    <td className="px-4 py-3 text-right font-mono text-[#C9A84C]">{fmtMoney(r.total_earnings)}</td>
                    <td className="px-4 py-3 text-white/60">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-over */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSelected(null)} />
          <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-[#111] border-l border-white/10 z-50 overflow-y-auto">
            <div className="p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#C9A84C]">{selected.full_name ?? 'Unnamed'}</h2>
                  <p className="text-xs text-white/50">Member since {fmtDate(selected.created_at)}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/60 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white/50">Email</span><span>{selected.email ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Phone</span><span>{selected.phone ?? '—'}</span></div>
                <div className="flex justify-between items-center"><span className="text-white/50">Role</span><Badge className={roleClass(selected.role)}>{selected.role ?? '—'}</Badge></div>
                <div className="flex justify-between items-center"><span className="text-white/50">Rank</span><Badge className="bg-white/10 text-white/70 border-white/20">{selected.rank ?? '—'}</Badge></div>
                <div className="flex justify-between items-center"><span className="text-white/50">Status</span><Badge className={statusClass(selected.status)}>{selected.status ?? '—'}</Badge></div>
                <div className="flex justify-between"><span className="text-white/50">Referral code</span><span className="font-mono text-[#C9A84C]">{selected.referral_code ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Total earnings</span><span className="font-mono text-[#C9A84C]">{fmtMoney(selected.total_earnings)}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Total sales</span><span className="font-mono">{fmtMoney(selected.total_sales)}</span></div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {selected.status === 'pending' && (
                  <button
                    disabled={busy}
                    onClick={() => updateStatus(selected.id, 'active', 'Earner approved')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 disabled:opacity-50 text-sm"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                  </button>
                )}
                {selected.status === 'active' && !showSuspend && (
                  <button
                    disabled={busy}
                    onClick={() => setShowSuspend(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 text-sm"
                  >
                    <Ban className="h-4 w-4" /> Suspend
                  </button>
                )}
                {selected.status === 'suspended' && (
                  <button
                    disabled={busy}
                    onClick={() => updateStatus(selected.id, 'active', 'Earner reactivated')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 text-sm"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reactivate
                  </button>
                )}
              </div>

              {showSuspend && (
                <div className="rounded border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                  <label className="text-xs text-white/60">Reason (optional, logged locally)</label>
                  <input
                    value={suspendReason}
                    onChange={e => setSuspendReason(e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm"
                    placeholder="Reason for suspension"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (suspendReason) console.info('[EarnEarners] suspend reason', selected.id, suspendReason);
                        void updateStatus(selected.id, 'suspended', 'Earner suspended');
                      }}
                      className="px-3 py-1.5 rounded bg-red-500/30 border border-red-500/50 text-red-100 text-sm"
                    >Confirm suspend</button>
                    <button onClick={() => { setShowSuspend(false); setSuspendReason(''); }} className="px-3 py-1.5 rounded border border-white/10 text-white/70 text-sm">Cancel</button>
                  </div>
                </div>
              )}

              {/* Commission history */}
              <div>
                <h3 className="text-sm font-semibold text-white/80 mb-2">Recent commissions</h3>
                <div className="rounded border border-white/10 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-white/5 text-white/50 uppercase tracking-wider">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Program</th>
                        <th className="px-2 py-1.5 text-right">Sale</th>
                        <th className="px-2 py-1.5 text-right">Commission</th>
                        <th className="px-2 py-1.5 text-left">Status</th>
                        <th className="px-2 py-1.5 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commLoading && <tr><td colSpan={5} className="px-2 py-3 text-center text-white/40">Loading…</td></tr>}
                      {!commLoading && commissions.length === 0 && (
                        <tr><td colSpan={5} className="px-2 py-3 text-center text-white/40">No commissions.</td></tr>
                      )}
                      {!commLoading && commissions.map((c, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="px-2 py-1.5">{c.earn_programs?.business_name ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(c.sale_amount)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-[#C9A84C]">{fmtMoney(c.commission_amount)}</td>
                          <td className="px-2 py-1.5"><Badge className={statusClass(c.status)}>{c.status ?? '—'}</Badge></td>
                          <td className="px-2 py-1.5 text-white/60">{fmtDate(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
