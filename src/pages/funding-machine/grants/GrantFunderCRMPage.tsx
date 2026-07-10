import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Handshake, Users, FileText, DollarSign, X, Search, Plus, Globe,
} from 'lucide-react';

const GOLD = '#C9A84C';

type GrantFunder = {
  id: string;
  name: string;
  funder_type: string;
  website: string | null;
  primary_contact_name: string | null;
  primary_contact_title: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  secondary_contact_name: string | null;
  secondary_contact_email: string | null;
  focus_areas: string[] | null;
  grant_size_min: number | null;
  grant_size_max: number | null;
  application_deadline_typical: string | null;
  accepts_unsolicited: boolean | null;
  relationship_status: string;
  relationship_notes: string | null;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  total_awarded: number | null;
  total_applications: number | null;
  success_rate: number | null;
  is_active: boolean;
};

type GrantFunderInteraction = {
  id: string;
  funder_id: string;
  interaction_type: string;
  subject: string | null;
  notes: string | null;
  outcome: string | null;
  interaction_date: string;
  created_at: string;
};

const TYPE_BADGE: Record<string, string> = {
  government: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  foundation: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  corporate: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  community: 'bg-green-500/15 text-green-300 border-green-500/30',
  faith_based: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  other: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
};

const STATUS_BADGE: Record<string, string> = {
  prospect: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  contacted: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  responded: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  relationship: 'bg-green-500/15 text-green-300 border-green-500/30',
  declined: 'bg-red-500/15 text-red-300 border-red-500/30',
  do_not_contact: 'bg-red-500/15 text-red-300 border-red-500/30 opacity-50',
};

const INTERACTION_BADGE: Record<string, string> = {
  email: 'bg-blue-500/15 text-blue-300',
  call: 'bg-green-500/15 text-green-300',
  phone: 'bg-green-500/15 text-green-300',
  meeting: 'bg-purple-500/15 text-purple-300',
  site_visit: 'bg-indigo-500/15 text-indigo-300',
  application_submitted: 'bg-amber-500/15 text-amber-300',
  award_received: 'bg-yellow-500/15 text-yellow-300',
  rejection_received: 'bg-red-500/15 text-red-300',
  follow_up: 'bg-teal-500/15 text-teal-300',
  note: 'bg-gray-500/15 text-gray-300',
  other: 'bg-gray-500/15 text-gray-300',
};

// UI label ↔ DB value map (GR-25). DB constraint keeps historical values;
// the UI now surfaces the QA-spec labels but stores the correct enum.
const INTERACTION_LABEL: Record<string, string> = {
  email: 'Email Sent',
  call: 'Phone Call',
  phone: 'Phone Call',
  meeting: 'Meeting',
  site_visit: 'Site Visit',
  application_submitted: 'Application Submitted',
  award_received: 'Award Received',
  rejection_received: 'Rejection Received',
  follow_up: 'Follow Up',
  note: 'Note',
  other: 'Other',
};


const money = (n: number | null | undefined) =>
  `$${Number(n || 0).toLocaleString()}`;

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString() : '';

const isOverdue = (d: string | null) =>
  !!d && new Date(d) < new Date(new Date().toDateString());

