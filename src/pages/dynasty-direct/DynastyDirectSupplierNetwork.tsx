/**
 * Dynasty Direct — Supplier Network Map
 *
 * State-by-state choropleth shaded by supplier count.
 * Click state → drawer listing suppliers + their products + inventory.
 * Un-geocoded suppliers listed in a sidebar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Link } from 'react-router-dom';
import { MapPin, AlertTriangle, CheckSquare, Square, RefreshCw, Send, Pause, Play, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { InviteButton } from '@/components/invites/InviteButton';
import { DDAlertBar } from '@/components/dynasty-direct/DDAlertBar';
import { DDBulkBar } from '@/components/dynasty-direct/DDBulkBar';
import { DDDrillMenu, ddDrill } from '@/components/dynasty-direct/DDDrillMenu';
import { DDDraftOutreachDialog } from '@/components/dynasty-direct/DDDraftOutreachDialog';
import { WholesalerPortalReadiness } from '@/components/dynasty-direct/WholesalerPortalReadiness';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;

type Wholesaler = {
  id: string;
  name: string;
  state: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string | null;
  reliability_grade: string | null;
  preferred: boolean | null;
  overall_rating: number | null;
};

type Product = { id: string; name: string; wholesaler_id: string | null };
type Inventory = { product_id: string; wholesaler_id: string; quantity_available: number | null };

// US state name → 2-letter, used to match free-form state strings.
const STATE_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC',
};

function normState(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length === 2) return t.toUpperCase();
  return STATE_ABBR[t.toLowerCase()] ?? null;
}

const US_ALL_STATES = Object.values(STATE_ABBR);

export default function DynastyDirectSupplierNetwork() {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedUngeo, setSelectedUngeo] = useState<Set<string>>(new Set());
  const [outreachTarget, setOutreachTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [addrInputs, setAddrInputs] = useState<Record<string, string>>({});
  const [geoBusy, setGeoBusy] = useState<string | null>(null);

  async function geocodeAndSave(w: Wholesaler) {
    if (!MAPBOX_TOKEN) { toast.error('Mapbox token not configured'); return; }
    const q = (addrInputs[w.id] || [w.address, w.city, normState(w.state)].filter(Boolean).join(', ')).trim();
    if (!q) { toast.error('Enter an address'); return; }
    setGeoBusy(w.id);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=us&limit=1&access_token=${MAPBOX_TOKEN}`,
      );
      const j = await res.json();
      const feat = j?.features?.[0];
      if (!feat?.center) throw new Error('No match');
      const [lng, lat] = feat.center as [number, number];
      const ctx = (feat.context || []) as any[];
      const stateCtx = ctx.find((c) => String(c.id || '').startsWith('region'));
      const placeCtx = ctx.find((c) => String(c.id || '').startsWith('place'));
      const stateCode = stateCtx?.short_code?.replace(/^US-/, '') ?? null;
      const city = placeCtx?.text ?? null;
      const { error } = await supabase
        .from('wholesalers')
        .update({
          latitude: lat,
          longitude: lng,
          city: w.city ?? city,
          state_code: stateCode,
          state: w.state ?? stateCode,
          geocoded_at: new Date().toISOString(),
          geocode_status: 'ok',
        } as any)
        .eq('id', w.id);
      if (error) throw error;
      setWholesalers((prev) => prev.map((x) => (x.id === w.id ? { ...x, latitude: lat, longitude: lng, city: x.city ?? city, state: x.state ?? stateCode } : x)));
      toast.success(`Saved location for ${w.name}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Geocode failed');
    } finally {
      setGeoBusy(null);
    }
  }

  function toggleUngeo(id: string) {
    setSelectedUngeo((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function bulkGeocodeRetry() {
    setBulkBusy('geocode');
    let ok = 0, failed = 0;
    for (const id of Array.from(selectedUngeo)) {
      try {
        const { error } = await supabase.functions.invoke('geocode-wholesaler', { body: { wholesaler_id: id } });
        if (error) throw error;
        ok++;
      } catch (e) { console.error('[bulkGeocode]', id, e); failed++; }
    }
    toast.success(`Geocode retry: ${ok} ok, ${failed} failed`);
    setSelectedUngeo(new Set());
    setBulkBusy(null);
  }

  async function bulkSupplierStatus(status: 'active' | 'paused') {
    setBulkBusy(status);
    let ok = 0, failed = 0;
    for (const id of Array.from(selectedUngeo)) {
      try {
        const { error } = await supabase.from('wholesalers').update({ status } as any).eq('id', id);
        if (error) throw error;
        ok++;
      } catch (e) { console.error('[bulkSupplierStatus]', id, e); failed++; }
    }
    toast.success(`Bulk ${status}: ${ok} ok, ${failed} failed`);
    setSelectedUngeo(new Set());
    setBulkBusy(null);
  }


  // Load data
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [w, p, inv] = await Promise.all([
        supabase
          .from('wholesalers')
          .select('id, name, state, city, address, latitude, longitude, geocode_status, reliability_grade, preferred, overall_rating')
          .is('deleted_at', null),
        supabase.from('products_all').select('id, name, wholesaler_id'),
        supabase.from('marketplace_inventory').select('product_id, wholesaler_id, quantity_available'),
      ]);
      setWholesalers((w.data as any) || []);
      setProducts((p.data as any) || []);
      setInventory((inv.data as any) || []);
      setLoading(false);
    })();
  }, []);

  const byState = useMemo(() => {
    const m = new Map<string, Wholesaler[]>();
    for (const w of wholesalers) {
      const s = normState(w.state);
      if (!s) continue;
      if (!m.has(s)) m.set(s, []);
      m.get(s)!.push(w);
    }
    return m;
  }, [wholesalers]);

  const unGeocoded = useMemo(
    () => wholesalers.filter((w) => w.latitude == null || w.longitude == null),
    [wholesalers]
  );

  const summary = useMemo(() => {
    const covered = byState.size;
    return {
      suppliers: wholesalers.length,
      statesCovered: covered,
      statesEmpty: US_ALL_STATES.length - covered,
      geocoded: wholesalers.length - unGeocoded.length,
    };
  }, [wholesalers, byState, unGeocoded]);

  // Init map
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapEl.current || map.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapEl.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-96, 38],
      zoom: 3.4,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
  }, []);

  // Choropleth + pins
  useEffect(() => {
    if (!map.current || loading) return;
    const m = map.current;

    const apply = () => {
      // Build per-state counts keyed by state NAME (matches public GeoJSON `name` prop)
      const counts: Record<string, number> = {};
      byState.forEach((list, st) => {
        const entry = Object.entries(STATE_ABBR).find(([, abbr]) => abbr === st);
        if (!entry) return;
        const name = entry[0].replace(/\b\w/g, (c) => c.toUpperCase());
        counts[name] = list.length;
      });
      const matchPairs: any[] = [];
      Object.entries(counts).forEach(([name, n]) => matchPairs.push(name, n));
      const colorExpr: any = [
        'interpolate', ['linear'],
        matchPairs.length
          ? ['match', ['get', 'name'], ...matchPairs, 0]
          : ['literal', 0],
        0, '#f3f4f6',
        1, '#bfdbfe',
        3, '#60a5fa',
        6, '#2563eb',
        10, '#1e3a8a',
      ];

      // Public US-states GeoJSON (PublicaMundi)
      if (!m.getSource('us-states')) {
        m.addSource('us-states', {
          type: 'geojson',
          data: 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
        });
        m.addLayer({
          id: 'state-fills',
          type: 'fill',
          source: 'us-states',
          paint: { 'fill-color': colorExpr, 'fill-opacity': 0.7 },
        });
        m.addLayer({
          id: 'state-borders',
          type: 'line',
          source: 'us-states',
          paint: { 'line-color': '#1f2937', 'line-width': 0.5 },
        });
        m.on('click', 'state-fills', (e) => {
          const f = e.features?.[0] as any;
          const name = f?.properties?.name as string | undefined;
          if (!name) return;
          const abbr = STATE_ABBR[name.toLowerCase()];
          if (abbr) setSelectedState(abbr);
        });
        m.on('mouseenter', 'state-fills', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'state-fills', () => { m.getCanvas().style.cursor = ''; });
      } else {
        m.setPaintProperty('state-fills', 'fill-color', colorExpr);
      }

      // Markers for geocoded suppliers — grade-colored + preferred star
      const gradeColor = (g: string | null | undefined): string => {
        const k = (g || '').toUpperCase();
        if (k === 'A') return '#16a34a';
        if (k === 'B') return '#2563eb';
        if (k === 'C') return '#eab308';
        if (k === 'D' || k === 'F') return '#dc2626';
        return '#9ca3af';
      };
      wholesalers
        .filter((w) => w.latitude != null && w.longitude != null)
        .forEach((w) => {
          const el = document.createElement('div');
          const initial = (w.name || '?').trim().charAt(0).toUpperCase();
          const bg = gradeColor(w.reliability_grade);
          el.style.cssText =
            `position:relative;width:24px;height:24px;border-radius:50%;background:${bg};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);cursor:pointer;color:white;font:600 12px/20px system-ui;text-align:center;`;
          el.textContent = initial;
          if (w.preferred) {
            const star = document.createElement('div');
            star.textContent = '★';
            star.style.cssText =
              'position:absolute;top:-8px;right:-8px;width:14px;height:14px;font:700 12px/14px system-ui;color:#f59e0b;text-shadow:0 0 2px #000;pointer-events:none;';
            el.appendChild(star);
          }
          const stars = '★★★★★'.slice(0, Math.max(0, Math.min(5, Math.round(Number(w.overall_rating) || 0))))
            + '☆☆☆☆☆'.slice(0, 5 - Math.max(0, Math.min(5, Math.round(Number(w.overall_rating) || 0))));
          new mapboxgl.Marker({ element: el })
            .setLngLat([Number(w.longitude), Number(w.latitude)])
            .setPopup(
              new mapboxgl.Popup({ offset: 14 }).setHTML(
                `<div style="font-size:12px;min-width:180px">
                   <strong>${w.name}</strong>${w.preferred ? ' <span style="color:#f59e0b">★ Preferred</span>' : ''}<br/>
                   ${w.city || ''} ${normState(w.state) || ''}<br/>
                   Grade: <strong>${w.reliability_grade || '—'}</strong><br/>
                   Rating: ${stars}<br/>
                   <a href="/dynasty-direct/suppliers/${w.id}" style="color:#2563eb;text-decoration:underline">View Details →</a>
                 </div>`
              )
            )
            .addTo(m);
        });
    };

    if (m.isStyleLoaded()) apply();
    else m.on('load', apply);
  }, [byState, wholesalers, loading]);

  const stateSuppliers = selectedState ? byState.get(selectedState) || [] : [];
  const stateProductsByWh = (whId: string) => products.filter((p) => p.wholesaler_id === whId);
  const stateInvByWh = (whId: string) => inventory.filter((i) => i.wholesaler_id === whId);

  return (
    <div className="p-6 space-y-4">
      <DDAlertBar />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dynasty Direct — Supplier Network</h1>
          <p className="text-sm text-muted-foreground">
            State-by-state coverage. Click any state to drill into its suppliers, products and inventory.
          </p>
        </div>
        <div className="inline-flex rounded-md border bg-background overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            📋 List View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 text-xs font-medium border-l ${viewMode === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            🗺️ Map View
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total suppliers</div>
          <div className="text-2xl font-semibold">{summary.suppliers}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">States covered</div>
          <div className="text-2xl font-semibold text-primary">{summary.statesCovered}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">States with no supplier</div>
          <div className="text-2xl font-semibold">{summary.statesEmpty}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Geocoded</div>
          <div className="text-2xl font-semibold">{summary.geocoded} / {summary.suppliers}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3 p-0 overflow-hidden">
          {!MAPBOX_TOKEN ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              VITE_MAPBOX_PUBLIC_TOKEN is not configured — map cannot render.
            </div>
          ) : (
            <div ref={mapEl} style={{ height: 600 }} />
          )}
        </Card>

        <Card className="p-4 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <div className="font-semibold text-sm">Needs location</div>
            <Badge variant="outline">{unGeocoded.length}</Badge>
            {unGeocoded.length > 0 && (
              <button
                onClick={() => setSelectedUngeo(
                  selectedUngeo.size === unGeocoded.length
                    ? new Set()
                    : new Set(unGeocoded.map((w) => w.id))
                )}
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {selectedUngeo.size === unGeocoded.length ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                {selectedUngeo.size === unGeocoded.length ? 'Clear' : 'All'}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Suppliers missing lat/lng. Select rows to bulk geocode-retry, pause / activate, or invite.
          </p>
          <DDBulkBar
            count={selectedUngeo.size}
            total={unGeocoded.length}
            onClear={() => setSelectedUngeo(new Set())}
            busy={bulkBusy}
            className="mb-2"
            actions={[
              { key: 'geocode', label: 'Retry geocode', icon: RefreshCw, variant: 'default', onRun: bulkGeocodeRetry },
              { key: 'paused',  label: 'Pause',         icon: Pause,    variant: 'outline', onRun: () => bulkSupplierStatus('paused') },
              { key: 'active',  label: 'Activate',      icon: Play,     variant: 'outline', onRun: () => bulkSupplierStatus('active') },
            ]}
          />
          <div className="max-h-[500px] overflow-y-auto space-y-1">
            {unGeocoded.map((w) => {
              const isSel = selectedUngeo.has(w.id);
              return (
              <div
                key={w.id}
                className={`text-xs border rounded p-2 flex items-start gap-2 ${isSel ? 'ring-1 ring-primary bg-primary/5' : ''}`}
              >
                <button
                  onClick={() => toggleUngeo(w.id)}
                  className="mt-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Select"
                >
                  {isSel ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{w.name}</div>
                  <div className="text-muted-foreground truncate">
                    {w.address || '—'} {w.city ? `· ${w.city}` : ''} {normState(w.state) || ''}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <input
                      type="text"
                      value={addrInputs[w.id] ?? ''}
                      onChange={(e) => setAddrInputs((p) => ({ ...p, [w.id]: e.target.value }))}
                      placeholder={w.address ? 'Override address…' : 'Enter address, city, state'}
                      className="flex-1 min-w-0 h-6 text-[11px] px-1.5 border rounded bg-background"
                    />
                    <button
                      type="button"
                      onClick={() => geocodeAndSave(w)}
                      disabled={geoBusy === w.id}
                      className="text-[11px] px-2 h-6 rounded bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      {geoBusy === w.id ? '…' : 'Add Location'}
                    </button>
                  </div>
                </div>
                <DDDrillMenu
                  label={w.name}
                  items={[
                    ddDrill.supplier(w.id, w.name),
                    ddDrill.supplierOrders(w.id),
                    ddDrill.supplierProducts(w.id),
                    ddDrill.inventory(w.id),
                    ddDrill.supplierInvite(w.id),
                    { label: 'Draft outreach', icon: Sparkles, onSelect: () => setOutreachTarget({ id: w.id, name: w.name }) },
                  ]}
                />
              </div>
              );
            })}
            {unGeocoded.length === 0 && (
              <div className="text-xs text-muted-foreground">All suppliers geocoded.</div>
            )}
          </div>
          <Link to="/admin/dynasty-direct-ops">
            <Button variant="outline" size="sm" className="w-full mt-3">
              <MapPin className="h-4 w-4 mr-2" /> Open Ops Console
            </Button>
          </Link>
        </Card>
      </div>

      <Sheet open={!!selectedState} onOpenChange={(o) => !o && setSelectedState(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedState} — Suppliers ({stateSuppliers.length})</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {stateSuppliers.length === 0 && (
              <div className="text-sm text-muted-foreground">No suppliers in this state yet.</div>
            )}
            {stateSuppliers.map((w) => {
              const prods = stateProductsByWh(w.id);
              const inv = stateInvByWh(w.id);
              return (
                <Card key={w.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{w.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[w.address, w.city, normState(w.state)].filter(Boolean).join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOutreachTarget({ id: w.id, name: w.name })}
                        title="AI-draft an outreach message"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1" /> Draft outreach
                      </Button>
                      <InviteButton
                        role="wholesaler"
                        targetLink={{ wholesaler_id: w.id, company_name: w.name }}
                        defaultName={w.name}
                        label="Invite"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Products ({prods.length})
                    </div>
                    {prods.map((p) => {
                      const stock = inv.find((i) => i.product_id === p.id);
                      return (
                        <div key={p.id} className="text-xs flex justify-between border-b py-1">
                          <span>{p.name}</span>
                          <span className="text-muted-foreground">
                            stock: {stock?.quantity_available ?? '—'}
                          </span>
                        </div>
                      );
                    })}
                    {prods.length === 0 && (
                      <div className="text-xs text-muted-foreground">No catalog products.</div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {outreachTarget && (
        <DDDraftOutreachDialog
          open={!!outreachTarget}
          onOpenChange={(o) => !o && setOutreachTarget(null)}
          wholesalerId={outreachTarget.id}
          wholesalerName={outreachTarget.name}
        />
      )}

      <WholesalerPortalReadiness />
    </div>
  );
}
