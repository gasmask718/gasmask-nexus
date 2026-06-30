/**
 * LiveNavigationMap — Waze-style turn-by-turn map for drivers & ambassadors.
 *
 * Features:
 *  - Auto-requests browser geolocation (current position)
 *  - Calls Mapbox Directions API with `mapbox/driving-traffic` profile
 *  - Draws the best route + live traffic tile overlay (green/yellow/red)
 *  - Floating ETA / distance / next-turn card
 *  - "Heavy traffic ahead" warning when live ETA >> free-flow ETA
 */
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Navigation, MapPin, Loader2 } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;

export interface NavDestination {
  lat: number;
  lng: number;
  label?: string;
}

interface LiveNavigationMapProps {
  destination: NavDestination | null;
  /** Optional fixed origin; otherwise uses browser geolocation. */
  origin?: { lat: number; lng: number } | null;
  /** Map container height. Defaults to 380px. */
  height?: number | string;
  /** Title shown above the map (e.g. "Next Delivery"). */
  title?: string;
}

interface RouteSummary {
  durationSec: number;
  durationTypicalSec?: number;
  distanceM: number;
  nextStep?: string;
  geometry: GeoJSON.LineString;
}

function formatDuration(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatDistance(m: number): string {
  const miles = m / 1609.34;
  if (miles < 0.2) return `${Math.round(m * 3.28084)} ft`;
  return `${miles.toFixed(1)} mi`;
}

// Haversine distance (meters) between two lng/lat points.
function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Perpendicular distance (meters) from point p to segment a-b, using a flat
// equirectangular projection — accurate enough at street scale.
function pointToSegmentM(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const mPerDegLat = 111_320;
  const lat0 = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const mPerDegLng = 111_320 * Math.cos(lat0);
  const ax = a[0] * mPerDegLng, ay = a[1] * mPerDegLat;
  const bx = b[0] * mPerDegLng, by = b[1] * mPerDegLat;
  const px = p[0] * mPerDegLng, py = p[1] * mPerDegLat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return haversineM(p, a);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function minDistanceToPolyline(
  pos: { lat: number; lng: number },
  coords: [number, number][]
): number {
  if (!coords.length) return Infinity;
  const p: [number, number] = [pos.lng, pos.lat];
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentM(p, coords[i], coords[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

export const LiveNavigationMap: React.FC<LiveNavigationMapProps> = ({
  destination,
  origin,
  height = 380,
  title,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);

  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(origin ?? null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [rerouteToken, setRerouteToken] = useState(0);
  const [rerouting, setRerouting] = useState(false);
  const lastRerouteAt = useRef(0);
  const offRouteSince = useRef<number | null>(null);
  const fetchOriginRef = useRef<{ lat: number; lng: number } | null>(null);

  // 1. Geolocation watcher — high-frequency updates for Waze-style smooth tracking.
  //    Transient TIMEOUT / POSITION_UNAVAILABLE (tunnels, parking garages) are
  //    suppressed for 15 s so the UI keeps the last-known position and route
  //    instead of flashing an error on every failed fix.
  useEffect(() => {
    if (origin) {
      setCurrentPos(origin);
      return;
    }
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.');
      return;
    }
    let firstErrorAt: number | null = null;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        firstErrorAt = null;
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(null);
      },
      (err) => {
        // PERMISSION_DENIED (1) is permanent → surface immediately.
        if (err.code === 1) {
          setGeoError('Location permission denied. Enable GPS to navigate.');
          return;
        }
        // TIMEOUT (3) / POSITION_UNAVAILABLE (2) → likely tunnel; debounce.
        if (firstErrorAt == null) firstErrorAt = Date.now();
        if (Date.now() - firstErrorAt > 15_000) {
          setGeoError('Waiting for GPS signal…');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [origin]);

  // 1b. Screen Wake Lock — keep the phone awake while navigation is mounted
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const anyNav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
    };
    if (!anyNav.wakeLock) return;

    const acquire = async () => {
      try {
        lock = await anyNav.wakeLock!.request('screen');
      } catch {
        /* user gesture may be required; ignore */
      }
    };
    acquire();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !released) acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release().catch(() => undefined);
    };
  }, []);

  // 2. Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: currentPos ? [currentPos.lng, currentPos.lat] : [-98.5795, 39.8283],
      zoom: currentPos ? 13 : 3,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      'top-right'
    );

    map.on('load', () => {
      // Live traffic tile overlay (green/yellow/orange/red)
      if (!map.getSource('mapbox-traffic')) {
        map.addSource('mapbox-traffic', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-traffic-v1',
        });
        map.addLayer({
          id: 'traffic',
          type: 'line',
          source: 'mapbox-traffic',
          'source-layer': 'traffic',
          paint: {
            'line-width': 2.5,
            'line-color': [
              'match',
              ['get', 'congestion'],
              'low', '#22c55e',
              'moderate', '#facc15',
              'heavy', '#f97316',
              'severe', '#ef4444',
              '#94a3b8',
            ],
          },
        });
      }
      // Route line placeholder
      if (!map.getSource('nav-route')) {
        map.addSource('nav-route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
        map.addLayer({
          id: 'nav-route-line',
          type: 'line',
          source: 'nav-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 6, 'line-opacity': 0.85 },
        });
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Origin marker — smooth glide (no jump) + gentle camera follow
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentPos) return;
    const lngLat: [number, number] = [currentPos.lng, currentPos.lat];
    if (!originMarker.current) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 2px #2563eb;transition:transform 600ms linear;';
      originMarker.current = new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
    } else {
      originMarker.current.setLngLat(lngLat);
    }
    // Soft camera follow once we have an active route
    if (route) {
      map.easeTo({ center: lngLat, duration: 600, essential: true });
    }
  }, [currentPos, route]);

  // 4. Destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (destMarker.current) {
      destMarker.current.remove();
      destMarker.current = null;
    }
    if (destination) {
      destMarker.current = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([destination.lng, destination.lat])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(destination.label || 'Destination'))
        .addTo(map);
    }
  }, [destination]);

  // 5. Fetch directions — only on destination change or explicit reroute,
  //    NOT on every GPS tick. Uses the latest GPS fix at the moment of fetch.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentPos || !destination || !MAPBOX_TOKEN) return;

    let cancelled = false;
    const isReroute = rerouteToken > 0;
    if (isReroute) setRerouting(true);
    else setLoadingRoute(true);
    setRouteError(null);
    fetchOriginRef.current = currentPos;

    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
      `${currentPos.lng},${currentPos.lat};${destination.lng},${destination.lat}` +
      `?alternatives=false&annotations=duration,distance,congestion,duration_typical` +
      `&geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const r = data?.routes?.[0];
        if (!r) {
          setRouteError('No route found');
          setRoute(null);
          return;
        }
        const firstStep = r.legs?.[0]?.steps?.[0]?.maneuver?.instruction as string | undefined;
        const summary: RouteSummary = {
          durationSec: r.duration,
          durationTypicalSec: r.duration_typical,
          distanceM: r.distance,
          nextStep: firstStep,
          geometry: r.geometry,
        };
        setRoute(summary);
        offRouteSince.current = null;

        const src = map.getSource('nav-route') as mapboxgl.GeoJSONSource | undefined;
        if (src) {
          src.setData({ type: 'Feature', properties: {}, geometry: r.geometry });
        }

        // Fit bounds only on first route; subsequent reroutes keep camera on driver.
        if (!isReroute) {
          const coords: [number, number][] = r.geometry.coordinates;
          if (coords.length > 1) {
            const bounds = coords.reduce(
              (b, c) => b.extend(c as [number, number]),
              new mapboxgl.LngLatBounds(coords[0], coords[0])
            );
            map.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 15 });
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setRouteError(e.message || 'Failed to fetch route');
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingRoute(false);
        setRerouting(false);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally NOT depending on currentPos — would refetch on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.lat, destination?.lng, rerouteToken]);

  // 5b. Initial fetch trigger once we get our first GPS fix.
  useEffect(() => {
    if (currentPos && destination && !route && !loadingRoute && rerouteToken === 0) {
      setRerouteToken((t) => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPos, destination]);

  // 5c. Off-route detection — if driver strays >60m from route polyline for >5s,
  //     request a fresh route. Throttled to once every 15s.
  useEffect(() => {
    if (!currentPos || !route?.geometry?.coordinates?.length) return;
    const distM = minDistanceToPolyline(currentPos, route.geometry.coordinates as [number, number][]);
    const OFF_ROUTE_M = 60;
    const STICKY_MS = 5_000;
    const COOLDOWN_MS = 15_000;
    if (distM > OFF_ROUTE_M) {
      if (offRouteSince.current == null) offRouteSince.current = Date.now();
      const strayedFor = Date.now() - offRouteSince.current;
      const sinceLast = Date.now() - lastRerouteAt.current;
      if (strayedFor >= STICKY_MS && sinceLast >= COOLDOWN_MS) {
        lastRerouteAt.current = Date.now();
        offRouteSince.current = null;
        setRerouteToken((t) => t + 1);
      }
    } else {
      offRouteSince.current = null;
    }
  }, [currentPos, route]);

  const heavyTraffic =
    route && route.durationTypicalSec
      ? route.durationSec > route.durationTypicalSec * 1.25
      : false;

  if (!MAPBOX_TOKEN) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/20">
        <CardContent className="p-4 text-sm">
          Mapbox token not configured. Set <code>VITE_MAPBOX_PUBLIC_TOKEN</code> to enable navigation.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b flex items-center gap-2 text-sm font-medium">
          <Navigation className="h-4 w-4 text-primary" />
          {title}
          {destination?.label && (
            <Badge variant="outline" className="ml-auto font-normal">
              <MapPin className="h-3 w-3 mr-1" />
              {destination.label}
            </Badge>
          )}
        </div>
      )}
      <div className="relative" style={{ height }}>
        <div ref={containerRef} className="absolute inset-0" />

        {/* Floating ETA card */}
        {(route || loadingRoute || routeError || geoError || !destination) && (
          <div className="absolute left-3 right-3 bottom-3 z-10">
            <div className="bg-background/95 backdrop-blur border rounded-xl shadow-lg p-3">
              {geoError && (
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Location: {geoError}
                </div>
              )}
              {!geoError && !destination && (
                <div className="text-sm text-muted-foreground">
                  No active stop assigned. Once a task is dispatched, your route will appear here.
                </div>
              )}
              {loadingRoute && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating fastest route with live traffic…
                </div>
              )}
              {routeError && !loadingRoute && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {routeError}
                </div>
              )}
              {route && !loadingRoute && !routeError && (
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <div>
                        <div className="text-xs text-muted-foreground leading-none">ETA</div>
                        <div className="text-lg font-bold leading-tight">
                          {formatDuration(route.durationSec)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground leading-none">Distance</div>
                        <div className="text-lg font-bold leading-tight">
                          {formatDistance(route.distanceM)}
                        </div>
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {rerouting && (
                        <Badge variant="secondary" className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Rerouting…
                        </Badge>
                      )}
                      {heavyTraffic && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Heavy traffic ahead
                        </Badge>
                      )}
                    </div>
                  </div>
                  {route.nextStep && (
                    <div className="flex items-start gap-2 text-sm border-t pt-2">
                      <Navigation className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span className="line-clamp-2">{route.nextStep}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default LiveNavigationMap;
