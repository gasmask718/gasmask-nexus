import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

interface ActiveOrder {
  id: string;
  store_name: string;
  status: string;
  eta?: string;
}

interface LiveLocationMapProps {
  className?: string;
  height?: string;
}

export function LiveLocationMap({ className = '', height = '300px' }: LiveLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const watchId = useRef<number | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const { data: profileData } = useCurrentUserProfile();
  const userName = profileData?.profile?.full_name || 'Me';

  // Fetch active orders/visits for popup
  useEffect(() => {
    async function fetchActiveOrders() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];
        const { data: visits } = await supabase
          .from('store_visits')
          .select(`id, status, visit_type, store_master:store_id (store_name)`)
          .eq('visited_by', user.id)
          .gte('created_at', today)
          .in('status', ['pending', 'in_progress'])
          .limit(5);

        if (visits) {
          setActiveOrders(visits.map((v: any) => ({
            id: v.id,
            store_name: v.store_master?.store_name || 'Unknown',
            status: v.status,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch active orders:', err);
      }
    }
    fetchActiveOrders();
  }, []);

  // Log location to DB
  const logLocation = useCallback(async (lat: number, lng: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('location_events').insert({
        user_id: user.id,
        event_type: 'live_tracking',
        lat,
        lng,
      });
    } catch (err) {
      // silent - don't block UI for logging
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.006, 40.7128],
      zoom: 14,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Watch position
  useEffect(() => {
    if (!navigator.geolocation) return;

    let logInterval: ReturnType<typeof setInterval> | null = null;
    let lastLoggedPos: { lat: number; lng: number } | null = null;
    let hasLoggedFirst = false;

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setPosition({ lat, lng });
        lastLoggedPos = { lat, lng };

        // Log immediately on first GPS fix
        if (!hasLoggedFirst) {
          hasLoggedFirst = true;
          logLocation(lat, lng);
        }

        // Update marker position
        if (map.current) {
          if (!marker.current) {
            // Create custom marker element
            const el = document.createElement('div');
            el.className = 'live-location-marker';
            el.innerHTML = `
              <div style="
                width: 20px; height: 20px;
                background: hsl(210, 100%, 56%);
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 0 0 4px hsla(210, 100%, 56%, 0.3), 0 2px 8px rgba(0,0,0,0.3);
                animation: pulse-ring 2s ease-out infinite;
              "></div>
            `;

            marker.current = new mapboxgl.Marker({ element: el })
              .setLngLat([lng, lat])
              .addTo(map.current);

            // Create popup
            const popupContent = buildPopupContent(userName, activeOrders);
            popup.current = new mapboxgl.Popup({ offset: 25, closeButton: false })
              .setHTML(popupContent);

            marker.current.setPopup(popup.current);
          } else {
            marker.current.setLngLat([lng, lat]);
          }

          map.current.easeTo({ center: [lng, lat], duration: 1000 });
        }
      },
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    // Log position every 30 seconds
    logInterval = setInterval(() => {
      if (lastLoggedPos) {
        logLocation(lastLoggedPos.lat, lastLoggedPos.lng);
      }
    }, 30000);

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (logInterval) clearInterval(logInterval);
    };
  }, [logLocation, userName, activeOrders]);

  // Update popup content when orders change
  useEffect(() => {
    if (popup.current) {
      popup.current.setHTML(buildPopupContent(userName, activeOrders));
    }
  }, [activeOrders, userName]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            My Location
          </CardTitle>
          {position && (
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-1.5 animate-pulse" />
              Live
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-lg">
        <div ref={mapContainer} style={{ height, width: '100%' }} />
        <style>{`
          @keyframes pulse-ring {
            0% { box-shadow: 0 0 0 4px hsla(210, 100%, 56%, 0.3), 0 2px 8px rgba(0,0,0,0.3); }
            70% { box-shadow: 0 0 0 12px hsla(210, 100%, 56%, 0), 0 2px 8px rgba(0,0,0,0.3); }
            100% { box-shadow: 0 0 0 4px hsla(210, 100%, 56%, 0), 0 2px 8px rgba(0,0,0,0.3); }
          }
        `}</style>
      </CardContent>
    </Card>
  );
}

function buildPopupContent(name: string, orders: ActiveOrder[]): string {
  const ordersList = orders.length > 0
    ? orders.map(o => `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;">
        <span>${o.store_name}</span>
        <span style="background:${o.status === 'in_progress' ? '#f59e0b' : '#6b7280'};color:white;padding:1px 6px;border-radius:4px;font-size:10px;">${o.status}</span>
      </div>`).join('')
    : '<div style="color:#888;font-size:12px;">No active orders</div>';

  return `
    <div style="min-width:180px;font-family:system-ui;">
      <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${name}</div>
      <div style="font-size:11px;color:#888;margin-bottom:4px;">Active Orders</div>
      ${ordersList}
    </div>
  `;
}

export default LiveLocationMap;
