import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Loader2, Mail, MessageSquarePlus } from 'lucide-react';

export const SF_JURISDICTIONS = ['FL','TX','GA','NJ','NY','IL','MN','PA','KY','WV','DC','AZ','NV','OH','SC','MI','MO','TN','MS','CA','CO','MD'] as const;

const STAGES = [
  { key: 'identified', label: 'Identified' },
  { key: 'bar_verified', label: 'Bar Verified' },
  { key: 'conflict_checked', label: 'Conflict Checked' },
  { key: 'recruited', label: 'Recruited' },
  { key: 'retainer_signed', label: 'Retainer Signed' },
  { key: 'active', label: 'Active' },
] as const;

type OutreachEntry = { at?: string; channel?: string; note?: string; by?: string };

export function SFRecruitingQueue() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [logNote, setLogNote] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['sf-recruiting-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sf_recruiting_queue')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () => queue.filter((r: any) => tierFilter === 'all' || r.priority_tier === tierFilter),
    [queue, tierFilter],
  );

  const coverage = useMemo(() => {
    return SF_JURISDICTIONS.map((j) => {
      const rows = queue.filter((r: any) => r.jurisdiction === j);
      return {
        jurisdiction: j,
        total: rows.length,
        active: rows.filter((r: any) => r.stage === 'active').length,
        signed: rows.filter((r: any) => r.stage === 'retainer_signed').length,
      };
    });
  }, [queue]);

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from('sf_recruiting_queue').update({ stage }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sf-recruiting-queue'] });
      toast.success('Stage updated');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update stage'),
  });

  const addOutreach = useMutation({
    mutationFn: async ({ row, note }: { row: any; note: string }) => {
      const log: OutreachEntry[] = Array.isArray(row.outreach_log) ? row.outreach_log : [];
      const next = [...log, { at: new Date().toISOString(), channel: 'email', note }];
      const { error } = await supabase.from('sf_recruiting_queue').update({ outreach_log: next as any }).eq('id', row.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: ['sf-recruiting-queue'] });
      setSelected((s: any) => (s ? { ...s, outreach_log: next } : s));
      setLogNote('');
      toast.success('Outreach logged');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to log outreach'),
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const csv = await file.text();
      const { data, error } = await supabase.functions.invoke('sf-recruiting-import', {
        body: { csv, source: file.name },
      });
      if (error) throw error;
      toast.success(`Imported ${data.inserted} of ${data.parsed} rows`);
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} row issue(s): ${data.errors[0]}`);
      }
      queryClient.invalidateQueries({ queryKey: ['sf-recruiting-queue'] });
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recruiting Queue</h2>
          <p className="text-xs text-muted-foreground">
            {queue.length} prospects across 22 jurisdictions — email-first outreach, logged here. No automated SMS goes to attorneys.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All tiers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="A1">A1</SelectItem>
              <SelectItem value="A2">A2</SelectItem>
              <SelectItem value="A3">A3</SelectItem>
            </SelectContent>
          </Select>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {importing ? 'Importing…' : 'Import CSV'}
          </Button>
        </div>
      </div>

      {/* Coverage summary */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Per-jurisdiction coverage</p>
        <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-11 gap-2">
          {coverage.map((c) => (
            <Card key={c.jurisdiction} className={c.active > 0 ? 'border-green-500/40' : c.total > 0 ? 'border-amber-500/40' : 'border-border/50'}>
              <CardContent className="p-2 text-center">
                <p className="text-sm font-bold">{c.jurisdiction}</p>
                <p className="text-[10px] text-muted-foreground">{c.active} active / {c.total}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Pipeline board */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAGES.map((stage) => {
          const rows = filtered.filter((r: any) => r.stage === stage.key);
          return (
            <Card key={stage.key} className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center justify-between">
                  {stage.label}
                  <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-2">
                {isLoading && <p className="text-[11px] text-muted-foreground px-1">Loading…</p>}
                {!isLoading && rows.length === 0 && (
                  <p className="text-[11px] text-muted-foreground px-1">Empty</p>
                )}
                {rows.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="w-full text-left rounded-md border border-border/60 bg-muted/20 p-2 hover:bg-accent/40 transition"
                  >
                    <p className="text-xs font-medium truncate">{r.attorney_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.firm || '—'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-[9px]">{r.jurisdiction}</Badge>
                      {r.priority_tier && <Badge variant="outline" className="text-[9px]">{r.priority_tier}</Badge>}
                      {Array.isArray(r.outreach_log) && r.outreach_log.length > 0 && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                          <Mail className="h-2.5 w-2.5" />{r.outreach_log.length}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail / outreach log */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selected?.attorney_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">Firm</span><p>{selected.firm || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Jurisdiction</span><p>{selected.jurisdiction}</p></div>
                <div><span className="text-muted-foreground text-xs">Email</span><p className="truncate">{selected.email || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Phone</span><p>{selected.phone || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Next action</span><p>{selected.next_action || '—'}</p></div>
                <div>
                  <span className="text-muted-foreground text-xs">Stage</span>
                  <Select value={selected.stage} onValueChange={(v) => { setSelected({ ...selected, stage: v }); updateStage.mutate({ id: selected.id, stage: v }); }}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-2">Outreach log (email-first)</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(Array.isArray(selected.outreach_log) ? selected.outreach_log : []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No outreach logged yet.</p>
                  )}
                  {(Array.isArray(selected.outreach_log) ? selected.outreach_log : []).map((entry: OutreachEntry, i: number) => (
                    <div key={i} className="rounded-md border border-border/50 p-2">
                      <p className="text-[10px] text-muted-foreground">
                        {entry.at ? new Date(entry.at).toLocaleString() : '—'} · {entry.channel || 'email'}
                      </p>
                      <p className="text-xs">{entry.note}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Textarea value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Log an email touch…" className="text-xs min-h-[60px]" />
                  <Button
                    size="sm"
                    disabled={!logNote.trim() || addOutreach.isPending}
                    onClick={() => addOutreach.mutate({ row: selected, note: logNote.trim() })}
                  >
                    {addOutreach.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
