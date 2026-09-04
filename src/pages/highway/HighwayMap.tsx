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
import { Download, MapPin } from 'lucide-react';
import {
  fetchHwLeads, fetchHwStages, fetchHwStateCounts, downloadCsv,
  HW_STAGE_COLORS, HW_STAGE_LABELS, HwLead,
} from '@/lib/hwLeads';

type Bbox = { west: number; south: number; east: number; north: number } | null;

export default function HighwayMap() {
  const [search, setSearch] = useState('');
  const [state, setState] = useState<string>('all');
  const [bucket, setBucket] = useState<string>('all');
  const [medicalOnly, setMedicalOnly] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [deliversOnly, setDeliversOnly] = useState(false);
  const [bbox, setBbox] = useState<Bbox>(null);

  const { data: stateCounts = [] } = useQuery({
    queryKey: ['hw-state-counts'],
    queryFn: fetchHwStateCounts,
  });

  const filters = {
    states: state === 'all' ? undefined : [state],
    bucket: bucket === 'all' ? null : Number(bucket),
    medicalOnly,
    hasPhone,
    alreadyDelivers: deliversOnly ? true : null,
    search: search || undefined,
    bbox,
    limit: 2000,
  };

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['hw-leads', filters],
    queryFn: () => fetchHwLeads(filters),
  });

  const ids = useMemo(() => leads.map(l => l.id), [leads]);
  const { data: stages = {} } = useQuery({
    queryKey: ['hw-stages', ids.length],
    queryFn: () => fetchHwStages(ids),
    enabled: ids.length > 0,
  });

  const points: GeoPoint[] = useMemo(
    () => leads
      .filter(l => l.lat != null && l.long != null)
      .map(l => ({
        id: l.id,
        lng: Number(l.long),
        lat: Number(l.lat),
        title: l.business_name,
        subtitle: [l.city, l.state].filter(Boolean).join(', '),
        groupKey: l.state,
        statusKey: stages[l.id]?.stage ?? 'not_contacted',
        meta: l,
      })),
    [leads, stages],
  );

  const onBoundsChange = useCallback((b: any) => {
    setBbox({ west: b.west, south: b.south, east: b.east, north: b.north });
  }, []);

  const exportCsv = () => downloadCsv(
    `highway_leads_${new Date().toISOString().slice(0, 10)}.csv`,
    leads.map(l => ({
      business_name: l.business_name, license_number: l.license_number, license_type: l.license_type,
      license_status: l.license_status, bucket: l.bucket, state: l.state, city: l.city, address: l.address,
      phone: l.phone, email: l.email, website: l.website, medical: l.medical_flag,
      already_delivers: l.already_delivers, stage: stages[l.id]?.stage ?? 'not_contacted',
    })),
  );

  const states = useMemo(
    () => (stateCounts as any[]).map(r => r.state).filter(Boolean).sort(),
    [stateCounts],
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Highway — Licensed Dispensary Map</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${leads.length.toLocaleString()} leads in view`}
            {bbox ? ' (viewport-limited)' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!leads.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button asChild size="sm"><Link to="/highway/crm">Open CRM</Link></Button>
        </div>
      </div>

      {error && (
        <Card className="p-3 bg-destructive/15 text-sm">{(error as Error).message}</Card>
      )}

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
            <Label>Bucket</Label>
            <Select value={bucket} onValueChange={setBucket}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All buckets</SelectItem>
                <SelectItem value="1">Bucket 1</SelectItem>
                <SelectItem value="2">Bucket 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between"><Label>Medical only</Label>
            <Switch checked={medicalOnly} onCheckedChange={setMedicalOnly} /></div>
          <div className="flex items-center justify-between"><Label>Has phone</Label>
            <Switch checked={hasPhone} onCheckedChange={setHasPhone} /></div>
          <div className="flex items-center justify-between"><Label>Already delivers</Label>
            <Switch checked={deliversOnly} onCheckedChange={setDeliversOnly} /></div>

          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Stage legend</p>
            {Object.entries(HW_STAGE_LABELS).map(([k, label]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: HW_STAGE_COLORS[k as keyof typeof HW_STAGE_COLORS] }} />
                {label}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden h-[70vh]">
          <GeoMapView
            points={points}
            statusColors={HW_STAGE_COLORS}
            initialCenter={[-98.5, 39.5]}
            initialZoom={3.5}
            clustering
            onBoundsChange={onBoundsChange}
            searchPlaceholder="Search dispensaries..."
            emptyState={
              <div className="p-6 text-center text-sm text-muted-foreground">
                <MapPin className="h-6 w-6 mx-auto mb-2 opacity-50" />
                No Highway leads loaded yet. Import the licensed-dispensary CSVs to populate this map.
              </div>
            }
            renderDetail={(p) => {
              const l = p.meta as HwLead;
              const stage = (stages as any)[l.id]?.stage ?? 'not_contacted';
              return (
                <div className="space-y-2 text-sm">
                  <div className="font-semibold">{l.business_name}</div>
                  <Badge variant="outline">{HW_STAGE_LABELS[stage as keyof typeof HW_STAGE_LABELS] ?? stage}</Badge>
                  <div className="text-muted-foreground">{[l.address, l.city, l.state].filter(Boolean).join(', ')}</div>
                  {l.license_number && <div>License: {l.license_number} ({l.license_status ?? '—'})</div>}
                  {l.phone && <div>Phone: {l.phone}</div>}
                  {l.email && <div>Email: {l.email}</div>}
                  {l.website && <div className="truncate">Web: {l.website}</div>}
                  <div className="flex gap-2 text-xs">
                    {l.medical_flag && <Badge variant="secondary">Medical</Badge>}
                    {l.already_delivers && <Badge variant="secondary">Delivers</Badge>}
                    {l.bucket && <Badge variant="secondary">Bucket {l.bucket}</Badge>}
                  </div>
                  <Button asChild size="sm" className="w-full">
                    <Link to={`/highway/crm?lead=${l.id}`}>Open in CRM</Link>
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
