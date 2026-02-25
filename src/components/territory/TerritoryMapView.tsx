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
import { X, Search, Store, MapPin, Phone } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

const BOROUGH_CITY_MAP: Record<string, string[]> = {
  'Bronx': ['Bronx', 'bronx'],
  'Brooklyn': ['Brooklyn', 'brooklyn'],
  'Queens': ['Queens', 'queens', 'Jamaica', 'Ridgewood', 'Far Rockaway', 'South Richmond Hill', 'Forest Hills', 'Glendale', 'Middle Village', 'Hollis', 'Flushing', 'Astoria', 'Long Island City', 'Woodside', 'Jackson Heights', 'Elmhurst', 'Corona', 'Bayside', 'Ozone Park', 'Richmond Hill', 'Woodhaven', 'Kew Gardens', 'Rego Park', 'Maspeth', 'Sunnyside'],
  'Manhattan': ['Manhattan', 'New York', 'New york', 'new york', 'NYC'],
  'Staten Island': ['Staten Island', 'staten island'],
};

interface StoreRecord {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  status: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  phone: string | null;
  health_score: number | null;
  last_visit_date: string | null;
  boro: string | null;
}

const statusColor = (s: string | null) => {
  if (!s) return '#6b7280';
  const lower = s.toLowerCase();
  if (lower === 'active') return '#22c55e';
  if (lower === 'prospect') return '#eab308';
  if (lower === 'inactive' || lower === 'churned') return '#ef4444';
  return '#6b7280';
};

const statusBadgeVariant = (s: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (!s) return 'outline';
  const lower = s.toLowerCase();
  if (lower === 'active') return 'default';
  if (lower === 'inactive' || lower === 'churned') return 'destructive';
  return 'secondary';
};

export function TerritoryMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: stores = [] } = useQuery({
    queryKey: ['territory-map-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, lat, lng, status, address_street, address_city, address_state, phone, health_score, last_visit_date, boro')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .is('deleted_at', null);
      if (error) throw error;
      return (data || []) as StoreRecord[];
    },
  });

  // Filter stores for selected territory
  const territoryStores = useMemo(() => {
    if (!selectedTerritory) return [];
    const cities = BOROUGH_CITY_MAP[selectedTerritory] || [selectedTerritory];
    const citySet = new Set(cities.map(c => c.toLowerCase()));
    return stores.filter(s => {
      const city = (s.address_city || '').toLowerCase();
      const boro = (s.boro || '').toLowerCase();
      return citySet.has(city) || boro.toLowerCase() === selectedTerritory.toLowerCase();
    });
  }, [selectedTerritory, stores]);

  const filteredStores = useMemo(() => {
    if (!searchQuery) return territoryStores;
    const q = searchQuery.toLowerCase();
    return territoryStores.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.address_street || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    );
  }, [territoryStores, searchQuery]);

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
      // Add territory polygons
      territories.forEach((t) => {
        const sourceId = `territory-${t.id}`;
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { name: t.name, id: t.id },
            geometry: {
              type: 'Polygon',
              coordinates: t.coordinates,
            },
          },
        });

        map.addLayer({
          id: `${t.id}-fill`,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': t.color,
            'fill-opacity': 0.15,
          },
        });

        map.addLayer({
          id: `${t.id}-line`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': t.color,
            'line-width': 2,
            'line-opacity': 0.8,
          },
        });

        // Label
        map.addLayer({
          id: `${t.id}-label`,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': t.name,
            'text-size': 14,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          },
          paint: {
            'text-color': t.color,
            'text-halo-color': '#000',
            'text-halo-width': 1,
          },
        });

        // Hover
        map.on('mouseenter', `${t.id}-fill`, () => {
          map.getCanvas().style.cursor = 'pointer';
          map.setPaintProperty(`${t.id}-fill`, 'fill-opacity', 0.35);
        });
        map.on('mouseleave', `${t.id}-fill`, () => {
          map.getCanvas().style.cursor = '';
          map.setPaintProperty(`${t.id}-fill`, 'fill-opacity', 0.15);
        });

        // Click
        map.on('click', `${t.id}-fill`, () => {
          setSelectedTerritory(t.name);
          setSearchQuery('');
        });
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render store markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    stores.forEach(s => {
      if (s.lat == null || s.lng == null) return;
      const el = document.createElement('div');
      el.style.width = '8px';
      el.style.height = '8px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = statusColor(s.status);
      el.style.border = '1px solid rgba(255,255,255,0.4)';

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 10, closeButton: false })
            .setHTML(`<div style="color:#000;font-size:12px"><strong>${s.name}</strong><br/>${s.address_street || ''}<br/>${s.address_city || ''}</div>`)
        )
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [stores]);

  const flyToStore = (store: StoreRecord) => {
    if (!mapRef.current || !store.lat || !store.lng) return;
    mapRef.current.flyTo({ center: [store.lng, store.lat], zoom: 16, duration: 1200 });
    // Find and open popup
    const idx = stores.findIndex(s => s.id === store.id);
    if (idx >= 0 && markersRef.current[idx]) {
      markersRef.current[idx].togglePopup();
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-220px)] rounded-lg overflow-hidden border border-border">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Slide-out panel */}
      {selectedTerritory && (
        <div className="absolute top-0 right-0 h-full w-[380px] bg-background/95 backdrop-blur border-l border-border shadow-xl flex flex-col z-10">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="font-semibold text-lg">{selectedTerritory}</h3>
              <p className="text-xs text-muted-foreground">{territoryStores.length} stores</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedTerritory(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-4 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-4 pb-4 space-y-1">
              {filteredStores.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No stores found</p>
              ) : (
                filteredStores.map(store => (
                  <button
                    key={store.id}
                    onClick={() => flyToStore(store)}
                    className="w-full text-left p-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{store.name}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {store.address_street || '—'}, {store.address_city || ''}
                        </p>
                        {store.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 shrink-0" />
                            {store.phone}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={statusBadgeVariant(store.status)} className="text-[10px] px-1.5 py-0">
                          {store.status || 'Unknown'}
                        </Badge>
                        {store.health_score != null && (
                          <span className={`text-[10px] font-medium ${store.health_score >= 70 ? 'text-green-500' : store.health_score >= 40 ? 'text-amber-500' : 'text-destructive'}`}>
                            {store.health_score}%
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
