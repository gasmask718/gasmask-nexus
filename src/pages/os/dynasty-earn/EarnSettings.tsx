/**
 * Dynasty Earn — Settings & database connection health
 */
import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Settings as SettingsIcon, Database, Save } from 'lucide-react';
import { toast } from 'sonner';
import { earnDb, isEarnConnected } from '@/lib/dynastyEarnClient';

const EARN_URL = import.meta.env.VITE_DYNASTY_EARN_SUPABASE_URL as string | undefined;

const DEFAULT_KEYS = [
  { key: 'default_commission_rate', label: 'Default commission rate (%)', type: 'number', placeholder: '10' },
  { key: 'l1_override_rate', label: 'L1 override rate (%)', type: 'number', placeholder: '5' },
  { key: 'l2_override_rate', label: 'L2 override rate (%)', type: 'number', placeholder: '2' },
  { key: 'min_payout_amount', label: 'Minimum payout amount ($)', type: 'number', placeholder: '50' },
  { key: 'payout_schedule', label: 'Payout schedule', type: 'text', placeholder: 'weekly | biweekly | monthly' },
  { key: 'support_email', label: 'Support email', type: 'text', placeholder: 'support@dynasty.com' },
] as const;

type Counts = Record<string, number | null>;

const TABLES = ['earners', 'brand_accounts', 'earn_programs', 'commissions', 'brand_campaigns', 'payouts'] as const;

