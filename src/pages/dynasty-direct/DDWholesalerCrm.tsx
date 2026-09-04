import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Download } from 'lucide-react';
import { downloadCsv } from '@/lib/hwLeads';
import {
  fetchDdLeads, fetchDdStages, fetchDdOutreach, setDdStage, logDdOutreach, fetchDdStateCounts,
  DD_STAGES, DD_STAGE_LABELS, DD_STAGE_COLORS, DD_CHANNELS, DdStage, DdLead,
} from '@/lib/ddLeads';

export default function DDWholesalerCrm() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('lead');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [stageDraft, setStageDraft] = useState<DdStage>('contacted');
  const [notes, setNotes] = useState('');
  const [channel, setChannel] = useState<string>('call');
  const [outcome, setOutcome] = useState('');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['dd-crm-leads', search],
    queryFn: () => fetchDdLeads({ leadType: 'wholesaler', search: search || undefined, limit: 1000 }),
  });
  const { data: stages = {} } = useQuery({ queryKey: ['dd-crm-stages'], queryFn: () => fetchDdStages() });
  const { data: coverage = [] } = useQuery({ queryKey: ['dd-state-counts'], queryFn: fetchDdStateCounts });

  const selected = useMemo(() => leads.find(l => l.id === selectedId) ?? null, [leads, selectedId]);
  const { data: outreach = [] } = useQuery({
    queryKey: ['dd-outreach', selectedId],
    queryFn: () => fetchDdOutreach(selectedId!),
    enabled: !!selectedId,
  });

  const columns = useMemo(() => {
    const map: Record<string, DdLead[]> = Object.fromEntries(DD_STAGES.map(s => [s, [] as DdLead[]]));
    leads.forEach(l => {
      const s = (stages as any)[l.id]?.stage ?? 'not_contacted';
      (map[s] ?? map.not_contacted).push(l);
    });
    return map;
  }, [leads, stages]);

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('lead', id); else next.delete('lead');
    setParams(next, { replace: true });
  };

  const saveStage = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await setDdStage({ wholesaler_id: selected.id, stage: stageDraft, notes: notes || undefined });
      toast.success('Stage updated');
      setNotes('');
      qc.invalidateQueries({ queryKey: ['dd-crm-stages'] });
      qc.invalidateQueries({ queryKey: ['dd-stages'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update stage');
    } finally { setSaving(false); }
  };

  const saveOutreach = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await logDdOutreach({ wholesaler_id: selected.id, channel, outcome: outcome || undefined, notes: notes || undefined });
      toast.success('Outreach logged');
      setOutcome(''); setNotes('');
      qc.invalidateQueries({ queryKey: ['dd-outreach', selected.id] });
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to log outreach');
    } finally { setSaving(false); }
  };

  const topStates = useMemo(
    () => [...(coverage as any[])].sort((a, b) => (b.wholesaler_leads ?? 0) - (a.wholesaler_leads ?? 0)).slice(0, 8),
    [coverage],
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dynasty Direct — Wholesaler CRM</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${leads.length.toLocaleString()} wholesaler leads`}
          </p>
        </div>
        <div className="flex gap-2">
          <Input className="w-56" placeholder="Search business" value={search} onChange={e => setSearch(e.target.value)} />
          <Button variant="outline" size="sm" disabled={!leads.length}
            onClick={() => downloadCsv('dd_wholesaler_crm.csv', leads.map(l => ({
              business_name: l.business_name, state: l.state, city: l.city, phone: l.phone_e164,
              stage: (stages as any)[l.id]?.stage ?? 'not_contacted',
            })))}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button asChild size="sm" variant="secondary"><Link to="/dynasty-direct/wholesaler-map">Map</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        {topStates.map((s: any) => (
          <Card key={s.state} className="p-3">
            <div className="text-xs text-muted-foreground">{s.state}</div>
            <div className="text-lg font-semibold">{s.wholesaler_leads ?? 0}</div>
            <div className="text-xs text-muted-foreground">{(s.retail_leads ?? 0).toLocaleString()} retail</div>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {DD_STAGES.map(stage => (
          <div key={stage} className="min-w-[240px] w-[240px] shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full" style={{ background: DD_STAGE_COLORS[stage] }} />
              <span className="text-sm font-medium">{DD_STAGE_LABELS[stage]}</span>
              <Badge variant="secondary" className="ml-auto">{columns[stage]?.length ?? 0}</Badge>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {(columns[stage] ?? []).slice(0, 100).map(l => (
                <Card key={l.id} className="p-3 cursor-pointer hover:bg-muted/50" onClick={() => open(l.id)}>
                  <div className="text-sm font-medium truncate">{l.business_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[l.city, l.state].filter(Boolean).join(', ')}
                  </div>
                  {l.phone_e164 && <div className="text-xs text-muted-foreground">{l.phone_e164}</div>}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && open(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle>{selected.business_name}</SheetTitle></SheetHeader>
              <div className="space-y-4 mt-4 text-sm">
                <div className="text-muted-foreground">
                  {[selected.address_line, selected.city, selected.state].filter(Boolean).join(', ')}
                </div>
                {selected.phone_e164 && <div>Phone: {selected.phone_e164}</div>}
                {selected.category && <div>Category: {selected.category}</div>}
                {selected.source_payload?.seed_note && (
                  <div className="text-xs text-muted-foreground">{selected.source_payload.seed_note}</div>
                )}

                <div className="space-y-2 border-t pt-4">
                  <Label>Stage</Label>
                  <Select value={stageDraft} onValueChange={(v) => setStageDraft(v as DdStage)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DD_STAGES.map(s => <SelectItem key={s} value={s}>{DD_STAGE_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DD_CHANNELS.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Label>Outcome (outreach only)</Label>
                  <Input value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="e.g. wants samples" />
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                  <div className="flex gap-2">
                    <Button onClick={saveStage} disabled={saving} size="sm">
                      {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save stage
                    </Button>
                    <Button onClick={saveOutreach} disabled={saving} size="sm" variant="outline">Log outreach</Button>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <p className="font-medium">Outreach history</p>
                  {outreach.length === 0 && <p className="text-xs text-muted-foreground">No outreach logged yet.</p>}
                  {outreach.map((o: any) => (
                    <div key={o.id} className="text-xs border rounded p-2">
                      <div className="flex justify-between">
                        <span>{o.channel}</span>
                        <span className="text-muted-foreground">{new Date(o.created_at).toLocaleString()}</span>
                      </div>
                      {o.outcome && <div>{o.outcome}</div>}
                      {o.notes && <div className="text-muted-foreground">{o.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
