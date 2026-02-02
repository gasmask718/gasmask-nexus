import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LiveRoute, WorkerLocation, LiveAlert, LiveStop } from "@/hooks/useLiveMapData";

interface MapCanvasProps {
  routes: LiveRoute[];
  workers: WorkerLocation[];
  alerts: LiveAlert[];
  selectedRouteId: string | null;
  selectedWorkerId: string | null;
  followWorkerId: string | null;
  onSelectRoute: (routeId: string) => void;
  onSelectWorker: (workerId: string) => void;
  onSelectStop: (stopId: string) => void;
  onSelectAlert: (alertId: string) => void;
}

export function MapCanvas({
  routes,
  workers,
  alerts,
  selectedRouteId,
  selectedWorkerId,
  followWorkerId,
  onSelectRoute,
  onSelectWorker,
  onSelectStop,
  onSelectAlert,
}: MapCanvasProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const routeLayersRef = useRef<string[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    
    if (token) {
      mapboxgl.accessToken = token;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-74.006, 40.7128],
        zoom: 11,
      });
    } else {
      // Fallback to OpenStreetMap tiles
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap',
            },
          },
          layers: [
            {
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [-74.006, 40.7128],
        zoom: 11,
      });
    }

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Helper to get role color
  const getRoleColor = useCallback((role: string) => {
    switch (role) {
      case 'driver': return '#3b82f6';
      case 'biker': return '#06b6d4';
      case 'ambassador': return '#a855f7';
      default: return '#6b7280';
    }
  }, []);

  // Helper to get status ring color
  const getStatusRingColor = useCallback((status: string, hasAlert: boolean) => {
    if (hasAlert) return '#ef4444';
    switch (status) {
      case 'active': return '#22c55e';
      case 'stale': return '#eab308';
      case 'offline': return '#6b7280';
      default: return '#6b7280';
    }
  }, []);

  // Update worker markers
  useEffect(() => {
    if (!map.current) return;

    // Clear old worker markers
    Object.entries(markersRef.current).forEach(([key, marker]) => {
      if (key.startsWith('worker-')) {
        marker.remove();
        delete markersRef.current[key];
      }
    });

    // Add worker markers
    workers.forEach(worker => {
      const hasAlert = alerts.some(a => 
        routes.find(r => r.assigned_to === worker.worker_id && r.id === a.route_id)
      );

      const el = document.createElement('div');
      el.className = 'worker-marker';
      el.style.cssText = `
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: ${getRoleColor(worker.role)};
        border: 3px solid ${getStatusRingColor(worker.status, hasAlert)};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        transition: transform 0.2s;
      `;
      el.innerHTML = worker.name.charAt(0).toUpperCase();
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.15)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });
      el.addEventListener('click', () => {
        onSelectWorker(worker.worker_id);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([worker.lng, worker.lat])
        .addTo(map.current!);

      markersRef.current[`worker-${worker.worker_id}`] = marker;
    });
  }, [workers, alerts, routes, getRoleColor, getStatusRingColor, onSelectWorker]);

  // Update route stops
  useEffect(() => {
    if (!map.current) return;

    // Clear old stop markers
    Object.entries(markersRef.current).forEach(([key, marker]) => {
      if (key.startsWith('stop-')) {
        marker.remove();
        delete markersRef.current[key];
      }
    });

    // Add stop markers for all routes
    routes.forEach(route => {
      const isSelected = route.id === selectedRouteId;
      
      route.stops.forEach((stop, idx) => {
        if (!stop.store?.lat || !stop.store?.lng) return;

        const el = document.createElement('div');
        const stopColor = stop.status === 'completed' ? '#22c55e'
          : stop.status === 'skipped' ? '#f97316'
          : stop.status === 'failed' ? '#ef4444'
          : '#9ca3af';

        el.style.cssText = `
          width: ${isSelected ? '24px' : '16px'};
          height: ${isSelected ? '24px' : '16px'};
          border-radius: 50%;
          background: ${stopColor};
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          color: white;
          transition: all 0.2s;
        `;
        if (isSelected) {
          el.innerHTML = String(idx + 1);
        }
        el.addEventListener('click', () => {
          onSelectStop(stop.id);
        });

        const marker = new mapboxgl.Marker(el)
          .setLngLat([stop.store.lng, stop.store.lat])
          .addTo(map.current!);

        markersRef.current[`stop-${stop.id}`] = marker;
      });
    });
  }, [routes, selectedRouteId, onSelectStop]);

  // Draw route lines for selected route
  useEffect(() => {
    if (!map.current) return;

    // Wait for map to be loaded
    const drawRouteLines = () => {
      // Remove old route layers
      routeLayersRef.current.forEach(layerId => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(layerId)) {
          map.current.removeSource(layerId);
        }
      });
      routeLayersRef.current = [];

      if (!selectedRouteId) return;

      const route = routes.find(r => r.id === selectedRouteId);
      if (!route) return;

      const coordinates = route.stops
        .filter(s => s.store?.lat && s.store?.lng)
        .sort((a, b) => a.planned_order - b.planned_order)
        .map(s => [s.store!.lng, s.store!.lat] as [number, number]);

      if (coordinates.length < 2) return;

      const sourceId = `route-line-${route.id}`;
      const layerId = `route-line-layer-${route.id}`;

      try {
        map.current!.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates,
            },
          },
        });

        map.current!.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': getRoleColor(route.assignee?.role || route.type),
            'line-width': 4,
            'line-opacity': 0.8,
          },
        });

        routeLayersRef.current = [layerId];
      } catch (e) {
        console.warn('Error adding route line:', e);
      }
    };

    if (map.current.isStyleLoaded()) {
      drawRouteLines();
    } else {
      map.current.on('load', drawRouteLines);
    }
  }, [routes, selectedRouteId, getRoleColor]);

  // Alert markers
  useEffect(() => {
    if (!map.current) return;

    // Clear old alert markers
    Object.entries(markersRef.current).forEach(([key, marker]) => {
      if (key.startsWith('alert-')) {
        marker.remove();
        delete markersRef.current[key];
      }
    });

    // Add alert markers (positioned at related stop/route)
    alerts.forEach(alert => {
      // Find the related stop or route to position the alert
      let position: [number, number] | null = null;

      if (alert.stop_id) {
        for (const route of routes) {
          const stop = route.stops.find(s => s.id === alert.stop_id);
          if (stop?.store?.lat && stop?.store?.lng) {
            position = [stop.store.lng, stop.store.lat];
            break;
          }
        }
      } else if (alert.route_id) {
        const route = routes.find(r => r.id === alert.route_id);
        if (route && route.stops.length > 0) {
          const firstStop = route.stops.find(s => s.store?.lat && s.store?.lng);
          if (firstStop?.store) {
            position = [firstStop.store.lng, firstStop.store.lat];
          }
        }
      }

      if (!position) return;

      const el = document.createElement('div');
      const isCritical = alert.severity === 'critical' || alert.severity === 'high';
      el.style.cssText = `
        width: 24px;
        height: 24px;
        cursor: pointer;
        ${isCritical ? 'animation: pulse 1s infinite;' : ''}
      `;
      el.innerHTML = `
        <svg viewBox="0 0 24 24" fill="${isCritical ? '#ef4444' : '#f97316'}" stroke="white" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2"/>
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="white" stroke-width="2"/>
        </svg>
      `;
      el.addEventListener('click', () => {
        onSelectAlert(alert.id);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat(position)
        .addTo(map.current!);

      markersRef.current[`alert-${alert.id}`] = marker;
    });
  }, [alerts, routes, onSelectAlert]);

  // Follow worker
  useEffect(() => {
    if (!map.current || !followWorkerId) return;

    const worker = workers.find(w => w.worker_id === followWorkerId);
    if (worker) {
      map.current.flyTo({
        center: [worker.lng, worker.lat],
        zoom: 15,
        duration: 1000,
      });
    }
  }, [followWorkerId, workers]);

  // Focus on selected route
  useEffect(() => {
    if (!map.current || !selectedRouteId) return;

    const route = routes.find(r => r.id === selectedRouteId);
    if (!route || route.stops.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    let hasValidCoords = false;

    route.stops.forEach(stop => {
      if (stop.store?.lat && stop.store?.lng) {
        bounds.extend([stop.store.lng, stop.store.lat]);
        hasValidCoords = true;
      }
    });

    if (hasValidCoords) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
        duration: 1000,
      });
    }
  }, [selectedRouteId, routes]);

  return (
    <div ref={mapContainer} className="absolute inset-0" />
  );
}
