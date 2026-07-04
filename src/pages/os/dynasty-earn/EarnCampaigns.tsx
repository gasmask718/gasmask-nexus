/**
 * Dynasty Earn — Brand Campaigns and deliverables
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Plus, Loader2, X, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { earnDb } from '@/lib/dynastyEarnClient';

type Campaign = {
  id: string;
  brand_id: string | null;
  name: string | null;
  description: string | null;
  budget: number | null;
  spent: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  deliverables: string | null;
  created_at: string;
  brand_accounts?: { business_name: string | null } | null;
};

type Brand = { id: string; business_name: string | null };

const fmtMoney = (n: number | null | undefined) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const statusClass = (s: string | null) => {
  switch (s) {
    case 'draft': return 'bg-white/10 text-white/60 border-white/20';
    case 'active': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'paused': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'completed': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'cancelled': return 'bg-red-500/20 text-red-300 border-red-500/40';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
};

const Badge = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>{children}</span>
);

const TABS = ['All', 'Draft', 'Active', 'Paused', 'Completed'] as const;
type Tab = typeof TABS[number];

export default function EarnCampaigns() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('All');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    brand_id: '',
    name: '',
    description: '',
    budget: '',
    status: 'draft',
    start_date: '',
    end_date: '',
    deliverables: '',
  });

  const load = useCallback(async () => {
    if (!earnDb) { setLoading(false); return; }
    setLoading(true);
    const [cRes, bRes] = await Promise.all([
      earnDb
        .from('brand_campaigns')
        .select('id, brand_id, name, description, budget, spent, status, start_date, end_date, deliverables, created_at, brand_accounts!brand_id(business_name)')
        .order('created_at', { ascending: false }),
      earnDb.from('brand_accounts').select('id, business_name').order('business_name', { ascending: true }),
    ]);
    if (cRes.error) { toast.error(`Load failed: ${cRes.error.message}`); setRows([]); }
    else setRows((cRes.data ?? []) as any);
    if (!bRes.error) setBrands((bRes.data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const active = rows.filter(r => r.status === 'active');
    const totalBudget = rows.reduce((s, r) => s + (Number(r.budget) || 0), 0);
    const totalSpent = rows.reduce((s, r) => s + (Number(r.spent) || 0), 0);
    return {
      total: rows.length,
      activeCount: active.length,
      totalBudget,
      totalSpent,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === 'All') return rows;
    return rows.filter(r => r.status === tab.toLowerCase());
  }, [rows, tab]);

  const setStatus = async (c: Campaign, next: string) => {
    if (!earnDb) return;
    setBusyId(c.id);
    const { error } = await earnDb.from('brand_campaigns').update({ status: next }).eq('id', c.id);
    setBusyId(null);
    if (error) { toast.error(`Update failed: ${error.message}`); return; }
    toast.success(`Campaign ${next}`);
    void load();
  };

  const submitAdd = async () => {
    if (!earnDb) return;
    if (!form.brand_id) { toast.error('Brand is required'); return; }
    if (!form.name.trim()) { toast.error('Campaign name is required'); return; }
    setSaving(true);
    const payload: any = {
      brand_id: form.brand_id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      budget: form.budget ? Number(form.budget) : null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      deliverables: form.deliverables.trim() || null,
    };
    const { error } = await earnDb.from('brand_campaigns').insert(payload);
    setSaving(false);
    if (error) { toast.error(`Create failed: ${error.message}`); return; }
    toast.success('Campaign created');
    setShowAdd(false);
    setForm({ brand_id: '', name: '', description: '', budget: '', status: 'draft', start_date: '', end_date: '', deliverables: '' });
    void load();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-[#C9A84C]/30 pb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#C9A84C] flex items-center gap-2"><Megaphone className="h-7 w-7" /> Campaigns</h1>
            <p className="text-sm text-white/60 mt-1">Active brand campaigns and deliverables.</p>
          </div>
          <button
            disabled={!earnDb}
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#C9A84C] text-black font-semibold hover:bg-[#d9b85c] disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Add Campaign
          </button>
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
            <div className="text-xs uppercase tracking-wider text-white/50">Total Campaigns</div>
            <div className="mt-2 text-2xl font-bold">{loading ? '—' : stats.total.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Active</div>
            <div className="mt-2 text-2xl font-bold text-green-400">{loading ? '—' : stats.activeCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Total Budget</div>
            <div className="mt-2 text-2xl font-bold text-[#C9A84C] font-mono">{loading ? '—' : fmtMoney(stats.totalBudget)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Total Spent</div>
            <div className="mt-2 text-2xl font-bold font-mono">{loading ? '—' : fmtMoney(stats.totalSpent)}</div>
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
                  <th className="px-4 py-2 text-left">Campaign</th>
                  <th className="px-4 py-2 text-left">Brand</th>
                  <th className="px-4 py-2 text-right">Budget</th>
                  <th className="px-4 py-2 text-right">Spent</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Dates</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-white/40">No campaigns yet.</td></tr>
                )}
                {!loading && filtered.map(c => (
                  <tr key={c.id} className="border-t border-white/5 hover:bg-white/5 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name ?? '—'}</div>
                      {c.deliverables && (
                        <div className="text-xs text-white/50 mt-0.5 line-clamp-2 max-w-md">{c.deliverables}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">{c.brand_accounts?.business_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(c.budget)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#C9A84C]">{fmtMoney(c.spent)}</td>
                    <td className="px-4 py-3"><Badge className={statusClass(c.status)}>{c.status ?? '—'}</Badge></td>
                    <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">
                      {fmtDate(c.start_date)} <span className="text-white/30">→</span> {fmtDate(c.end_date)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        {(c.status === 'draft' || c.status === 'paused') && (
                          <button
                            disabled={busyId === c.id}
                            onClick={() => setStatus(c, 'active')}
                            className="px-2 py-1 rounded bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 disabled:opacity-50 text-xs"
                          >
                            {busyId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Activate'}
                          </button>
                        )}
                        {c.status === 'active' && (
                          <>
                            <button
                              disabled={busyId === c.id}
                              onClick={() => setStatus(c, 'paused')}
                              className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/30 disabled:opacity-50 text-xs"
                            >Pause</button>
                            <button
                              disabled={busyId === c.id}
                              onClick={() => setStatus(c, 'completed')}
                              className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 disabled:opacity-50 text-xs"
                            >Complete</button>
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

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => !saving && setShowAdd(false)}>
          <div className="w-full max-w-lg rounded-lg border border-[#C9A84C]/40 bg-[#0A0A0A] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#C9A84C]">New Campaign</h2>
              <button onClick={() => !saving && setShowAdd(false)} className="text-white/50 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/60 mb-1">Brand *</label>
                <select
                  value={form.brand_id}
                  onChange={e => setForm({ ...form, brand_id: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm"
                >
                  <option value="">— Select brand —</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.business_name ?? b.id}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Budget ($)</label>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={e => setForm({ ...form, budget: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm"
                  >
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Start date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">End date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Deliverables</label>
                <textarea
                  value={form.deliverables}
                  onChange={e => setForm({ ...form, deliverables: e.target.value })}
                  rows={3}
                  placeholder="e.g. 3 IG reels, 1 TikTok, 2 stories"
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={saving}
                onClick={() => setShowAdd(false)}
                className="px-3 py-2 rounded border border-white/20 text-white/70 hover:bg-white/5 text-sm"
              >Cancel</button>
              <button
                disabled={saving}
                onClick={submitAdd}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#C9A84C] text-black font-semibold hover:bg-[#d9b85c] disabled:opacity-50 text-sm"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
