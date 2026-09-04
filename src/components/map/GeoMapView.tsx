import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Search, Filter } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

const DEFAULT_STATUS_COLOR = '#6b7280';

/** Generic map point. Domain-specific fields live in `meta` and are only ever
 *  read by caller-supplied render props — never by this component. */
export interface GeoPoint {
  id: string;
  lng: number;
  lat: number;
  title: string;
  subtitle?: string;
  groupKey?: string;
  statusKey?: string;
  /** Optional marker radius in px (clustering === false only). Defaults to a 4px radius dot. */
  radius?: number;
  meta?: Record<string, any>;
}

export interface GeoMapViewProps {
  points: GeoPoint[];
  statusColors: Record<string, string>;
  initialCenter: [number, number];
  initialZoom: number;
  resolveGroup?: (p: GeoPoint) => string | null;
  showHulls?: boolean;
  clustering?: boolean;
  renderDetail?: (p: GeoPoint) => React.ReactNode;
  renderListItem?: (p: GeoPoint) => React.ReactNode;
  renderPopupHTML?: (p: GeoPoint) => string;
  searchFields?: (p: GeoPoint) => string[];
  groupFilterLabel?: string;
  groupCountLabel?: (count: number) => string;
  searchPlaceholder?: string;
  emptyState?: React.ReactNode;
  onPointClick?: (p: GeoPoint) => void;
  /** Fires after the map settles; lets callers load only what is in view. */
  onBoundsChange?: (b: { west: number; south: number; east: number; north: number; zoom: number }) => void;
  className?: string;
}

interface HullGroup {
  name: string;
  slug: string;
  color: string;
  coordinates: [number, number][][];
  center: [number, number];
  count: number;
}

const TERRITORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#6366f1',
  '#ec4899', '#14b8a6', '#8b5cf6', '#f43f5e', '#06b6d4',
];

/** Slugify a group name so it is safe to use as a Mapbox layer/source id. */
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';
}

/** Compute convex hull of 2D points using Andrew's monotone chain */
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) {
    // For 1-2 points, create a small buffer polygon
    if (points.length === 0) return [];
    const [cx, cy] = points.length === 1
      ? points[0]
      : [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
    const r = 0.005; // ~500m buffer
    return [
      [cx - r, cy - r], [cx + r, cy - r],
      [cx + r, cy + r], [cx - r, cy + r],
      [cx - r, cy - r],
    ];
  }

  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (O: [number, number], A: [number, number], B: [number, number]) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  // Close the ring
  if (hull.length > 0) hull.push(hull[0]);
  return hull;
}

/** Add a small padding to convex hull by expanding outward from centroid */
function padHull(hull: [number, number][], factor = 0.08): [number, number][] {
  if (hull.length < 4) return hull;
  const cx = hull.slice(0, -1).reduce((s, p) => s + p[0], 0) / (hull.length - 1);
  const cy = hull.slice(0, -1).reduce((s, p) => s + p[1], 0) / (hull.length - 1);
  return hull.map(([x, y]) => [
    cx + (x - cx) * (1 + factor),
    cy + (y - cy) * (1 + factor),
  ] as [number, number]);
}

const CLUSTER_SRC = 'geo-pts-src';
const CLUSTER_LAYER = 'geo-clusters';
const CLUSTER_COUNT_LAYER = 'geo-cluster-count';
const POINT_LAYER = 'geo-unclustered-point';

