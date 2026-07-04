/**
 * Dynasty Earn — Programs management (inline-editable commission rates)
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { earnDb } from '@/lib/dynastyEarnClient';

type Program = {
  id: string;
  business_name: string | null;
  description: string | null;
  commission_rate: number | null;
  commission_type: string | null;
  category: string | null;
  is_active: boolean | null;
  created_at: string;
};

const categoryClass = (c: string | null) => {
  switch (c) {
    case 'luxury': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'events': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'distribution': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'digital': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'services': return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    case 'technology': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    case 'entertainment': return 'bg-pink-500/20 text-pink-300 border-pink-500/40';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
};

const Badge = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>{children}</span>
);

const COMMISSION_TYPES = ['percentage', 'flat', 'tiered'] as const;

export default function EarnPrograms() {
  const [rows, setRows] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    business_name: '',
    description: '',
    commission_rate: '',
    commission_type: 'percentage' as string,
    category: '',
    is_active: true,
  });

  const load = useCallback(async () => {
    if (!earnDb) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await earnDb
      .from('earn_programs')
      .select('id, business_name, description, commission_rate, commission_type, category, is_active, created_at')
      .order('commission_rate', { ascending: false });
    if (error) { toast.error(`Load failed: ${error.message}`); setRows([]); }
    else setRows((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const active = rows.filter(r => r.is_active);
    const avg = active.length
      ? active.reduce((s, r) => s + (Number(r.commission_rate) || 0), 0) / active.length
      : 0;
    return { active: active.length, avg };
  }, [rows]);

  const saveRate = async (p: Program) => {
    if (!earnDb) return;
    const val = parseFloat(editValue);
    setEditingId(null);
    if (isNaN(val) || val === Number(p.commission_rate)) return;
    const { error } = await earnDb.from('earn_programs').update({ commission_rate: val }).eq('id', p.id);
    if (error) { toast.error(`Update failed: ${error.message}`); return; }
    toast.success('Rate updated');
    void load();
  };

  const toggleActive = async (p: Program) => {
    if (!earnDb) return;
    const next = !p.is_active;
    const { error } = await earnDb.from('earn_programs').update({ is_active: next }).eq('id', p.id);
    if (error) { toast.error(`Toggle failed: ${error.message}`); return; }
    toast.success(next ? 'Program activated' : 'Program deactivated');
    void load();
  };

  const submitAdd = async () => {
    if (!earnDb) return;
    if (!form.business_name.trim() || !form.commission_rate) {
      toast.error('Business name and commission rate are required');
      return;
    }
    setSaving(true);
    const { error } = await earnDb.from('earn_programs').insert({
      business_name: form.business_name.trim(),
      description: form.description.trim() || null,
      commission_rate: parseFloat(form.commission_rate),
      commission_type: form.commission_type,
      category: form.category.trim() || null,
      is_active: form.is_active,
    });
    setSaving(false);
    if (error) { toast.error(`Insert failed: ${error.message}`); return; }
    toast.success('Program added');
    setShowAdd(false);
    setForm({ business_name: '', description: '', commission_rate: '', commission_type: 'percentage', category: '', is_active: true });
    void load();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-[#C9A84C]/30 pb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#C9A84C]">🎯 Programs</h1>
            <p className="text-sm text-white/60 mt-1">Dynasty affiliate programs and commission rates.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            disabled={!earnDb}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#C9A84C] text-black text-sm font-semibold hover:brightness-110 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Add Program
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Active Programs</div>
            <div className="mt-2 text-2xl font-bold text-green-400">{loading ? '—' : stats.active}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Avg Commission</div>
            <div className="mt-2 text-2xl font-bold text-[#C9A84C]">{loading ? '—' : `${stats.avg.toFixed(1)}%`}</div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-2 text-left">Business</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-right">Commission</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-center">Active</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">
                    No programs. The 7 Dynasty businesses are pre-seeded.
                  </td></tr>
                )}
                {!loading && rows.map(p => (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.business_name ?? '—'}</div>
                      {p.description && <div className="text-xs text-white/50 mt-0.5 line-clamp-1">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3"><Badge className={categoryClass(p.category)}>{p.category ?? '—'}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {editingId === p.id ? (
                        <input
                          autoFocus
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveRate(p)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingId(null); }}
                          className="w-20 px-2 py-1 rounded bg-white/10 border border-[#C9A84C]/60 text-right font-mono text-[#C9A84C]"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingId(p.id); setEditValue(String(p.commission_rate ?? '')); }}
                          className="font-mono font-bold text-[#C9A84C] hover:underline"
                        >
                          {p.commission_rate != null ? `${Number(p.commission_rate).toFixed(1)}%` : '—'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70 capitalize">{p.commission_type ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(p)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${p.is_active ? 'bg-green-500/60' : 'bg-white/20'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${p.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Program Modal */}
      {showAdd && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => !saving && setShowAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-lg bg-[#111] border border-white/10 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-bold text-[#C9A84C]">Add Program</h2>
                <button onClick={() => !saving && setShowAdd(false)} className="text-white/60 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60">Business name *</label>
                  <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} className="mt-1 w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-white/60">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60">Commission rate *</label>
                    <input type="number" step="0.1" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: e.target.value })} className="mt-1 w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Commission type</label>
                    <select value={form.commission_type} onChange={e => setForm({ ...form, commission_type: e.target.value })} className="mt-1 w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm">
                      {COMMISSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/60">Category</label>
                  <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="luxury, events, digital…" className="mt-1 w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  Active
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button disabled={saving} onClick={() => setShowAdd(false)} className="px-3 py-2 rounded border border-white/10 text-white/70 text-sm">Cancel</button>
                <button disabled={saving} onClick={submitAdd} className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#C9A84C] text-black text-sm font-semibold disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add Program
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
