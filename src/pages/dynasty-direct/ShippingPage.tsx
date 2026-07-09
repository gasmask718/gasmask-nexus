import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Truck, Package, Ruler, PackageCheck, Clock, AlertTriangle, Info,
  RefreshCw, Boxes, Printer,
} from 'lucide-react';
import { printShippingLabel } from '@/lib/shipping/printLabel';
import { validateProductsForShipping } from '@/components/products/ProductDimensionsPanel';

const GOLD = '#C9A84C';

type ProductRow = {
  id: string;
  product_name: string;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
  weight_oz: number | null;
  is_fragile: boolean | null;
  stackable: boolean | null;
};

type ShipmentRow = {
  id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  rate_selected: number | null;
  label_url: string | null;
  order_id: string | null;
};

type PackedBox = {
  box_id: string;
  box_name: string;
  carrier: string;
  is_flat_rate: boolean;
  flat_rate_price: number | null;
  dimensions: { length_in: number; width_in: number; height_in: number };
  items: { product_id: string; quantity: number }[];
  actual_weight_oz: number;
  dim_weight_oz: number;
  billable_weight_oz: number;
  fill_percentage: number;
  fragile_only: boolean;
};

function hasCompleteDims(p: ProductRow) {
  return !!(p.length_in && p.width_in && p.height_in && p.weight_oz);
}