export function GeoMapView({
  points,
  statusColors,
  initialCenter,
  initialZoom,
  resolveGroup,
  showHulls = false,
  clustering = false,
  renderDetail,
  renderListItem,
  renderPopupHTML,
  searchFields,
  groupFilterLabel = 'All Groups',
  groupCountLabel = (n) => `${n} points`,
  searchPlaceholder = 'Search...',
  emptyState,
  onPointClick,
  onBoundsChange,
  className,
}: GeoMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const layerIdsRef = useRef<string[]>([]);
  const sourceIdsRef = useRef<string[]>([]);
  const handlersRef = useRef<Array<{ type: any; layer: string; fn: any }>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);

  const groupOf = useCallback(
    (p: GeoPoint) => (resolveGroup ? resolveGroup(p) : p.groupKey ?? null),
    [resolveGroup],
  );

  const colorOf = useCallback(
    (statusKey?: string) => (statusKey && statusColors[statusKey]) || DEFAULT_STATUS_COLOR,
    [statusColors],
  );

  // Build hull groups from point data
  const hullGroups = useMemo((): HullGroup[] => {
    if (!showHulls || points.length === 0) return [];

    const groups: Record<string, [number, number][]> = {};
    points.forEach(p => {
      const g = groupOf(p);
      if (!g) return;
      if (!groups[g]) groups[g] = [];
      groups[g].push([p.lng, p.lat]);
    });

    const names = Object.keys(groups).sort();
    return names.map((name, i) => {
      const pts = groups[name];
      const hull = padHull(convexHull(pts));
      const cx = pts.reduce((s, c) => s + c[0], 0) / pts.length;
      const cy = pts.reduce((s, c) => s + c[1], 0) / pts.length;
      return {
        name,
        slug: slug(name),
        color: TERRITORY_COLORS[i % TERRITORY_COLORS.length],
        coordinates: [hull],
        center: [cx, cy] as [number, number],
        count: pts.length,
      };
    });
  }, [points, showHulls, groupOf]);

  // Group names for the filter dropdown (works with or without hulls)
  const groupOptions = useMemo(() => {
    if (hullGroups.length > 0) {
      return hullGroups.map(g => ({ name: g.name, count: g.count }));
    }
    const counts: Record<string, number> = {};
    points.forEach(p => {
      const g = groupOf(p);
      if (!g) return;
      counts[g] = (counts[g] || 0) + 1;
    });
    return Object.keys(counts).sort().map(name => ({ name, count: counts[name] }));
  }, [hullGroups, points, groupOf]);

  const visiblePoints = useMemo(() => (
    filterGroup === 'all' ? points : points.filter(p => groupOf(p) === filterGroup)
  ), [points, filterGroup, groupOf]);

  const groupPoints = useMemo(() => {
    if (!selectedGroup) return [];
    return points.filter(p => groupOf(p) === selectedGroup);
  }, [selectedGroup, points, groupOf]);

  const filteredPoints = useMemo(() => {
    if (!searchQuery) return groupPoints;
    const q = searchQuery.toLowerCase();
    return groupPoints.filter(p => {
      const fields = searchFields
        ? searchFields(p)
        : [p.title, p.subtitle || ''];
      return fields.some(f => (f || '').toLowerCase().includes(q));
    });
  }, [groupPoints, searchQuery, searchFields]);

  const popupHTML = useCallback((p: GeoPoint) => {
    if (renderPopupHTML) return renderPopupHTML(p);
    return `<div style="color:#000;font-size:12px"><strong>${p.title}</strong><br/><span style="color:#555">${p.subtitle || '—'}</span>${p.statusKey ? `<br/><span style="color:#888;font-size:11px">${p.statusKey.replace('_', ' ')}</span>` : ''}</div>`;
  }, [renderPopupHTML]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: initialCenter,
      zoom: initialZoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    map.on('load', () => setMapLoaded(true));

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report the viewport so callers can load only the visible slice.
  const boundsCbRef = useRef(onBoundsChange);
  boundsCbRef.current = onBoundsChange;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !onBoundsChange) return;
    const emit = () => {
      const b = map.getBounds();
      if (!b) return;
      boundsCbRef.current?.({
        west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(),
        zoom: map.getZoom(),
      });
    };
    emit();
    map.on('moveend', emit);
    return () => { map.off('moveend', emit); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, !!onBoundsChange]);



  // Draw hull polygons whenever groups or the filter change
  const drawHulls = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Single clean teardown: detach handlers, drop layers, then drop sources.
    handlersRef.current.forEach(({ type, layer, fn }) => map.off(type, layer, fn));
    handlersRef.current = [];
    layerIdsRef.current.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
    sourceIdsRef.current.forEach(id => { if (map.getSource(id)) map.removeSource(id); });
    layerIdsRef.current = [];
    sourceIdsRef.current = [];

    if (!showHulls) return;

    const visible = filterGroup === 'all'
      ? hullGroups
      : hullGroups.filter(g => g.name === filterGroup);

    visible.forEach(g => {
      if (g.coordinates[0].length < 3) return;
      const srcId = `grp-${g.slug}-src`;
      const fillId = `grp-${g.slug}-fill`;
      const lineId = `grp-${g.slug}-line`;
      const labelId = `grp-${g.slug}-label`;

      map.addSource(srcId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { name: g.name },
          geometry: { type: 'Polygon', coordinates: g.coordinates },
        },
      });

      map.addLayer({
        id: fillId, type: 'fill', source: srcId,
        paint: { 'fill-color': g.color, 'fill-opacity': 0.15 },
      });
      map.addLayer({
        id: lineId, type: 'line', source: srcId,
        paint: { 'line-color': g.color, 'line-width': 2, 'line-opacity': 0.8 },
      });
      map.addLayer({
        id: labelId, type: 'symbol', source: srcId,
        layout: {
          'text-field': `${g.name} (${g.count})`,
          'text-size': 13,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: { 'text-color': g.color, 'text-halo-color': '#000', 'text-halo-width': 1 },
      });

      sourceIdsRef.current.push(srcId);
      layerIdsRef.current.push(fillId, lineId, labelId);

      // Interactions
      const onEnter = () => {
        map.getCanvas().style.cursor = 'pointer';
        map.setPaintProperty(fillId, 'fill-opacity', 0.35);
      };
      const onLeave = () => {
        map.getCanvas().style.cursor = '';
        map.setPaintProperty(fillId, 'fill-opacity', 0.15);
      };
      const onClick = () => {
        setSelectedGroup(g.name);
        setSelectedPoint(null);
        setSearchQuery('');
      };
      map.on('mouseenter', fillId, onEnter);
      map.on('mouseleave', fillId, onLeave);
      map.on('click', fillId, onClick);
      handlersRef.current.push(
        { type: 'mouseenter', layer: fillId, fn: onEnter },
        { type: 'mouseleave', layer: fillId, fn: onLeave },
        { type: 'click', layer: fillId, fn: onClick },
      );
    });

    // Fit map to visible groups
    if (visible.length > 0 && filterGroup !== 'all') {
      const bounds = new mapboxgl.LngLatBounds();
      visible.forEach(g => g.coordinates[0].forEach(c => bounds.extend(c)));
      map.fitBounds(bounds, { padding: 60, duration: 800 });
    }
  }, [hullGroups, filterGroup, mapLoaded, showHulls]);

  useEffect(() => { drawHulls(); }, [drawHulls]);

  // ---- Marker path (clustering === false) — unchanged behaviour ----
  useEffect(() => {
    if (clustering) return;
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    visiblePoints.forEach(p => {
      const el = document.createElement('div');
      // Optional per-point sizing; defaults to the original 8px dot.
      const size = p.radius != null ? `${Math.max(4, p.radius * 2)}px` : '8px';
      el.style.width = size;
      el.style.height = size;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = colorOf(p.statusKey);
      el.style.border = '1px solid rgba(255,255,255,0.4)';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 10, closeButton: false }).setHTML(popupHTML(p))
        )
        .addTo(map);

      el.addEventListener('click', () => onPointClick?.(p));

      markersRef.current.push(marker);
    });
  }, [visiblePoints, clustering, colorOf, popupHTML, onPointClick]);

  // ---- Clustering path (clustering === true) ----
  const clusterGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: visiblePoints.map(p => ({
      type: 'Feature' as const,
      properties: {
        id: p.id,
        title: p.title,
        subtitle: p.subtitle || '',
        statusKey: p.statusKey || '',
      },
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    })),
  }), [visiblePoints]);

  useEffect(() => {
    if (!clustering) return;
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const matchExpr: any = ['match', ['get', 'statusKey']];
    Object.entries(statusColors).forEach(([k, v]) => matchExpr.push(k, v));
    matchExpr.push(DEFAULT_STATUS_COLOR);

    if (!map.getSource(CLUSTER_SRC)) {
      map.addSource(CLUSTER_SRC, {
        type: 'geojson',
        data: clusterGeoJSON,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: CLUSTER_SRC,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#3b82f6', 25, '#6366f1', 100, '#8b5cf6'],
          'circle-radius': ['step', ['get', 'point_count'], 14, 25, 20, 100, 28],
          'circle-opacity': 0.75,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.5)',
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: CLUSTER_SRC,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });

      map.addLayer({
        id: POINT_LAYER,
        type: 'circle',
        source: CLUSTER_SRC,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': matchExpr,
          'circle-radius': 5,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.4)',
        },
      });
    } else {
      (map.getSource(CLUSTER_SRC) as mapboxgl.GeoJSONSource).setData(clusterGeoJSON as any);
      if (map.getLayer(POINT_LAYER)) map.setPaintProperty(POINT_LAYER, 'circle-color', matchExpr);
    }
  }, [clustering, mapLoaded, clusterGeoJSON, statusColors]);

  // Cluster / point interactions
  useEffect(() => {
    if (!clustering) return;
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const onClusterClick = (e: any) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
      const clusterId = features[0]?.properties?.cluster_id;
      if (clusterId == null) return;
      const src = map.getSource(CLUSTER_SRC) as mapboxgl.GeoJSONSource;
      src.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: zoom ?? map.getZoom() + 1 });
      });
    };

    const onPointLayerClick = (e: any) => {
      const f = e.features?.[0];
      if (!f) return;
      const point = points.find(p => p.id === f.properties?.id);
      if (!point) return;
      setSelectedPoint(point);
      const g = groupOf(point);
      if (g) setSelectedGroup(g);
      onPointClick?.(point);
      new mapboxgl.Popup({ offset: 10, closeButton: false })
        .setLngLat([point.lng, point.lat])
        .setHTML(popupHTML(point))
        .addTo(map);
    };

    const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const leave = () => { map.getCanvas().style.cursor = ''; };

    map.on('click', CLUSTER_LAYER, onClusterClick);
    map.on('click', POINT_LAYER, onPointLayerClick);
    map.on('mouseenter', CLUSTER_LAYER, enter);
    map.on('mouseleave', CLUSTER_LAYER, leave);
    map.on('mouseenter', POINT_LAYER, enter);
    map.on('mouseleave', POINT_LAYER, leave);

    return () => {
      map.off('click', CLUSTER_LAYER, onClusterClick);
      map.off('click', POINT_LAYER, onPointLayerClick);
      map.off('mouseenter', CLUSTER_LAYER, enter);
      map.off('mouseleave', CLUSTER_LAYER, leave);
      map.off('mouseenter', POINT_LAYER, enter);
      map.off('mouseleave', POINT_LAYER, leave);
    };
  }, [clustering, mapLoaded, points, groupOf, onPointClick, popupHTML]);

  const flyToPoint = (p: GeoPoint) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: 16, duration: 1200 });
    setSelectedPoint(p);
    onPointClick?.(p);
    if (!clustering) {
      const idx = visiblePoints.findIndex(v => v.id === p.id);
      if (idx >= 0 && markersRef.current[idx]) {
        markersRef.current[idx].togglePopup();
      }
    }
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className={className ?? 'relative w-full h-[calc(100vh-220px)] rounded-lg overflow-hidden border border-border'}>
        <div className="w-full h-full flex items-center justify-center bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Map unavailable: <code>VITE_MAPBOX_PUBLIC_TOKEN</code> is not configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className ?? 'relative w-full h-[calc(100vh-220px)] rounded-lg overflow-hidden border border-border'}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Group filter dropdown */}
      <div className="absolute top-3 right-3 z-20">
        <div className="flex items-center gap-2 bg-background/90 backdrop-blur rounded-lg border border-border p-2 shadow-lg">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterGroup} onValueChange={(val) => {
            setFilterGroup(val);
            setSelectedPoint(null);
            if (val !== 'all') {
              setSelectedGroup(val);
              setSearchQuery('');
            } else {
              setSelectedGroup(null);
            }
          }}>
            <SelectTrigger className="w-[180px] h-8 text-sm border-none bg-transparent">
              <SelectValue placeholder={groupFilterLabel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{groupFilterLabel} ({points.length})</SelectItem>
              {groupOptions.map(g => (
                <SelectItem key={g.name} value={g.name}>
                  {g.name} ({g.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Slide-out panel */}
      {selectedGroup && (
        <div className="absolute top-0 right-0 h-full w-[380px] bg-background/95 backdrop-blur border-l border-border shadow-xl flex flex-col z-10">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="font-semibold text-lg">{selectedGroup}</h3>
              <p className="text-xs text-muted-foreground">{groupCountLabel(groupPoints.length)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => {
              setSelectedGroup(null);
              setSelectedPoint(null);
              if (filterGroup !== 'all') setFilterGroup('all');
            }}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {selectedPoint && renderDetail && (
            <div className="px-4 py-3 border-b border-border">
              {renderDetail(selectedPoint)}
            </div>
          )}

          <div className="px-4 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-4 pb-4 space-y-1">
              {filteredPoints.length === 0 ? (
                emptyState ?? <p className="text-sm text-muted-foreground py-8 text-center">No results found</p>
              ) : (
                filteredPoints.map(p => (
                  <button
                    key={p.id}
                    onClick={() => flyToPoint(p)}
                    className="w-full text-left p-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    {renderListItem ? renderListItem(p) : (
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{p.subtitle || '—'}</p>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
