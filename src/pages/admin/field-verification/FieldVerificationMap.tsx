import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin } from 'lucide-react';
import { SignedImage } from '@/components/ui/signed-image';
import {
  useCrewDrops, useCrewProfiles, crewNameMap, DROP_TYPE_COLOR, DROP_TYPE_LABEL, CrewDropRow,
} from '@/hooks/useFieldVerification';

export default function FieldVerificationMap() {
  const { data: drops, isLoading, error } = useCrewDrops();
  const { data: profiles } = useCrewProfiles();
  const names = useMemo(() => crewNameMap(profiles), [profiles]);

  const [crewFilter, setCrewFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<CrewDropRow | null>(null);

  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';

  const filtered = useMemo(() => {
    return (drops ?? []).filter((d) =>
      d.latitude != null && d.longitude != null &&
      (crewFilter === 'all' || d.crew_id === crewFilter) &&
      (statusFilter === 'all' || d.status === statusFilter));
  }, [drops, crewFilter, statusFilter]);

  useEffect(() => {
    if (!container.current || map.current || !token) return;
    mapboxgl.accessToken = token;
    map.current = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.95, 40.68],
      zoom: 10,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    return () => { map.current?.remove(); map.current = null; };
  }, [token]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const markers = filtered.map((d) => {
      const el = document.createElement('div');
      el.style.cssText = `width:14px;height:14px;border-radius:9999px;border:2px solid #fff;cursor:pointer;background:${DROP_TYPE_COLOR[d.drop_type] ?? '#a3a3a3'};${d.status === 'rejected' ? 'opacity:.45;' : ''}`;
      el.addEventListener('click', () => setSelected(d));
      return new mapboxgl.Marker(el).setLngLat([d.longitude!, d.latitude!]).addTo(m);
    });
    if (filtered.length) {
      const bounds = new mapboxgl.LngLatBounds();
      filtered.forEach((d) => bounds.extend([d.longitude!, d.latitude!]));
      m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
    }
    return () => markers.forEach((mk) => mk.remove());
  }, [filtered]);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="h-6 w-6 text-primary" /> Field Verification — Live Map</h1>
        <p className="text-sm text-muted-foreground">Every crew drop, colour-coded by type.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={crewFilter} onValueChange={setCrewFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Crew member" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All crew members</SelectItem>
            {(profiles ?? []).map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || 'Unnamed crew'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {Object.entries(DROP_TYPE_LABEL).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full border border-border" style={{ background: DROP_TYPE_COLOR[k] }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {error && <Card><CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent></Card>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="h-[600px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : !token ? (
              <div className="h-[600px] flex items-center justify-center text-sm text-muted-foreground">Map unavailable</div>
            ) : (
              <div ref={container} className="h-[600px] rounded-md overflow-hidden" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Drop details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!selected ? (
              <p className="text-muted-foreground">
                {filtered.length === 0 && !isLoading ? 'No drops match these filters yet.' : 'Click a pin to see the drop.'}
              </p>
            ) : (
              <>
                <SignedImage bucket="crew-drop-photos" path={selected.photo_path} alt="Drop photo" className="w-full h-40 object-cover rounded-md" />
                <div className="font-semibold">{names.get(selected.crew_id) ?? 'Unknown crew'}</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{DROP_TYPE_LABEL[selected.drop_type] ?? selected.drop_type}</Badge>
                  <Badge variant={selected.status === 'verified' ? 'default' : selected.status === 'rejected' ? 'destructive' : 'secondary'}>{selected.status}</Badge>
                </div>
                {selected.store_name && <div><span className="text-muted-foreground">Store: </span>{selected.store_name}</div>}
                <div className="text-muted-foreground text-xs">
                  {selected.server_timestamp ? new Date(selected.server_timestamp).toLocaleString() : '—'}<br />
                  {selected.latitude?.toFixed(5)}, {selected.longitude?.toFixed(5)}
                </div>
                {selected.notes && <p className="text-muted-foreground">{selected.notes}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} drop{filtered.length === 1 ? '' : 's'} shown.</p>
    </div>
  );
}