// ---------- STATS ----------
function StatsRow({
  loading, total, relationships, totalApps, totalAwarded,
}: { loading: boolean; total: number; relationships: number; totalApps: number; totalAwarded: number }) {
  const cards = [
    { label: 'Total Funders', value: total, icon: Users, color: GOLD, iconBg: `${GOLD}20` },
    { label: 'Relationships', value: relationships, icon: Handshake, color: '#4ade80', iconBg: 'rgba(74,222,128,0.15)' },
    { label: 'Applications Sent', value: totalApps, icon: FileText, color: '#60a5fa', iconBg: 'rgba(96,165,250,0.15)' },
    { label: 'Total Awarded', value: money(totalAwarded), icon: DollarSign, color: '#34d399', iconBg: 'rgba(52,211,153,0.15)' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
                {loading ? (
                  <div className="h-7 w-20 mt-2 rounded bg-muted animate-pulse" />
                ) : (
                  <p className="text-xl font-bold mt-1 truncate" style={{ color: c.color }}>{c.value}</p>
                )}
              </div>
              <div className="p-2 rounded-lg" style={{ background: c.iconBg }}>
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- FUNDER CARD ----------
function FunderCard({ f, onView, onLog }: { f: GrantFunder; onView: () => void; onLog: () => void }) {
  const areas = f.focus_areas || [];
  const overdue = isOverdue(f.next_follow_up_date);
  const sizeLabel =
    f.grant_size_min && f.grant_size_max
      ? `${money(f.grant_size_min)} — ${money(f.grant_size_max)}`
      : f.grant_size_max
      ? `Up to ${money(f.grant_size_max)}`
      : 'Size varies';

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-[#C9A84C]/30 transition space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold text-foreground">{f.name}</div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TYPE_BADGE[f.funder_type] || TYPE_BADGE.other}`}>
          {f.funder_type.replace('_', ' ')}
        </span>
      </div>

      <div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[f.relationship_status] || STATUS_BADGE.prospect}`}>
          {f.relationship_status === 'relationship' ? '⭐ Active Relationship' : f.relationship_status.replace('_', ' ')}
        </span>
      </div>

      {areas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {areas.slice(0, 3).map((a, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{a}</span>
          ))}
          {areas.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{areas.length - 3} more</span>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground">{sizeLabel}</div>

      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <div>Last contact: {f.last_contact_date ? fmtDate(f.last_contact_date) : 'Never contacted'}</div>
        <div className={overdue ? 'text-red-400' : ''}>
          {overdue
            ? `⚠️ Overdue: ${fmtDate(f.next_follow_up_date)}`
            : f.next_follow_up_date
            ? `Next: ${fmtDate(f.next_follow_up_date)}`
            : 'Not scheduled'}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onLog}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition"
        >
          Log Interaction
        </button>
        <button
          onClick={onView}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/15 text-[#C9A84C] hover:bg-[#C9A84C]/25 transition"
        >
          View Details
        </button>
      </div>
    </div>
  );
}

// ---------- SLIDE-OVER ----------
function FunderDetail({
  funder, onClose, onChanged, onOpenLog,
}: {
  funder: GrantFunder;
  onClose: () => void;
  onChanged: (f: GrantFunder) => void;
  onOpenLog: () => void;
}) {
  const [interactions, setInteractions] = useState<GrantFunderInteraction[]>([]);
  const [loadingH, setLoadingH] = useState(true);

  const loadHistory = async () => {
    setLoadingH(true);
    const { data } = await supabase
      .from('grant_funder_interactions')
      .select('*')
      .eq('funder_id', funder.id)
      .order('interaction_date', { ascending: false });
    setInteractions((data as GrantFunderInteraction[]) || []);
    setLoadingH(false);
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [funder.id]);

  const patch = async (updates: Partial<GrantFunder>, successMsg: string) => {
    const { data, error } = await supabase
      .from('grant_funders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', funder.id)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success(successMsg);
    onChanged(data as GrantFunder);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full md:w-[480px] h-full bg-card border-l border-border overflow-y-auto">
        <div className="p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold" style={{ color: GOLD }}>{funder.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TYPE_BADGE[funder.funder_type] || TYPE_BADGE.other}`}>
                  {funder.funder_type.replace('_', ' ')}
                </span>
                {funder.website && (
                  <a href={funder.website} target="_blank" rel="noreferrer" className="text-xs text-[#C9A84C] hover:underline inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" /> {funder.website}
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Relationship Status</label>
            <select
              value={funder.relationship_status}
              onChange={(e) => patch({ relationship_status: e.target.value }, 'Status updated')}
              className="mt-1 w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
            >
              {['prospect','contacted','responded','relationship','declined','do_not_contact'].map(s => (
                <option key={s} value={s}>{s.replace('_',' ')}</option>
              ))}
            </select>
          </div>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Primary Contact</h3>
            <Field label="Name" value={funder.primary_contact_name} />
            <Field label="Title" value={funder.primary_contact_title} />
            <Field
              label="Email"
              value={funder.primary_contact_email}
              render={(v) => <a href={`mailto:${v}`} className="text-[#C9A84C] hover:underline">{v}</a>}
            />
            <Field label="Phone" value={funder.primary_contact_phone} />
            {(funder.secondary_contact_name || funder.secondary_contact_email) && (
              <>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground pt-2">Secondary Contact</h3>
                <Field label="Name" value={funder.secondary_contact_name} />
                <Field
                  label="Email"
                  value={funder.secondary_contact_email}
                  render={(v) => <a href={`mailto:${v}`} className="text-[#C9A84C] hover:underline">{v}</a>}
                />
              </>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Settings</h3>
            <Field
              label="Grant size"
              value={
                funder.grant_size_min && funder.grant_size_max
                  ? `${money(funder.grant_size_min)} — ${money(funder.grant_size_max)}`
                  : null
              }
            />
            <Field label="Accepts unsolicited" value={funder.accepts_unsolicited ? '✅ Yes' : '❌ No'} />
            <Field label="Typical deadline" value={funder.application_deadline_typical} />
          </section>

          <section>
            <label className="text-xs text-muted-foreground">Relationship Notes</label>
            <textarea
              defaultValue={funder.relationship_notes || ''}
              placeholder="Add relationship notes..."
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (funder.relationship_notes || '')) patch({ relationship_notes: v || null }, 'Notes saved');
              }}
              className="mt-1 w-full min-h-[80px] bg-background border border-border rounded-lg p-2 text-sm resize-none"
            />
          </section>

          <section>
            <label className="text-xs text-muted-foreground">Next Follow-Up</label>
            <input
              type="date"
              defaultValue={funder.next_follow_up_date || ''}
              onChange={(e) => patch({ next_follow_up_date: e.target.value || null }, 'Follow-up date saved')}
              className="mt-1 w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Interaction History</h3>
              <button
                onClick={onOpenLog}
                className="text-xs px-2 py-1 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/15 text-[#C9A84C] hover:bg-[#C9A84C]/25"
              >
                + Log
              </button>
            </div>
            {loadingH ? (
              <div className="h-16 rounded bg-muted animate-pulse" />
            ) : interactions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No interactions yet — log your first one below.</p>
            ) : (
              <ul className="space-y-2">
                {interactions.map((it) => (
                  <li key={it.id} className="rounded-lg border border-border p-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${INTERACTION_BADGE[it.interaction_type] || INTERACTION_BADGE.note}`}>
                        {it.interaction_type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{fmtDate(it.interaction_date)}</span>
                    </div>
                    {it.subject && <div className="text-sm font-semibold text-foreground">{it.subject}</div>}
                    {it.notes && <div className="text-xs text-muted-foreground">{it.notes}</div>}
                    {it.outcome && <div className="text-xs">↳ {it.outcome}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, render,
}: { label: string; value: string | null | undefined; render?: (v: string) => React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase text-muted-foreground w-24 shrink-0">{label}</span>
      {value ? (
        <span className="text-sm text-foreground">{render ? render(value) : value}</span>
      ) : (
        <span className="text-sm text-muted-foreground italic">Not set</span>
      )}
    </div>
  );
}

// ---------- LOG MODAL ----------
function LogInteractionModal({
  funders, defaultFunderId, onClose, onLogged,
}: {
  funders: GrantFunder[];
  defaultFunderId: string | null;
  onClose: () => void;
  onLogged: (funderId: string) => void;
}) {
  const [funderId, setFunderId] = useState(defaultFunderId || funders[0]?.id || '');
  const [type, setType] = useState('email');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!funderId || !subject.trim()) { toast.error('Funder and subject required'); return; }
    setSaving(true);
    const { error } = await supabase.from('grant_funder_interactions').insert({
      funder_id: funderId,
      interaction_type: type,
      subject: subject.trim(),
      notes: notes.trim() || null,
      outcome: outcome.trim() || null,
      interaction_date: date,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }

    const funder = funders.find(f => f.id === funderId);
    const updates: Record<string, unknown> = {
      last_contact_date: date,
      updated_at: new Date().toISOString(),
    };
    if (['email','call','phone','meeting','site_visit','follow_up'].includes(type) && funder?.relationship_status === 'prospect') {
      updates.relationship_status = 'contacted';
    }

    if (type === 'application_submitted') {
      updates.total_applications = (funder?.total_applications || 0) + 1;
    }
    if (type === 'award_received') {
      updates.total_awarded = (Number(funder?.total_awarded) || 0) + Number(amount || 0);
      updates.relationship_status = 'relationship';
    }
    await supabase.from('grant_funders').update(updates).eq('id', funderId);

    toast.success('Interaction logged');
    onLogged(funderId);
    setSaving(false);
    onClose();
  };

  return (
    <ModalShell title="Log Interaction" onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Funder">
          <select value={funderId} onChange={(e) => setFunderId(e.target.value)} className={inputCls}>
            {funders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Labeled>
        <Labeled label="Type">
          {/* Display labels per QA spec (GR-25); DB values stay the historical enum. */}
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            <option value="email">Email Sent</option>
            <option value="phone">Phone Call</option>
            <option value="meeting">Meeting</option>
            <option value="site_visit">Site Visit</option>
            <option value="application_submitted">Application Submitted</option>
            <option value="award_received">Award Received</option>
            <option value="rejection_received">Rejection Received</option>
            <option value="follow_up">Follow Up</option>
            <option value="note">Note</option>
            <option value="other">Other</option>
          </select>
        </Labeled>

        <Labeled label="Subject *">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject or topic" className={inputCls} />
        </Labeled>
        <Labeled label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Details..." className={`${inputCls} min-h-[70px] resize-none`} />
        </Labeled>
        <Labeled label="Outcome">
          <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Result or next step" className={inputCls} />
        </Labeled>
        <Labeled label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Labeled>
        {type === 'award_received' && (
          <Labeled label="Award Amount ($)">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputCls} />
          </Labeled>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-border">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/15 text-[#C9A84C] disabled:opacity-50"
          >{saving ? 'Saving...' : 'Log Interaction'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------- ADD FUNDER MODAL ----------
function AddFunderModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('foundation');
  const [website, setWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [areasCsv, setAreasCsv] = useState('');
  const [gmin, setGmin] = useState('');
  const [gmax, setGmax] = useState('');
  const [accepts, setAccepts] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    const areas = areasCsv.split(',').map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from('grant_funders').insert({
      name: name.trim(),
      funder_type: type,
      website: website.trim() || null,
      primary_contact_name: contactName.trim() || null,
      primary_contact_email: contactEmail.trim() || null,
      primary_contact_phone: contactPhone.trim() || null,
      focus_areas: areas.length ? areas : null,
      grant_size_min: gmin ? Number(gmin) : null,
      grant_size_max: gmax ? Number(gmax) : null,
      accepts_unsolicited: accepts,
      relationship_notes: notes.trim() || null,
      relationship_status: 'prospect',
      is_active: true,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success('Funder added');
    onAdded();
    setSaving(false);
    onClose();
  };

  return (
    <ModalShell title="Add Funder" onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Labeled>
        <Labeled label="Type *">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            <option value="foundation">Foundation</option>
            <option value="government">Government</option>
            <option value="corporate">Corporate</option>
            <option value="community">Community</option>
            <option value="faith_based">Faith Based</option>
            <option value="other">Other</option>
          </select>
        </Labeled>
        <Labeled label="Website"><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className={inputCls} /></Labeled>
        <Labeled label="Primary contact"><input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} /></Labeled>
        <Labeled label="Contact email"><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} /></Labeled>
        <Labeled label="Contact phone"><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} /></Labeled>
        <Labeled label="Focus areas (comma-separated)">
          <input value={areasCsv} onChange={(e) => setAreasCsv(e.target.value)} placeholder="women, tech, education" className={inputCls} />
        </Labeled>
        <div className="grid grid-cols-2 gap-2">
          <Labeled label="Grant min ($)"><input type="number" value={gmin} onChange={(e) => setGmin(e.target.value)} className={inputCls} /></Labeled>
          <Labeled label="Grant max ($)"><input type="number" value={gmax} onChange={(e) => setGmax(e.target.value)} className={inputCls} /></Labeled>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={accepts} onChange={(e) => setAccepts(e.target.checked)} />
          Accepts unsolicited applications
        </label>
        <Labeled label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} min-h-[70px] resize-none`} />
        </Labeled>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-border">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/15 text-[#C9A84C] disabled:opacity-50"
          >{saving ? 'Saving...' : 'Add Funder'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------- Modal shell + helpers ----------
const inputCls = 'w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm';

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: GOLD }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- MAIN PAGE ----------
export default function GrantFunderCRMPage() {
  const [funders, setFunders] = useState<GrantFunder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedFunder, setSelectedFunder] = useState<GrantFunder | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logFunderId, setLogFunderId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('grant_funders')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) toast.error(error.message);
    setFunders((data as GrantFunder[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: funders.length,
    relationships: funders.filter(f => f.relationship_status === 'relationship').length,
    totalApps: funders.reduce((s, f) => s + (f.total_applications || 0), 0),
    totalAwarded: funders.reduce((s, f) => s + Number(f.total_awarded || 0), 0),
  }), [funders]);

  const filtered = useMemo(() => {
    return funders.filter(f => {
      if (activeTab === 'prospects' && f.relationship_status !== 'prospect') return false;
      if (activeTab === 'contacted' && !['contacted','responded'].includes(f.relationship_status)) return false;
      if (activeTab === 'relationships' && f.relationship_status !== 'relationship') return false;
      if (activeTab === 'dnc' && f.relationship_status !== 'do_not_contact') return false;
      if (typeFilter !== 'all' && f.funder_type !== typeFilter) return false;
      if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [funders, activeTab, searchQuery, typeFilter]);

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'prospects', label: 'Prospects' },
    { id: 'contacted', label: 'Contacted' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'dnc', label: 'Do Not Contact' },
  ];

  const openLog = (funderId: string | null) => {
    setLogFunderId(funderId);
    setShowLogModal(true);
  };

  const onFunderChanged = (updated: GrantFunder) => {
    setFunders(prev => prev.map(f => f.id === updated.id ? updated : f));
    if (selectedFunder?.id === updated.id) setSelectedFunder(updated);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GOLD }}>🤝 Funder CRM</h1>
            <p className="text-sm text-muted-foreground">Grant funder relationships and contact management</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs px-3 py-2 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/15 text-[#C9A84C] hover:bg-[#C9A84C]/25 inline-flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Funder
          </button>
        </header>

        <StatsRow loading={loading} {...stats} />

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map(t => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    active
                      ? 'border-[#C9A84C]/40 bg-[#C9A84C]/15 text-[#C9A84C]'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >{t.label}</button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search funders..."
                className="w-full pl-7 bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="all">All Types</option>
              <option value="foundation">Foundation</option>
              <option value="government">Government</option>
              <option value="corporate">Corporate</option>
              <option value="community">Community</option>
              <option value="faith_based">Faith Based</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-sm text-muted-foreground">
              No funders match your filters.
            </div>
          ) : (
            filtered.map(f => (
              <FunderCard
                key={f.id}
                f={f}
                onView={() => setSelectedFunder(f)}
                onLog={() => openLog(f.id)}
              />
            ))
          )}
        </div>
      </div>

      {selectedFunder && (
        <FunderDetail
          funder={selectedFunder}
          onClose={() => setSelectedFunder(null)}
          onChanged={onFunderChanged}
          onOpenLog={() => openLog(selectedFunder.id)}
        />
      )}

      {showLogModal && (
        <LogInteractionModal
          funders={funders}
          defaultFunderId={logFunderId}
          onClose={() => setShowLogModal(false)}
          onLogged={() => load()}
        />
      )}

      {showAddModal && (
        <AddFunderModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => load()}
        />
      )}
    </div>
  );
}