export default function EarnSettings() {
  const [counts, setCounts] = useState<Counts>({});
  const [pinging, setPinging] = useState(false);
  const [pingOk, setPingOk] = useState<boolean | null>(null);

  const [values, setValues] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsTableExists, setSettingsTableExists] = useState(true);

  const pingAndCount = useCallback(async () => {
    if (!earnDb) { setPingOk(false); return; }
    setPinging(true);
    const results = await Promise.all(TABLES.map(async (t) => {
      const { count, error } = await earnDb.from(t).select('*', { count: 'exact', head: true });
      return [t, error ? null : (count ?? 0)] as const;
    }));
    const next: Counts = {};
    let anyOk = false;
    for (const [t, c] of results) {
      next[t] = c;
      if (c !== null) anyOk = true;
    }
    setCounts(next);
    setPingOk(anyOk);
    setPinging(false);
  }, []);

  const loadSettings = useCallback(async () => {
    if (!earnDb) { setLoadingSettings(false); return; }
    setLoadingSettings(true);
    const { data, error } = await earnDb.from('earn_settings').select('key, value');
    if (error) {
      // Table may not exist yet — show inputs but disable save gracefully
      setSettingsTableExists(false);
      setValues({});
      setInitial({});
    } else {
      setSettingsTableExists(true);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value == null ? '' : String(r.value); });
      setValues(map);
      setInitial(map);
    }
    setLoadingSettings(false);
  }, []);

  useEffect(() => { void pingAndCount(); void loadSettings(); }, [pingAndCount, loadSettings]);

  const dirty = DEFAULT_KEYS.some(k => (values[k.key] ?? '') !== (initial[k.key] ?? ''));

  const save = async () => {
    if (!earnDb) return;
    if (!settingsTableExists) { toast.error('earn_settings table does not exist in the Dynasty Earn database.'); return; }
    setSaving(true);
    const changed = DEFAULT_KEYS
      .filter(k => (values[k.key] ?? '') !== (initial[k.key] ?? ''))
      .map(k => ({ key: k.key, value: values[k.key] ?? '' }));
    if (changed.length === 0) { setSaving(false); return; }
    const { error } = await earnDb.from('earn_settings').upsert(changed, { onConflict: 'key' });
    setSaving(false);
    if (error) { toast.error(`Save failed: ${error.message}`); return; }
    toast.success(`Saved ${changed.length} setting${changed.length === 1 ? '' : 's'}`);
    setInitial({ ...values });
  };

  const connected = isEarnConnected();
  const host = (() => { try { return EARN_URL ? new URL(EARN_URL).host : '—'; } catch { return EARN_URL ?? '—'; } })();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="border-b border-[#C9A84C]/30 pb-4">
          <h1 className="text-3xl font-bold text-[#C9A84C] flex items-center gap-2"><SettingsIcon className="h-7 w-7" /> Settings</h1>
          <p className="text-sm text-white/60 mt-1">Dynasty Earn database connection, table health, and commission defaults.</p>
        </header>

        {!connected && (
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

        {/* Connection card */}
        <section className="rounded-lg border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-[#C9A84C]" />
              <h2 className="text-lg font-semibold">Database Connection</h2>
            </div>
            <button
              onClick={() => void pingAndCount()}
              disabled={pinging || !connected}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-white/20 text-white/80 hover:bg-white/10 disabled:opacity-40 text-sm"
            >
              {pinging ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Re-check
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded border border-white/10 bg-black/30 p-3">
              <div className="text-xs uppercase tracking-wider text-white/50">Status</div>
              <div className="mt-1 font-semibold flex items-center gap-1.5">
                {connected && pingOk ? (
                  <><CheckCircle2 className="h-4 w-4 text-green-400" /><span className="text-green-400">Connected</span></>
                ) : connected && pingOk === false ? (
                  <><AlertTriangle className="h-4 w-4 text-red-400" /><span className="text-red-400">Client OK, queries failing</span></>
                ) : connected ? (
                  <><Loader2 className="h-4 w-4 animate-spin text-white/60" /><span className="text-white/60">Checking…</span></>
                ) : (
                  <><AlertTriangle className="h-4 w-4 text-amber-400" /><span className="text-amber-400">Not configured</span></>
                )}
              </div>
            </div>
            <div className="rounded border border-white/10 bg-black/30 p-3 md:col-span-2">
              <div className="text-xs uppercase tracking-wider text-white/50">Host</div>
              <div className="mt-1 font-mono text-white/80 truncate">{host}</div>
            </div>
          </div>

          <div className="mt-4 rounded border border-white/10 bg-black/30 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-3 py-2 text-left">Table</th>
                  <th className="px-3 py-2 text-right">Row Count</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {TABLES.map(t => {
                  const c = counts[t];
                  return (
                    <tr key={t} className="border-t border-white/5">
                      <td className="px-3 py-2 font-mono text-white/80">{t}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {c === undefined ? '—' : c === null ? <span className="text-red-400">error</span> : c.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {c === undefined ? <span className="text-white/40 text-xs">—</span>
                          : c === null ? <span className="text-red-400 text-xs">Query failed</span>
                          : <span className="text-green-400 text-xs inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> OK</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Defaults */}
        <section className="rounded-lg border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Commission & Payout Defaults</h2>
              <p className="text-xs text-white/50 mt-0.5">Stored in <code>earn_settings</code> as key/value.</p>
            </div>
            <button
              onClick={save}
              disabled={!connected || !settingsTableExists || saving || !dirty}
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#C9A84C] text-black font-semibold hover:bg-[#d9b85c] disabled:opacity-40 text-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
            </button>
          </div>

          {!settingsTableExists && connected && (
            <div className="mb-4 p-3 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm">
              <div className="font-semibold">earn_settings table not found.</div>
              <div className="text-amber-100/80 text-xs mt-1">
                Create table <code>earn_settings (key text primary key, value text)</code> in the Dynasty Earn database to enable saving.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DEFAULT_KEYS.map(k => (
              <div key={k.key}>
                <label className="block text-xs text-white/60 mb-1">{k.label}</label>
                <input
                  type={k.type}
                  value={values[k.key] ?? ''}
                  onChange={e => setValues({ ...values, [k.key]: e.target.value })}
                  placeholder={k.placeholder}
                  disabled={loadingSettings || !connected || !settingsTableExists}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm font-mono disabled:opacity-50"
                />
                <div className="text-[10px] text-white/30 mt-1 font-mono">key: {k.key}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
