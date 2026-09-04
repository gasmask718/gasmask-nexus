import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { GeoMapView, GeoPoint } from '@/components/map/GeoMapView';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/hwLeads';
import {
  fetchDdLeads, fetchDdStages, fetchDdStateCounts,
  DD_STAGE_COLORS, DD_STAGE_LABELS, DdLead,
} from '@/lib/ddLeads';

type Bbox = { west: number; south: number; east: number; north: number } | null;

export default function DDWholesalerMap() {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('all');
  const [leadType, setLeadType] = useState<'all' | 'wholesaler' | 'retail_store'>('wholesaler');
  const [hasPhone, setHasPhone] = useState(false);
  const [bbox, setBbox] = useState<Bbox>(null);

  const { data: stateCounts = [] } = useQuery({
    queryKey: ['dd-state-counts'], queryFn: fetchDdStateCounts,
  });

  const filters = {
    states: state === 'all' ? undefined : [state],
    leadType: leadType === 'all' ? null : leadType,
    hasPhone,
    search: search || undefined,
    bbox,
    limit: 2000,
  } as const;

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['dd-leads', filters],
    queryFn: () => fetchDdLeads(filters as any),
  });

  const ids = useMemo(() => leads.map(l => l.id), [leads]);
  const { data: stages = {} } = useQuery({
    queryKey: ['dd-stages', ids.length],
    queryFn: () => fetchDdStages(ids),
    enabled: ids.length > 0,
  });

  const points: GeoPoint[] = useMemo(
    () => leads
      .filter(l => l.lat != null && l.lng != null)
      .map(l => ({
        id: l.id,
        lng: Number(l.lng),
        lat: Number(l.lat),
        title: l.business_name,
        subtitle: [l.city, l.state].filter(Boolean).join(', '),
        groupKey: l.state ?? undefined,
        statusKey: (stages as any)[l.id]?.stage ?? 'not_contacted',
        meta: l,
      })),
    [leads, stages],
  );

  const onBoundsChange = useCallback((b: any) => {
    setBbox({ west: b.west, south: b.south, east: b.east, north: b.north });
  }, []);

  const states = useMemo(
    () => (stateCounts as any[]).map(r => r.state).filter(Boolean).sort(),
    [stateCounts],
  );

  const geoMissing = leads.length - points.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dynasty Direct — Wholesaler Map</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${leads.length.toLocaleString()} leads in view`}
            {geoMissing > 0 ? ` · ${geoMissing.toLocaleString()} without coordinates` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!leads.length}
            onClick={() => downloadCsv('dynasty_direct_leads.csv', leads.map(l => ({
              business_name: l.business_name, lead_type: l.lead_type, category: l.category,
              address: l.address_line, city: l.city, state: l.state, phone: l.phone_e164,
              stage: (stages as any)[l.id]?.stage ?? 'not_contacted',
            })))}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button asChild size="sm"><Link to="/dynasty-direct/wholesaler-crm">Open CRM</Link></Button>
        </div>
      </div>

      {error && <Card className="p-3 bg-destructive/15 text-sm">{(error as Error).message}</Card>}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <Card className="p-4 space-y-4 h-fit">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Business name" />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Lead type</Label>
            <Select value={leadType} onValueChange={(v) => setLeadType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wholesaler">Wholesalers</SelectItem>
                <SelectItem value="retail_store">Retail stores</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Has phone</Label>
            <Switch checked={hasPhone} onCheckedChange={setHasPhone} />
          </div>
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Stage legend</p>
            {Object.entries(DD_STAGE_LABELS).map(([k, label]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: DD_STAGE_COLORS[k as keyof typeof DD_STAGE_COLORS] }} />
                {label}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden h-[70vh]">
          <GeoMapView
            points={points}
            statusColors={DD_STAGE_COLORS}
            initialCenter={[-96, 39]}
            initialZoom={3.6}
            clustering
            onBoundsChange={onBoundsChange}
            searchPlaceholder="Search wholesalers..."
            emptyState={<div className="p-6 text-sm text-muted-foreground text-center">No leads match these filters.</div>}
            renderDetail={(p) => {
              const l = p.meta as DdLead;
              const stage = (stages as any)[l.id]?.stage ?? 'not_contacted';
              return (
                <div className="space-y-2 text-sm">
                  <div className="font-semibold">{l.business_name}</div>
                  <Badge variant="outline">{DD_STAGE_LABELS[stage as keyof typeof DD_STAGE_LABELS] ?? stage}</Badge>
                  <div className="text-muted-foreground">
                    {[l.address_line, l.city, l.state].filter(Boolean).join(', ')}
                  </div>
                  {l.phone_e164 && <div>Phone: {l.phone_e164}</div>}
                  {l.category && <div>Category: {l.category}</div>}
                  {l.source_payload?.seed_note && (
                    <div className="text-xs text-muted-foreground">{l.source_payload.seed_note}</div>
                  )}
                  <Button asChild size="sm" className="w-full">
                    <Link to={`/dynasty-direct/wholesaler-crm?lead=${l.id}`}>Open in CRM</Link>
                  </Button>
                </div>
              );
            }}
          />
        </Card>
      </div>
    </div>
  );
}
