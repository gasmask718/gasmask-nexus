import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Search, MapPin, CheckCircle, Eye, Filter } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

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
  discovery_status: string | null;
  discovered_by: string | null;
  address_type: string | null;
  notes: string | null;
  verified_sells_grabba: boolean | null;
  last_checked_at: string | null;
  created_at: string | null;
}

interface DynamicTerritory {
  name: string;
  color: string;
  coordinates: [number, number][][];
  center: [number, number];
  count: number;
}

const TERRITORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#6366f1',
  '#ec4899', '#14b8a6', '#8b5cf6', '#f43f5e', '#06b6d4',
];

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

/** Compute convex hull of 2D points using Andrew's monotone chain */
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) {
    // For 1-2 points, create a small buffer polygon
    if (points.length === 0) return [];
    const [cx, cy] = points.length === 1
      ? points[0]
      : [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
    const r = 0.005; // ~500m buffer
    return [
      [cx - r, cy - r], [cx + r, cy - r],
      [cx + r, cy + r], [cx - r, cy + r],
      [cx - r, cy - r],
    ];
  }

  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (O: [number, number], A: [number, number], B: [number, number]) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  // Close the ring
  if (hull.length > 0) hull.push(hull[0]);
  return hull;
}

/** Add a small padding to convex hull by expanding outward from centroid */
function padHull(hull: [number, number][], factor = 0.08): [number, number][] {
  if (hull.length < 4) return hull;
  const cx = hull.slice(0, -1).reduce((s, p) => s + p[0], 0) / (hull.length - 1);
  const cy = hull.slice(0, -1).reduce((s, p) => s + p[1], 0) / (hull.length - 1);
  return hull.map(([x, y]) => [
    cx + (x - cx) * (1 + factor),
    cy + (y - cy) * (1 + factor),
  ] as [number, number]);
}

