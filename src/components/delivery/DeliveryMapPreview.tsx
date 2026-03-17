import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Map, Clock, Navigation, Maximize2, Minimize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

interface DeliveryMapPreviewProps {
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string;
  recipientName?: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupAddress?: string;
  workerName?: string;
  bikerId?: string | null;
  driverId?: string | null;
  className?: string;
  expanded?: boolean;
}

export function DeliveryMapPreview({
  deliveryLat,
  deliveryLng,
  deliveryAddress,
  recipientName,
  pickupLat,
  pickupLng,
  pickupAddress,
  workerName,
  bikerId,
  driverId,
  className = '',
  expanded: initialExpanded = false,
}: DeliveryMapPreviewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [routeInfo, setRouteInfo] = useState<{ eta: string; distance: string } | null>(null);
  const [workerLocation, setWorkerLocation] = useState<[number, number] | null>(null);

  // Fetch live worker location
  useEffect(() => {
    if (!bikerId && !driverId) return;

    const fetchWorkerLocation = async () => {
      let userId: string | null = null;

      if (bikerId) {
        const { data } = await supabase.from('bikers').select('user_id').eq('id', bikerId).maybeSingle();
        userId = data?.user_id || null;
      } else if (driverId) {
        const { data } = await supabase.from('drivers').select('user_id').eq('id', driverId).maybeSingle();
        userId = data?.user_id || null;
      }

      if (!userId) return;

      // Try drivers_live_location first
      const { data: liveRow } = await supabase
        .from('drivers_live_location')
        .select('lat, lng')
        .eq('driver_id', worker.user_id)
        .maybeSingle();

      if (liveRow?.lat && liveRow?.lng && liveRow.lat !== 0 && liveRow.lng !== 0) {
        setWorkerLocation([Number(liveRow.lng), Number(liveRow.lat)]);
        return;
      }

      // Fallback: latest location_events
      const { data: events } = await supabase
        .from('location_events')
        .select('lat, lng')
        .eq('user_id', worker.user_id)
        .order('created_at', { ascending: false })
        .limit(5);

      const validEvent = (events || []).find((e: any) => e.lat !== 0 && e.lng !== 0);
      if (validEvent) {
        setWorkerLocation([Number(validEvent.lng), Number(validEvent.lat)]);
      }
    };

    fetchWorkerLocation();
  }, [bikerId, driverId]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN) return;
    if (!deliveryLat || !deliveryLng) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const destCoords: [number, number] = [Number(deliveryLng), Number(deliveryLat)];
    
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: destCoords,
      zoom: 13,
      accessToken: MAPBOX_TOKEN,
    });
    mapRef.current = map;

    // Destination pin (red)
    new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat(destCoords)
      .setPopup(new mapboxgl.Popup().setHTML(`<strong>${recipientName || 'Delivery'}</strong><br/>${deliveryAddress}`))
      .addTo(map);

    // Origin: worker location > pickup coords > store coords
    const originCoords: [number, number] | null = workerLocation
      || (pickupLat && pickupLng ? [Number(pickupLng), Number(pickupLat)] : null);

    if (originCoords) {
      // Worker/pickup pin (blue)
      new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat(originCoords)
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>${workerName || 'Worker'}</strong><br/>${pickupAddress || 'Current Location'}`))
        .addTo(map);

      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(originCoords);
      bounds.extend(destCoords);
      map.fitBounds(bounds, { padding: 60 });

      // Draw dashed trajectory line
      const addLine = () => {
        if (map.getSource('trajectory')) return;
        map.addSource('trajectory', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [originCoords, destCoords],
            },
          },
        });
        map.addLayer({
          id: 'trajectory',
          type: 'line',
          source: 'trajectory',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 2.5,
            'line-opacity': 0.5,
            'line-dasharray': [4, 3],
          },
        });
      };

      if (map.isStyleLoaded()) addLine();
      else map.on('load', addLine);

      // Fetch driving route for ETA
      fetchRoute(originCoords, destCoords, map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [deliveryLat, deliveryLng, workerLocation, pickupLat, pickupLng, expanded]);

  const fetchRoute = async (origin: [number, number], dest: [number, number], map: mapboxgl.Map) => {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${dest[0]},${dest[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        setRouteInfo({
          eta: `${Math.round(route.duration / 60)} min`,
          distance: `${(route.distance / 1000).toFixed(1)} km`,
        });

        const addRouteLayer = () => {
          if (map.getSource('route')) return;
          map.addSource('route', { type: 'geojson', data: route.geometry });
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.8 },
          });
        };

        if (map.isStyleLoaded()) addRouteLayer();
        else map.on('load', addRouteLayer);
      }
    } catch (err) {
      console.warn('Route fetch failed:', err);
    }
  };

  if (!deliveryLat || !deliveryLng) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center text-muted-foreground text-sm">
          <Map className="h-6 w-6 mx-auto mb-2 opacity-30" />
          No delivery coordinates available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {routeInfo && (
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 text-sm bg-muted/50 rounded-md px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{routeInfo.eta}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm bg-muted/50 rounded-md px-3 py-1.5">
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{routeInfo.distance}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 w-8 p-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          <div
            ref={mapContainerRef}
            className={`rounded-lg transition-all ${expanded ? 'h-[450px]' : 'h-[250px]'}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
