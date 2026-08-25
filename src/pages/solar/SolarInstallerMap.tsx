import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GeoMapView, type GeoPoint } from '@/components/map/GeoMapView';
import { MapPin, RefreshCw, ShieldAlert, Contact, Lock } from 'lucide-react';
import { toast } from 'sonner';

const AMBER = '#E8A317';

const CRM_STAGES = ['identified', 'contacted', 'interested', 'onboarded', 'active', 'declined'] as const;

const STAGE_COLORS: Record<string, string> = {
  identified: '#9ca3af',
  contacted: '#3b82f6',
  interested: '#f59e0b',
  onboarded: '#22c55e',
  active: '#22c55e',
  declined: '#ef4444',
};

interface Installer {
  id: string;
  company_name: string;
  phone: string | null;
  office_address: string | null;
  licence_state: string | null;
  roc_licence_number: string | null;
  licence_class: string | null;
  licence_status: string | null;
  crm_stage: string | null;
  national: boolean | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
}

const isSuspended = (s: string | null) => (s || '').toLowerCase().includes('susp');

export default function SolarInstallerMap() {
  const queryClient = useQueryClient();
  const [stateFilter, setStateFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [nationalFilter, setNationalFilter] = useState('all');
  const [clustering, setClustering] = useState(true);
  const [selected, setSelected] = useState<Installer | null>(null);

  const { data: installers = [], isLoading, error } = useQuery({
    queryKey: ['bs-installers-map'],
    queryFn: async () => {
      const rows: Installer[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await (supabase.from('bs_installers') as any)
          .select('id, company_name, phone, office_address, licence_state, roc_licence_number, licence_class, licence_status, crm_stage, national, notes, lat, lng')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...((data || []) as Installer[]));
        if (!data || data.length < pageSize) break;
      }
      return rows;
    },
  });

  const { data: pending = 0 } = useQuery({
    queryKey: ['bs-installers-ungeocoded'],
    queryFn: async () => {
      const { count, error } = await (supabase.from('bs_installers') as any)
        .select('id', { count: 'exact', head: true })
        .is('geocode_status', null)
        .not('office_address', 'is', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const geocode = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('bs-geocode-installers', {
        body: { limit: 500 },
      });
      if (error) throw error;
      return data as { geocoded: number; failed: number; remaining: number };
    },
    onSuccess: (d) => {
      toast.success(`Geocoded ${d.geocoded} · failed ${d.failed} · ${d.remaining} left`);
      queryClient.invalidateQueries({ queryKey: ['bs-installers-map'] });
      queryClient.invalidateQueries({ queryKey: ['bs-installers-ungeocoded'] });
    },
    onError: (e: any) => toast.error(e.message || 'Geocoding failed'),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, crm_stage }: { id: string; crm_stage: string }) => {
      const { error } = await (supabase.from('bs_installers') as any).update({ crm_stage }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success('Stage updated');
      setSelected(s => (s ? { ...s, crm_stage: v.crm_stage } : s));
      queryClient.invalidateQueries({ queryKey: ['bs-installers-map'] });
    },
    onError: (e: any) => toast.error(e.message || 'Update failed'),
  });

  const states = useMemo(
    () => Array.from(new Set(installers.map(i => i.licence_state).filter(Boolean) as string[])).sort(),
    [installers],
  );

  const filtered = useMemo(() => installers.filter(i => {
    if (stateFilter !== 'all' && i.licence_state !== stateFilter) return false;
    if (stageFilter !== 'all' && (i.crm_stage || 'identified') !== stageFilter) return false;
    if (nationalFilter === 'national' && !i.national) return false;
    if (nationalFilter === 'regional' && i.national) return false;
    return true;
  }), [installers, stateFilter, stageFilter, nationalFilter]);

  const points = useMemo<GeoPoint[]>(() => filtered.map(i => ({
    id: i.id,
    lat: Number(i.lat),
    lng: Number(i.lng),
    title: i.company_name,
    subtitle: i.office_address || '—',
    groupKey: i.licence_state || 'Unknown',
    statusKey: (i.crm_stage || 'identified').toLowerCase(),
    meta: i as unknown as Record<string, any>,
  })), [filtered]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: AMBER }}>
            <MapPin className="h-6 w-6" /> Installer Map
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Internal only · {installers.length.toLocaleString()} mapped
            {pending > 0 && ` · ${pending.toLocaleString()} awaiting geocode`}
          </p>
        </div>
        <Button variant="outline" onClick={() => geocode.mutate()} disabled={geocode.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${geocode.isPending ? 'animate-spin' : ''}`} />
          {geocode.isPending ? 'Geocoding…' : 'Geocode addresses'}
        </Button>
      </header>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-3 text-sm text-destructive">{(error as Error).message}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {CRM_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={nationalFilter} onValueChange={setNationalFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Coverage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All coverage</SelectItem>
            <SelectItem value="national">National only</SelectItem>
            <SelectItem value="regional">Regional only</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="cluster" checked={clustering} onCheckedChange={setClustering} />
          <Label htmlFor="cluster" className="text-sm">Cluster dense areas</Label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {Object.entries(STAGE_COLORS).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} /> {k}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <GeoMapView
          key={clustering ? 'clustered' : 'pins'}
          points={points}
          statusColors={STAGE_COLORS}
          initialCenter={[-98.35, 39.5]}
          initialZoom={3.6}
          clustering={clustering}
          searchPlaceholder="Search installers..."
          groupFilterLabel="All States"
          groupCountLabel={n => `${n} installers`}
          searchFields={p => {
            const i = p.meta as Installer;
            return [i.company_name, i.office_address || '', i.phone || '', i.roc_licence_number || ''];
          }}
          renderPopupHTML={p => {
            const i = p.meta as Installer;
            return `<div style="color:#000;font-size:12px"><strong>${i.company_name}</strong>${isSuspended(i.licence_status) ? ' ⚠️' : ''}<br/><span style="color:#555">${i.office_address || '—'}</span><br/><span style="color:#888;font-size:11px">${i.crm_stage || 'identified'} · ${i.licence_status || 'unknown licence'}</span></div>`;
          }}
          onPointClick={p => setSelected(p.meta as Installer)}
          emptyState={<p className="text-sm text-muted-foreground py-8 text-center">
            {isLoading ? 'Loading installers…' : 'No geocoded installers match these filters.'}
          </p>}
        />

        <Card className="h-fit">
          <CardContent className="p-4 space-y-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Click a pin to see installer details.</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-tight">{selected.company_name}</h2>
                  {isSuspended(selected.licence_status) && (
                    <ShieldAlert className="h-5 w-5 text-destructive shrink-0" aria-label="Licence suspended" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{selected.office_address || '—'}</p>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Phone:</span> {selected.phone || '—'}</p>
                  <p><span className="text-muted-foreground">Licence #:</span> {selected.roc_licence_number || '—'}</p>
                  <p><span className="text-muted-foreground">Class:</span> {selected.licence_class || '—'}</p>
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="outline">{selected.licence_status || 'unknown'}</Badge>
                  </p>
                  <p><span className="text-muted-foreground">State:</span> {selected.licence_state || '—'}{selected.national ? ' · National' : ''}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">CRM stage</Label>
                  <Select
                    value={selected.crm_stage || 'identified'}
                    onValueChange={v => updateStage.mutate({ id: selected.id, crm_stage: v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CRM_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-xs line-clamp-4">{selected.notes || '—'}</p>
                </div>

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/solar/crm"><Contact className="h-4 w-4 mr-2" /> Open in CRM</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
