import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle, Eye } from 'lucide-react';
import { GeoMapView, type GeoPoint } from '@/components/map/GeoMapView';

// Reverse map: given a city name, resolve to its canonical borough
const BOROUGH_CITY_MAP: Record<string, string[]> = {
  'Bronx': ['Bronx', 'bronx'],
  'Brooklyn': ['Brooklyn', 'brooklyn'],
  'Queens': ['Queens', 'queens', 'Jamaica', 'Ridgewood', 'Far Rockaway', 'South Richmond Hill', 'Forest Hills', 'Glendale', 'Middle Village', 'Hollis', 'Flushing', 'Astoria', 'Long Island City', 'Woodside', 'Jackson Heights', 'Elmhurst', 'Corona', 'Bayside', 'Ozone Park', 'Richmond Hill', 'Woodhaven', 'Kew Gardens', 'Rego Park', 'Maspeth', 'Sunnyside'],
  'Manhattan': ['Manhattan', 'New York', 'New york', 'new york', 'NYC'],
  'Staten Island': ['Staten Island', 'staten island'],
};

function resolveBoroughForCity(city: string): string {
  const lower = city.toLowerCase();
  for (const [borough, cities] of Object.entries(BOROUGH_CITY_MAP)) {
    if (cities.some(c => c.toLowerCase() === lower)) return borough;
  }
  return city; // no match → use city as its own territory name
}

interface TerritoryAddress {
  id: string;
  store_name: string | null;
  full_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  discovery_status: string | null;
  discovered_by: string | null;
  address_type: string | null;
  notes: string | null;
  verified_sells_grabba: boolean | null;
  last_checked_at: string | null;
  created_at: string | null;
}

// Same values as the previous statusColor(); the '#6b7280' fallback for unknown
// statuses is GeoMapView's default.
const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  verified: '#22c55e',
  rejected: '#ef4444',
  pending_visit: '#eab308',
};

const statusBadgeVariant = (s: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (!s) return 'outline';
  const lower = s.toLowerCase();
  if (lower === 'verified') return 'default';
  if (lower === 'rejected') return 'destructive';
  return 'secondary';
};

export function TerritoryMapView() {
  const { data: addresses = [] } = useQuery({
    queryKey: ['territory-map-addresses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_addresses')
        .select('id, store_name, full_address, city, state, zip, latitude, longitude, phone, discovery_status, discovered_by, address_type, notes, verified_sells_grabba, last_checked_at, created_at')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      if (error) throw error;
      return (data || []) as TerritoryAddress[];
    },
  });

  const points = useMemo<GeoPoint[]>(() => addresses
    .filter(a => a.latitude != null && a.longitude != null)
    .map(a => ({
      id: a.id,
      lng: a.longitude!,
      lat: a.latitude!,
      title: a.store_name || 'Unknown Store',
      subtitle: a.full_address || '—',
      groupKey: resolveBoroughForCity(a.city || 'Unknown'),
      statusKey: (a.discovery_status || 'new').toLowerCase(),
      meta: a as unknown as Record<string, any>,
    })), [addresses]);

  return (
    <GeoMapView
      points={points}
      statusColors={STATUS_COLORS}
      initialCenter={[-73.95, 40.73]}
      initialZoom={10.5}
      showHulls
      clustering={false}
      resolveGroup={p => p.groupKey ?? null}
      groupFilterLabel="All Territories"
      groupCountLabel={n => `${n} ingested addresses`}
      searchPlaceholder="Search addresses..."
      searchFields={p => {
        const a = p.meta as TerritoryAddress;
        return [a?.store_name || '', a?.full_address || '', a?.notes || '', a?.discovered_by || ''];
      }}
      renderPopupHTML={p => {
        const a = p.meta as TerritoryAddress;
        return `<div style="color:#000;font-size:12px"><strong>${a.store_name || 'Unknown Store'}</strong><br/><span style="color:#555">${a.full_address || '—'}</span>${a.phone ? `<br/><span style=\"color:#555\">Phone: ${a.phone}</span>` : ''}<br/><span style="color:#888;font-size:11px">${(a.discovery_status || 'new').replace('_', ' ')} · ${a.discovered_by || '—'}</span></div>`;
      }}
      emptyState={<p className="text-sm text-muted-foreground py-8 text-center">No addresses found</p>}
      renderListItem={p => {
        const addr = p.meta as TerritoryAddress;
        return (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{addr.store_name || 'Unknown Store'}</p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {addr.full_address || '—'}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {addr.address_type && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {addr.address_type}
                  </Badge>
                )}
                {addr.discovered_by && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Eye className="h-3 w-3 shrink-0" />
                    {addr.discovered_by}
                  </span>
                )}
                {addr.created_at && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(addr.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant={statusBadgeVariant(addr.discovery_status)} className="text-[10px] px-1.5 py-0">
                {addr.discovery_status || 'new'}
              </Badge>
              {addr.verified_sells_grabba && (
                <span className="text-[10px] font-medium text-green-500 flex items-center gap-0.5">
                  <CheckCircle className="h-3 w-3" /> Grabba
                </span>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}