export function TerritoryMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const layerIdsRef = useRef<string[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [filterTerritory, setFilterTerritory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);

  const { data: addresses = [] } = useQuery({
    queryKey: ['territory-map-addresses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_addresses')
        .select('id, store_name, full_address, city, state, zip, latitude, longitude, discovery_status, discovered_by, address_type, notes, verified_sells_grabba, last_checked_at, created_at')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      if (error) throw error;
      return (data || []) as TerritoryAddress[];
    },
  });

  // Build dynamic territories from address data via convex hull
  const dynamicTerritories = useMemo((): DynamicTerritory[] => {
    if (addresses.length === 0) return [];

    // Group addresses by resolved borough/territory
    const groups: Record<string, [number, number][]> = {};
    addresses.forEach(a => {
      if (a.latitude == null || a.longitude == null) return;
      const territory = resolveBoroughForCity(a.city || 'Unknown');
      if (!groups[territory]) groups[territory] = [];
      groups[territory].push([a.longitude, a.latitude]);
    });

    // Generate convex hull per territory
    const names = Object.keys(groups).sort();
    return names.map((name, i) => {
      const points = groups[name];
      const hull = padHull(convexHull(points));
      const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
      const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
      return {
        name,
        color: TERRITORY_COLORS[i % TERRITORY_COLORS.length],
        coordinates: [hull],
        center: [cx, cy] as [number, number],
        count: points.length,
      };
    });
  }, [addresses]);

  // Available territory names for filter dropdown
  const territoryNames = useMemo(() => dynamicTerritories.map(t => t.name), [dynamicTerritories]);

  // Filtered addresses for the selected territory panel
  const territoryAddresses = useMemo(() => {
    if (!selectedTerritory) return [];
    return addresses.filter(a => {
      const resolved = resolveBoroughForCity(a.city || 'Unknown');
      return resolved === selectedTerritory;
    });
  }, [selectedTerritory, addresses]);

  const filteredAddresses = useMemo(() => {
    if (!searchQuery) return territoryAddresses;
    const q = searchQuery.toLowerCase();
    return territoryAddresses.filter(a =>
      (a.store_name || '').toLowerCase().includes(q) ||
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
    map.on('load', () => setMapLoaded(true));

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Draw dynamic territory polygons whenever territories or filter changes
  const drawTerritories = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove old layers/sources
    layerIdsRef.current.forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    layerIdsRef.current.forEach(id => {
      const srcId = id.replace(/-fill$|-line$|-label$/, '');
      if (map.getSource(`dyn-${srcId}`) && !layerIdsRef.current.some(
        lid => lid !== id && lid.startsWith(srcId) && map.getLayer(lid)
      )) {
        // Don't remove source yet — handled below
      }
    });
    // Brute remove all dyn sources
    dynamicTerritories.forEach(t => {
      const srcId = `dyn-${t.name}`;
      [`${t.name}-fill`, `${t.name}-line`, `${t.name}-label`].forEach(lid => {
        if (map.getLayer(lid)) map.removeLayer(lid);
      });
      if (map.getSource(srcId)) map.removeSource(srcId);
    });
    // Also remove any stale sources from previous renders
    layerIdsRef.current.forEach(lid => {
      if (map.getLayer(lid)) map.removeLayer(lid);
    });
    layerIdsRef.current = [];

    const visible = filterTerritory === 'all'
      ? dynamicTerritories
      : dynamicTerritories.filter(t => t.name === filterTerritory);

    visible.forEach(t => {
      if (t.coordinates[0].length < 3) return;
      const srcId = `dyn-${t.name}`;

      // Clean up if somehow exists
      if (map.getSource(srcId)) {
        [`${t.name}-fill`, `${t.name}-line`, `${t.name}-label`].forEach(lid => {
          if (map.getLayer(lid)) map.removeLayer(lid);
        });
        map.removeSource(srcId);
      }

      map.addSource(srcId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { name: t.name },
          geometry: { type: 'Polygon', coordinates: t.coordinates },
        },
      });

      const fillId = `${t.name}-fill`;
      const lineId = `${t.name}-line`;
      const labelId = `${t.name}-label`;

      map.addLayer({
        id: fillId, type: 'fill', source: srcId,
        paint: { 'fill-color': t.color, 'fill-opacity': 0.15 },
      });
      map.addLayer({
        id: lineId, type: 'line', source: srcId,
        paint: { 'line-color': t.color, 'line-width': 2, 'line-opacity': 0.8 },
      });
      map.addLayer({
        id: labelId, type: 'symbol', source: srcId,
        layout: {
          'text-field': `${t.name} (${t.count})`,
          'text-size': 13,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: { 'text-color': t.color, 'text-halo-color': '#000', 'text-halo-width': 1 },
      });

      layerIdsRef.current.push(fillId, lineId, labelId);

      // Interactions
      map.on('mouseenter', fillId, () => {
        map.getCanvas().style.cursor = 'pointer';
        map.setPaintProperty(fillId, 'fill-opacity', 0.35);
      });
      map.on('mouseleave', fillId, () => {
        map.getCanvas().style.cursor = '';
        map.setPaintProperty(fillId, 'fill-opacity', 0.15);
      });
      map.on('click', fillId, () => {
        setSelectedTerritory(t.name);
        setSearchQuery('');
      });
    });

    // Fit map to visible territories
    if (visible.length > 0 && filterTerritory !== 'all') {
      const bounds = new mapboxgl.LngLatBounds();
      visible.forEach(t => t.coordinates[0].forEach(c => bounds.extend(c)));
      map.fitBounds(bounds, { padding: 60, duration: 800 });
    }
  }, [dynamicTerritories, filterTerritory, mapLoaded]);

  useEffect(() => { drawTerritories(); }, [drawTerritories]);

  // Render address markers (filtered by territory filter)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const visibleAddresses = filterTerritory === 'all'
      ? addresses
      : addresses.filter(a => resolveBoroughForCity(a.city || 'Unknown') === filterTerritory);

    visibleAddresses.forEach(a => {
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
            .setHTML(`<div style="color:#000;font-size:12px"><strong>${a.store_name || 'Unknown Store'}</strong><br/><span style="color:#555">${a.full_address || '—'}</span><br/><span style="color:#888;font-size:11px">${(a.discovery_status || 'new').replace('_', ' ')} · ${a.discovered_by || '—'}</span></div>`)
        )
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [addresses, filterTerritory]);

  const flyToAddress = (addr: TerritoryAddress) => {
    if (!mapRef.current || !addr.latitude || !addr.longitude) return;
    mapRef.current.flyTo({ center: [addr.longitude, addr.latitude], zoom: 16, duration: 1200 });
    // Find in currently visible markers
    const visibleAddresses = filterTerritory === 'all'
      ? addresses
      : addresses.filter(a => resolveBoroughForCity(a.city || 'Unknown') === filterTerritory);
    const idx = visibleAddresses.findIndex(a => a.id === addr.id);
    if (idx >= 0 && markersRef.current[idx]) {
      markersRef.current[idx].togglePopup();
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-220px)] rounded-lg overflow-hidden border border-border">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Territory filter dropdown */}
      <div className="absolute top-3 right-3 z-20">
        <div className="flex items-center gap-2 bg-background/90 backdrop-blur rounded-lg border border-border p-2 shadow-lg">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterTerritory} onValueChange={(val) => {
            setFilterTerritory(val);
            if (val !== 'all') {
              setSelectedTerritory(val);
              setSearchQuery('');
            } else {
              setSelectedTerritory(null);
            }
          }}>
            <SelectTrigger className="w-[180px] h-8 text-sm border-none bg-transparent">
              <SelectValue placeholder="All Territories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Territories ({addresses.length})</SelectItem>
              {dynamicTerritories.map(t => (
                <SelectItem key={t.name} value={t.name}>
                  {t.name} ({t.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Slide-out panel */}
      {selectedTerritory && (
        <div className="absolute top-0 right-0 h-full w-[380px] bg-background/95 backdrop-blur border-l border-border shadow-xl flex flex-col z-10">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="font-semibold text-lg">{selectedTerritory}</h3>
              <p className="text-xs text-muted-foreground">{territoryAddresses.length} ingested addresses</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => {
              setSelectedTerritory(null);
              if (filterTerritory !== 'all') setFilterTerritory('all');
            }}>
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
