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

const STAGES = ['identified', 'contacted', 'interested', 'applied', 'activated', 'declined'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'chauffeur': '#3b82f6',
  'exotic car rental': '#ef4444',
  'party bus': '#f97316',
  'helicopter': '#0ea5e9',
  'yacht charter': '#06b6d4',
  'powersports rental': '#84cc16',
  'nightlife venue': '#a855f7',
  'rooftop venue': '#8b5cf6',
  'event hall': '#6366f1',
  'decorator': '#ec4899',
  'decor rental': '#f472b6',
  'florist': '#22c55e',
  'private chef': '#eab308',
  'photographer': '#14b8a6',
  'beauty-hair-makeup': '#fb7185',
  'security-exec protection': '#64748b',
  'rose-gifting supplier': '#e11d48',
  'authenticator': '#78716c',
};

const CATEGORIES = Object.keys(CATEGORY_COLORS);

interface Partner {
  id: string;
  company_name: string;
  phone: string | null;
  office_address: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  specialty: string | null;
  coverage_areas: string | null;
  stage: string | null;
  licence_status: string | null;
  insurance_status: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
}

const isSuspended = (p: Partner) =>
  `${p.licence_status || ''} ${p.insurance_status || ''}`.toLowerCase().includes('susp');

export default function TopTierSupplyMap() {
  const queryClient = useQueryClient();
  const [stateFilter, setStateFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [clustering, setClustering] = useState(true);
  const [selected, setSelected] = useState<Partner | null>(null);

  const { data: partners = [], isLoading, error } = useQuery({
    queryKey: ['tt-partners-map'],
    queryFn: async () => {
      const rows: Partner[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await (supabase.from('crm_partners') as any)
          .select('id, company_name, phone, office_address, city, state, category, specialty, coverage_areas, stage, licence_status, insurance_status, notes, lat, lng')
          .eq('business', 'toptier')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...((data || []) as Partner[]));
        if (!data || data.length < pageSize) break;
      }
      return rows;
    },
  });

  const { data: pending = 0 } = useQuery({
    queryKey: ['tt-partners-ungeocoded'],
    queryFn: async () => {
      const { count, error } = await (supabase.from('crm_partners') as any)
        .select('id', { count: 'exact', head: true })
        .eq('business', 'toptier')
        .is('geocode_status', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const geocode = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tt-geocode-partners', {
        body: { limit: 500 },
      });
      if (error) throw error;
      return data as { geocoded: number; failed: number; remaining: number };
    },
    onSuccess: (d) => {
      toast.success(`Geocoded ${d.geocoded} · failed ${d.failed} · ${d.remaining} left`);
      queryClient.invalidateQueries({ queryKey: ['tt-partners-map'] });
      queryClient.invalidateQueries({ queryKey: ['tt-partners-ungeocoded'] });
    },
    onError: (e: any) => toast.error(e.message || 'Geocoding failed'),
  });

  const states = useMemo(
    () => Array.from(new Set(partners.map(p => p.state).filter(Boolean) as string[])).sort(),
    [partners],
  );

  const filtered = useMemo(() => partners.filter(p => {
    if (stateFilter !== 'all' && p.state !== stateFilter) return false;
    if (categoryFilter !== 'all' && (p.category || '') !== categoryFilter) return false;
    if (stageFilter !== 'all' && (p.stage || 'identified') !== stageFilter) return false;
    return true;
  }), [partners, stateFilter, categoryFilter, stageFilter]);

  const points = useMemo<GeoPoint[]>(() => filtered.map(p => ({
    id: p.id,
    lat: Number(p.lat),
    lng: Number(p.lng),
    title: p.company_name,
    subtitle: p.office_address || '—',
    groupKey: p.state || 'Unknown',
    statusKey: (p.category || '').toLowerCase(),
    meta: p as unknown as Record<string, any>,
  })), [filtered]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" /> Supply Coverage Map
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Internal only · {partners.length.toLocaleString()} mapped
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
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[210px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="cluster" checked={clustering} onCheckedChange={setClustering} />
          <Label htmlFor="cluster" className="text-sm">Cluster dense metros</Label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {CATEGORIES.map(c => (
          <span key={c} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c] }} /> {c}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <GeoMapView
          key={clustering ? 'clustered' : 'pins'}
          points={points}
          statusColors={CATEGORY_COLORS}
          initialCenter={[-98.35, 39.5]}
          initialZoom={3.6}
          clustering={clustering}
          searchPlaceholder="Search partners..."
          groupFilterLabel="All States"
          groupCountLabel={n => `${n} partners`}
          searchFields={p => {
            const i = p.meta as Partner;
            return [i.company_name, i.office_address || '', i.phone || '', i.coverage_areas || '', i.specialty || ''];
          }}
          renderPopupHTML={p => {
            const i = p.meta as Partner;
            return `<div style="color:#000;font-size:12px"><strong>${i.company_name}</strong>${isSuspended(i) ? ' ⚠️' : ''}<br/><span style="color:#555">${i.office_address || '—'}</span><br/><span style="color:#888;font-size:11px">${i.category || 'uncategorised'} · ${i.stage || 'identified'}</span></div>`;
          }}
          onPointClick={p => setSelected(p.meta as Partner)}
          emptyState={<p className="text-sm text-muted-foreground py-8 text-center">
            {isLoading ? 'Loading partners…' : 'No geocoded partners match these filters.'}
          </p>}
        />

        <Card className="h-fit">
          <CardContent className="p-4 space-y-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Click a pin to see partner details.</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-tight">{selected.company_name}</h2>
                  {isSuspended(selected) && (
                    <ShieldAlert className="h-5 w-5 text-destructive shrink-0" aria-label="Licence or insurance suspended" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{selected.office_address || '—'}</p>
                <div className="text-sm space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="outline">{selected.category || 'uncategorised'}</Badge>
                  </p>
                  <p><span className="text-muted-foreground">Phone:</span> {selected.phone || '—'}</p>
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">Stage:</span>
                    <Badge variant="secondary">{selected.stage || 'identified'}</Badge>
                  </p>
                  <p><span className="text-muted-foreground">Coverage:</span> {selected.coverage_areas || '—'}</p>
                  {isSuspended(selected) && (
                    <p className="text-xs text-destructive">
                      Licence: {selected.licence_status || '—'} · Insurance: {selected.insurance_status || '—'}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-xs line-clamp-4">{selected.notes || '—'}</p>
                </div>

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={`/crm/toptier-experience/partners/profile/${selected.id}`}>
                    <Contact className="h-4 w-4 mr-2" /> Open in Partner CRM
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
