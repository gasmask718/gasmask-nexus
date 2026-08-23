/**
 * QuickDialPad — floating speed-capture pad mounted on every ambassador portal
 * page (via AmbassadorLayout). Solves the street problem: someone hands an
 * ambassador a number, and until now there was nowhere to put it.
 *
 * Flow, fastest first:
 *   1. Type/paste a number on a thumb-sized keypad.
 *   2. CALL or TEXT fire immediately through ambassador-direct-call /
 *      ambassador-send-sms (quick path — no store required). The edge function
 *      writes the quick_contacts row the moment the action fires, so an
 *      interrupted conversation still leaves the number captured.
 *   3. Only after firing, a short save panel: name / what they are / address /
 *      neighbourhood / note, with optional "Save as a store" and
 *      "Add to my task list" toggles → promote_quick_contact RPC.
 *
 * Duplicate safety: promote_quick_contact links to an existing store instead of
 * duplicating it and returns already_existed — surfaced prominently. A
 * pre-check on store_master.phone_last10 offers "Open the store" up front.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAmbassador } from '@/hooks/useAmbassadorComms';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Phone, MessageSquare, Delete, Store, ListTodo, History, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Stage = 'dial' | 'text' | 'save';

interface QuickContactRow {
  id: string;
  phone10: string;
  name: string | null;
  status: string | null;
  first_action: string | null;
  captured_at: string | null;
  became_store_id: string | null;
}

const WHAT_OPTIONS = ['store', 'wholesaler', 'worker', 'other'] as const;

const fmt = (digits: string) => {
  const d = digits.slice(-10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

async function fnErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const text = await error.context.text();
    try {
      const parsed = JSON.parse(text);
      return parsed?.error || parsed?.message || text;
    } catch {
      return text;
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function QuickDialPad() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('dial');
  const [digits, setDigits] = useState('');
  const [message, setMessage] = useState('');
  const [quickId, setQuickId] = useState<string | null>(null);

  // Save panel
  const [name, setName] = useState('');
  const [whatTheyAre, setWhatTheyAre] = useState<string>('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [note, setNote] = useState('');
  const [makeStore, setMakeStore] = useState(false);
  const [makeTask, setMakeTask] = useState(false);
  const [taskText, setTaskText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dupResult, setDupResult] = useState<{ storeId: string; storeName: string | null } | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: ambassador } = useCurrentAmbassador();

  const phone10 = digits.length >= 10 ? digits.slice(-10) : null;

  const reset = () => {
    setStage('dial');
    setDigits('');
    setMessage('');
    setQuickId(null);
    setName(''); setWhatTheyAre(''); setAddress(''); setNeighborhood(''); setNote('');
    setMakeStore(false); setMakeTask(false); setTaskText(''); setDueDate('');
    setDupResult(null);
  };

  // Pre-check: does this number already belong to a store? (Backstop is the
  // promote RPC's already_existed flag — this just surfaces it earlier.)
  const { data: existingStore } = useQuery({
    queryKey: ['quick-dial-store-check', phone10],
    enabled: open && !!phone10,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_master')
        .select('id, store_name')
        .eq('phone_last10', phone10!)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (error) return null; // RLS may hide unassigned stores — RPC backstop covers it
      return data as { id: string; store_name: string } | null;
    },
  });

  // Recent captures by this ambassador — finish one they abandoned.
  const { data: recent } = useQuery({
    queryKey: ['quick-contacts-recent', ambassador?.id],
    enabled: open && !!ambassador?.id,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('quick_contacts')
        .select('id, phone10, name, status, first_action, captured_at, became_store_id')
        .eq('captured_by_ambassador_id', ambassador!.id)
        .order('captured_at', { ascending: false })
        .limit(5);
      if (error) return [];
      return (data || []) as QuickContactRow[];
    },
  });

  const invalidateRecent = () =>
    queryClient.invalidateQueries({ queryKey: ['quick-contacts-recent'] });

  const callMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ambassador-direct-call', {
        body: { to_phone: phone10 },
      });
      if (error) throw new Error(await fnErrorMessage(error));
      return data as { quick_contact_id: string | null; message?: string };
    },
    onSuccess: (data) => {
      if (data?.quick_contact_id) setQuickId(data.quick_contact_id);
      toast.success(data?.message || 'Your phone will ring shortly — answer to connect.');
      setStage('save');
      invalidateRecent();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const textMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ambassador-send-sms', {
        body: { to_phone: phone10, body: message },
      });
      if (error) throw new Error(await fnErrorMessage(error));
      return data as { quick_contact_id: string | null; blocked?: boolean; provider_status?: string };
    },
    onSuccess: (data) => {
      if (data?.quick_contact_id) setQuickId(data.quick_contact_id);
      if (data?.blocked || data?.provider_status === 'blocked') {
        toast.warning('This number has opted out of texts — not sent. Call them instead.');
      } else {
        toast.success('Text sent');
      }
      setStage('save');
      invalidateRecent();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!quickId) return null;
      const { error: upErr } = await (supabase as any)
        .from('quick_contacts')
        .update({
          name: name.trim() || null,
          what_they_are: whatTheyAre || null,
          address: address.trim() || null,
          neighborhood: neighborhood.trim() || null,
          note: note.trim() || null,
        })
        .eq('id', quickId);
      if (upErr) throw upErr;

      if (!makeStore && !makeTask) return null;
      const { data, error } = await (supabase as any).rpc('promote_quick_contact', {
        p_quick_id: quickId,
        p_make_store: makeStore,
        p_make_task: makeTask,
        p_task_text: makeTask ? taskText.trim() || null : null,
        p_due_date: makeTask && dueDate ? dueDate : null,
      });
      if (error) throw error;
      return data as { store_id: string | null; task_id: string | null; already_existed: boolean };
    },
    onSuccess: async (data) => {
      invalidateRecent();
      if (data?.already_existed && data.store_id) {
        const { data: s } = await (supabase as any)
          .from('store_master')
          .select('store_name')
          .eq('id', data.store_id)
          .maybeSingle();
        setDupResult({ storeId: data.store_id, storeName: s?.store_name ?? null });
        return;
      }
      if (data?.store_id) toast.success('Store created and linked to this number.');
      else if (data?.task_id) toast.success('Follow-up task added to your list.');
      else toast.success('Number saved to your quick contacts.');
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save'),
  });

  // Prefill the text message once ambassador name is known.
  useEffect(() => {
    if (stage === 'text' && !message) {
      setMessage(
        `Hi — this is ${ambassador?.name ?? 'your GasMask rep'} from GasMask, you gave me your number a moment ago. What's a good time to talk?`,
      );
    }
  }, [stage, ambassador?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: string) => {
    if (k === 'back') setDigits((d) => d.slice(0, -1));
    else if (k === '+') setDigits((d) => (d ? d : d)); // display-only key, US numbers assumed
    else setDigits((d) => (d.replace(/\D/g, '').length >= 11 ? d : d + k));
  };

  const openStore = (storeId: string) => {
    setOpen(false);
    reset();
    navigate(`/ambassador/stores/${storeId}`);
  };

  const loadRecent = (row: QuickContactRow) => {
    setDigits(row.phone10);
    setName(row.name ?? '');
    if (row.became_store_id) {
      openStore(row.became_store_id);
      return;
    }
    setQuickId(row.id);
    setStage('save');
  };

  const firing = callMutation.isPending || textMutation.isPending;
  const knownStore = existingStore ?? null;

  const keypad = useMemo(
    () => ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', 'back'],
    [],
  );

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 md:bottom-6 md:left-6 z-50 h-14 w-14 rounded-full shadow-lg p-0"
        aria-label="Quick dial pad"
      >
        <Phone className="h-6 w-6" />
      </Button>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <SheetContent side="bottom" className="sm:max-w-md sm:mx-auto rounded-t-xl max-h-[92vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> Quick Dial
            </SheetTitle>
          </SheetHeader>

          {stage === 'dial' && (
            <div className="space-y-3 pt-2">
              {/* Number display — also accepts paste/keyboard */}
              <Input
                value={fmt(digits)}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="(___) ___-____"
                inputMode="tel"
                className="text-center text-2xl font-semibold tracking-wide h-14"
                aria-label="Phone number"
              />

              {knownStore && (
                <button
                  type="button"
                  onClick={() => openStore(knownStore.id)}
                  className="w-full flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-left"
                >
                  <Store className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    Already in your book: <strong>{knownStore.store_name}</strong>
                    <span className="block text-xs text-muted-foreground">Tap to open the store</span>
                  </span>
                </button>
              )}

              <div className="grid grid-cols-3 gap-2">
                {keypad.map((k) => (
                  <Button
                    key={k}
                    type="button"
                    variant="outline"
                    className="h-14 text-xl font-medium"
                    onClick={() => press(k)}
                    aria-label={k === 'back' ? 'Delete digit' : `Digit ${k}`}
                  >
                    {k === 'back' ? <Delete className="h-5 w-5" /> : k}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  className="h-14 text-lg gap-2"
                  disabled={!phone10 || firing}
                  onClick={() => callMutation.mutate()}
                >
                  <Phone className="h-5 w-5" />
                  {callMutation.isPending ? 'Calling…' : 'CALL'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-14 text-lg gap-2"
                  disabled={!phone10 || firing}
                  onClick={() => setStage('text')}
                >
                  <MessageSquare className="h-5 w-5" />
                  TEXT
                </Button>
              </div>

              {recent && recent.length > 0 && (
                <div className="pt-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                    <History className="h-3.5 w-3.5" /> Recent captures
                  </p>
                  <ul className="space-y-1">
                    {recent.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => loadRecent(r)}
                          className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent"
                        >
                          <span className="font-medium">{fmt(r.phone10)}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.became_store_id
                              ? 'store linked'
                              : r.name || (r.status === 'new' ? 'finish saving →' : r.status)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {stage === 'text' && (
            <div className="space-y-3 pt-2">
              <p className="text-center text-lg font-semibold">{fmt(digits)}</p>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="text-base"
                aria-label="Text message"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-12" onClick={() => setStage('dial')}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="h-12 gap-2"
                  disabled={!message.trim() || textMutation.isPending}
                  onClick={() => textMutation.mutate()}
                >
                  <MessageSquare className="h-4 w-4" />
                  {textMutation.isPending ? 'Sending…' : 'Send text'}
                </Button>
              </div>
            </div>
          )}

          {stage === 'save' && (
            <div className="space-y-3 pt-2">
              {dupResult ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                    <span>
                      You already have this number
                      {dupResult.storeName ? (
                        <> — it belongs to <strong>{dupResult.storeName}</strong></>
                      ) : (
                        <> — it is linked to an existing store</>
                      )}
                      . No duplicate was created.
                    </span>
                  </div>
                  <Button type="button" className="w-full h-12 gap-2" onClick={() => openStore(dupResult.storeId)}>
                    <Store className="h-4 w-4" /> Open the store
                  </Button>
                  <Button
                    type="button" variant="outline" className="w-full"
                    onClick={() => { setOpen(false); reset(); }}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {fmt(digits)} is captured. Add details while they're fresh — or skip.
                  </p>

                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-12 text-base" />
                  <div className="flex flex-wrap gap-1.5">
                    {WHAT_OPTIONS.map((w) => (
                      <Button
                        key={w}
                        type="button"
                        size="sm"
                        variant={whatTheyAre === w ? 'default' : 'outline'}
                        onClick={() => setWhatTheyAre(whatTheyAre === w ? '' : w)}
                        className="capitalize"
                      >
                        {w}
                      </Button>
                    ))}
                  </div>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className="h-12 text-base" />
                  <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Neighbourhood (optional)" className="h-12 text-base" />
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quick note (optional)" className="h-12 text-base" />

                  {knownStore ? (
                    <Button type="button" variant="outline" className="w-full h-12 gap-2" onClick={() => openStore(knownStore.id)}>
                      <Store className="h-4 w-4" /> Open {knownStore.store_name}
                    </Button>
                  ) : (
                    <label className={cn('flex items-center justify-between rounded-md border px-3 py-2.5')}>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Store className="h-4 w-4" /> Save as a store
                      </span>
                      <Switch checked={makeStore} onCheckedChange={setMakeStore} />
                    </label>
                  )}

                  <div className="rounded-md border px-3 py-2.5 space-y-2">
                    <label className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <ListTodo className="h-4 w-4" /> Add to my task list
                      </span>
                      <Switch checked={makeTask} onCheckedChange={setMakeTask} />
                    </label>
                    {makeTask && (
                      <div className="space-y-2 pt-1">
                        <Input
                          value={taskText}
                          onChange={(e) => setTaskText(e.target.value)}
                          placeholder={`Follow up with ${name.trim() || fmt(digits)}`}
                          className="h-11"
                        />
                        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11" aria-label="Due date" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pb-1">
                    <Button
                      type="button" variant="ghost" className="h-12"
                      onClick={() => { setOpen(false); reset(); }}
                    >
                      Skip for now
                    </Button>
                    <Button
                      type="button" className="h-12"
                      disabled={saveMutation.isPending || !quickId}
                      onClick={() => saveMutation.mutate()}
                    >
                      {saveMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default QuickDialPad;
