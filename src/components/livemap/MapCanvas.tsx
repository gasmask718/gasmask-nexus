import { useEffect, useRef, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LiveRoute, WorkerLocation, LiveAlert, LiveStop, LiveDeliveryTask } from "@/hooks/useLiveMapData";

export interface MapStore {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  phone: string | null;
  status: string | null;
  health_score: number | null;
  type: string | null;
}

interface MapCanvasProps {
  routes: LiveRoute[];
  workers: WorkerLocation[];
  alerts: LiveAlert[];
  deliveryTasks?: LiveDeliveryTask[];
  stores?: MapStore[];
  showStores?: boolean;
  selectedRouteId: string | null;
  selectedWorkerId: string | null;
  followWorkerId: string | null;
  onSelectRoute: (routeId: string) => void;
  onSelectWorker: (workerId: string) => void;
  onSelectStop: (stopId: string) => void;
  onSelectAlert: (alertId: string) => void;
}

// Store pin rendered as Mapbox image (created once)
const STORE_PIN_SIZE = 24;
const STORE_LAYER_SOURCE = 'stores-source';
const STORE_LAYER_CLUSTERS = 'store-clusters';
const STORE_LAYER_CLUSTER_COUNT = 'store-cluster-count';
const STORE_LAYER_PINS = 'store-pins';
const STORE_MIN_ZOOM = 10; // Only show individual pins at zoom >= 10


