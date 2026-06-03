// End-of-Day Notes — shared between Driver, Biker, Ambassador portals.
// Saves one row per rep per day to public.field_day_notes.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardList,
  MapPinOff,
  Lightbulb,
  Sparkles,
  Search,
  Plus,
  X,
  CheckCircle2,
  Save,
} from 'lucide-react';

type WrongAddress = {
  store_id?: string;
  store_name: string;
  current_address?: string;
  suggested_address?: string;
  note?: string;
  resolved?: boolean;
};

type Role = 'driver' | 'biker' | 'ambassador';

interface Props {
  role: Role;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function EndOfDayNotes({ role }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [needs, setNeeds] = useState('');
  const [helpful, setHelpful] = useState('');
  const [observations, setObservations] = useState('');
  const [wrongAddresses, setWrongAddresses] = useState<WrongAddress[]>([]);
  const [storeQuery, setStoreQuery] = useState('');
  const [storeResults, setStoreResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const date = useMemo(() => todayISO(), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('field_day_notes')
        .select('*')
        .eq('rep_id', uid)
        .eq('note_date', date)
        .maybeSingle();
      if (error) {
        console.warn('[EndOfDayNotes] load error', error);
      }
      if (data) {
        setNoteId(data.id);
        setCompletedCount(data.completed_count ?? 0);
        setNeeds(data.needs ?? '');
        setHelpful(data.helpful ?? '');
        setObservations(data.observations ?? '');
        setWrongAddresses(Array.isArray(data.wrong_addresses) ? (data.wrong_addresses as any) : []);
      }
      setLoading(false);
    })();
  }, [date]);

  async function searchStores(q: string) {
    setStoreQuery(q);
    if (q.trim().length < 2) {
      setStoreResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('stores')
      .select('id, name, address_street, address_city, address_state')
      .ilike('name', `%${q}%`)
      .limit(8);
    setStoreResults(data ?? []);
    setSearching(false);
  }

  function addWrongAddress(store?: any) {
    const entry: WrongAddress = store
      ? {
          store_id: store.id,
          store_name: store.name,
          current_address: [store.address_street, store.address_city, store.address_state]
            .filter(Boolean)
            .join(', '),
          suggested_address: '',
          note: '',
        }
      : { store_name: '', current_address: '', suggested_address: '', note: '' };
    setWrongAddresses((prev) => [...prev, entry]);
    setStoreQuery('');
    setStoreResults([]);
  }

  function updateWrong(idx: number, patch: Partial<WrongAddress>) {
    setWrongAddresses((prev) => prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  }

  function removeWrong(idx: number) {
    setWrongAddresses((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast({ title: 'Not signed in', variant: 'destructive' });
      setSaving(false);
      return;
    }
    const payload = {
      rep_id: uid,
      rep_role: role,
      note_date: date,
      completed_count: completedCount,
      wrong_addresses: wrongAddresses,
      needs: needs || null,
      helpful: helpful || null,
      observations: observations || null,
    };
    const { data, error } = await supabase
      .from('field_day_notes')
      .upsert(payload, { onConflict: 'rep_id,note_date' })
      .select('id')
      .single();
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setNoteId(data.id);
    toast({ title: 'End-of-day notes saved', description: `Logged for ${date}` });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            End-of-Day Notes
          </h1>
          <p className="text-sm text-muted-foreground">
            {date} · {role.charAt(0).toUpperCase() + role.slice(1)}
            {noteId && (
              <Badge variant="outline" className="ml-2 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </Badge>
            )}
          </p>
        </div>
      </div>

      {/* Completed count */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total Completed Addresses</CardTitle>
          <CardDescription>How many stops did you finish today?</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="number"
            min={0}
            value={completedCount}
            onChange={(e) => setCompletedCount(Math.max(0, parseInt(e.target.value || '0', 10)))}
            className="w-32 text-xl font-semibold"
          />
        </CardContent>
      </Card>

      {/* Wrong addresses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPinOff className="h-4 w-4 text-amber-500" />
            Wrong Addresses
          </CardTitle>
          <CardDescription>
            Flag stores whose address is wrong. These feed data cleanup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search store by name..."
                  value={storeQuery}
                  onChange={(e) => searchStores(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" onClick={() => addWrongAddress()}>
                <Plus className="h-4 w-4 mr-1" /> Manual
              </Button>
            </div>
            {storeResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-auto">
                {storeResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addWrongAddress(s)}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  >
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[s.address_street, s.address_city, s.address_state].filter(Boolean).join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searching && <p className="text-xs text-muted-foreground mt-1">Searching…</p>}
          </div>

          {wrongAddresses.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No flags yet today.</p>
          ) : (
            <div className="space-y-3">
              {wrongAddresses.map((w, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Input
                        value={w.store_name}
                        onChange={(e) => updateWrong(idx, { store_name: e.target.value })}
                        placeholder="Store name"
                        className="font-medium"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeWrong(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={w.current_address ?? ''}
                    onChange={(e) => updateWrong(idx, { current_address: e.target.value })}
                    placeholder="Address on file"
                  />
                  <Input
                    value={w.suggested_address ?? ''}
                    onChange={(e) => updateWrong(idx, { suggested_address: e.target.value })}
                    placeholder="Correct address (what you saw)"
                  />
                  <Textarea
                    value={w.note ?? ''}
                    onChange={(e) => updateWrong(idx, { note: e.target.value })}
                    placeholder="Notes (e.g. moved, doesn't exist, second location)"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Things needed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Things Needed</CardTitle>
          <CardDescription>What does the store need? What do you need?</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
            placeholder="e.g. more stickers, restock SKU X, replacement scanner..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Helpful */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Things That Would Be Helpful
          </CardTitle>
          <CardDescription>Suggestions to make your day easier.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={helpful}
            onChange={(e) => setHelpful(e.target.value)}
            placeholder="e.g. earlier route assignments, better packaging, in-app translation..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Observations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Sales Observations
          </CardTitle>
          <CardDescription>
            What you saw in-store / in-system that helps sales (best-sellers, owner questions, competitor brands).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="e.g. owner asked about new flavors, this store moves a lot of X, competitor Y just dropped a display..."
            rows={5}
          />
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving…' : noteId ? 'Update Notes' : 'Save Notes'}
        </Button>
      </div>
    </div>
  );
}

export default EndOfDayNotes;
