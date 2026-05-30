/**
 * AmbassadorStoreMap — Mapbox canvas showing the ambassador's portfolio stores.
 * RLS-scoped: only stores returned by useAmbassadorPortfolio are plotted.
 * Coordinates come from the `stores` table (legacy lat/lng store), joined by id.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAmbassadorPortfolio } from '@/hooks/useAmbassadorPortfolio';

interface StoreCoord {
  id: string;
  lat: number;
  lng: number;
}

export function AmbassadorStoreMap() {
  const navigate = useNavigate();
  const { stores, isLoading } = useAmbassadorPortfolio();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const storeIds = useMemo(() => stores.map((s) => s.store_id), [stores]);

  // Fetch coords for the ambassador's stores from the `stores` legacy table
  const { data: coords } = useQuery({
    queryKey: ['ambassador-store-coords', storeIds],
    enabled: storeIds.length > 0,
    queryFn: async (): Promise<StoreCoord[]> => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, lat, lng')
        .in('id', storeIds)
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id as string,
        lat: Number(r.lat),
        lng: Number(r.lng),
      }));
    },
  });

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-73.95, 40.72], // NYC default
      zoom: 10,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current.on('load', () => setMapReady(true));
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Render markers when data + map ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !coords) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const coordById = new Map(coords.map((c) => [c.id, c]));
    const bounds = new mapboxgl.LngLatBounds();
    let plotted = 0;

    stores.forEach((store) => {
      const c = coordById.get(store.store_id);
      if (!c) return;

      const el = document.createElement('div');
      el.className = 'cursor-pointer';
      const isSourced = store.assignment_type === 'sourced';
      el.style.cssText = `
        width: 22px; height: 22px; border-radius: 50%;
        background: ${isSourced ? 'hsl(142 76% 45%)' : 'hsl(217 91% 60%)'};
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      `;

      const popupHtml = `
        <div style="font-family: ui-sans-serif, system-ui; padding: 2px 4px; max-width: 220px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
            ${escapeHtml(store.store_name || 'Unnamed store')}
          </div>
          <div style="font-size: 12px; color: #555; margin-bottom: 4px;">
            ${escapeHtml([store.store_address, store.store_city, store.store_state].filter(Boolean).join(', '))}
          </div>
          <div style="display:flex; gap:6px; align-items:center; font-size: 11px; margin-bottom: 6px;">
            <span style="padding:2px 6px; border-radius: 4px; background:${isSourced ? '#dcfce7' : '#dbeafe'}; color:${isSourced ? '#166534' : '#1e40af'};">
              ${store.assignment_type}
            </span>
            ${store.is_primary ? '<span style="padding:2px 6px; border-radius:4px; background:#fef3c7; color:#92400e;">primary</span>' : ''}
            <span style="color:#666;">Comm ${store.commission_rate}%</span>
          </div>
          <button id="ambassador-store-open-${store.store_id}"
            style="display:block;width:100%;padding:6px 8px;font-size:12px;font-weight:500;background:#111;color:#fff;border:0;border-radius:6px;cursor:pointer;">
            Open store →
          </button>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 16, closeButton: true }).setHTML(popupHtml);
      popup.on('open', () => {
        const btn = document.getElementById(`ambassador-store-open-${store.store_id}`);
        btn?.addEventListener('click', () => navigate(`/ambassador/stores/${store.store_id}`));
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([c.lng, c.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([c.lng, c.lat]);
      plotted++;
    });

    if (plotted > 0) {
      map.fitBounds(bounds, { padding: 50, maxZoom: 14, duration: 400 });
    }
  }, [stores, coords, mapReady, navigate]);

  const tokenMissing = !import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
  const plottedCount = coords?.length ?? 0;
  const missingCoords = stores.length - plottedCount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          My Stores Map
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {plottedCount} on map{missingCoords > 0 ? ` · ${missingCoords} missing location` : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {tokenMissing ? (
          <div className="p-6 text-sm text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500" />
            Map unavailable: VITE_MAPBOX_PUBLIC_TOKEN is not configured.
          </div>
        ) : (
          <div
            ref={containerRef}
            className="w-full h-[320px] sm:h-[420px] rounded-b-lg overflow-hidden"
            aria-label="Map of your stores"
          />
        )}
        {!tokenMissing && !isLoading && stores.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No stores in your portfolio yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
