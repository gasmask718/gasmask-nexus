import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Package, Plus, Search, Upload, RefreshCw, Ruler, DollarSign, AlertTriangle,
} from 'lucide-react';
import ProductDetailPanel from '@/components/dynasty-direct/ProductDetailPanel';
import { uploadOriginalToStorage } from '@/lib/dynastyDirect/productImages';
import { requestSpecSourcing, specStatusLabel, hasCompleteSpecs } from '@/lib/dynastyDirect/shippingSpecs';

const GOLD = '#C9A84C';

const CATEGORIES = [
  'disposable_vape', 'nicotine_pouch', 'tobacco_grabba', 'rolling_papers',
  'lighters', 'grinders', 'glass', 'vape_hardware', 'cbd_hemp', 'accessories',
] as const;

type ProductRow = {
  id: string;
  product_name: string;
  category: string | null;
  brand: string | null;
  supplier_id: string | null;
  supplier_cost: number | null;
  store_price_a: number | null;
  dtc_price_b: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
  weight_oz: number | null;
  status: string | null;
  description: string | null;
  inventory_qty: number | null;
  created_at: string;
  shipping_spec_status?: string | null;
};

type SupplierRow = { id: string; name: string };

function hasDims(p: ProductRow) {
  return !!(p.length_in && p.width_in && p.height_in && p.weight_oz);
}
function hasPricing(p: ProductRow) {
  return !!(p.supplier_cost && p.store_price_a && p.dtc_price_b);
}
function money(n: number | null | undefined) {
  return n == null ? '—' : `$${Number(n).toFixed(2)}`;
}

