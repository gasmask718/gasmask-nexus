/**
 * DevWorkspace — End-of-pipeline operator view for client websites.
 * 3 tabs (real DB data):
 *   • Client Instances  → customer_sites
 *   • Intake Inbox      → customer_intake_forms
 *   • Revision Tracker  → customer_change_requests (kanban)
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ExternalLink, Search, Bell, Globe, Inbox, KanbanSquare,
  Circle, Loader2, Plus, X, ChevronRight, Mail,
} from 'lucide-react';

type TabKey = 'instances' | 'inbox' | 'tracker';

const STATUS_PILL: Record<string, string> = {
  pending:     'bg-dev-warning/15 text-dev-warning border-dev-warning/40',
  in_progress: 'bg-dev-accent/15 text-dev-accent border-dev-accent/40',
  in_revision: 'bg-dev-accent/15 text-dev-accent border-dev-accent/40',
  live:        'bg-dev-success/15 text-dev-success border-dev-success/40',
  delivered:   'bg-dev-success/15 text-dev-success border-dev-success/40',
  archived:    'bg-dev-dim/15 text-dev-dim border-dev-dim/30',
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-dev-danger',
  high:   'bg-dev-danger/80',
  normal: 'bg-dev-warning',
  low:    'bg-dev-success',
};

export const DevWorkspace = ({ userEmail }: { userEmail: string }) => {
  const [tab, setTab] = useState<TabKey>('instances');

  return (
    <div className="h-full flex bg-dev-bg text-dev-text">
      {/* Sidebar */}
      <aside className="w-56 border-r border-dev-border bg-dev-elev flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-dev-border">
          <div className="text-[11px] uppercase tracking-[0.3em] text-dev-accent font-mono-dev">DevPortal</div>
          <div className="text-[9px] text-dev-dim mt-0.5">Workspace v1.0</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <NavItem active={tab === 'instances'} onClick={() => setTab('instances')} icon={Globe} label="Client Instances" />
          <NavItem active={tab === 'inbox'} onClick={() => setTab('inbox')} icon={Inbox} label="Intake Inbox" />
          <NavItem active={tab === 'tracker'} onClick={() => setTab('tracker')} icon={KanbanSquare} label="Revision Tracker" />
        </nav>
        <div className="p-3 border-t border-dev-border flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-dev-accent/20 border border-dev-accent/40 flex items-center justify-center text-[11px] font-mono-dev text-dev-accent">
            {userEmail[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] truncate">{userEmail}</div>
            <div className="text-[9px] text-dev-dim">Developer</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-dev-border bg-dev-elev px-6 flex items-center justify-between shrink-0">
          <h1 className="text-sm font-medium tracking-wide">
            {tab === 'instances' && 'Client Instances'}
            {tab === 'inbox' && 'Intake Inbox'}
            {tab === 'tracker' && 'Revision Tracker'}
          </h1>
          <button className="relative p-2 text-dev-dim hover:text-dev-text transition-colors" title="Notifications">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-dev-accent" />
          </button>
        </header>

        <main className="flex-1 overflow-hidden">
          {tab === 'instances' && <ClientInstances />}
          {tab === 'inbox' && <IntakeInbox userEmail={userEmail} />}
          {tab === 'tracker' && <RevisionTracker userEmail={userEmail} />}
        </main>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// Sidebar nav item
// ────────────────────────────────────────────────────────────────
const NavItem = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-[12px] transition-all border-l-2 ${
      active
        ? 'bg-dev-accent/10 text-dev-accent border-dev-accent'
        : 'text-dev-dim border-transparent hover:text-dev-text hover:bg-dev-surface/40'
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    <span>{label}</span>
  </button>
);

// ────────────────────────────────────────────────────────────────
// TAB 1 — CLIENT INSTANCES
// ────────────────────────────────────────────────────────────────
const ClientInstances = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customer_sites')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEdit = async (row: any) => {
    const next = row.status === 'in_revision' ? 'live' : 'in_revision';
    const { error } = await supabase.from('customer_sites').update({ status: next }).eq('id', row.id);
    if (error) return toast.error(error.message);
    toast.success(`Edit access ${next === 'in_revision' ? 'enabled' : 'disabled'}`);
    load();
  };

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (r.customer_name || '').toLowerCase().includes(q) ||
          (r.business_name || '').toLowerCase().includes(q) ||
          (r.id || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, statusFilter, search]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-dev-border bg-dev-elev/50 flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-dev-surface border border-dev-border rounded px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-dev-dim" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client name or project ID..."
            className="bg-transparent border-none outline-none text-[12px] flex-1 text-dev-text placeholder:text-dev-dim"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-dev-surface border border-dev-border rounded px-3 py-1.5 text-[11px] text-dev-text"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_revision">In Revision</option>
          <option value="live">Live</option>
          <option value="delivered">Delivered</option>
        </select>
        <span className="ml-auto text-[10px] text-dev-dim font-mono-dev">{filtered.length} / {rows.length}</span>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-dev-dim text-[12px] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Loading client sites...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-dev-dim text-[12px]">No client sites match your filters.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-dev-elev/50 sticky top-0 border-b border-dev-border">
              <tr className="text-[10px] uppercase tracking-widest text-dev-dim">
                <th className="text-left px-6 py-2.5 font-normal">Client</th>
                <th className="text-left px-4 py-2.5 font-normal">Project ID</th>
                <th className="text-left px-4 py-2.5 font-normal">Date Agreed</th>
                <th className="text-left px-4 py-2.5 font-normal">Status</th>
                <th className="text-right px-6 py-2.5 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-dev-border/50 hover:bg-dev-surface/30 transition-colors">
                  <td className="px-6 py-3">
                    <div className="font-medium text-dev-text">{r.customer_name || r.business_name || '—'}</div>
                    {r.business_name && r.customer_name && (
                      <div className="text-[10px] text-dev-dim">{r.business_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono-dev text-[11px] text-dev-dim">PRJ-{r.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 text-dev-dim text-[11px]">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${STATUS_PILL[r.status] || 'bg-dev-surface text-dev-dim border-dev-border'}`}>
                      {(r.status || 'pending').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {r.site_url && (
                        <a
                          href={r.site_url}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-dev-border rounded text-[10px] text-dev-text hover:border-dev-accent hover:text-dev-accent transition-colors"
                        >
                          <ExternalLink className="w-3 h-3"/> View
                        </a>
                      )}
                      <button
                        onClick={() => toggleEdit(r)}
                        title="Allow client to edit their site"
                        className={`relative w-9 h-5 rounded-full border transition-colors ${
                          r.status === 'in_revision'
                            ? 'bg-dev-accent/30 border-dev-accent'
                            : 'bg-dev-surface border-dev-border'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${
                          r.status === 'in_revision' ? 'left-[18px] bg-dev-accent' : 'left-0.5 bg-dev-dim'
                        }`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// TAB 2 — INTAKE INBOX
// ────────────────────────────────────────────────────────────────
const IntakeInbox = ({ userEmail }: { userEmail: string }) => {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('customer_intake_forms')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (error) toast.error(error.message);
      setForms(data || []);
      setLoading(false);
    })();
    try {
      const stored = localStorage.getItem('dev_intake_read');
      if (stored) setReadSet(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const markRead = (id: string) => {
    const next = new Set(readSet);
    next.add(id);
    setReadSet(next);
    localStorage.setItem('dev_intake_read', JSON.stringify([...next]));
  };

  const groups = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const map: Record<string, any[]> = {};
    for (const f of forms) {
      const d = new Date(f.submitted_at || f.created_at);
      const dDay = new Date(d); dDay.setHours(0, 0, 0, 0);
      let label: string;
      if (dDay.getTime() === today.getTime()) label = 'Today';
      else if (dDay.getTime() === yesterday.getTime()) label = 'Yesterday';
      else label = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
      (map[label] ||= []).push(f);
    }
    return map;
  }, [forms]);

  return (
    <div className="h-full flex">
      <aside className="w-80 border-r border-dev-border overflow-auto shrink-0 bg-dev-elev/30">
        {loading ? (
          <div className="p-4 text-dev-dim text-[12px] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Loading...</div>
        ) : forms.length === 0 ? (
          <div className="p-6 text-center text-dev-dim text-[12px]">No intake forms yet.</div>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-dev-dim border-b border-dev-border bg-dev-bg/50 sticky top-0">
                {label}
              </div>
              {items.map(f => {
                const isSelected = selected?.id === f.id;
                const isUnread = !readSet.has(f.id);
                const preview = typeof f.form_data === 'object' && f.form_data
                  ? (Object.values(f.form_data).find(v => typeof v === 'string') as string)?.slice(0, 60) || f.form_type
                  : f.form_type;
                return (
                  <button
                    key={f.id}
                    onClick={() => { setSelected(f); markRead(f.id); }}
                    className={`w-full text-left px-4 py-3 border-b border-dev-border/50 transition-all ${
                      isSelected
                        ? 'bg-dev-accent/10 border-l-2 border-l-dev-accent'
                        : 'hover:bg-dev-surface/40 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {isUnread && <Circle className="w-1.5 h-1.5 mt-1.5 fill-dev-accent text-dev-accent shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12px] truncate ${isUnread ? 'font-medium text-dev-text' : 'text-dev-dim'}`}>
                          {f.customer_name || 'Anonymous'}
                        </div>
                        <div className="text-[10px] text-dev-dim truncate mt-0.5">{preview}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </aside>

      <section className="flex-1 overflow-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Mail className="w-10 h-10 mx-auto mb-3 text-dev-dim/50"/>
              <div className="text-[12px] text-dev-dim">Select a submission to review</div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-start justify-between border-b border-dev-border pb-4 mb-4">
              <div>
                <h2 className="text-base font-medium text-dev-text">{selected.customer_name || 'Anonymous'}</h2>
                <div className="text-[11px] text-dev-dim mt-1">
                  {new Date(selected.submitted_at || selected.created_at).toLocaleString()} · {selected.form_type}
                </div>
                {selected.customer_email && (
                  <div className="text-[11px] text-dev-dim font-mono-dev mt-0.5">{selected.customer_email}</div>
                )}
              </div>
              <button
                onClick={() => markRead(selected.id)}
                className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-dev-border rounded text-dev-text hover:border-dev-accent hover:text-dev-accent transition-colors"
              >
                Mark as Read
              </button>
            </div>

            <JsonViewer data={selected.form_data} />

            {selected.attachments && Array.isArray(selected.attachments) && selected.attachments.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-widest text-dev-dim mb-2">Attachments</div>
                <div className="flex flex-wrap gap-2">
                  {selected.attachments.map((a: any, i: number) => (
                    <a key={i} href={a.url || a} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-dev-border rounded text-[11px] text-dev-accent hover:bg-dev-accent/10">
                      <ExternalLink className="w-3 h-3"/> {a.name || `file_${i+1}`}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

// JSON-style key/value viewer
const JsonViewer = ({ data }: { data: any }) => {
  if (!data || typeof data !== 'object') {
    return <div className="text-[12px] text-dev-dim">No structured data.</div>;
  }
  return (
    <div className="bg-dev-elev border border-dev-border rounded p-4 font-mono-dev text-[12px] space-y-1.5">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex items-start gap-3">
          <span className="text-dev-accent shrink-0 min-w-[140px]">{k}:</span>
          <span className={
            typeof v === 'string' ? 'text-dev-text break-all' :
            typeof v === 'number' || typeof v === 'boolean' ? 'text-dev-warning' :
            'text-dev-dim'
          }>
            {Array.isArray(v) ? (
              <span className="text-dev-dim">[
                {v.map((x, i) => <div key={i} className="ml-3 text-dev-text">{typeof x === 'string' ? `"${x}"` : JSON.stringify(x)}</div>)}
              ]</span>
            ) : typeof v === 'object' && v !== null
              ? <pre className="text-dev-dim whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</pre>
              : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// TAB 3 — REVISION TRACKER (Kanban)
// ────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'open',        label: 'Requested',   accent: 'text-dev-danger',  bar: 'bg-dev-danger' },
  { key: 'in_progress', label: 'In Progress', accent: 'text-dev-warning', bar: 'bg-dev-warning' },
  { key: 'done',        label: 'Resolved',    accent: 'text-dev-success', bar: 'bg-dev-success' },
];

const RevisionTracker = ({ userEmail }: { userEmail: string }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, s] = await Promise.all([
      supabase.from('customer_change_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('customer_sites').select('id, customer_name, business_name, site_url'),
    ]);
    setRequests(r.data || []);
    setSites(s.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const moveCard = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'done' || status === 'rejected') updates.resolved_at = new Date().toISOString();
    const { error } = await supabase.from('customer_change_requests').update(updates).eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const siteFor = (id: string) => sites.find(s => s.id === id);

  const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d ago`;
    const h = Math.floor(diff / 3600000);
    if (h > 0) return `${h}h ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-dev-border bg-dev-elev/50 flex items-center justify-between shrink-0">
        <span className="text-[11px] text-dev-dim font-mono-dev">{requests.length} total requests</span>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dev-accent text-white rounded text-[11px] uppercase tracking-widest hover:bg-dev-accent/80 transition-colors"
        >
          <Plus className="w-3 h-3"/> Add Request
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-dev-dim text-[12px] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Loading...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4 h-full">
            {COLUMNS.map(col => {
              const items = requests.filter(r => r.status === col.key);
              return (
                <div key={col.key} className="flex flex-col bg-dev-elev/40 rounded-lg border border-dev-border min-h-[400px]">
                  <div className="px-4 py-3 border-b border-dev-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-4 rounded ${col.bar}`} />
                      <span className={`text-[11px] uppercase tracking-widest ${col.accent}`}>{col.label}</span>
                    </div>
                    <span className="text-[10px] text-dev-dim font-mono-dev px-1.5 py-0.5 bg-dev-surface rounded">{items.length}</span>
                  </div>
                  <div className="flex-1 overflow-auto p-3 space-y-2">
                    {items.length === 0 ? (
                      <div className="text-center text-[10px] text-dev-dim/50 py-8">No cards</div>
                    ) : items.map(r => {
                      const site = siteFor(r.customer_site_id);
                      return (
                        <div
                          key={r.id}
                          className="bg-dev-surface border border-dev-border rounded p-3 hover:border-dev-accent/40 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-[12px] text-dev-text">{site?.customer_name || site?.business_name || 'Unassigned'}</div>
                            <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${PRIORITY_DOT[r.priority] || 'bg-dev-dim'}`} title={r.priority}/>
                          </div>
                          {site?.site_url && (
                            <div className="text-[10px] font-mono-dev text-dev-accent truncate mt-1">{site.site_url}</div>
                          )}
                          <div className="text-[11px] text-dev-dim mt-1.5 line-clamp-2">{r.title}</div>
                          {r.description && <div className="text-[10px] text-dev-dim/70 mt-1 line-clamp-2">{r.description}</div>}
                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-dev-border/50">
                            <span className="text-[9px] text-dev-dim font-mono-dev">{relTime(r.created_at)}</span>
                            <select
                              value={r.status}
                              onChange={e => moveCard(r.id, e.target.value)}
                              className="bg-transparent text-[9px] text-dev-dim border-none cursor-pointer hover:text-dev-text"
                            >
                              <option value="open">→ Requested</option>
                              <option value="in_progress">→ In Progress</option>
                              <option value="done">→ Resolved</option>
                              <option value="rejected">→ Rejected</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && <AddRequestModal sites={sites} userEmail={userEmail} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// Add request modal
// ────────────────────────────────────────────────────────────────
const AddRequestModal = ({ sites, userEmail, onClose, onSaved }: any) => {
  const [siteId, setSiteId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!siteId || !title.trim()) {
      toast.error('Client and description required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('customer_change_requests').insert({
      customer_site_id: siteId,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status: 'open',
      requested_by_email: userEmail,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Change request created');
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-dev-elev border border-dev-border rounded-lg w-full max-w-md">
        <div className="px-5 py-4 border-b border-dev-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-dev-text">New Change Request</h3>
          <button onClick={onClose} className="text-dev-dim hover:text-dev-text"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Client">
            <select value={siteId} onChange={e => setSiteId(e.target.value)}
              className="w-full bg-dev-surface border border-dev-border rounded px-3 py-2 text-[12px] text-dev-text">
              <option value="">Select a client...</option>
              {sites.map((s: any) => (
                <option key={s.id} value={s.id}>{s.customer_name || s.business_name || s.id.slice(0, 8)}</option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Update homepage hero copy"
              className="w-full bg-dev-surface border border-dev-border rounded px-3 py-2 text-[12px] text-dev-text"/>
          </Field>
          <Field label="Description (optional)">
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Details of the change requested..."
              className="w-full bg-dev-surface border border-dev-border rounded px-3 py-2 text-[12px] text-dev-text resize-none"/>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="w-full bg-dev-surface border border-dev-border rounded px-3 py-2 text-[12px] text-dev-text">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
        </div>
        <div className="px-5 py-3 border-t border-dev-border flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] text-dev-dim hover:text-dev-text">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dev-accent text-white rounded text-[11px] uppercase tracking-widest hover:bg-dev-accent/80 disabled:opacity-50">
            {saving ? <Loader2 className="w-3 h-3 animate-spin"/> : <ChevronRight className="w-3 h-3"/>}
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: any) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest text-dev-dim mb-1">{label}</div>
    {children}
  </div>
);

export default DevWorkspace;
