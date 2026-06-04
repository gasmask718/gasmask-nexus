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
import { MapPin, AlertTriangle, CheckSquare, Square, RefreshCw, Send, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { InviteButton } from '@/components/invites/InviteButton';
import { DDAlertBar } from '@/components/dynasty-direct/DDAlertBar';
import { DDBulkBar } from '@/components/dynasty-direct/DDBulkBar';
import { DDDrillMenu, ddDrill } from '@/components/dynasty-direct/DDDrillMenu';

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
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

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
          .select('id, name, state, city, address, latitude, longitude, geocode_status')
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

      // Markers for geocoded suppliers
      wholesalers
        .filter((w) => w.latitude != null && w.longitude != null)
        .forEach((w) => {
          const el = document.createElement('div');
          el.style.cssText =
            'width:12px;height:12px;border-radius:50%;background:#dc2626;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);cursor:pointer';
          new mapboxgl.Marker({ element: el })
            .setLngLat([Number(w.longitude), Number(w.latitude)])
            .setPopup(
              new mapboxgl.Popup({ offset: 14 }).setHTML(
                `<div style="font-size:12px"><strong>${w.name}</strong><br/>${w.city || ''} ${normState(w.state) || ''}</div>`
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
      <div>
        <h1 className="text-2xl font-bold">Dynasty Direct — Supplier Network</h1>
        <p className="text-sm text-muted-foreground">
          State-by-state coverage. Click any state to drill into its suppliers, products and inventory.
        </p>
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
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Suppliers missing lat/lng. Geocode them from the Ops Console.
          </p>
          <div className="max-h-[500px] overflow-y-auto space-y-1">
            {unGeocoded.map((w) => (
              <div key={w.id} className="text-xs border rounded p-2">
                <div className="font-medium">{w.name}</div>
                <div className="text-muted-foreground">
                  {w.address || '—'} {w.city ? `· ${w.city}` : ''} {normState(w.state) || ''}
                </div>
              </div>
            ))}
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
                    <InviteButton
                      role="wholesaler"
                      targetLink={{ wholesaler_id: w.id, company_name: w.name }}
                      defaultName={w.name}
                      label="Invite"
                    />
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
    </div>
  );
}
