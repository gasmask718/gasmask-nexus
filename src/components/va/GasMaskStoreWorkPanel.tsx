/**
 * GasMaskStoreWorkPanel — the scoped GasMask account/work surface a VA gets
 * while working a store from /va/dashboard.
 *
 * Deliberately NOT the admin /stores/:id surface: no financials, no deletes,
 * no user management, no cross-business data. Everything here is reachable by
 * the VA's own RLS (store_master VA business scope, store_contacts /
 * store_notes VA business scope, gasmask_store_call_observations).
 *
 * Stock levels captured on a call are OBSERVATIONS. They are appended to
 * gasmask_store_call_observations with a timestamp and never overwrite the
 * authoritative numeric counts in store_tube_inventory.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, MapPin, Package, PhoneCall, Save, History, StickyNote, Plus, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STOCK_LEVELS = [
  { value: 'full', label: 'Full' },
  { value: 'three_quarter', label: '3/4' },
  { value: 'half', label: '1/2' },
  { value: 'quarter', label: '1/4' },
  { value: 'few', label: 'A few left' },
  { value: 'empty', label: 'Empty' },
];

const CALL_STATUSES = [
  { value: 'needs_reorder', label: 'Needs reorder' },
  { value: 'not_yet', label: 'Not yet' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'call_back', label: 'Call back' },
];

const levelLabel = (v: string | null) =>
  STOCK_LEVELS.find((l) => l.value === v)?.label ?? '—';

/**
 * One canonical "worked" test for a number on file.
 * Canonical columns only:
 *   store_contacts.number_verification_status ∈ unverified|sent|delivered|confirmed|failed
 *   store_contacts.responsiveness_status      ∈ unknown|responsive|unresponsive|wrong_number|not_active
 * A number counts as WORKED once the caller has recorded any real outcome on
 * it — good, no answer, wrong number, or dead line.
 */
export function isNumberWorked(c: { number_verification_status?: string | null; responsiveness_status?: string | null }) {
  return (
    c.number_verification_status === 'confirmed' ||
    c.number_verification_status === 'failed' ||
    ['responsive', 'unresponsive', 'wrong_number', 'not_active'].includes(c.responsiveness_status || '')
  );
}

export interface NumbersProgress {
  total: number;
  open: number;
  openNumbers: string[];
}

interface Props {
  storeId: string | null | undefined;
  /** Reports how many numbers on this account still need to be worked. */
  onNumbersProgress?: (p: NumbersProgress) => void;
}