export default function ShippingPage() {
  const [filterMissingDims, setFilterMissingDims] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [manifest, setManifest] = useState<{
    box_count: number;
    boxes: PackedBox[];
    warnings: string[];
    total_units_input: number;
    total_units_packed: number;
  } | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const productsQ = useQuery({
    queryKey: ['dd-shipping-products'],
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from('products_all')
        .select('id, product_name, length_in, width_in, height_in, weight_oz, is_fragile, stackable')
        .eq('status', 'active')
        .order('product_name');
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const shipmentsQ = useQuery({
    queryKey: ['dd-shipments-recent'],
    queryFn: async (): Promise<ShipmentRow[]> => {
      const { data, error } = await supabase
        .from('dd_shipments')
        .select('id, status, carrier, tracking_number, created_at, rate_selected, label_url, order_id')
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as ShipmentRow[];
    },
  });

  const pickupsQ = useQuery({
    queryKey: ['dd-pickups-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dd_pickup_schedules')
        .select('id, status, pickup_date')
        .gte('pickup_date', new Date().toISOString().slice(0, 10));
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = productsQ.data ?? [];
  const totalProducts = products.length;
  const readyProducts = products.filter(hasCompleteDims).length;
  const dimCoveragePct = totalProducts ? Math.round((readyProducts / totalProducts) * 100) : 0;

  const shipments = shipmentsQ.data ?? [];
  const inTransit = shipments.filter((s) => ['in_transit', 'out_for_delivery', 'picked_up'].includes(s.status)).length;
  const delivered = shipments.filter((s) => s.status === 'delivered').length;
  const upcomingPickups = (pickupsQ.data ?? []).filter((p: any) => p.status !== 'cancelled').length;

  const filteredProducts = useMemo(() => {
    if (!filterMissingDims) return products;
    return products.filter((p) => !hasCompleteDims(p));
  }, [products, filterMissingDims]);

  async function runPackingPreview() {
    setManifest(null);
    setManifestError(null);
    const chosen = products.filter((p) => selectedProductIds.includes(p.id));
    if (chosen.length === 0) {
      setManifestError('Select at least one product.');
      return;
    }
    const { ok, errors } = validateProductsForShipping(chosen);
    if (!ok) {
      setManifestError(
        'Cannot run packing — the following products are missing required dimensions:\n' +
        errors.map((e) => `• ${e.product_name} (missing: ${e.missing.join(', ')})`).join('\n'),
      );
      return;
    }
    setManifestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('dd-calculate-packing', {
        body: {
          items: chosen.map((p) => ({
            product_id: p.id,
            quantity: 1,
            length_in: p.length_in,
            width_in: p.width_in,
            height_in: p.height_in,
            weight_oz: p.weight_oz,
            is_fragile: !!p.is_fragile,
            stackable: p.stackable !== false,
          })),
          carrier_preference: 'any',
          prefer_flat_rate: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setManifest(data);
    } catch (e: any) {
      setManifestError(e?.message ?? 'Packing preview failed');
    } finally {
      setManifestLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const goldBorder = { borderColor: GOLD };
  const goldText = { color: GOLD };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="w-7 h-7" style={goldText} />
            Shipping
          </h1>
          <p className="text-muted-foreground">
            Dynasty Direct outbound fulfillment: box selection, rate preview, labels & pickups.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            productsQ.refetch();
            shipmentsQ.refetch();
            pickupsQ.refetch();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={<Package />} label="Total Shipments" value={shipmentsQ.isLoading ? null : shipments.length} loading={shipmentsQ.isLoading} />
        <StatCard icon={<Truck />} label="In Transit" value={shipmentsQ.isLoading ? null : inTransit} loading={shipmentsQ.isLoading} />
        <StatCard icon={<PackageCheck />} label="Delivered" value={shipmentsQ.isLoading ? null : delivered} loading={shipmentsQ.isLoading} />
        <StatCard icon={<Clock />} label="Upcoming Pickups" value={pickupsQ.isLoading ? null : upcomingPickups} loading={pickupsQ.isLoading} />
        <Card
          role="button"
          tabIndex={0}
          onClick={() => setFilterMissingDims((v) => !v)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setFilterMissingDims((v) => !v)}
          className="cursor-pointer transition hover:shadow-md"
          style={{ borderColor: GOLD, borderWidth: 1 }}
        >
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Ruler className="w-4 h-4" style={goldText} />
              Dimension Coverage
            </CardTitle>
            {filterMissingDims && <Badge style={{ backgroundColor: GOLD, color: '#000' }}>filtered</Badge>}
          </CardHeader>
          <CardContent>
            {productsQ.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  <span style={goldText}>{readyProducts}</span>{' '}
                  <span className="text-muted-foreground text-base">of {totalProducts} ready</span>
                </div>
                <Progress value={dimCoveragePct} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {filterMissingDims ? 'Showing products missing dimensions' : 'Click to filter missing-dim products'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card style={{ borderColor: GOLD, borderWidth: 1 }}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5" style={goldText} />
                Box Packing Preview
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Runs <code>dd-calculate-packing</code> against your selection.{' '}
                <strong style={goldText}>No label is generated here.</strong>
              </p>
            </div>
            <Button
              onClick={runPackingPreview}
              disabled={manifestLoading || selectedProductIds.length === 0}
              style={{ backgroundColor: GOLD, color: '#000' }}
            >
              {manifestLoading ? 'Calculating…' : `Preview (${selectedProductIds.length} selected)`}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {manifestError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Packing failed</AlertTitle>
              <AlertDescription className="whitespace-pre-line">{manifestError}</AlertDescription>
            </Alert>
          )}
          {manifestLoading && (
            <div className="grid gap-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {!manifestLoading && !manifest && !manifestError && (
            <div className="text-center py-10 text-muted-foreground border border-dashed rounded">
              <Boxes className="w-8 h-8 mx-auto mb-2 opacity-60" />
              Select products below and click Preview to see the packing manifest.
            </div>
          )}
          {manifest && (
            <>
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Packed <strong>{manifest.total_units_packed}</strong> / {manifest.total_units_input} units
                  into <strong>{manifest.box_count}</strong> box{manifest.box_count === 1 ? '' : 'es'}.
                </AlertDescription>
              </Alert>
              <div className="grid gap-3 md:grid-cols-2">
                {manifest.boxes.map((b, i) => (
                  <Card key={i} style={goldBorder}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Package className="w-4 h-4" style={goldText} />
                          {b.box_name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Badge variant="outline">{b.carrier}</Badge>
                          {b.is_flat_rate && <Badge style={{ backgroundColor: GOLD, color: '#000' }}>flat rate</Badge>}
                          {b.fragile_only && <Badge variant="destructive">fragile</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="text-muted-foreground">
                        {b.dimensions.length_in}″ × {b.dimensions.width_in}″ × {b.dimensions.height_in}″
                      </div>
                      <div className="flex justify-between">
                        <span>Actual wt</span><span>{b.actual_weight_oz} oz</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dim wt</span><span>{b.dim_weight_oz} oz</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Billable wt</span><span style={goldText}>{b.billable_weight_oz} oz</span>
                      </div>
                      {b.is_flat_rate && b.flat_rate_price != null && (
                        <div className="flex justify-between">
                          <span>Flat rate</span><span>${b.flat_rate_price.toFixed(2)}</span>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">
                          Fill {b.fill_percentage}%
                        </div>
                        <Progress value={b.fill_percentage} className="h-2" />
                      </div>
                      <div className="pt-2 border-t">
                        <div className="text-xs text-muted-foreground mb-1">Items</div>
                        {b.items.map((it) => (
                          <div key={it.product_id} className="text-xs flex justify-between">
                            <span className="truncate">{products.find((p) => p.id === it.product_id)?.product_name ?? it.product_id}</span>
                            <span>× {it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {manifest.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle>Warnings</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc ml-4">
                      {manifest.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card style={goldBorder}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Ruler className="w-5 h-5" style={goldText} />
              Products {filterMissingDims && <Badge style={{ backgroundColor: GOLD, color: '#000' }}>missing dims</Badge>}
            </CardTitle>
            {filterMissingDims && (
              <Button variant="ghost" size="sm" onClick={() => setFilterMissingDims(false)}>
                Clear filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {productsQ.isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-dashed rounded">
              {filterMissingDims
                ? 'All active products have complete dimensions. 🎉'
                : 'No active products found.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>L × W × H (in)</TableHead>
                  <TableHead>Weight (oz)</TableHead>
                  <TableHead>Ready</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((p) => {
                  const ready = hasCompleteDims(p);
                  return (
                    <TableRow key={p.id} className={selectedProductIds.includes(p.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          disabled={!ready}
                          aria-label={`Select ${p.product_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{p.product_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {ready
                          ? `${p.length_in} × ${p.width_in} × ${p.height_in}`
                          : <span className="italic">— missing —</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.weight_oz ?? <span className="italic">—</span>}
                      </TableCell>
                      <TableCell>
                        {ready
                          ? <Badge style={{ backgroundColor: GOLD, color: '#000' }}>ready</Badge>
                          : <Badge variant="outline">needs dims</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card style={goldBorder}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" style={goldText} />
            Recent Shipments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shipmentsQ.isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : shipments.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-dashed rounded">
              No shipments yet. Preview a manifest and create a label when ready.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{s.carrier ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{s.tracking_number ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                    <TableCell>{s.rate_selected != null ? `$${Number(s.rate_selected).toFixed(2)}` : '—'}</TableCell>
                    <TableCell className="text-right">
                      {s.label_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            printShippingLabel({
                              labelUrl: s.label_url,
                              recordId: s.id,
                              entityType: 'dd_shipments',
                              meta: {
                                carrier: s.carrier,
                                tracking: s.tracking_number,
                                order_id: s.order_id,
                              },
                            })
                          }
                        >
                          <Printer className="w-3 h-3 mr-1" /> Print Label
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon, label, value, loading,
}: { icon: React.ReactNode; label: string; value: number | null; loading: boolean }) {
  return (
    <Card style={{ borderColor: GOLD, borderWidth: 1 }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          <span style={{ color: GOLD }}>{icon}</span>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : (
          <div className="text-3xl font-bold" style={{ color: GOLD }}>{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
