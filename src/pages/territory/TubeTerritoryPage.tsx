import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, MapPin, Flame, TrendingUp, Trophy, Target, Sprout, Search, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePriorCustomerSegmentMap, FLOW_STATUS_META, type FlowStatus } from '@/hooks/usePriorCustomerSegmentMap';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbTRraHBmeXEwMDZ3Mm1xdDJhYXc5NHBvIn0.5CCWFu1E1SIrFdLJ0uT5yQ';

interface NeighIntel {
  neighborhood: string | null;
  boro: string | null;
  total_lifetime_tubes: number;
  revenue_active_count: number;
  reactivation_target_count: number;
  reactivation_target_tube_value: number;
  prospect_count: number;
  lost_count: number;
  total_known_stores: number;
  takeover_pct: number;
  top_brand: string | null;
  monthly_velocity: number;
  estimated_customers: number;
  top_5_stores: any;
}

interface StoreCoord {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  neighborhood: string | null;
  boro: string | null;
}

const fmt = (n: number) => Number(n || 0).toLocaleString();
const PIN_COLORS: Record<FlowStatus, string> = {
  active_flow: '#10b981',
  recently_quiet: '#f59e0b',
  cold: '#ef4444',
  long_dormant: '#71717a',
};

export default function TubeTerritoryPage() {
  const navigate = useNavigate();
  const [boroFilter, setBoroFilter] = useState<string>('all');
  const [minTubes, setMinTubes] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [mapFilters, setMapFilters] = useState<Record<FlowStatus, boolean>>({
    active_flow: true, recently_quiet: true, cold: true, long_dormant: true,
  });

  // Neighborhood intel
  const intelQuery = useQuery({
    queryKey: ['neighborhood-tube-intel'],
    staleTime: 60_000,
    queryFn: async (): Promise<NeighIntel[]> => {
      const { data, error } = await supabase
        .from('v_neighborhood_tube_intel' as any)
        .select('*')
        .limit(2000);
      if (error) throw error;
      return (data || []) as unknown as NeighIntel[];
    },
  });

  // Store coords for map
  const coordsQuery = useQuery({
    queryKey: ['stores-coords-for-tube-map'],
    staleTime: 60_000,
    queryFn: async (): Promise<StoreCoord[]> => {
      const all: StoreCoord[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('stores')
          .select('id, name, lat, lng, neighborhood, boro')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as StoreCoord[];
        all.push(...rows.filter(r => r.lat != null && r.lng != null));
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  const { segments } = usePriorCustomerSegmentMap();

  const intel = intelQuery.data || [];
  const totalEmpire = intel.reduce((a, n) => a + Number(n.total_lifetime_tubes || 0), 0);
  const activeTerritoryCount = intel.filter(n => Number(n.revenue_active_count || 0) > 0).length;
  const reactivationValue = intel.reduce((a, n) => a + Number(n.reactivation_target_tube_value || 0), 0);
  const topTerritory = [...intel].sort((a, b) => Number(b.reactivation_target_tube_value || 0) - Number(a.reactivation_target_tube_value || 0))[0];

  const boros = useMemo(() => Array.from(new Set(intel.map(n => n.boro).filter(Boolean))).sort() as string[], [intel]);

  const filtered = useMemo(() => {
    let rows = intel;
    if (boroFilter !== 'all') rows = rows.filter(r => r.boro === boroFilter);
    if (minTubes > 0) rows = rows.filter(r => Number(r.total_lifetime_tubes || 0) >= minTubes);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => (r.neighborhood || '').toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => Number(b.reactivation_target_tube_value || 0) - Number(a.reactivation_target_tube_value || 0));
  }, [intel, boroFilter, minTubes, search]);

  const PAGE_SIZE = 20;
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const topROI = topTerritory;
  const topGrowth = [...intel].filter(n => Number(n.estimated_customers || 0) > 5)
    .sort((a, b) => Number(b.takeover_pct || 0) - Number(a.takeover_pct || 0))[0];
  const topUntapped = [...intel].filter(n => Number(n.total_lifetime_tubes || 0) > 100)
    .sort((a, b) => Number(a.takeover_pct || 0) - Number(b.takeover_pct || 0))[0];

  // Map setup
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.95, 40.73],
      zoom: 10.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    map.on('load', () => setMapLoaded(true));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!coordsQuery.data || segments.length === 0) return;

    // Clear markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Build segment map
    const segMap = new Map(segments.map(s => [s.store_id, s]));

    const sourceId = 'tube-stores-source';
    const clusterLayer = 'tube-clusters';
    const clusterCountLayer = 'tube-cluster-count';
    const unclusteredLayer = 'tube-unclustered';

    // Remove old layers/source
    [unclusteredLayer, clusterCountLayer, clusterLayer].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    const features = coordsQuery.data
      .map(s => {
        const seg = segMap.get(s.id);
        if (!seg || !seg.flow_status) return null;
        const flow = seg.flow_status as FlowStatus;
        if (!mapFilters[flow]) return null;
        const tubes = Number(seg.lifetime_tubes || 0);
        const size = tubes > 500 ? 12 : tubes >= 100 ? 8 : 5;
        return {
          type: 'Feature' as const,
          properties: {
            store_id: s.id,
            store_name: s.name,
            flow_status: flow,
            color: PIN_COLORS[flow],
            size,
            tubes,
            last_order: seg.last_order_date,
          },
          geometry: { type: 'Point' as const, coordinates: [Number(s.lng), Number(s.lat)] },
        };
      })
      .filter(Boolean) as any[];

    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 50,
    });

    map.addLayer({
      id: clusterLayer,
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#3b82f6', 10, '#8b5cf6', 50, '#ef4444'],
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#0f172a',
      },
    });

    map.addLayer({
      id: clusterCountLayer,
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
      paint: { 'text-color': '#ffffff' },
    });

    map.addLayer({
      id: unclusteredLayer,
      type: 'circle',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': ['get', 'size'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#0f172a',
      },
    });

    map.on('click', clusterLayer, (e: any) => {
      const f = e.features?.[0];
      if (!f) return;
      const clusterId = f.properties.cluster_id;
      const src = map.getSource(sourceId) as any;
      src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return;
        map.easeTo({ center: f.geometry.coordinates, zoom });
      });
    });

    map.on('click', unclusteredLayer, (e: any) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties;
      const days = p.last_order ? Math.floor((Date.now() - new Date(p.last_order).getTime()) / 86400000) : null;
      const meta = FLOW_STATUS_META[p.flow_status as FlowStatus];
      new mapboxgl.Popup({ offset: 12 })
        .setLngLat(f.geometry.coordinates)
        .setHTML(`
          <div style="font-family: system-ui; min-width: 200px;">
            <div style="font-weight:600; margin-bottom:4px;">${(p.store_name || 'Store').replace(/</g, '&lt;')}</div>
            <div style="font-size:12px; color:#666; margin-bottom:4px;">${meta.emoji} ${meta.label}</div>
            <div style="font-size:12px;">Lifetime: <strong>${Number(p.tubes).toLocaleString()}</strong> tubes</div>
            ${days != null ? `<div style="font-size:12px; color:#666;">Last delivery: ${days}d ago</div>` : ''}
            <a href="/stores/${p.store_id}" style="display:inline-block; margin-top:6px; font-size:12px; color:#3b82f6;">Open Profile →</a>
          </div>
        `)
        .addTo(map);
    });

    map.on('mouseenter', clusterLayer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', clusterLayer, () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', unclusteredLayer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', unclusteredLayer, () => { map.getCanvas().style.cursor = ''; });
  }, [mapLoaded, coordsQuery.data, segments, mapFilters]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">🗺️ Tube Territory</h1>
          <p className="text-muted-foreground text-sm">
            Where the empire flows. Where it can flow next.
          </p>
        </div>
        <Link to="/territory">
          <Button variant="outline" size="sm">← Territory Control</Button>
        </Link>
      </div>

      {/* SECTION A — KPI HERO STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-red-500/15">
              <Globe className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{fmt(totalEmpire)}</p>
              <p className="text-xs text-muted-foreground">Total empire (tubes)</p>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-500/15">
              <MapPin className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{fmt(activeTerritoryCount)}</p>
              <p className="text-xs text-muted-foreground">Active territories</p>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-amber-500/15">
              <Flame className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{fmt(reactivationValue)}</p>
              <p className="text-xs text-muted-foreground">Reactivation tube value</p>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-purple-500/15">
              <Trophy className="h-5 w-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold truncate">{topTerritory?.neighborhood || '—'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {topTerritory ? `${fmt(topTerritory.total_lifetime_tubes)} tubes • ${fmt(topTerritory.reactivation_target_count)} targets` : 'No data'}
              </p>
            </div>
          </div>
        </CardContent></Card>
      </div>

      {/* SECTION C — MAP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Empire Map</span>
            <div className="flex flex-wrap gap-2">
              {(['active_flow','recently_quiet','cold','long_dormant'] as FlowStatus[]).map(f => (
                <Button key={f} size="sm"
                  variant={mapFilters[f] ? 'default' : 'outline'}
                  onClick={() => setMapFilters(prev => ({ ...prev, [f]: !prev[f] }))}
                  className="text-xs h-7">
                  {FLOW_STATUS_META[f].emoji} {FLOW_STATUS_META[f].label}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={mapContainer} className="h-[500px] w-full rounded-lg overflow-hidden border" />
        </CardContent>
      </Card>

      {/* SECTION D — OPPORTUNITY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-amber-600" /> 🎯 Highest ROI Territory</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topROI ? (
              <>
                <p className="text-sm">
                  <strong>{topROI.neighborhood}</strong> — {fmt(topROI.reactivation_target_tube_value)} tubes across {fmt(topROI.reactivation_target_count)} reactivation targets. One ambassador, one week, transform this zone.
                </p>
                <Button size="sm" onClick={() => navigate(`/communication/dialer/campaign?neighborhood=${encodeURIComponent(topROI.neighborhood || '')}`)}>
                  Start {topROI.neighborhood} Campaign →
                </Button>
              </>
            ) : <p className="text-sm text-muted-foreground">No data</p>}
          </CardContent>
        </Card>
        <Card className="border-emerald-500/40">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /> 🚀 Strongest Growth</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topGrowth ? (
              <>
                <p className="text-sm">
                  <strong>{topGrowth.neighborhood}</strong> — {Number(topGrowth.takeover_pct || 0).toFixed(1)}% takeover already. Double-down territory.
                </p>
                <Button size="sm" variant="outline" onClick={() => navigate(`/territory/tube-intelligence/${encodeURIComponent(topGrowth.neighborhood || '')}`)}>
                  View Active Stores →
                </Button>
              </>
            ) : <p className="text-sm text-muted-foreground">No data</p>}
          </CardContent>
        </Card>
        <Card className="border-blue-500/40">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sprout className="h-4 w-4 text-blue-600" /> 🌱 Most Untapped</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topUntapped ? (
              <>
                <p className="text-sm">
                  <strong>{topUntapped.neighborhood}</strong> — only {Number(topUntapped.takeover_pct || 0).toFixed(1)}% takeover but {fmt(topUntapped.total_lifetime_tubes)} tubes prove the market. Field expansion priority.
                </p>
                <Button size="sm" variant="outline" disabled>Discover Prospects →</Button>
              </>
            ) : <p className="text-sm text-muted-foreground">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* SECTION B — LEADERBOARD */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Neighborhood Leaderboard</CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <Select value={boroFilter} onValueChange={(v) => { setBoroFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Borough" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All boroughs</SelectItem>
                {boros.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Min tubes" className="w-[140px]"
              value={minTubes || ''}
              onChange={e => { setMinTubes(Number(e.target.value) || 0); setPage(0); }} />
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search neighborhood" className="pl-8 w-[220px]"
                value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {intelQuery.isLoading ? <Skeleton className="h-64 mx-6 mb-6" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground bg-muted/30">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Neighborhood</th>
                    <th className="py-2 px-3">Borough</th>
                    <th className="py-2 px-3 text-right">Total Tubes</th>
                    <th className="py-2 px-3 text-right">Active</th>
                    <th className="py-2 px-3 text-right">Reactivation</th>
                    <th className="py-2 px-3 text-right">Reactivation Value</th>
                    <th className="py-2 px-3 text-right">Takeover %</th>
                    <th className="py-2 px-3">Top Brand</th>
                    <th className="py-2 px-3 text-right">Velocity</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((n, i) => {
                    const key = `${n.neighborhood}-${n.boro}`;
                    const expanded = expandedRow === key;
                    const top5 = Array.isArray(n.top_5_stores) ? n.top_5_stores : [];
                    return (
                      <>
                        <tr key={key} className="border-b hover:bg-muted/20 cursor-pointer"
                          onClick={() => setExpandedRow(expanded ? null : key)}>
                          <td className="py-2 px-3 font-mono text-muted-foreground">{page * PAGE_SIZE + i + 1}</td>
                          <td className="py-2 px-3 font-medium">{n.neighborhood || '—'}</td>
                          <td className="py-2 px-3">{n.boro || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{fmt(n.total_lifetime_tubes)}</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-600">{fmt(n.revenue_active_count)}</td>
                          <td className="py-2 px-3 text-right font-mono text-red-600">{fmt(n.reactivation_target_count)}</td>
                          <td className="py-2 px-3 text-right font-mono text-amber-600">{fmt(n.reactivation_target_tube_value)}</td>
                          <td className="py-2 px-3 text-right">
                            <Badge variant="outline">{Number(n.takeover_pct || 0).toFixed(1)}%</Badge>
                          </td>
                          <td className="py-2 px-3 capitalize">{n.top_brand || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{fmt(n.monthly_velocity)}/mo</td>
                          <td className="py-2 px-3">
                            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${key}-x`} className="bg-muted/10 border-b">
                            <td colSpan={11} className="px-6 py-3">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground">Top 5 stores in {n.neighborhood}</p>
                                {top5.length > 0 ? (
                                  <ul className="text-xs space-y-1">
                                    {top5.slice(0, 5).map((s: any, idx: number) => (
                                      <li key={idx} className="flex items-center justify-between gap-3">
                                        <span>{s.store_name || s.name || 'Unknown'}</span>
                                        <span className="font-mono text-muted-foreground">{fmt(Number(s.lifetime_tubes || s.tubes || 0))} tubes</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : <p className="text-xs text-muted-foreground">No store data</p>}
                                <div>
                                  <Link to={`/territory/tube-intelligence/${encodeURIComponent(n.neighborhood || '')}`}
                                    className="text-xs text-primary inline-flex items-center gap-1">
                                    View Full Detail <ChevronRight className="h-3 w-3" />
                                  </Link>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pageCount > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <p className="text-xs text-muted-foreground">{filtered.length} territories • page {page + 1} / {pageCount}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</Button>
                <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