export function GasMaskStoreWorkPanel({ storeId, onNumbersProgress }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const valid = !!storeId && UUID_RE.test(storeId);


  const storeQ = useQuery({
    queryKey: ['gm-va-store', storeId],
    enabled: valid,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_master')
        .select(
          'id, store_name, address, city, state, zip, owner_name, contact_name, phone, ' +
          'gasmask_call_status, last_contacted_at, notes, business_id',
        )
        .eq('id', storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const contactsQ = useQuery({
    queryKey: ['gm-va-store-contacts', storeId],
    enabled: valid,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_contacts')
        .select('id, name, role, phone, is_primary, number_verification_status, responsiveness_status')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const obsQ = useQuery({
    queryKey: ['gm-va-store-observations', storeId],
    enabled: valid,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('gasmask_store_call_observations')
        .select('id, observed_at, tubes_level, bags_level, reorder_needed, reorder_quantity, call_status, callback_at, notes, source')
        .eq('store_id', storeId)
        .order('observed_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const notesQ = useQuery({
    queryKey: ['gm-va-store-notes', storeId],
    enabled: valid,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_notes')
        .select('id, note_text, created_at, source')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const store = storeQ.data;

  // --- account fields (scoped edit) ---
  const [ownerName, setOwnerName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [callStatusField, setCallStatusField] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    if (!store) return;
    setOwnerName(store.owner_name ?? '');
    setContactName(store.contact_name ?? '');
    setPhone(store.phone ?? '');
    setCallStatusField(store.gasmask_call_status ?? '');
  }, [store?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAccount = async () => {
    if (!valid) return;
    setSavingAccount(true);
    const { error } = await (supabase as any)
      .from('store_master')
      .update({
        owner_name: ownerName.trim() || null,
        contact_name: contactName.trim() || null,
        phone: phone.trim() || null,
        gasmask_call_status: callStatusField || null,
      })
      .eq('id', storeId);
    setSavingAccount(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Account details saved');
    qc.invalidateQueries({ queryKey: ['gm-va-store', storeId] });
  };

  // --- alternate numbers ---
  const [altPhone, setAltPhone] = useState('');
  const [altName, setAltName] = useState('');
  const [addingAlt, setAddingAlt] = useState(false);

  const addAlternate = async () => {
    if (!valid || !altPhone.trim()) return;
    setAddingAlt(true);
    const { error } = await (supabase as any).from('store_contacts').insert({
      store_id: storeId,
      name: altName.trim() || 'Alternate contact',
      phone: altPhone.trim(),
      role: 'alt',
      source: 'va_call',
    });
    setAddingAlt(false);
    if (error) { toast.error(error.message); return; }
    setAltPhone(''); setAltName('');
    toast.success('Alternate number added');
    qc.invalidateQueries({ queryKey: ['gm-va-store-contacts', storeId] });
  };

  // Canonical number outcomes. Values are the ones the DB actually allows —
  // 'verified' is NOT a legal number_verification_status and was silently
  // rejected by the CHECK constraint before this fix.
  const NUMBER_OUTCOMES = [
    { key: 'good',        label: 'Good',       vs: 'confirmed', rs: 'responsive',   cls: 'text-emerald-300' },
    { key: 'no_answer',   label: 'No answer',  vs: null,        rs: 'unresponsive', cls: 'text-amber-300' },
    { key: 'wrong',       label: 'Wrong #',    vs: 'failed',    rs: 'wrong_number', cls: 'text-rose-300' },
    { key: 'dead',        label: 'Dead line',  vs: 'failed',    rs: 'not_active',   cls: 'text-rose-300' },
  ] as const;

  const [markingId, setMarkingId] = useState<string | null>(null);

  /**
   * Record an outcome on ONE number. If the number lives only on
   * store_master.phone (no store_contacts row yet) it is first adopted into
   * the canonical contacts table, so there is still exactly one contact store.
   */
  const markNumber = async (
    row: { id: string | null; phone: string; name?: string | null; role?: string | null },
    outcome: (typeof NUMBER_OUTCOMES)[number],
  ) => {
    if (!valid) return;
    setMarkingId(row.id ?? row.phone);
    let contactId = row.id;
    if (!contactId) {
      const { data: ins, error: insErr } = await (supabase as any)
        .from('store_contacts')
        .insert({
          store_id: storeId,
          name: row.name?.trim() || 'Store line',
          phone: row.phone,
          role: row.role || 'primary',
          is_primary: true,
          source: 'va_call',
        })
        .select('id')
        .maybeSingle();
      if (insErr || !ins?.id) {
        setMarkingId(null);
        toast.error(insErr?.message || 'Could not save this number');
        return;
      }
      contactId = ins.id;
    }
    const patch: Record<string, any> = {
      responsiveness_status: outcome.rs,
      responsiveness_updated_at: new Date().toISOString(),
    };
    if (outcome.vs) {
      patch.number_verification_status = outcome.vs;
      patch.verified_at = new Date().toISOString();
      patch.verified_by = user?.id ?? null;
    }
    const { error } = await (supabase as any)
      .from('store_contacts')
      .update(patch)
      .eq('id', contactId);
    setMarkingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Number marked "${outcome.label}"`);
    qc.invalidateQueries({ queryKey: ['gm-va-store-contacts', storeId] });
  };

  /** Inline correction of an existing contact record (name / role / phone). */
  const saveContact = async (contactId: string, patch: { name: string; role: string; phone: string }) => {
    const { error } = await (supabase as any)
      .from('store_contacts')
      .update({
        name: patch.name.trim() || null,
        role: patch.role.trim() || null,
        phone: patch.phone.trim() || null,
      })
      .eq('id', contactId);
    if (error) { toast.error(error.message); return false; }
    toast.success('Contact updated');
    qc.invalidateQueries({ queryKey: ['gm-va-store-contacts', storeId] });
    return true;
  };

  // ── Every number on the account, in one list ────────────────────────────
  // store_contacts rows + the store_master primary line when it isn't already
  // represented there (matched on the last 10 digits).
  const last10 = (p?: string | null) => (p || '').replace(/\D/g, '').slice(-10);
  const contactRows: any[] = (contactsQ.data || []).filter((c: any) => c.phone);
  const storeLineCovered = !!store?.phone && contactRows.some((c) => last10(c.phone) === last10(store.phone));
  const numberRows: any[] = [
    ...(store?.phone && !storeLineCovered
      ? [{
          id: null,
          phone: store.phone,
          name: store.contact_name || store.owner_name || 'Store line',
          role: 'primary',
          number_verification_status: null,
          responsiveness_status: null,
          fromStore: true,
        }]
      : []),
    ...contactRows,
  ];
  const openNumbers = numberRows.filter((r) => !isNumberWorked(r));

  useEffect(() => {
    if (!onNumbersProgress) return;
    onNumbersProgress({
      total: numberRows.length,
      open: openNumbers.length,
      openNumbers: openNumbers.map((r) => r.phone),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, JSON.stringify(numberRows.map((r) => [r.id, r.phone, r.number_verification_status, r.responsiveness_status]))]);



  // --- call observation capture ---
  const [tubes, setTubes] = useState('');
  const [bags, setBags] = useState('');
  const [reorderNeeded, setReorderNeeded] = useState('');
  const [reorderQty, setReorderQty] = useState('');
  const [obsStatus, setObsStatus] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [obsNotes, setObsNotes] = useState('');
  const [savingObs, setSavingObs] = useState(false);

  const saveObservation = async () => {
    if (!valid) return;
    if (!tubes && !bags && !obsStatus) {
      toast.error('Capture at least a stock level or a call status');
      return;
    }
    setSavingObs(true);
    const { error } = await (supabase as any)
      .from('gasmask_store_call_observations')
      .insert({
        store_id: storeId,
        business_id: store?.business_id ?? null,
        observed_by: user?.id,
        source: 'va_call',
        tubes_level: tubes || null,
        bags_level: bags || null,
        reorder_needed: reorderNeeded === '' ? null : reorderNeeded === 'yes',
        reorder_quantity: reorderQty === '' ? null : Number(reorderQty),
        call_status: obsStatus || null,
        callback_at: callbackAt ? new Date(callbackAt).toISOString() : null,
        notes: obsNotes.trim() || null,
      });
    if (error) { setSavingObs(false); toast.error(error.message); return; }

    // Roll the outcome up onto the account so the call list reflects it.
    const { error: upErr } = await (supabase as any)
      .from('store_master')
      .update({
        gasmask_call_status: obsStatus || callStatusField || null,
        last_contacted_at: new Date().toISOString(),
      })
      .eq('id', storeId);
    setSavingObs(false);
    if (upErr) { toast.error(`Observation saved, account status not updated: ${upErr.message}`); }
    else { toast.success('Call observation logged'); }

    if (obsStatus) setCallStatusField(obsStatus);
    setTubes(''); setBags(''); setReorderNeeded(''); setReorderQty('');
    setObsStatus(''); setCallbackAt(''); setObsNotes('');
    qc.invalidateQueries({ queryKey: ['gm-va-store-observations', storeId] });
    qc.invalidateQueries({ queryKey: ['gm-va-store', storeId] });
  };

  // --- VA note ---
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const saveNote = async () => {
    if (!valid || !note.trim()) return;
    setSavingNote(true);
    const { error } = await (supabase as any).from('store_notes').insert({
      store_id: storeId,
      note_text: note.trim(),
      created_by: user?.id,
      source: 'va_call',
      brand_scope: 'gasmask',
    });
    setSavingNote(false);
    if (error) { toast.error(error.message); return; }
    setNote('');
    toast.success('Note saved');
    qc.invalidateQueries({ queryKey: ['gm-va-store-notes', storeId] });
  };

  if (!valid) {
    return (
      <div className="text-xs text-slate-400 py-6 text-center">
        This dial isn't linked to a GasMask store record, so there's no account to work.
      </div>
    );
  }

  if (storeQ.isLoading) {
    return <div className="space-y-2"><Skeleton className="h-24 w-full bg-slate-700/40" /><Skeleton className="h-24 w-full bg-slate-700/40" /></div>;
  }

  if (storeQ.error || !store) {
    return (
      <div className="text-xs text-rose-300 py-6 text-center">
        {storeQ.error ? (storeQ.error as any).message : 'Store not visible to your account.'}
      </div>
    );
  }

  const lastObs = obsQ.data?.[0];

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white">{store.store_name}</h4>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {[store.address, store.city, store.state, store.zip].filter(Boolean).join(', ') || 'No address on file'}
            </p>
          </div>
          <div className="text-right space-y-1">
            {store.gasmask_call_status && (
              <Badge className="bg-caller/20 text-caller-glow text-[10px]">{store.gasmask_call_status}</Badge>
            )}
            <p className="text-[10px] text-slate-500">
              Last contacted: {store.last_contacted_at ? new Date(store.last_contacted_at).toLocaleDateString() : 'never'}
            </p>
          </div>
        </div>
        {lastObs && (
          <p className="text-[11px] text-slate-400 mt-2 border-t border-slate-700/40 pt-2">
            Last observed — Tubes: <span className="text-slate-200">{levelLabel(lastObs.tubes_level)}</span>
            {' · '}Bags: <span className="text-slate-200">{levelLabel(lastObs.bags_level)}</span>
            {lastObs.callback_at && <> · Follow-up {new Date(lastObs.callback_at).toLocaleString()}</>}
          </p>
        )}
      </div>

      {/* Account fields */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 space-y-3">
        <div className="text-[11px] uppercase font-bold text-slate-400">Account details</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-[11px] text-slate-400">Owner name</Label>
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" /></div>
          <div><Label className="text-[11px] text-slate-400">Contact name</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" /></div>
          <div><Label className="text-[11px] text-slate-400">Primary phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 bg-slate-800 border-slate-700 text-white text-xs font-mono" /></div>
          <div><Label className="text-[11px] text-slate-400">GasMask call status</Label>
            <Select value={callStatusField} onValueChange={setCallStatusField}>
              <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{CALL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select></div>
        </div>
        <Button size="sm" onClick={saveAccount} disabled={savingAccount} className="gap-1.5">
          {savingAccount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save details
        </Button>
      </div>

      {/* Numbers */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 space-y-3">
        <div className="text-[11px] uppercase font-bold text-slate-400 flex items-center justify-between gap-1">
          <span className="flex items-center gap-1"><PhoneCall className="h-3 w-3" /> Numbers on file</span>
          <Badge className={openNumbers.length === 0
            ? 'bg-emerald-500/20 text-emerald-300 text-[9px]'
            : 'bg-amber-500/20 text-amber-300 text-[9px]'}>
            {openNumbers.length === 0
              ? `All ${numberRows.length} worked`
              : `${openNumbers.length} of ${numberRows.length} still to work`}
          </Badge>
        </div>
        {contactsQ.isLoading ? <Skeleton className="h-10 w-full bg-slate-700/40" /> : (
          <div className="space-y-1.5">
            {numberRows.length === 0 && (
              <p className="text-[11px] text-slate-500">No numbers on file for this account.</p>
            )}
            {numberRows.map((c: any) => (
              <NumberRow
                key={c.id || c.phone}
                row={c}
                worked={isNumberWorked(c)}
                busy={markingId === (c.id ?? c.phone)}
                outcomes={NUMBER_OUTCOMES as any}
                onMark={(o) => markNumber(c, o)}
                onSave={(patch) => saveContact(c.id, patch)}
              />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="Alternate phone"
            className="h-8 bg-slate-800 border-slate-700 text-white text-xs font-mono" />
          <Input value={altName} onChange={(e) => setAltName(e.target.value)} placeholder="Whose number?"
            className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
          <Button size="sm" variant="outline" onClick={addAlternate} disabled={addingAlt || !altPhone.trim()} className="gap-1 shrink-0">
            {addingAlt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
          </Button>
        </div>
      </div>

      {/* Call-side inventory capture */}
      <div className="rounded-lg border border-caller/30 bg-caller/5 p-3 space-y-3">
        <div className="text-[11px] uppercase font-bold text-caller-glow flex items-center gap-1">
          <Package className="h-3 w-3" /> Stock observed on this call
        </div>
        <p className="text-[10px] text-slate-400 -mt-1">
          What the store TELLS you. Appended as history — it never overwrites warehouse counts.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-[11px] text-slate-400">Tubes</Label>
            <Select value={tubes} onValueChange={setTubes}>
              <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-xs"><SelectValue placeholder="Select level" /></SelectTrigger>
              <SelectContent>{STOCK_LEVELS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-[11px] text-slate-400">Bags</Label>
            <Select value={bags} onValueChange={setBags}>
              <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-xs"><SelectValue placeholder="Select level" /></SelectTrigger>
              <SelectContent>{STOCK_LEVELS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-[11px] text-slate-400">Reorder needed?</Label>
            <Select value={reorderNeeded} onValueChange={setReorderNeeded}>
              <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select></div>
          <div><Label className="text-[11px] text-slate-400">Reorder quantity</Label>
            <Input type="number" min={0} value={reorderQty} onChange={(e) => setReorderQty(e.target.value)}
              className="h-8 bg-slate-800 border-slate-700 text-white text-xs" /></div>
          <div><Label className="text-[11px] text-slate-400">Call status</Label>
            <Select value={obsStatus} onValueChange={setObsStatus}>
              <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{CALL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-[11px] text-slate-400">Callback / follow-up</Label>
            <Input type="datetime-local" value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)}
              className="h-8 bg-slate-800 border-slate-700 text-white text-xs" /></div>
        </div>
        <Textarea value={obsNotes} onChange={(e) => setObsNotes(e.target.value)} rows={2}
          placeholder="What did they say about stock?"
          className="bg-slate-800 border-slate-700 text-white text-xs" />
        <Button size="sm" onClick={saveObservation} disabled={savingObs} className="gap-1.5 bg-caller text-caller-foreground hover:bg-caller-glow">
          {savingObs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Log observation
        </Button>
      </div>

      {/* Observation history */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
        <div className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-2">
          <History className="h-3 w-3" /> Previous call observations
        </div>
        {obsQ.isLoading ? <Skeleton className="h-10 w-full bg-slate-700/40" /> : (
          <div className="space-y-1.5">
            {(obsQ.data || []).length === 0 && <p className="text-[11px] text-slate-500">No prior observations.</p>}
            {(obsQ.data || []).map((o: any) => (
              <div key={o.id} className="text-[11px] text-slate-300 bg-slate-800/50 rounded px-2 py-1.5">
                <span className="text-slate-500">{new Date(o.observed_at).toLocaleString()}</span>
                {' — Tubes '}<span className="text-slate-100">{levelLabel(o.tubes_level)}</span>
                {' · Bags '}<span className="text-slate-100">{levelLabel(o.bags_level)}</span>
                {o.call_status && <> · <span className="text-caller-glow">{o.call_status}</span></>}
                {o.reorder_needed && <> · reorder {o.reorder_quantity ?? 'yes'}</>}
                {o.notes && <div className="text-slate-400 italic mt-0.5">{o.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VA notes */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 space-y-2">
        <div className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1">
          <StickyNote className="h-3 w-3" /> Notes
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Add a note for the next caller…"
          className="bg-slate-800 border-slate-700 text-white text-xs" />
        <Button size="sm" variant="outline" onClick={saveNote} disabled={savingNote || !note.trim()} className="gap-1.5">
          {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save note
        </Button>
        <div className="space-y-1.5 pt-1">
          {(notesQ.data || []).map((n: any) => (
            <div key={n.id} className="text-[11px] text-slate-300 bg-slate-800/50 rounded px-2 py-1.5">
              <span className="text-slate-500">{new Date(n.created_at).toLocaleDateString()}</span> — {n.note_text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NumberRow — one phone number on the account: its canonical status, the
// outcome buttons that record it, and inline correction of name / role / phone.
// Writes go straight to store_contacts (the canonical contact record).
// ─────────────────────────────────────────────────────────────────────────────
function NumberRow({
  row, worked, busy, outcomes, onMark, onSave,
}: {
  row: any;
  worked: boolean;
  busy: boolean;
  outcomes: { key: string; label: string; vs: string | null; rs: string; cls: string }[];
  onMark: (o: any) => void;
  onSave: (patch: { name: string; role: string; phone: string }) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name || '');
  const [role, setRole] = useState(row.role || '');
  const [phone, setPhone] = useState(row.phone || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(row.name || ''); setRole(row.role || ''); setPhone(row.phone || '');
  }, [row.id, row.name, row.role, row.phone]);

  const status = row.responsiveness_status && row.responsiveness_status !== 'unknown'
    ? row.responsiveness_status
    : (row.number_verification_status || 'unverified');

  return (
    <div className={`rounded px-2 py-1.5 text-xs border ${worked
      ? 'bg-slate-800/60 border-slate-700/60'
      : 'bg-amber-500/5 border-amber-500/30'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-slate-200 font-mono">{row.phone || '—'}</span>
          <span className="text-slate-500"> · {row.name || 'unnamed'}{row.role ? ` (${row.role})` : ''}</span>
          {row.is_primary && <span className="ml-1 text-[9px] text-caller-glow uppercase">primary</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge className={worked
            ? 'bg-emerald-500/15 text-emerald-300 text-[9px]'
            : 'bg-amber-500/15 text-amber-300 text-[9px]'}>
            {status}
          </Badge>
          {row.id && (
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-slate-400"
              onClick={() => setEditing((v) => !v)}>
              {editing ? 'Cancel' : 'Edit'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 mt-1">
        {busy && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        {outcomes.map((o) => (
          <Button key={o.key} size="sm" variant="ghost" disabled={busy}
            className={`h-6 px-1.5 text-[10px] ${o.cls}`}
            onClick={() => onMark(o)}>
            {o.key === 'good' && <ShieldCheck className="h-3 w-3 mr-0.5" />}{o.label}
          </Button>
        ))}
      </div>

      {editing && row.id && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact name"
            className="h-7 bg-slate-800 border-slate-700 text-white text-[11px]" />
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role"
            className="h-7 bg-slate-800 border-slate-700 text-white text-[11px]" />
          <div className="flex gap-1">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone"
              className="h-7 bg-slate-800 border-slate-700 text-white text-[11px] font-mono" />
            <Button size="sm" disabled={saving} className="h-7 px-2 text-[10px]"
              onClick={async () => {
                setSaving(true);
                const ok = await onSave({ name, role, phone });
                setSaving(false);
                if (ok) setEditing(false);
              }}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
