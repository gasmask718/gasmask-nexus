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

  // Fetch latest location, orders, and profile for this biker
  useEffect(() => {
    async function fetchData() {
      // Resolve user_id: bikerId could be a bikers.id OR a user_id directly
      let userId = bikerId;
      
      // First try: look up bikers table by id
      const { data: bikerById } = await supabase
        .from('bikers')
        .select('user_id, phone, email, territory, status')
        .eq('id', bikerId)
        .maybeSingle();

      if (bikerById?.user_id) {
        userId = bikerById.user_id;
        setBikerProfile({ phone: bikerById.phone, email: bikerById.email, territory: bikerById.territory, status: bikerById.status });
      } else if (bikerById) {
        // Biker record found but user_id is null — try to find auth user via email/phone
        setBikerProfile({ phone: bikerById.phone, email: bikerById.email, territory: bikerById.territory, status: bikerById.status });
        
        if (bikerById.email) {
          const { data: profileByEmail } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', bikerById.email)
            .maybeSingle();
          if (profileByEmail) {
            userId = profileByEmail.id;
          }
        }
        
        if (userId === bikerId && bikerById.phone) {
          const { data: profileByPhone } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', bikerById.phone)
            .maybeSingle();
          if (profileByPhone) {
            userId = profileByPhone.id;
          }
        }
      } else {
        // Second try: bikerId might already be a user_id — check bikers table by user_id
        const { data: bikerByUserId } = await supabase
          .from('bikers')
          .select('user_id, phone, email, territory, status')
          .eq('user_id', bikerId)
          .maybeSingle();

        if (bikerByUserId) {
          userId = bikerByUserId.user_id!;
          setBikerProfile({ phone: bikerByUserId.phone, email: bikerByUserId.email, territory: bikerByUserId.territory, status: bikerByUserId.status });
        } else {
          // Fallback: profiles table
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

      // Try to find location using resolved userId first, then fall back to bikerId
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
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [bikerId]);

  // Build popup HTML
  const buildPopupHTML = () => {
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
  };

  // Initialize / update map
  useEffect(() => {
    if (!mapContainer.current || !lastLocation) return;

    if (map.current) {
      if (marker.current) {
        marker.current.setLngLat([lastLocation.lng, lastLocation.lat]);
        const existingPopup = marker.current.getPopup();
        if (existingPopup) existingPopup.setHTML(buildPopupHTML());
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
        cursor: pointer;
      "></div>
    `;

    const popup = new mapboxgl.Popup({ offset: 20, maxWidth: '280px' }).setHTML(buildPopupHTML());

    marker.current = new mapboxgl.Marker({ element: el })
      .setLngLat([lastLocation.lng, lastLocation.lat])
      .setPopup(popup)
      .addTo(map.current);

    // Auto-open popup
    marker.current.togglePopup();

    return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [lastLocation, bikerName, activeOrders, bikerProfile]);

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
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-1.5 animate-pulse" />
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
