import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { territories } from '@/components/map/territories';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X, Search, MapPin, CheckCircle, Eye } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

const BOROUGH_CITY_MAP: Record<string, string[]> = {
  'Bronx': ['Bronx', 'bronx'],
  'Brooklyn': ['Brooklyn', 'brooklyn'],
  'Queens': ['Queens', 'queens', 'Jamaica', 'Ridgewood', 'Far Rockaway', 'South Richmond Hill', 'Forest Hills', 'Glendale', 'Middle Village', 'Hollis', 'Flushing', 'Astoria', 'Long Island City', 'Woodside', 'Jackson Heights', 'Elmhurst', 'Corona', 'Bayside', 'Ozone Park', 'Richmond Hill', 'Woodhaven', 'Kew Gardens', 'Rego Park', 'Maspeth', 'Sunnyside'],
  'Manhattan': ['Manhattan', 'New York', 'New york', 'new york', 'NYC'],
  'Staten Island': ['Staten Island', 'staten island'],
};

interface TerritoryAddress {
  id: string;
  full_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  discovery_status: string | null;
  discovered_by: string | null;
  address_type: string | null;
  notes: string | null;
  verified_sells_grabba: boolean | null;
  last_checked_at: string | null;
  created_at: string | null;
}

const statusColor = (s: string | null) => {
  if (!s) return '#6b7280';
  const lower = s.toLowerCase();
  if (lower === 'new') return '#3b82f6';
  if (lower === 'verified') return '#22c55e';
  if (lower === 'rejected') return '#ef4444';
  if (lower === 'pending_visit') return '#eab308';
  return '#6b7280';
};

const statusBadgeVariant = (s: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (!s) return 'outline';
  const lower = s.toLowerCase();
  if (lower === 'verified') return 'default';
  if (lower === 'rejected') return 'destructive';
  return 'secondary';
};

export function TerritoryMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: addresses = [] } = useQuery({
    queryKey: ['territory-map-addresses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_addresses')
        .select('id, full_address, city, state, zip, latitude, longitude, discovery_status, discovered_by, address_type, notes, verified_sells_grabba, last_checked_at, created_at')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      if (error) throw error;
      return (data || []) as TerritoryAddress[];
    },
  });

  // Filter addresses for selected territory
  const territoryAddresses = useMemo(() => {
    if (!selectedTerritory) return [];
    const cities = BOROUGH_CITY_MAP[selectedTerritory] || [selectedTerritory];
    const citySet = new Set(cities.map(c => c.toLowerCase()));
    return addresses.filter(a => {
      const city = (a.city || '').toLowerCase();
      return citySet.has(city);
    });
  }, [selectedTerritory, addresses]);

  const filteredAddresses = useMemo(() => {
    if (!searchQuery) return territoryAddresses;
    const q = searchQuery.toLowerCase();
    return territoryAddresses.filter(a =>
      (a.full_address || '').toLowerCase().includes(q) ||
      (a.notes || '').toLowerCase().includes(q) ||
      (a.discovered_by || '').toLowerCase().includes(q)
    );
  }, [territoryAddresses, searchQuery]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.95, 40.73],
      zoom: 10.5,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-left');

    map.on('load', () => {
      territories.forEach((t) => {
        const sourceId = `territory-${t.id}`;
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { name: t.name, id: t.id },
            geometry: { type: 'Polygon', coordinates: t.coordinates },
          },
        });

        map.addLayer({
          id: `${t.id}-fill`, type: 'fill', source: sourceId,
          paint: { 'fill-color': t.color, 'fill-opacity': 0.15 },
        });
        map.addLayer({
          id: `${t.id}-line`, type: 'line', source: sourceId,
          paint: { 'line-color': t.color, 'line-width': 2, 'line-opacity': 0.8 },
        });
        map.addLayer({
          id: `${t.id}-label`, type: 'symbol', source: sourceId,
          layout: { 'text-field': t.name, 'text-size': 14, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'] },
          paint: { 'text-color': t.color, 'text-halo-color': '#000', 'text-halo-width': 1 },
        });

        map.on('mouseenter', `${t.id}-fill`, () => {
          map.getCanvas().style.cursor = 'pointer';
          map.setPaintProperty(`${t.id}-fill`, 'fill-opacity', 0.35);
        });
        map.on('mouseleave', `${t.id}-fill`, () => {
          map.getCanvas().style.cursor = '';
          map.setPaintProperty(`${t.id}-fill`, 'fill-opacity', 0.15);
        });
        map.on('click', `${t.id}-fill`, () => {
          setSelectedTerritory(t.name);
          setSearchQuery('');
        });
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Render address markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    addresses.forEach(a => {
      if (a.latitude == null || a.longitude == null) return;
      const el = document.createElement('div');
      el.style.width = '8px';
      el.style.height = '8px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = statusColor(a.discovery_status);
      el.style.border = '1px solid rgba(255,255,255,0.4)';

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([a.longitude, a.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 10, closeButton: false })
            .setHTML(`<div style="color:#000;font-size:12px"><strong>${a.full_address || 'Unknown'}</strong><br/>${a.discovery_status || 'new'} · ${a.discovered_by || '—'}</div>`)
        )
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [addresses]);

  const flyToAddress = (addr: TerritoryAddress) => {
    if (!mapRef.current || !addr.latitude || !addr.longitude) return;
    mapRef.current.flyTo({ center: [addr.longitude, addr.latitude], zoom: 16, duration: 1200 });
    const idx = addresses.findIndex(a => a.id === addr.id);
    if (idx >= 0 && markersRef.current[idx]) {
      markersRef.current[idx].togglePopup();
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-220px)] rounded-lg overflow-hidden border border-border">
      <div ref={mapContainer} className="w-full h-full" />

      {selectedTerritory && (
        <div className="absolute top-0 right-0 h-full w-[380px] bg-background/95 backdrop-blur border-l border-border shadow-xl flex flex-col z-10">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="font-semibold text-lg">{selectedTerritory}</h3>
              <p className="text-xs text-muted-foreground">{territoryAddresses.length} ingested addresses</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedTerritory(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-4 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search addresses..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-4 pb-4 space-y-1">
              {filteredAddresses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No addresses found</p>
              ) : (
                filteredAddresses.map(addr => (
                  <button
                    key={addr.id}
                    onClick={() => flyToAddress(addr)}
                    className="w-full text-left p-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{addr.full_address || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {addr.city || ''}, {addr.state || ''} {addr.zip || ''}
                        </p>
                        {addr.discovered_by && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Eye className="h-3 w-3 shrink-0" />
                            {addr.discovered_by}
                          </p>
                        )}
                        {addr.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{addr.notes}</p>
                        )}
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
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
