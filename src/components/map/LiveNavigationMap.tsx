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

  // 1. Geolocation watcher
  useEffect(() => {
    if (origin) {
      setCurrentPos(origin);
      return;
    }
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(null);
      },
      (err) => setGeoError(err.message || 'Unable to access location'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [origin]);

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

  // 3. Origin marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentPos) return;
    if (!originMarker.current) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 2px #2563eb;';
      originMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([currentPos.lng, currentPos.lat])
        .addTo(map);
    } else {
      originMarker.current.setLngLat([currentPos.lng, currentPos.lat]);
    }
  }, [currentPos]);

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

  // 5. Fetch directions
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentPos || !destination || !MAPBOX_TOKEN) return;

    let cancelled = false;
    setLoadingRoute(true);
    setRouteError(null);

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

        const src = map.getSource('nav-route') as mapboxgl.GeoJSONSource | undefined;
        if (src) {
          src.setData({ type: 'Feature', properties: {}, geometry: r.geometry });
        }

        // Fit bounds to route
        const coords: [number, number][] = r.geometry.coordinates;
        if (coords.length > 1) {
          const bounds = coords.reduce(
            (b, c) => b.extend(c as [number, number]),
            new mapboxgl.LngLatBounds(coords[0], coords[0])
          );
          map.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 15 });
        }
      })
      .catch((e) => {
        if (!cancelled) setRouteError(e.message || 'Failed to fetch route');
      })
      .finally(() => {
        if (!cancelled) setLoadingRoute(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPos?.lat, currentPos?.lng, destination?.lat, destination?.lng]);

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
                    {heavyTraffic && (
                      <Badge variant="destructive" className="ml-auto gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Heavy traffic ahead
                      </Badge>
                    )}
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
