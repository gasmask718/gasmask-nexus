/**
 * Dynasty Earn — Payouts ledger and processing
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Check, Loader2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { earnDb } from '@/lib/dynastyEarnClient';

type Payout = {
  id: string;
  earner_id: string | null;
  amount: number | null;
  method: string | null;
  status: string | null;
  reference: string | null;
  notes: string | null;
  requested_at: string | null;
  processed_at: string | null;
  created_at: string;
  earners?: { full_name: string | null; email: string | null } | null;
};

const fmtMoney = (n: number | null | undefined) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const statusClass = (s: string | null) => {
  switch (s) {
    case 'requested': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'processing': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'paid': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'failed': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'cancelled': return 'bg-white/10 text-white/60 border-white/20';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
};

const Badge = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>{children}</span>
);

const TABS = ['All', 'Requested', 'Processing', 'Paid', 'Failed'] as const;
type Tab = typeof TABS[number];

export default function EarnPayouts() {
  const [rows, setRows] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('All');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmPay, setConfirmPay] = useState<Payout | null>(null);
  const [payRef, setPayRef] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!earnDb) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await earnDb
      .from('payouts')
      .select('id, earner_id, amount, method, status, reference, notes, requested_at, processed_at, created_at, earners!earner_id(full_name, email)')
      .order('created_at', { ascending: false });
    if (error) { toast.error(`Load failed: ${error.message}`); setRows([]); }
    else setRows((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const sum = (arr: Payout[]) => arr.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const requested = rows.filter(r => r.status === 'requested');
    const processing = rows.filter(r => r.status === 'processing');
    const paid = rows.filter(r => r.status === 'paid');
    return {
      total: rows.length,
      requestedCount: requested.length, requestedSum: sum(requested),
      processingSum: sum(processing),
      paidSum: sum(paid),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === 'All') return rows;
    return rows.filter(r => r.status === tab.toLowerCase());
  }, [rows, tab]);

  const setStatus = async (p: Payout, next: string, extra: Record<string, any> = {}) => {
    if (!earnDb) return;
    setBusyId(p.id);
    const patch: any = { status: next, ...extra };
    const { error } = await earnDb.from('payouts').update(patch).eq('id', p.id);
    setBusyId(null);
    if (error) { toast.error(`Update failed: ${error.message}`); return false; }
    return true;
  };

  const startProcessing = async (p: Payout) => {
    const ok = await setStatus(p, 'processing');
    if (ok) { toast.success('Payout moved to processing'); void load(); }
  };

  const markFailed = async (p: Payout) => {
    const ok = await setStatus(p, 'failed');
    if (ok) { toast.success('Payout marked failed'); void load(); }
  };

  const confirmMarkPaid = async () => {
    if (!earnDb || !confirmPay) return;
    setSaving(true);
    const { error } = await earnDb.from('payouts').update({
      status: 'paid',
      reference: payRef.trim() || null,
      processed_at: new Date().toISOString(),
    }).eq('id', confirmPay.id);
    setSaving(false);
    if (error) { toast.error(`Mark paid failed: ${error.message}`); return; }
    toast.success('Payout marked paid');
    setConfirmPay(null);
    setPayRef('');
    void load();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-[#C9A84C]/30 pb-4">
          <h1 className="text-3xl font-bold text-[#C9A84C] flex items-center gap-2"><Wallet className="h-7 w-7" /> Payouts</h1>
          <p className="text-sm text-white/60 mt-1">Earner payout requests, processing queue and paid ledger.</p>
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
            <div className="text-xs uppercase tracking-wider text-white/50">Total Payouts</div>
            <div className="mt-2 text-2xl font-bold">{loading ? '—' : stats.total.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Requested</div>
            <div className="mt-2 text-2xl font-bold text-yellow-400">{loading ? '—' : stats.requestedCount}</div>
            <div className="text-xs text-yellow-300/70 font-mono">{fmtMoney(stats.requestedSum)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Processing</div>
            <div className="mt-2 text-2xl font-bold text-blue-400 font-mono">{loading ? '—' : fmtMoney(stats.processingSum)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Paid Out</div>
            <div className="mt-2 text-2xl font-bold text-[#C9A84C] font-mono">{loading ? '—' : fmtMoney(stats.paidSum)}</div>
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
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Method</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Reference</th>
                  <th className="px-4 py-2 text-left">Requested</th>
                  <th className="px-4 py-2 text-left">Processed</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-white/40">No payouts yet.</td></tr>
                )}
                {!loading && filtered.map(p => (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/5 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.earners?.full_name ?? '—'}</div>
                      {p.earners?.email && <div className="text-xs text-white/50">{p.earners.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#C9A84C]">{fmtMoney(p.amount)}</td>
                    <td className="px-4 py-3 text-white/70">{p.method ?? '—'}</td>
                    <td className="px-4 py-3"><Badge className={statusClass(p.status)}>{p.status ?? '—'}</Badge></td>
                    <td className="px-4 py-3 text-white/60 font-mono text-xs">{p.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">{fmtDate(p.requested_at ?? p.created_at)}</td>
                    <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">{fmtDate(p.processed_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        {p.status === 'requested' && (
                          <button
                            disabled={busyId === p.id}
                            onClick={() => startProcessing(p)}
                            className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 disabled:opacity-50 text-xs"
                          >
                            {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Process'}
                          </button>
                        )}
                        {(p.status === 'requested' || p.status === 'processing') && (
                          <>
                            <button
                              disabled={busyId === p.id}
                              onClick={() => { setConfirmPay(p); setPayRef(p.reference ?? ''); }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 disabled:opacity-50 text-xs"
                            >
                              <Check className="h-3 w-3" /> Mark Paid
                            </button>
                            <button
                              disabled={busyId === p.id}
                              onClick={() => markFailed(p)}
                              className="px-2 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50 text-xs"
                            >Fail</button>
                          </>
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

      {confirmPay && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => !saving && setConfirmPay(null)}>
          <div className="w-full max-w-md rounded-lg border border-[#C9A84C]/40 bg-[#0A0A0A] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#C9A84C]">Confirm Payout</h2>
              <button onClick={() => !saving && setConfirmPay(null)} className="text-white/50 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-white/5 border border-white/10">
                <div>
                  <div className="text-xs text-white/50">Earner</div>
                  <div className="font-medium">{confirmPay.earners?.full_name ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50">Amount</div>
                  <div className="font-mono text-[#C9A84C]">{fmtMoney(confirmPay.amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50">Method</div>
                  <div>{confirmPay.method ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50">Requested</div>
                  <div>{fmtDate(confirmPay.requested_at ?? confirmPay.created_at)}</div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Reference / Transaction ID</label>
                <input
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="e.g. Stripe tr_xxx / PayPal batch id"
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={saving}
                onClick={() => setConfirmPay(null)}
                className="px-3 py-2 rounded border border-white/20 text-white/70 hover:bg-white/5 text-sm"
              >Cancel</button>
              <button
                disabled={saving}
                onClick={confirmMarkPaid}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-green-500 text-black font-semibold hover:bg-green-400 disabled:opacity-50 text-sm"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
