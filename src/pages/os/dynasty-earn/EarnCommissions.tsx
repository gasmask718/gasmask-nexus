/**
 * Dynasty Earn — Commissions ledger and approval flow
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Check, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { earnDb } from '@/lib/dynastyEarnClient';

type Commission = {
  id: string;
  earner_id: string | null;
  program_id: string | null;
  sale_amount: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  l1_override_amount: number | null;
  l2_override_amount: number | null;
  status: string | null;
  created_at: string;
  earners?: { full_name: string | null } | null;
  earn_programs?: { business_name: string | null } | null;
};

const fmtMoney = (n: number | null | undefined) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const statusClass = (s: string | null) => {
  switch (s) {
    case 'pending': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'approved': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'paid': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    case 'cancelled': return 'bg-red-500/20 text-red-300 border-red-500/40';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
};

const Badge = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>{children}</span>
);

const TABS = ['All', 'Pending', 'Approved', 'Paid'] as const;
type Tab = typeof TABS[number];

export default function EarnCommissions() {
  const [rows, setRows] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('All');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!earnDb) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await earnDb
      .from('commissions')
      .select('id, earner_id, program_id, sale_amount, commission_rate, commission_amount, l1_override_amount, l2_override_amount, status, created_at, earners!earner_id(full_name), earn_programs!program_id(business_name)')
      .order('created_at', { ascending: false });
    if (error) { toast.error(`Load failed: ${error.message}`); setRows([]); }
    else setRows((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const sum = (arr: Commission[]) => arr.reduce((s, r) => s + (Number(r.commission_amount) || 0), 0);
    const pending = rows.filter(r => r.status === 'pending');
    const approved = rows.filter(r => r.status === 'approved');
    const paid = rows.filter(r => r.status === 'paid');
    return {
      total: rows.length,
      pendingCount: pending.length, pendingSum: sum(pending),
      approvedCount: approved.length, approvedSum: sum(approved),
      paidSum: sum(paid),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === 'All') return rows;
    return rows.filter(r => r.status === tab.toLowerCase());
  }, [rows, tab]);

  const approve = async (c: Commission) => {
    if (!earnDb) return;
    setBusyId(c.id);
    const { error } = await earnDb.from('commissions').update({ status: 'approved' }).eq('id', c.id);
    setBusyId(null);
    if (error) { toast.error(`Approve failed: ${error.message}`); return; }
    toast.success('Commission approved');
    void load();
  };

  const markPaid = async (c: Commission) => {
    if (!earnDb) return;
    setBusyId(c.id);
    const { error } = await earnDb.from('commissions').update({ status: 'paid' }).eq('id', c.id);
    if (error) { setBusyId(null); toast.error(`Mark paid failed: ${error.message}`); return; }

    // Client-side increment of earner total_earnings
    if (c.earner_id && c.commission_amount != null) {
      const { data: earner, error: readErr } = await earnDb
        .from('earners')
        .select('total_earnings')
        .eq('id', c.earner_id)
        .maybeSingle();
      if (readErr) {
        console.error('[EarnCommissions] earner read failed', readErr);
      } else {
        const current = Number(earner?.total_earnings ?? 0);
        const next = current + Number(c.commission_amount);
        const { error: updErr } = await earnDb.from('earners').update({ total_earnings: next }).eq('id', c.earner_id);
        if (updErr) console.error('[EarnCommissions] earner update failed', updErr);
      }
    }

    setBusyId(null);
    toast.success('Commission paid and earner updated');
    void load();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-[#C9A84C]/30 pb-4">
          <h1 className="text-3xl font-bold text-[#C9A84C]">💵 Commissions</h1>
          <p className="text-sm text-white/60 mt-1">Approve, pay out and audit every commission event.</p>
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Total Commissions</div>
            <div className="mt-2 text-2xl font-bold">{loading ? '—' : stats.total.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Pending</div>
            <div className="mt-2 text-2xl font-bold text-yellow-400">{loading ? '—' : stats.pendingCount}</div>
            <div className="text-xs text-yellow-300/70 font-mono">{fmtMoney(stats.pendingSum)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Approved</div>
            <div className="mt-2 text-2xl font-bold text-green-400">{loading ? '—' : stats.approvedCount}</div>
            <div className="text-xs text-green-300/70 font-mono">{fmtMoney(stats.approvedSum)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Paid Out</div>
            <div className="mt-2 text-2xl font-bold text-[#C9A84C]">{loading ? '—' : fmtMoney(stats.paidSum)}</div>
          </div>
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
                  <th className="px-4 py-2 text-left">Earner</th>
                  <th className="px-4 py-2 text-left">Program</th>
                  <th className="px-4 py-2 text-right">Sale</th>
                  <th className="px-4 py-2 text-right">Commission</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-white/40">No commissions yet.</td></tr>
                )}
                {!loading && filtered.map(c => (
                  <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">{c.earners?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-white/70">{c.earn_programs?.business_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(c.sale_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#C9A84C]">{fmtMoney(c.commission_amount)}</td>
                    <td className="px-4 py-3"><Badge className={statusClass(c.status)}>{c.status ?? '—'}</Badge></td>
                    <td className="px-4 py-3 text-white/60">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        {c.status === 'pending' && (
                          <button
                            disabled={busyId === c.id}
                            onClick={() => approve(c)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 disabled:opacity-50 text-xs"
                          >
                            {busyId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
                          </button>
                        )}
                        {c.status === 'approved' && (
                          <button
                            disabled={busyId === c.id}
                            onClick={() => markPaid(c)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40 hover:bg-[#C9A84C]/30 disabled:opacity-50 text-xs"
                          >
                            {busyId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />} Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