export default function ProductManagementPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'missing_dims' | 'missing_pricing'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [form, setForm] = useState({
    product_name: '',
    category: '',
    supplier_id: '',
    supplier_cost: '',
    inventory_qty: '',
    store_price_a: '',
    dtc_price_b: '',
    weight_oz: '',
    length_in: '',
    width_in: '',
    height_in: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const emptyForm = {
    product_name: '', category: '', supplier_id: '', supplier_cost: '', inventory_qty: '',
    store_price_a: '', dtc_price_b: '', weight_oz: '', length_in: '', width_in: '', height_in: '',
  };

  const productsQ = useQuery({
    queryKey: ['dd-products-mgmt'],
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from('products_all')
        .select('id, product_name, category, brand, supplier_id, supplier_cost, store_price_a, dtc_price_b, length_in, width_in, height_in, weight_oz, status, description, inventory_qty, created_at, shipping_spec_status')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const suppliersQ = useQuery({
    queryKey: ['dd-suppliers-select'],
    queryFn: async (): Promise<SupplierRow[]> => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data ?? []) as SupplierRow[];
    },
  });

  const products = productsQ.data ?? [];
  const suppliers = suppliersQ.data ?? [];

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter(p => p.status === 'active').length;
    const missingDims = products.filter(p => !hasDims(p)).length;
    const missingPricing = products.filter(p => !hasPricing(p)).length;
    return { total, active, missingDims, missingPricing };
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (statusFilter === 'missing_dims' && hasDims(p)) return false;
      if (statusFilter === 'missing_pricing' && hasPricing(p)) return false;
      if (q && !(
        p.product_name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [products, search, categoryFilter, statusFilter]);

  async function pollForDescription(id: string, requestedStatus: string) {
    const start = Date.now();
    const timeoutMs = 18000;
    const toastId = toast.loading('Generating description…');
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 1500));
      const { data } = await supabase
        .from('products_all')
        .select('description, status')
        .eq('id', id)
        .maybeSingle();
      if (data?.description && data.description.length > 0) {
        toast.success('Description generated', { id: toastId });
        if (data.status && data.status !== requestedStatus) {
          if (data.status === 'draft') {
            toast.message('Product saved as Draft — a matching submission from this supplier is pending confirmation');
          } else if (data.status === 'pending_admin_review') {
            toast.message('Product routed to Admin Review — matching draft awaits admin approval');
          } else {
            toast.message(`Product saved with status "${data.status}" (requested "${requestedStatus}")`);
          }
        }
        qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
        return;
      }
    }
    toast.message('Still generating — check back in a moment', { id: toastId });
    qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
  }

  /** Shared auto-sourcing call used by Add Product and Bulk Import. */
  async function runSourcing(ids: string[], triggeredBy: string) {
    if (!ids.length) return;
    const toastId = toast.loading(`Looking up shipping specs for ${ids.length} product(s)…`);
    try {
      const results = await requestSpecSourcing(ids, { triggeredBy });
      const applied = results.filter(r => r.applied).length;
      const review = results.filter(r => r.status === 'needs_review').length;
      const none = results.filter(r => r.status === 'not_found').length;
      toast.success(
        `Shipping specs: ${applied} found automatically` +
        (review ? `, ${review} need review` : '') +
        (none ? `, ${none} not found` : ''),
        { id: toastId },
      );
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
    } catch (e: any) {
      toast.error(`Shipping spec lookup failed: ${e.message ?? e}`, { id: toastId });
    }
  }

  async function handleAdd() {
    const num = (v: string) => (v.trim() === '' ? null : Number(v));
    if (!form.product_name.trim()) return toast.error('Product name required');
    if (!form.category) return toast.error('Category required');

    const weight = num(form.weight_oz);
    const L = num(form.length_in), W = num(form.width_in), H = num(form.height_in);
    const specsComplete = Number(weight) > 0 && Number(L) > 0 && Number(W) > 0 && Number(H) > 0;
    const cost = num(form.supplier_cost);
    const storeP = num(form.store_price_a);
    const dtcP = num(form.dtc_price_b);
    if (Number(cost) > 0 && !(Number(storeP) > 0 || Number(dtcP) > 0)) {
      return toast.error('With a supplier cost set, enter a store price or a customer price');
    }

    setSubmitting(true);
    try {
      // Missing size/weight no longer blocks the save: the product is created
      // as a Draft and the app goes and sources the shipping specs itself.
      const requestedStatus = specsComplete ? 'active' : 'draft';
      const insert = {
        product_name: form.product_name.trim(),
        category: form.category,
        supplier_id: form.supplier_id || null,
        supplier_cost: cost,
        inventory_qty: form.inventory_qty !== '' ? Number(form.inventory_qty) : null,
        store_price_a: storeP,
        dtc_price_b: dtcP,
        weight_oz: weight,
        length_in: L,
        width_in: W,
        height_in: H,
        status: requestedStatus,
        shipping_spec_status: specsComplete ? 'manual' : 'sourcing',
        shipping_spec_locked: specsComplete,
      };
      const { data, error } = await supabase
        .from('products_all')
        .insert(insert)
        .select('id, status')
        .single();
      if (error) throw error;

      // PHOTO: stored in the public product-images bucket and attached to the row.
      if (photoFile && data?.id) {
        try {
          const url = await uploadOriginalToStorage(photoFile, data.id);
          const { error: imgErr } = await supabase
            .from('products_all')
            .update({ image_urls: [url], primary_image_url: url })
            .eq('id', data.id);
          if (imgErr) throw imgErr;
        } catch (imgE: any) {
          toast.error(`Product saved, but the photo did not: ${imgE.message ?? imgE}`);
        }
      }

      toast.success(
        specsComplete
          ? 'Product created — pricing running via trigger'
          : 'Product saved as Draft — looking up shipping weight and size online…',
      );

      // AUTO-SOURCING: physical product with missing shipping specs.
      if (!specsComplete && data?.id) void runSourcing([data.id], 'add_product');

      setAddOpen(false);
      setForm(emptyForm);
      setPhotoFile(null);
      if (photoRef.current) photoRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });

      // Gate immediate feedback (in case dd_enforce_catalog_confirm_gate downgraded status)
      if (data?.status && data.status !== requestedStatus) {
        if (data.status === 'draft') {
          toast.message('Product saved as Draft — a matching submission from this supplier is pending confirmation');
        } else if (data.status === 'pending_admin_review') {
          toast.message('Product routed to Admin Review');
        }
      }

      // Poll for the trigger-generated description
      if (data?.id) pollForDescription(data.id, requestedStatus);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCsvImport(file: File) {
    setImporting(true);
    const toastId = toast.loading(`Importing ${file.name}…`);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error('CSV appears empty');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const need = ['product_name', 'category'];
      for (const n of need) if (!headers.includes(n)) throw new Error(`Missing column: ${n}`);

      const NUMERIC = [
        'supplier_cost', 'store_price_a', 'dtc_price_b',
        'weight_oz', 'length_in', 'width_in', 'height_in', 'inventory_qty',
      ];
      const rows = lines.slice(1).map(line => {
        const cells = line.split(',').map(c => c.trim());
        const rec: any = { status: 'active' };
        headers.forEach((h, i) => {
          const v = cells[i];
          if (v === undefined || v === '') return;
          if (NUMERIC.includes(h)) rec[h] = Number(v);
          // A photo can be supplied as a public image URL per row.
          else if (h === 'image_url') { rec.image_urls = [v]; rec.primary_image_url = v; }
          else rec[h] = v;
        });
        return rec;
      }).filter(r => r.product_name && r.category);

      if (!rows.length) throw new Error('No valid rows');

      // Rows without size/weight are imported as Drafts and queued for
      // automatic spec sourcing — one unresolved product never fails the batch.
      let queued = 0;
      for (const r of rows) {
        const complete = Number(r.weight_oz) > 0 && Number(r.length_in) > 0 &&
          Number(r.width_in) > 0 && Number(r.height_in) > 0;
        if (complete) {
          r.shipping_spec_status = 'manual';
          r.shipping_spec_locked = true;
        } else {
          r.status = 'draft';
          r.shipping_spec_status = 'sourcing';
          queued++;
        }
      }

      // Batch insert in chunks of 100
      let inserted = 0;
      const queuedIds: string[] = [];
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { data: ins, error } = await supabase.from('products_all').insert(chunk).select('id, weight_oz, length_in, width_in, height_in');
        if (error) throw error;
        inserted += chunk.length;
        for (const row of ins ?? []) if (!hasCompleteSpecs(row as any)) queuedIds.push((row as any).id);
      }
      toast.success(
        `Imported ${inserted} products` +
        (queued ? ` — ${queued} saved as Draft while shipping specs are sourced` : ''),
        { id: toastId },
      );
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
      if (queuedIds.length) void runSourcing(queuedIds, 'bulk_import');
    } catch (e: any) {
      toast.error(e.message ?? 'Import failed', { id: toastId });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function downloadCsvTemplate() {
    const csv =
      'product_name,category,brand,supplier_cost,store_price_a,dtc_price_b,inventory_qty,weight_oz,length_in,width_in,height_in,image_url\n' +
      'Example Item,accessories,Acme,1.25,2.50,3.99,24,2.5,6,4,2,https://example.com/photo.jpg\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products-template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const loading = productsQ.isLoading;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-background">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: GOLD }}>
            <Package className="h-7 w-7" /> Products
          </h1>
          <p className="text-muted-foreground text-sm">Dynasty Direct catalog · pricing &amp; descriptions auto-run on insert</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => productsQ.refetch()}>
            <RefreshCw className={`h-4 w-4 mr-1 ${productsQ.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsvTemplate}>
            <Upload className="h-4 w-4 mr-1" /> CSV Template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvImport(f); }}
          />
          <Button variant="outline" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> {importing ? 'Importing…' : 'Bulk Import'}
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ background: GOLD, color: '#000' }}>
                <Plus className="h-4 w-4 mr-1" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Product</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Product Name *</Label>
                  <Input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} />
                </div>
                <div>
                  <Label>Category *</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select supplier (optional)" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Supplier Cost ($)</Label>
                  <Input type="number" step="0.01" value={form.supplier_cost}
                    onChange={e => setForm({ ...form, supplier_cost: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Setting a cost triggers automatic price computation via <code>dd-auto-price</code>.</p>
                </div>
                <div>
                  <Label>Inventory Qty</Label>
                  <Input type="number" min="0" step="1" placeholder="0" value={form.inventory_qty}
                    onChange={e => setForm({ ...form, inventory_qty: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Units on hand. Leave blank if unknown — storefront will show "Sold Out" until set.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Store Price ($)</Label>
                    <Input type="number" step="0.01" value={form.store_price_a}
                      onChange={e => setForm({ ...form, store_price_a: e.target.value })} />
                  </div>
                  <div>
                    <Label>Customer Price ($)</Label>
                    <Input type="number" step="0.01" value={form.dtc_price_b}
                      onChange={e => setForm({ ...form, dtc_price_b: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Product Photo</Label>
                  <Input ref={photoRef} type="file" accept="image/*"
                    onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Saved permanently with the product. {photoFile ? `Selected: ${photoFile.name}` : ''}
                  </p>
                </div>
                <div>
                  <Label>Shipping Weight &amp; Size *</Label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    <Input type="number" step="0.01" min="0" placeholder="Weight oz" value={form.weight_oz}
                      onChange={e => setForm({ ...form, weight_oz: e.target.value })} />
                    <Input type="number" step="0.01" min="0" placeholder="Length in" value={form.length_in}
                      onChange={e => setForm({ ...form, length_in: e.target.value })} />
                    <Input type="number" step="0.01" min="0" placeholder="Width in" value={form.width_in}
                      onChange={e => setForm({ ...form, width_in: e.target.value })} />
                    <Input type="number" step="0.01" min="0" placeholder="Height in" value={form.height_in}
                      onChange={e => setForm({ ...form, height_in: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ounces and inches. Shipping is charged on these numbers, so a live product cannot be saved without them.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button disabled={submitting} style={{ background: GOLD, color: '#000' }} onClick={handleAdd}>
                  {submitting ? 'Saving…' : 'Create Product'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Products" value={stats.total} icon={Package} loading={loading} />
        <StatCard label="Active" value={stats.active} icon={Package} loading={loading} accent />
        <StatCard label="Missing Dimensions" value={stats.missingDims} icon={Ruler} loading={loading}
          warn={stats.missingDims > 0} onClick={() => setStatusFilter('missing_dims')} />
        <StatCard label="Missing Pricing" value={stats.missingPricing} icon={DollarSign} loading={loading}
          warn={stats.missingPricing > 0} onClick={() => setStatusFilter('missing_pricing')} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products, brand, category…" className="pl-9"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="missing_dims">Missing Dimensions</SelectItem>
              <SelectItem value="missing_pricing">Missing Pricing</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">{filtered.length} of {products.length}</div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle style={{ color: GOLD }}>Catalog</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No products match your filters.</p>
              {products.length === 0 && (
                <Button className="mt-4" style={{ background: GOLD, color: '#000' }} onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add your first product
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Store</TableHead>
                  <TableHead className="text-right">DTC</TableHead>
                  <TableHead>Dims</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetailId(p.id)}>
                    <TableCell className="font-medium">
                      {p.product_name}
                      {p.brand && <div className="text-xs text-muted-foreground">{p.brand}</div>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.category ?? '—'}</Badge></TableCell>
                    <TableCell className="text-right">{money(p.supplier_cost)}</TableCell>
                    <TableCell className="text-right">{money(p.store_price_a)}</TableCell>
                    <TableCell className="text-right">{money(p.dtc_price_b)}</TableCell>
                    <TableCell>
                      {(() => {
                        const s = specStatusLabel(p.shipping_spec_status as any, hasDims(p));
                        const cls = s.tone === 'good'
                          ? 'text-green-600 border-green-600'
                          : s.tone === 'warn'
                            ? 'text-amber-600 border-amber-600'
                            : s.tone === 'bad'
                              ? 'text-destructive border-destructive'
                              : 'text-muted-foreground';
                        return (
                          <Badge variant="outline" className={cls}>
                            {s.tone === 'bad' && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {s.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status ?? '—'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > 200 && (
            <div className="p-3 text-center text-xs text-muted-foreground border-t">
              Showing first 200 of {filtered.length}. Refine filters to narrow.
            </div>
          )}
        </CardContent>
      </Card>

      <ProductDetailPanel
        productId={detailId}
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
      />
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, loading, warn, accent, onClick,
}: {
  label: string; value: number; icon: any; loading?: boolean; warn?: boolean; accent?: boolean; onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? 'cursor-pointer hover:border-primary transition' : ''}
      onClick={onClick}
      style={accent ? { borderColor: GOLD } : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <Icon className="h-4 w-4" style={{ color: warn ? '#dc2626' : accent ? GOLD : undefined }} />
        </div>
        {loading
          ? <Skeleton className="h-8 w-16 mt-2" />
          : <div className="text-3xl font-bold mt-1" style={{ color: warn ? '#dc2626' : accent ? GOLD : undefined }}>{value}</div>}
      </CardContent>
    </Card>
  );
}
