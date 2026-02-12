import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZ2FzbWFza2FwcHJvdmVkbGxjIiwiYSI6ImNtaTlkYjJ4czBtOWsycXBqMmh4dDlqaGMifQ.OVfGs2Bp6VLc0SBfMDrWpA';

interface BikerLocationPreviewProps {
  bikerId: string;
  bikerName: string;
  className?: string;
  height?: string;
}

export function BikerLocationPreview({ bikerId, bikerName, className = '', height = '250px' }: BikerLocationPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [activeOrders, setActiveOrders] = useState<{ store_name: string; status: string }[]>([]);

  // Fetch latest location for this biker
  useEffect(() => {
    async function fetchLocation() {
      // Try to get user_id from bikers table first
      let userId = bikerId;
      const { data: biker } = await supabase
        .from('bikers')
        .select('user_id')
        .eq('id', bikerId)
        .maybeSingle();

      if (biker?.user_id) {
        userId = biker.user_id;
      }
      // If not found in bikers table, bikerId IS the user_id (from user_roles)

      // Get latest location event
      const { data: locEvent } = await supabase
        .from('location_events')
        .select('lat, lng, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (locEvent && locEvent.lat && locEvent.lng) {
        setLastLocation({
          lat: Number(locEvent.lat),
          lng: Number(locEvent.lng),
          time: locEvent.created_at,
        });
      }

      // Get active visits for this user
      const today = new Date().toISOString().split('T')[0];
      const { data: visits } = await supabase
        .from('store_visits')
        .select(`status, store_master:store_id (store_name)`)
        .eq('visited_by', userId)
        .gte('created_at', today)
        .in('status', ['pending', 'in_progress'])
        .limit(3);

      if (visits) {
        setActiveOrders(visits.map((v: any) => ({
          store_name: v.store_master?.store_name || 'Unknown',
          status: v.status,
        })));
      }
    }

    fetchLocation();

    // Poll every 30s
    const interval = setInterval(fetchLocation, 30000);
    return () => clearInterval(interval);
  }, [bikerId]);

  // Initialize map when location is available
  useEffect(() => {
    if (!mapContainer.current || !lastLocation) return;

    if (map.current) {
      // Update existing map
      if (marker.current) {
        marker.current.setLngLat([lastLocation.lng, lastLocation.lat]);
      }
      map.current.easeTo({ center: [lastLocation.lng, lastLocation.lat] });
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lastLocation.lng, lastLocation.lat],
      zoom: 15,
      interactive: true,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const el = document.createElement('div');
    el.innerHTML = `
      <div style="
        width: 18px; height: 18px;
        background: hsl(142, 71%, 45%);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 3px hsla(142, 71%, 45%, 0.3), 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    `;

    const popupContent = `
      <div style="min-width:160px;font-family:system-ui;">
        <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${bikerName}</div>
        <div style="font-size:11px;color:#888;">Last seen: ${new Date(lastLocation.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        ${activeOrders.length > 0
          ? `<div style="margin-top:6px;font-size:11px;color:#888;">Active Orders:</div>` +
            activeOrders.map(o => `<div style="font-size:12px;padding:1px 0;">${o.store_name} <span style="background:${o.status === 'in_progress' ? '#f59e0b' : '#6b7280'};color:white;padding:1px 4px;border-radius:3px;font-size:10px;">${o.status}</span></div>`).join('')
          : '<div style="color:#888;font-size:11px;margin-top:4px;">No active orders</div>'
        }
      </div>
    `;

    marker.current = new mapboxgl.Marker({ element: el })
      .setLngLat([lastLocation.lng, lastLocation.lat])
      .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(popupContent))
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [lastLocation, bikerName, activeOrders]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {bikerName}'s Location
          </CardTitle>
          {lastLocation && (
            <Badge variant="outline" className="text-xs">
              {new Date(lastLocation.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-lg">
        {!lastLocation ? (
          <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
            No location data available
          </div>
        ) : (
          <div ref={mapContainer} style={{ height, width: '100%' }} />
        )}
      </CardContent>
    </Card>
  );
}

export default BikerLocationPreview;
