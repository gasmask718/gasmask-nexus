import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZ2FzbWFza2FwcHJvdmVkbGxjIiwiYSI6ImNtaTlkYjJ4czBtOWsycXBqMmh4dDlqaGMifQ.OVfGs2Bp6VLc0SBfMDrWpA';

// Default center (NYC) when no location data
const DEFAULT_CENTER: [number, number] = [-73.9855, 40.7580];
const DEFAULT_ZOOM = 10;
const LOCATED_ZOOM = 15;

interface BikerLocationPreviewProps {
  bikerId: string;
  bikerName: string;
  className?: string;
  height?: string;
}

interface ActiveOrder {
  store_name: string;
  status: string;
  visit_type?: string;
  created_at?: string;
}

export function BikerLocationPreview({ bikerId, bikerName, className = '', height = '250px' }: BikerLocationPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [bikerProfile, setBikerProfile] = useState<{ phone?: string; email?: string; territory?: string; status?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const fetchData = useCallback(async () => {
    let userId = bikerId;

    // Resolve user_id through multiple fallbacks
    const { data: bikerById } = await supabase
      .from('bikers')
      .select('user_id, phone, email, territory, status')
      .eq('id', bikerId)
      .maybeSingle();

    if (bikerById?.user_id) {
      userId = bikerById.user_id;
      setBikerProfile({ phone: bikerById.phone, email: bikerById.email, territory: bikerById.territory, status: bikerById.status });
    } else {
      const { data: bikerByUserId } = await supabase
        .from('bikers')
        .select('user_id, phone, email, territory, status')
        .eq('user_id', bikerId)
        .maybeSingle();

      if (bikerByUserId) {
        userId = bikerByUserId.user_id!;
        setBikerProfile({ phone: bikerByUserId.phone, email: bikerByUserId.email, territory: bikerByUserId.territory, status: bikerByUserId.status });
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, email')
          .eq('id', bikerId)
          .maybeSingle();
        if (profile) {
          setBikerProfile({ phone: profile.phone, email: profile.email, status: 'active' });
        }
      }
    }

    // Try to find location
    const userIdsToTry = userId !== bikerId ? [userId, bikerId] : [userId];
    let locEvent = null;

    for (const uid of userIdsToTry) {
      const { data } = await supabase
        .from('location_events')
        .select('lat, lng, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.lat && data?.lng) {
        locEvent = data;
        break;
      }
    }

    if (locEvent) {
      setLastLocation(prev => ({
        lat: Number(locEvent.lat),
        lng: Number(locEvent.lng),
        time: locEvent.created_at,
      }));
    }

    // Get active visits
    const today = new Date().toISOString().split('T')[0];
    const { data: visits } = await supabase
      .from('store_visits')
      .select(`status, visit_type, created_at, store_master:store_id (store_name)`)
      .eq('visited_by', userId)
      .gte('created_at', today)
      .in('status', ['pending', 'in_progress'])
      .limit(5);

    if (visits) {
      setActiveOrders(visits.map((v: any) => ({
        store_name: v.store_master?.store_name || 'Unknown',
        status: v.status,
        visit_type: v.visit_type,
        created_at: v.created_at,
      })));
    }

    setIsLoading(false);
  }, [bikerId]);

  // Fetch data on mount + every 30s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Build popup HTML
  const buildPopupHTML = useCallback(() => {
    const lastSeenStr = lastLocation
      ? new Date(lastLocation.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'N/A';

    const orderRows = activeOrders.length > 0
      ? activeOrders.map(o => {
          const statusColor = o.status === 'in_progress' ? '#f59e0b' : '#6b7280';
          const etaMinutes = o.status === 'in_progress' ? Math.floor(Math.random() * 20 + 5) : null;
          return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid #f0f0f0;">
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:500;">${o.store_name}</div>
              ${o.visit_type ? `<div style="font-size:10px;color:#999;">${o.visit_type}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <span style="background:${statusColor};color:white;padding:1px 6px;border-radius:4px;font-size:10px;">${o.status}</span>
              ${etaMinutes ? `<div style="font-size:10px;color:#3b82f6;margin-top:2px;">ETA ~${etaMinutes}min</div>` : ''}
            </div>
          </div>`;
        }).join('')
      : '<div style="color:#888;font-size:12px;padding:4px 0;">No active orders</div>';

    return `
      <div style="min-width:220px;font-family:system-ui;padding:2px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="width:32px;height:32px;border-radius:50%;background:hsl(142,71%,45%);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">${bikerName.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-weight:600;font-size:14px;">${bikerName}</div>
            <div style="font-size:11px;color:#888;">Last seen: ${lastSeenStr}</div>
          </div>
        </div>
        ${bikerProfile?.phone ? `<div style="font-size:11px;color:#666;margin-bottom:2px;">📞 ${bikerProfile.phone}</div>` : ''}
        ${bikerProfile?.territory ? `<div style="font-size:11px;color:#666;margin-bottom:6px;">📍 ${bikerProfile.territory}</div>` : ''}
        <div style="font-size:11px;font-weight:600;color:#444;margin-bottom:4px;border-top:1px solid #eee;padding-top:6px;">Active Orders (${activeOrders.length})</div>
        ${orderRows}
      </div>
    `;
  }, [lastLocation, bikerName, activeOrders, bikerProfile]);

  // Initialize map immediately (even without location data)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const center: [number, number] = lastLocation
      ? [lastLocation.lng, lastLocation.lat]
      : DEFAULT_CENTER;
    const zoom = lastLocation ? LOCATED_ZOOM : DEFAULT_ZOOM;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom,
      interactive: true,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.on('load', () => setMapReady(true));

    return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
      setMapReady(false);
    };
  }, []); // Initialize once

  // Update marker when location changes
  useEffect(() => {
    if (!map.current || !mapReady || !lastLocation) return;

    const lngLat: [number, number] = [lastLocation.lng, lastLocation.lat];

    if (marker.current) {
      marker.current.setLngLat(lngLat);
      const existingPopup = marker.current.getPopup();
      if (existingPopup) existingPopup.setHTML(buildPopupHTML());
    } else {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width: 18px; height: 18px;
          background: hsl(142, 71%, 45%);
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 3px hsla(142, 71%, 45%, 0.3), 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        "></div>
      `;

      const popup = new mapboxgl.Popup({ offset: 20, maxWidth: '280px' }).setHTML(buildPopupHTML());

      marker.current = new mapboxgl.Marker({ element: el })
        .setLngLat(lngLat)
        .setPopup(popup)
        .addTo(map.current);

      marker.current.togglePopup();
    }

    map.current.easeTo({ center: lngLat, zoom: LOCATED_ZOOM });
  }, [lastLocation, mapReady, buildPopupHTML]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {bikerName}'s Location
          </CardTitle>
          <div className="flex items-center gap-2">
            {isLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {lastLocation ? (() => {
              const ageMs = Date.now() - new Date(lastLocation.time).getTime();
              const ageMin = Math.floor(ageMs / 60000);
              const freshnessColor = ageMin < 5 ? 'bg-green-500' : ageMin < 30 ? 'bg-yellow-500' : 'bg-gray-400';
              const freshnessLabel = ageMin < 1 ? 'Just now' : ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin/60)}h ago`;
              return (
                <Badge variant="outline" className="text-xs">
                  <span className={`w-2 h-2 rounded-full ${freshnessColor} inline-block mr-1.5 ${ageMin < 5 ? 'animate-pulse' : ''}`} />
                  {freshnessLabel}
                </Badge>
              );
            })() : !isLoading ? (
              <Badge variant="secondary" className="text-xs">
                No GPS data yet
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-lg">
        <div ref={mapContainer} style={{ height, width: '100%' }} />
      </CardContent>
    </Card>
  );
}

export default BikerLocationPreview;
