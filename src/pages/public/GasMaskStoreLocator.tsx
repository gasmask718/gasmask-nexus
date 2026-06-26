import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, Search, Flame } from 'lucide-react';

interface LocatorStore {
  store_id: string;
  store_name: string | null;
  neighborhood: string | null;
  city: string | null;
  street: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * GasMask Store Locator — public-facing.
 * DRY: reuses the existing `v_public_store_locator` DB view (active stores only)
 * and the already-bundled mapbox-gl dependency (same pattern as `src/pages/LiveMap.tsx`).
 * No new map abstraction is introduced; styling overridden for the streetwear aesthetic.
 */
export default function GasMaskStoreLocator() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Record<string, mapboxgl.Marker>>({});
  const [stores, setStores] = useState<LocatorStore[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LocatorStore | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).rpc('get_public_store_locator');
      if (!error && Array.isArray(data)) setStores(data as LocatorStore[]);
    })();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';
    if (!token) return;
    mapboxgl.accessToken = token;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-74.006, 40.7128],
      zoom: 10.5,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      [s.store_name, s.neighborhood, s.city, s.street]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [stores, query]);

  useEffect(() => {
    if (!map.current) return;
    // remove stale
    Object.keys(markers.current).forEach((id) => {
      if (!filtered.find((s) => s.store_id === id)) {
        markers.current[id].remove();
        delete markers.current[id];
      }
    });
    const bounds = new mapboxgl.LngLatBounds();
    filtered.forEach((s) => {
      if (s.lat == null || s.lng == null) return;
      bounds.extend([s.lng, s.lat]);
      if (markers.current[s.store_id]) {
        markers.current[s.store_id].setLngLat([s.lng, s.lat]);
        return;
      }
      const el = document.createElement('div');
      el.style.cssText =
        'width:24px;height:24px;border-radius:50%;background:#FF0000;border:3px solid #fff;box-shadow:0 0 12px rgba(255,0,0,0.6);cursor:pointer;';
      el.addEventListener('click', () => {
        setSelected(s);
        map.current?.flyTo({ center: [s.lng!, s.lat!], zoom: 15 });
      });
      markers.current[s.store_id] = new mapboxgl.Marker(el)
        .setLngLat([s.lng, s.lat])
        .addTo(map.current!);
    });
    if (filtered.length && !bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
    }
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold uppercase tracking-wider">
            <Flame className="h-3 w-3" /> Approved Locations
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            Find <span className="text-red-500">GasMask</span> Near You
          </h1>
          <p className="text-muted-foreground">
            {stores.length} active stores carrying the heat.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by store, neighborhood, or city..."
            className="pl-9 bg-card border-border"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-0 overflow-hidden border-red-500/20">
            <div ref={mapContainer} className="h-[600px] w-full bg-black" />
          </Card>

          <Card className="p-4 max-h-[600px] overflow-y-auto border-border">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-3 text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'Store' : 'Stores'}
            </h3>
            <div className="space-y-2">
              {filtered.map((s) => (
                <button
                  key={s.store_id}
                  onClick={() => {
                    setSelected(s);
                    if (s.lat != null && s.lng != null) {
                      map.current?.flyTo({ center: [s.lng, s.lat], zoom: 15 });
                    }
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selected?.store_id === s.store_id
                      ? 'bg-red-500/10 border-red-500/50'
                      : 'bg-secondary/30 border-transparent hover:border-red-500/30 hover:bg-secondary/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">
                        {s.store_name || 'Unnamed Store'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[s.street, s.city].filter(Boolean).join(', ') || '—'}
                      </div>
                      {s.neighborhood && (
                        <Badge variant="outline" className="mt-1.5 text-[10px] border-red-500/30 text-red-400">
                          {s.neighborhood}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No stores match your search.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
