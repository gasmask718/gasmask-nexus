import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Search, Phone, Mail, MapPin, Globe, Loader2, StickyNote } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'event_hall', 'rental_company', 'caterer', 'bartender', 'florist', 'photographer',
  'videographer', 'decorator', 'event_planner', 'entertainer', 'dj', 'photo_booth',
  'lighting', 'transportation', 'security', 'staff', 'cleaner', 'other', 'limo',
  'chauffeur', 'exotic_car', 'party_bus', 'yacht', 'nightclub', 'security_firm',
  'authenticator', 'private_chef', 'beauty',
];

const PAGE_SIZE = 50;
const ALL = '__all__';

type Lead = Record<string, any>;

export default function UnforgettablePartnerLeads() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [metro, setMetro] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [note, setNote] = useState('');
  const [contactKind, setContactKind] = useState<'partner' | 'customer'>('partner');

  const { data: metros } = useQuery({
    queryKey: ['ut-metros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ut_coverage_by_metro')
        .select('metro_name')
        .order('metro_name');
      if (error) throw error;
      return (data ?? []).map((r: any) => r.metro_name).filter(Boolean) as string[];
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['ut-partner-leads', search, category, metro, status, source, page],
    queryFn: async () => {
      let q = supabase
        .from('ut_partner_leads')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search.trim()) {
        const t = `%${search.trim()}%`;
        q = q.or(`business_name.ilike.${t},phone.ilike.${t},city.ilike.${t}`);
      }
      if (category !== ALL) q = q.eq('category', category);
      if (metro !== ALL) q = q.eq('metro', metro);
      if (status !== ALL) q = q.eq('status', status);
      if (source !== ALL) q = q.eq('source', source);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Lead[], count: count ?? 0 };
    },
  });

  const { data: notes } = useQuery({
    queryKey: ['ut-call-notes', selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ut_call_notes')
        .select('*')
        .eq('lead_id', selected!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const logNote = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('ut_call_notes').insert({
        business: 'ut',
        lead_id: selected!.id,
        contact_kind: contactKind,
        note: note.trim(),
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['ut-call-notes', selected?.id] });
      toast.success('Note logged');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const total = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reset = (fn: () => void) => { fn(); setPage(0); };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">UT Partner Leads</h1>
        <p className="text-muted-foreground text-sm">
          {total.toLocaleString()} leads from the Unforgettable Times supply book
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Name, phone, city"
              value={search}
              onChange={(e) => reset(() => setSearch(e.target.value))}
            />
          </div>
          <Select value={category} onValueChange={(v) => reset(() => setCategory(v))}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL}>All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={metro} onValueChange={(v) => reset(() => setMetro(v))}>
            <SelectTrigger><SelectValue placeholder="Metro" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL}>All metros</SelectItem>
              {(metros ?? []).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => reset(() => setStatus(v))}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="new">new</SelectItem>
              <SelectItem value="needs_enrichment">needs_enrichment</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={(v) => reset(() => setSource(v))}>
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              <SelectItem value="google_places">google_places</SelectItem>
              <SelectItem value="overture">overture</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-sm text-destructive">{(error as any).message}</div>
          )}
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="divide-y">
              {(data?.rows ?? []).map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className="w-full text-left px-4 py-3 hover:bg-accent flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.business_name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[l.city, l.state, l.phone].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {l.category && <Badge variant="outline" className="text-xs">{String(l.category).replace(/_/g, ' ')}</Badge>}
                  {l.source && <Badge variant="secondary" className="text-xs">{l.source}</Badge>}
                </button>
              ))}
              {!data?.rows?.length && (
                <div className="p-8 text-center text-muted-foreground text-sm">No leads match these filters</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.business_name || 'Lead'}</SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="mt-4 space-y-5">
              <div className="space-y-1 text-sm">
                {selected.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{selected.phone}</p>}
                {selected.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{selected.email}</p>}
                {(selected.full_address || selected.city) && (
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{selected.full_address || `${selected.city}, ${selected.state}`}</p>
                )}
                {selected.website && <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><span className="truncate">{selected.website}</span></p>}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(selected)
                  .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
                  .map(([k, v]) => (
                    <div key={k} className="rounded border p-2">
                      <p className="text-muted-foreground">{k}</p>
                      <p className="break-words">{String(v)}</p>
                    </div>
                  ))}
              </div>

              <div className="space-y-2">
                <p className="font-medium flex items-center gap-2"><StickyNote className="h-4 w-4" /> Log note</p>
                <Select value={contactKind} onValueChange={(v) => setContactKind(v as 'partner' | 'customer')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner">partner</SelectItem>
                    <SelectItem value="customer">customer</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened on the call?" />
                <Button
                  size="sm"
                  disabled={!note.trim() || logNote.isPending}
                  onClick={() => logNote.mutate()}
                >
                  {logNote.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save note
                </Button>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-sm">Call notes ({notes?.length ?? 0})</p>
                {(notes ?? []).map((n: any) => (
                  <div key={n.id} className="rounded border p-3 text-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{n.contact_kind}</Badge>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">{n.note}</p>
                  </div>
                ))}
                {!notes?.length && <p className="text-xs text-muted-foreground">No notes yet.</p>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