export function MapCanvas({
  routes,
  workers,
  alerts,
  deliveryTasks = [],
  stores = [],
  showStores = true,
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
  const targetLineLayersRef = useRef<string[]>([]);
  const deliveryLineLayersRef = useRef<string[]>([]);
  const storePopupRef = useRef<mapboxgl.Popup | null>(null);
  const storeSourceAddedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build GeoJSON from stores array (memoized)
  const storeGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: stores
      .filter(s => s.lat && s.lng)
      .map(store => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [store.lng, store.lat] },
        properties: {
          id: store.id,
          name: store.name,
          address_street: store.address_street || '',
          address_city: store.address_city || '',
          address_state: store.address_state || '',
          phone: store.phone || '',
          status: store.status || 'unknown',
          health_score: store.health_score ?? -1,
          type: store.type || '',
        },
      })),
  }), [stores]);

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

  // Setup store GeoJSON source + layers (once on map load)
  useEffect(() => {
    if (!map.current) return;

    const setupStoreLayers = () => {
      const m = map.current!;
      if (storeSourceAddedRef.current) return;

      // Create a teardrop pin image for use in symbol layer
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      // Teardrop path scaled 2x
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.bezierCurveTo(10.8, 0, 0, 10.8, 0, 24);
      ctx.bezierCurveTo(0, 42, 24, 64, 24, 64);
      ctx.bezierCurveTo(24, 64, 48, 42, 48, 24);
      ctx.bezierCurveTo(48, 10.8, 37.2, 0, 24, 0);
      ctx.closePath();
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.stroke();
      // White center circle
      ctx.beginPath();
      ctx.arc(24, 22, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();

      m.addImage('store-pin', { width: 48, height: 64, data: ctx.getImageData(0, 0, 48, 64).data } as any);

      m.addSource(STORE_LAYER_SOURCE, {
        type: 'geojson',
        data: storeGeoJSON as any,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
      });

      // Cluster circles
      m.addLayer({
        id: STORE_LAYER_CLUSTERS,
        type: 'circle',
        source: STORE_LAYER_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#f59e0b', 50, '#f97316', 200, '#ef4444'],
          'circle-radius': ['step', ['get', 'point_count'], 18, 50, 24, 200, 30],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#b45309',
        },
      });

      // Cluster count labels
      m.addLayer({
        id: STORE_LAYER_CLUSTER_COUNT,
        type: 'symbol',
        source: STORE_LAYER_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      });

      // Individual pin icons
      m.addLayer({
        id: STORE_LAYER_PINS,
        type: 'symbol',
        source: STORE_LAYER_SOURCE,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': 'store-pin',
          'icon-size': 0.5,
          'icon-anchor': 'bottom',
          'icon-allow-overlap': false,
        },
      });

      // Click on cluster → zoom in
      m.on('click', STORE_LAYER_CLUSTERS, (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: [STORE_LAYER_CLUSTERS] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        (m.getSource(STORE_LAYER_SOURCE) as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          m.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        });
      });

      // Click on pin → show popup
      m.on('click', STORE_LAYER_PINS, (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: [STORE_LAYER_PINS] });
        if (!features.length) return;
        const f = features[0];
        const coords = (f.geometry as any).coordinates.slice() as [number, number];
        const p = f.properties!;
        const statusColor = p.status === 'active' ? '#22c55e' : p.status === 'churned' ? '#ef4444' : '#6b7280';
        const healthScore = p.health_score >= 0 ? p.health_score : null;
        const healthBar = healthScore != null
          ? `<div style="margin-top:8px;"><div style="display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;margin-bottom:2px;"><span>Health</span><span>${healthScore}/100</span></div><div style="height:4px;background:#374151;border-radius:2px;overflow:hidden;"><div style="height:100%;width:${healthScore}%;background:${healthScore >= 70 ? '#22c55e' : healthScore >= 40 ? '#eab308' : '#ef4444'};border-radius:2px;"></div></div></div>`
          : '';
        const addressLine2 = [p.address_city, p.address_state].filter(Boolean).join(', ');

        const html = `<div style="min-width:200px;max-width:260px;font-family:system-ui,-apple-system,sans-serif;padding:4px 0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <div style="flex:1;font-size:14px;font-weight:700;color:#111827;line-height:1.2;">${p.name}</div>
            <span style="flex-shrink:0;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${statusColor};color:white;text-transform:capitalize;">${p.status}</span>
          </div>
          ${p.type ? `<div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${p.type}</div>` : ''}
          <div style="font-size:12px;color:#374151;line-height:1.4;">${p.address_street}</div>
          <div style="font-size:12px;color:#374151;line-height:1.4;">${addressLine2}</div>
          ${p.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;">📞 ${p.phone}</div>` : ''}
          ${healthBar}
          <a href="/stores/${p.id}" style="display:inline-block;margin-top:8px;padding:4px 10px;font-size:11px;font-weight:600;color:white;background:#3b82f6;border-radius:6px;text-decoration:none;">View Profile →</a>
        </div>`;

        storePopupRef.current?.remove();
        storePopupRef.current = new mapboxgl.Popup({ offset: [0, -20], closeButton: true, maxWidth: '280px', className: 'store-popup-dark' })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(m);
      });

      // Cursor pointer on hover
      m.on('mouseenter', STORE_LAYER_PINS, () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', STORE_LAYER_PINS, () => { m.getCanvas().style.cursor = ''; });
      m.on('mouseenter', STORE_LAYER_CLUSTERS, () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', STORE_LAYER_CLUSTERS, () => { m.getCanvas().style.cursor = ''; });

      storeSourceAddedRef.current = true;
    };

    if (map.current.isStyleLoaded()) {
      setupStoreLayers();
    } else {
      map.current.on('load', setupStoreLayers);
    }
  }, []); // Run once on mount

  // Update store GeoJSON data when stores change
  useEffect(() => {
    if (!map.current || !storeSourceAddedRef.current) return;
    const source = map.current.getSource(STORE_LAYER_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(storeGeoJSON as any);
    }
  }, [storeGeoJSON]);

  // Toggle store layer visibility
  useEffect(() => {
    if (!map.current || !storeSourceAddedRef.current) return;
    const vis = showStores ? 'visible' : 'none';
    [STORE_LAYER_CLUSTERS, STORE_LAYER_CLUSTER_COUNT, STORE_LAYER_PINS].forEach(layer => {
      if (map.current?.getLayer(layer)) {
        map.current.setLayoutProperty(layer, 'visibility', vis);
      }
    });
  }, [showStores]);

  // Update worker markers
  useEffect(() => {
    if (!map.current) return;

    Object.entries(markersRef.current).forEach(([key, marker]) => {
      if (key.startsWith('worker-')) {
        marker.remove();
        delete markersRef.current[key];
      }
    });

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
      `;
      el.innerHTML = worker.name.charAt(0).toUpperCase();
      el.addEventListener('click', () => { onSelectWorker(worker.worker_id); });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([worker.lng, worker.lat])
        .addTo(map.current!);

      markersRef.current[`worker-${worker.worker_id}`] = marker;
    });
  }, [workers, alerts, routes, getRoleColor, getStatusRingColor, onSelectWorker]);

  // Draw worker-to-target dashed lines
  useEffect(() => {
    if (!map.current) return;

    const drawLines = () => {
      // Cleanup old lines
      targetLineLayersRef.current.forEach(id => {
        if (map.current?.getLayer(id)) map.current.removeLayer(id);
        if (map.current?.getSource(id)) map.current.removeSource(id);
      });
      targetLineLayersRef.current = [];

      workers.forEach(worker => {
        // Find active route for this worker
        const route = routes.find(r => r.assigned_to === worker.worker_id && (r.status === 'active' || r.status === 'in_progress'));
        if (!route) return;

        // Find next pending stop
        const nextStop = route.stops
          .sort((a, b) => a.planned_order - b.planned_order)
          .find(s => s.status !== 'completed' && s.status !== 'skipped' && s.status !== 'failed');
        if (!nextStop?.store?.lat || !nextStop?.store?.lng) return;

        const sourceId = `target-line-${worker.worker_id}`;
        const layerId = `target-line-layer-${worker.worker_id}`;

        try {
          map.current!.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [worker.lng, worker.lat],
                  [nextStop.store.lng, nextStop.store.lat],
                ],
              },
            },
          });

          map.current!.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': getRoleColor(worker.role),
              'line-width': 2.5,
              'line-opacity': 0.6,
              'line-dasharray': [4, 3],
            },
          });

          targetLineLayersRef.current.push(sourceId, layerId);
        } catch (e) {
          console.warn('Error adding target line:', e);
        }
      });
    };

    if (map.current.isStyleLoaded()) {
      drawLines();
    } else {
      map.current.on('load', drawLines);
    }
  }, [workers, routes, getRoleColor]);

  // Draw delivery task destination lines + markers
  useEffect(() => {
    if (!map.current) return;

    const drawDeliveryLines = () => {
      // Cleanup old delivery lines & markers
      deliveryLineLayersRef.current.forEach(id => {
        if (map.current?.getLayer(id)) map.current.removeLayer(id);
        if (map.current?.getSource(id)) map.current.removeSource(id);
      });
      deliveryLineLayersRef.current = [];

      Object.entries(markersRef.current).forEach(([key, marker]) => {
        if (key.startsWith('delivery-dest-')) {
          marker.remove();
          delete markersRef.current[key];
        }
      });

      deliveryTasks.forEach(task => {
        const workerUserId = task.biker_user_id || task.driver_user_id;
        if (!workerUserId) return;

        // Find the worker on the map
        const worker = workers.find(w => w.worker_id === workerUserId);
        if (!worker) return;

        // Skip if this worker already has a route trajectory line
        const hasRouteTrajectory = routes.some(
          r => r.assigned_to === worker.worker_id && (r.status === 'active' || r.status === 'in_progress')
        );
        if (hasRouteTrajectory) return;

        const sourceId = `delivery-line-${task.id}`;
        const layerId = `delivery-line-layer-${task.id}`;

        try {
          // Draw dashed line from worker to delivery destination
          map.current!.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [worker.lng, worker.lat],
                  [task.delivery_lng, task.delivery_lat],
                ],
              },
            },
          });

          map.current!.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': getRoleColor(worker.role),
              'line-width': 2.5,
              'line-opacity': 0.7,
              'line-dasharray': [4, 3],
            },
          });

          deliveryLineLayersRef.current.push(sourceId, layerId);

          // Add destination pin marker with click popup
          const el = document.createElement('div');
          el.style.cssText = `
            width: 28px;
            height: 28px;
            cursor: pointer;
          `;
          el.innerHTML = `
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8z" fill="${getRoleColor(worker.role)}" stroke="white" stroke-width="1.5"/>
              <circle cx="12" cy="8" r="3" fill="white"/>
            </svg>
          `;

          const statusLabel = task.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const statusColor = task.status === 'delivered' ? '#22c55e' : task.status === 'picked_up' ? '#f59e0b' : '#3b82f6';

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            storePopupRef.current?.remove();
            const html = `<div style="min-width:220px;max-width:280px;font-family:system-ui,-apple-system,sans-serif;padding:4px 0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <div style="flex:1;font-size:14px;font-weight:700;color:#111827;line-height:1.2;">📦 ${task.order_number || 'Delivery Task'}</div>
                <span style="flex-shrink:0;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${statusColor};color:white;">${statusLabel}</span>
              </div>
              ${task.recipient_name ? `<div style="font-size:12px;color:#374151;margin-bottom:2px;">👤 ${task.recipient_name}</div>` : ''}
              ${task.recipient_phone ? `<div style="font-size:12px;color:#6b7280;margin-bottom:2px;">📞 ${task.recipient_phone}</div>` : ''}
              <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">📍 ${task.delivery_address}</div>
              ${task.worker_name ? `<div style="font-size:11px;color:#6b7280;margin-bottom:2px;">🚚 ${task.worker_name}</div>` : ''}
              ${task.total_amount ? `<div style="font-size:13px;font-weight:600;color:#111827;margin-top:4px;">💰 $${Number(task.total_amount).toFixed(2)}</div>` : ''}
              ${task.delivery_notes ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px;font-style:italic;">"${task.delivery_notes}"</div>` : ''}
            </div>`;

            storePopupRef.current = new mapboxgl.Popup({ offset: [0, -28], closeButton: true, maxWidth: '300px' })
              .setLngLat([task.delivery_lng, task.delivery_lat])
              .setHTML(html)
              .addTo(map.current!);
          });

          const marker = new mapboxgl.Marker(el)
            .setLngLat([task.delivery_lng, task.delivery_lat])
            .addTo(map.current!);

          markersRef.current[`delivery-dest-${task.id}`] = marker;
        } catch (e) {
          console.warn('Error adding delivery trajectory:', e);
        }
      });
    };

    if (map.current.isStyleLoaded()) {
      drawDeliveryLines();
    } else {
      map.current.on('load', drawDeliveryLines);
    }
  }, [workers, deliveryTasks, routes, getRoleColor]);

  // Update route stops
  useEffect(() => {
    if (!map.current) return;

    Object.entries(markersRef.current).forEach(([key, marker]) => {
      if (key.startsWith('stop-')) {
        marker.remove();
        delete markersRef.current[key];
      }
    });

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
        `;
        if (isSelected) {
          el.innerHTML = String(idx + 1);
        }

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectStop(stop.id);

          storePopupRef.current?.remove();
          const stopStatusLabel = stop.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const assigneeName = route.assignee?.name || 'Unassigned';
          const arrivalInfo = stop.actual_arrival
            ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">⏱ Arrived: ${new Date(stop.actual_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`
            : '';

          const popupHtml = `<div style="min-width:200px;max-width:260px;font-family:system-ui,-apple-system,sans-serif;padding:4px 0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <div style="flex:1;font-size:14px;font-weight:700;color:#111827;line-height:1.2;">Stop #${idx + 1}: ${stop.store?.name || 'Unknown'}</div>
              <span style="flex-shrink:0;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${stopColor};color:white;">${stopStatusLabel}</span>
            </div>
            <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Route: ${route.territory || route.id.slice(0, 8)}</div>
            ${stop.store?.address_street ? `<div style="font-size:12px;color:#374151;">📍 ${stop.store.address_street}${stop.store.address_city ? ', ' + stop.store.address_city : ''}</div>` : ''}
            ${stop.store?.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">📞 ${stop.store.phone}</div>` : ''}
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">🚚 ${assigneeName}</div>
            ${arrivalInfo}
            ${stop.notes_to_worker ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px;font-style:italic;">"${stop.notes_to_worker}"</div>` : ''}
            <a href="/stores/${stop.store_id}" style="display:inline-block;margin-top:8px;padding:4px 10px;font-size:11px;font-weight:600;color:white;background:#3b82f6;border-radius:6px;text-decoration:none;">View Store →</a>
          </div>`;

          storePopupRef.current = new mapboxgl.Popup({ offset: [0, -16], closeButton: true, maxWidth: '280px' })
            .setLngLat([stop.store!.lng, stop.store!.lat])
            .setHTML(popupHtml)
            .addTo(map.current!);
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

    const drawRouteLines = () => {
      routeLayersRef.current.forEach(layerId => {
        if (map.current?.getLayer(layerId)) map.current.removeLayer(layerId);
        if (map.current?.getSource(layerId)) map.current.removeSource(layerId);
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
            geometry: { type: 'LineString', coordinates },
          },
        });

        map.current!.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
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

    Object.entries(markersRef.current).forEach(([key, marker]) => {
      if (key.startsWith('alert-')) {
        marker.remove();
        delete markersRef.current[key];
      }
    });

    alerts.forEach(alert => {
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
      el.addEventListener('click', () => { onSelectAlert(alert.id); });

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
      map.current.flyTo({ center: [worker.lng, worker.lat], zoom: 15, duration: 1000 });
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
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 14, duration: 1000 });
    }
  }, [selectedRouteId, routes]);

  return (
    <div ref={mapContainer} className="absolute inset-0" />
  );
}
