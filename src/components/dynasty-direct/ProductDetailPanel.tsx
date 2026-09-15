import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Package, DollarSign, Image as ImageIcon, Sparkles, Upload, Save, X, Star, AlertTriangle, Trash2, Ruler, Search,
} from 'lucide-react';
import { uploadOriginalToStorage, missingShippingData } from '@/lib/dynastyDirect/productImages';
import { requestSpecSourcing, specStatusLabel } from '@/lib/dynastyDirect/shippingSpecs';
import {
  identifyProductPhoto, confirmPhotoIdentification, photoIdLabel,
  type PhotoIdResponse,
} from '@/lib/dynastyDirect/photoIdentify';

const GOLD = '#C9A84C';

const CATEGORIES = [
  'disposable_vape', 'nicotine_pouch', 'tobacco_grabba', 'rolling_papers',
  'lighters', 'grinders', 'glass', 'vape_hardware', 'cbd_hemp', 'accessories',
] as const;

type ProductDetail = {
  id: string;
  product_name: string;
  category: string | null;
  brand: string | null;
  supplier_id: string | null;
  status: string | null;
  inventory_qty: number | null;
  supplier_cost: number | null;
  store_price_a: number | null;
  dtc_price_b: number | null;
  map_price: number | null;
  store_margin_pct: number | null;
  dtc_margin_pct: number | null;
  min_store_margin_pct: number | null;
  target_store_margin_pct: number | null;
  min_dtc_margin_pct: number | null;
  target_dtc_margin_pct: number | null;
  description: string | null;
  ai_description: string | null;
  ai_description_short: string | null;
  description_generated_at: string | null;
  primary_image_url: string | null;
  image_urls: string[] | null;
  image_enhanced_at: string | null;
  weight_oz: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
  shipping_spec_status: string | null;
  shipping_spec_candidates: any[] | null;
  shipping_spec_locked: boolean | null;
  shipping_spec_checked_at: string | null;
  spec_source: string | null;
  spec_source_ref: any | null;
  shipping_data_source: string | null;
  specs_verified_at: string | null;
  upc: string | null;
  gtin: string | null;
  supplier_sku: string | null;
  photo_id_status: string | null;
  photo_identification: any | null;
};

type Props = {
  productId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

function money(n: number | null | undefined) {
  return n == null ? '—' : `$${Number(n).toFixed(2)}`;
}

export default function ProductDetailPanel({ productId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [editingCore, setEditingCore] = useState(false);
  const [editingPricing, setEditingPricing] = useState(false);
  const [core, setCore] = useState<Partial<ProductDetail>>({});
  const [pricing, setPricing] = useState<Partial<ProductDetail>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingShipping, setEditingShipping] = useState(false);
  const [shipping, setShipping] = useState<Partial<ProductDetail>>({});
  const [sourcing, setSourcing] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [photoId, setPhotoId] = useState<PhotoIdResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const detailQ = useQuery({
    enabled: !!productId && open,
    queryKey: ['dd-product-detail', productId],
    queryFn: async (): Promise<ProductDetail | null> => {
      if (!productId) return null;
      const { data, error } = await supabase
        .from('products_all')
        .select('id, product_name, category, brand, supplier_id, status, inventory_qty, supplier_cost, store_price_a, dtc_price_b, map_price, store_margin_pct, dtc_margin_pct, min_store_margin_pct, target_store_margin_pct, min_dtc_margin_pct, target_dtc_margin_pct, description, ai_description, ai_description_short, description_generated_at, primary_image_url, image_urls, image_enhanced_at, weight_oz, length_in, width_in, height_in, shipping_spec_status, shipping_spec_candidates, shipping_spec_locked, shipping_spec_checked_at, spec_source, spec_source_ref, shipping_data_source, specs_verified_at, upc, gtin, supplier_sku, photo_id_status, photo_identification')
        .eq('id', productId)
        .maybeSingle();
      if (error) throw error;
      return data as ProductDetail;
    },
  });

  const suppliersQ = useQuery({
    enabled: open,
    queryKey: ['dd-suppliers-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const p = detailQ.data;

  useEffect(() => {
    if (p && !editingCore) setCore({
      product_name: p.product_name, category: p.category, brand: p.brand,
      supplier_id: p.supplier_id, status: p.status, inventory_qty: p.inventory_qty,
    });
  }, [p, editingCore]);

  useEffect(() => {
    if (p && !editingPricing) setPricing({
      supplier_cost: p.supplier_cost, store_price_a: p.store_price_a,
      dtc_price_b: p.dtc_price_b, map_price: p.map_price,
    });
  }, [p, editingPricing]);

  useEffect(() => {
    if (p && !editingShipping) setShipping({
      weight_oz: p.weight_oz, length_in: p.length_in,
      width_in: p.width_in, height_in: p.height_in,
    });
  }, [p, editingShipping]);

  async function saveCore() {
    if (!productId) return;
    setSaving(true);
    try {
      const payload: any = { ...core };
      if (payload.inventory_qty === '' || payload.inventory_qty == null) payload.inventory_qty = null;
      else payload.inventory_qty = Number(payload.inventory_qty);
      const { error } = await supabase.from('products_all').update(payload).eq('id', productId);
      if (error) throw error;
      toast.success('Product updated');
      setEditingCore(false);
      qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
    } catch (e: any) { toast.error(e.message ?? 'Save failed'); }
    finally { setSaving(false); }
  }

  async function softDelete() {
    if (!productId) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('products_all')
        .update({ status: 'deleted' })
        .eq('id', productId);
      if (error) throw error;
      toast.success('Product deleted — hidden from storefront');
      setDeleteOpen(false);
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
      qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
    } catch (e: any) {
      toast.error(e.message ?? 'Delete failed');
    } finally { setDeleting(false); }
  }

  async function savePricing() {
    if (!productId) return;
    const payload = Object.fromEntries(
      Object.entries(pricing).map(([k, v]) => [k, v === '' || v == null ? null : Number(v)])
    ) as Record<string, number | null>;

    // Client-side floor check — mirrors dd_enforce_price_floor DB trigger.
    const cost = (payload.supplier_cost ?? p?.supplier_cost) as number | null;
    const minStore = p?.min_store_margin_pct ?? null;
    const minDtc = p?.min_dtc_margin_pct ?? null;
    const newStore = payload.store_price_a;
    const newDtc = payload.dtc_price_b;
    const breaches: string[] = [];
    if (cost && cost > 0) {
      if (newStore && minStore != null && newStore > 0) {
        const m = ((newStore - cost) / newStore) * 100;
        if (m < minStore) breaches.push(`Store margin ${m.toFixed(1)}% < floor ${minStore}% (price $${newStore}, cost $${cost})`);
      }
      if (newDtc && minDtc != null && newDtc > 0) {
        const m = ((newDtc - cost) / newDtc) * 100;
        if (m < minDtc) breaches.push(`DTC margin ${m.toFixed(1)}% < floor ${minDtc}% (price $${newDtc}, cost $${cost})`);
      }
    }
    if (breaches.length > 0) {
      const proceed = window.confirm(
        `Price floor breach:\n\n${breaches.join('\n')}\n\nOverride and save anyway?`
      );
      if (!proceed) {
        toast.error('Save blocked — price below margin floor');
        return;
      }
    }

    setSaving(true);
    try {
      if (breaches.length > 0) {
        const { error } = await supabase.rpc('dd_update_product_pricing', {
          p_product_id: productId,
          p_supplier_cost: payload.supplier_cost ?? null,
          p_store_price_a: payload.store_price_a ?? null,
          p_dtc_price_b: payload.dtc_price_b ?? null,
          p_map_price: payload.map_price ?? null,
          p_allow_override: true,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products_all').update(payload).eq('id', productId);
        if (error) throw error;
      }
      toast.success(
        breaches.length > 0
          ? 'Pricing saved with override — margin floor bypassed'
          : 'Pricing updated — auto-price trigger will re-fire if cost changed'
      );
      setEditingPricing(false);
      qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
    } catch (e: any) { toast.error(e.message ?? 'Save failed'); }
    finally { setSaving(false); }
  }

  /**
   * PHOTO SAVE. dd-process-image always answers HTTP 200 — an enhancement failure
   * arrives as { success: false, error }. Reporting that as success is how a photo
   * "disappeared". Any failure (or demo mode) now falls back to storing the ORIGINAL
   * file in the product-images bucket and attaching it, so the photo is never lost.
   */
  async function handleImageUpload(file: File) {
    if (!productId) return;
    if (!file.type.startsWith('image/')) return toast.error('That file is not an image');
    if (file.size > 10 * 1024 * 1024) return toast.error('Image must be under 10MB');

    setUploading(true);
    const toastId = toast.loading('Saving photo…');
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('dd-process-image', {
        body: { product_id: productId, image_base64: b64, filename: file.name, persist: true },
      });
      if (error) throw error;

      if (data?.success === true) {
        toast.success('Photo saved and enhanced', { id: toastId });
      } else {
        const reason = data?.error || data?.reason || 'image enhancement unavailable';
        const url = await uploadOriginalToStorage(file, productId);
        const current = Array.isArray(p?.image_urls) ? p!.image_urls! : [];
        const next = current.includes(url) ? current : [...current, url];
        const patch: Record<string, unknown> = { image_urls: next };
        if (!p?.primary_image_url) patch.primary_image_url = url;
        const { error: upErr } = await supabase.from('products_all').update(patch).eq('id', productId);
        if (upErr) throw new Error(`${reason} — and saving the original failed: ${upErr.message}`);
        toast.warning(`Photo saved unedited (${reason})`, { id: toastId });
      }
      qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Photo could not be saved', { id: toastId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveShipping() {
    if (!productId) return;
    const toNum = (v: any) => (v === '' || v == null ? null : Number(v));
    const payload = {
      weight_oz: toNum(shipping.weight_oz),
      length_in: toNum(shipping.length_in),
      width_in: toNum(shipping.width_in),
      height_in: toNum(shipping.height_in),
      // A manual entry is an operator decision: it is locked so automatic
      // sourcing never overwrites it unless an admin asks for a new lookup.
      shipping_spec_status: 'manual',
      shipping_spec_locked: true,
      shipping_verified: true,
      spec_source: 'manual_admin',
      specs_verified_at: new Date().toISOString(),
    };
    setSaving(true);
    try {
      const { error } = await supabase.from('products_all').update(payload).eq('id', productId);
      if (error) throw error;
      toast.success('Shipping weight and size saved');
      setEditingShipping(false);
      qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
    } catch (e: any) { toast.error(e.message ?? 'Save failed'); }
    finally { setSaving(false); }
  }

  /** Manual re-run of the automatic online lookup. */
  async function findSpecs(force: boolean) {
    if (!productId) return;
    setSourcing(true);
    const toastId = toast.loading('Searching trusted sources for shipping specs…');
    try {
      const [res] = await requestSpecSourcing([productId], { force, triggeredBy: 'product_detail' });
      qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
      if (!res) { toast.message('No lookup ran', { id: toastId }); return; }
      if (res.applied) toast.success('Shipping specs found and saved', { id: toastId });
      else if (res.status === 'needs_review') toast.warning('Found possible matches — review them below', { id: toastId });
      else if (res.status === 'not_found') toast.error('No trustworthy match found online — enter the specs manually', { id: toastId });
      else toast.message(res.skipped ? `Skipped: ${res.skipped}` : (res.status ?? 'Done'), { id: toastId });
    } catch (e: any) {
      toast.error(e.message ?? 'Lookup failed', { id: toastId });
    } finally { setSourcing(false); }
  }

  /** Admin accepts one reviewed candidate. */
  async function applyCandidate(c: any) {
    if (!productId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('products_all').update({
        weight_oz: c.weight_oz, length_in: c.length_in,
        width_in: c.width_in, height_in: c.height_in,
        shipping_spec_status: 'manual',
        shipping_spec_locked: true,
        shipping_verified: true,
        spec_source: 'admin_reviewed_web',
        spec_source_ref: {
          source_url: c.source_url, source_name: c.source_name,
          matched_on: c.matched_on, packaged_dimensions: c.packaged,
          retrieved_at: c.retrieved_at, confidence: 'admin_reviewed',
        },
        shipping_data_source: c.source_name,
        specs_verified_at: new Date().toISOString(),
      }).eq('id', productId);
      if (error) throw error;
      toast.success('Shipping specs confirmed from the selected source');
      qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
      qc.invalidateQueries({ queryKey: ['dd-products-mgmt'] });
    } catch (e: any) { toast.error(e.message ?? 'Could not apply'); }
    finally { setSaving(false); }
  }

  async function setPrimary(url: string) {
    if (!productId) return;
    const { error } = await supabase.from('products_all')
      .update({ primary_image_url: url }).eq('id', productId);
    if (error) return toast.error(error.message);
    toast.success('Primary image updated');
    qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
  }

  async function pollDescription(baselineGeneratedAt: string | null) {
    if (!productId) return false;
    const start = Date.now();
    const timeoutMs = 18000;
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 1500));
      const { data } = await supabase.from('products_all')
        .select('ai_description, description_generated_at').eq('id', productId).maybeSingle();
      if (data?.description_generated_at && data.description_generated_at !== baselineGeneratedAt && data.ai_description) {
        return true;
      }
    }
    return false;
  }

  async function regenerateDescription() {
    if (!productId || !p) return;
    setRegenerating(true);
    const toastId = toast.loading('Regenerating description…');
    try {
      const { error } = await supabase.functions.invoke('dd-generate-description', {
        body: { product_id: productId, persist: true },
      });
      if (error) throw error;
      const updated = await pollDescription(p.description_generated_at);
      if (updated) toast.success('Description regenerated', { id: toastId });
      else toast.message('Still generating — check back in a moment', { id: toastId });
      qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
    } catch (e: any) {
      toast.error(e.message ?? 'Regenerate failed', { id: toastId });
    } finally { setRegenerating(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle style={{ color: GOLD }} className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Product Details
            </SheetTitle>
            {p && p.status !== 'deleted' && (
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                    <AlertDialogDescription>
                      <strong>{p.product_name}</strong> will be soft-deleted (status set to <code>deleted</code>) and immediately hidden from the storefront. Order history is preserved and this can be reversed by an admin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => { e.preventDefault(); softDelete(); }}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? 'Deleting…' : 'Delete Product'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </SheetHeader>

        {detailQ.isLoading || !p ? (
          <div className="space-y-3 mt-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {/* CORE */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Core Info</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setEditingCore(v => !v)}>
                  {editingCore ? <X className="h-4 w-4" /> : 'Edit'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingCore ? (
                  <>
                    <div><Label>Name</Label><Input value={core.product_name ?? ''} onChange={e => setCore({ ...core, product_name: e.target.value })} /></div>
                    <div><Label>Brand</Label><Input value={core.brand ?? ''} onChange={e => setCore({ ...core, brand: e.target.value })} /></div>
                    <div>
                      <Label>Category</Label>
                      <Select value={core.category ?? ''} onValueChange={v => setCore({ ...core, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Supplier</Label>
                      <Select value={core.supplier_id ?? ''} onValueChange={v => setCore({ ...core, supplier_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{(suppliersQ.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={core.status ?? ''} onValueChange={v => setCore({ ...core, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['active','draft','pending_admin_review','inactive'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Inventory Qty</Label>
                      <Input type="number" min="0" step="1" value={(core.inventory_qty as any) ?? ''}
                        onChange={e => setCore({ ...core, inventory_qty: e.target.value === '' ? null : Number(e.target.value) })} />
                      <p className="text-xs text-muted-foreground mt-1">Units on hand. Storefront shows "Sold Out" when 0 or null.</p>
                    </div>
                    <Button style={{ background: GOLD, color: '#000' }} disabled={saving} onClick={saveCore}>
                      <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><div className="text-muted-foreground text-xs">Name</div><div className="font-medium">{p.product_name}</div></div>
                    <div><div className="text-muted-foreground text-xs">Brand</div><div>{p.brand ?? '—'}</div></div>
                    <div><div className="text-muted-foreground text-xs">Category</div><Badge variant="outline">{p.category ?? '—'}</Badge></div>
                    <div><div className="text-muted-foreground text-xs">Status</div><Badge>{p.status}</Badge></div>
                    <div><div className="text-muted-foreground text-xs">Inventory Qty</div>
                      <div className={p.inventory_qty == null || p.inventory_qty <= 0 ? 'text-destructive font-medium' : 'font-medium'}>
                        {p.inventory_qty == null ? '—' : p.inventory_qty}
                        {(p.inventory_qty == null || p.inventory_qty <= 0) && <span className="text-xs ml-2">(Sold Out)</span>}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PRICING */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" style={{ color: GOLD }} /> Pricing
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setEditingPricing(v => !v)}>
                  {editingPricing ? <X className="h-4 w-4" /> : 'Edit'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingPricing ? (
                  <>
                    {(['supplier_cost','store_price_a','dtc_price_b','map_price'] as const).map(k => (
                      <div key={k}>
                        <Label>{k}</Label>
                        <Input type="number" step="0.01" value={(pricing as any)[k] ?? ''}
                          onChange={e => setPricing({ ...pricing, [k]: e.target.value as any })} />
                      </div>
                    ))}
                    <Button style={{ background: GOLD, color: '#000' }} disabled={saving} onClick={savePricing}>
                      <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <PriceBox label="Cost" v={money(p.supplier_cost)} />
                      <PriceBox label="Store" v={money(p.store_price_a)} />
                      <PriceBox label="DTC" v={money(p.dtc_price_b)} />
                      <PriceBox label="MAP" v={money(p.map_price)} />
                    </div>
                    <MarginBar label="Store Margin" pct={p.store_margin_pct} min={p.min_store_margin_pct} target={p.target_store_margin_pct} />
                    <MarginBar label="DTC Margin" pct={p.dtc_margin_pct} min={p.min_dtc_margin_pct} target={p.target_dtc_margin_pct} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* IMAGES */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" style={{ color: GOLD }} /> Images
                </CardTitle>
                <div>
                  <input ref={fileRef} type="file" hidden accept="image/*"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                  <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> {uploading ? 'Uploading…' : 'Upload Image'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(!p.image_urls || p.image_urls.length === 0) ? (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No photo yet. Upload one — it is stored permanently even if enhancement is unavailable.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {p.image_urls.map((url) => {
                      const isPrimary = url === p.primary_image_url;
                      return (
                        <div key={url} className="relative group cursor-pointer" onClick={() => setPrimary(url)}>
                          <img src={url} alt="" className="w-full h-24 object-cover rounded border"
                            style={isPrimary ? { borderColor: GOLD, borderWidth: 2 } : undefined} />
                          {isPrimary && (
                            <Badge className="absolute top-1 left-1 text-xs" style={{ background: GOLD, color: '#000' }}>
                              <Star className="h-3 w-3 mr-1" /> Primary
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SHIPPING SIZE + WEIGHT — what the shipping calculator actually rates on */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ruler className="h-4 w-4" style={{ color: GOLD }} /> Shipping Size &amp; Weight
                </CardTitle>
                {editingShipping ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingShipping(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" disabled={saving} onClick={saveShipping} style={{ background: GOLD, color: '#000' }}>
                      <Save className="h-4 w-4 mr-1" /> Save
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditingShipping(true)}>Edit</Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const st = specStatusLabel(p.shipping_spec_status as any, !missingShippingData(p));
                  const cls = st.tone === 'good'
                    ? 'text-green-600 border-green-600'
                    : st.tone === 'warn'
                      ? 'text-amber-600 border-amber-600'
                      : st.tone === 'bad'
                        ? 'text-destructive border-destructive'
                        : 'text-muted-foreground';
                  return (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cls}>{st.label}</Badge>
                      <Button size="sm" variant="outline" disabled={sourcing}
                        onClick={() => findSpecs(true)}>
                        <Search className="h-4 w-4 mr-1" />
                        {sourcing ? 'Searching…' : 'Find Shipping Specs'}
                      </Button>
                    </div>
                  );
                })()}

                {missingShippingData(p) && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/15 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <span>
                      Missing shipping data. Shipping is quoted on an estimated fallback parcel — not a
                      confirmed quote — until weight and all three sides are filled in, and this product
                      cannot be set live.
                    </span>
                  </div>
                )}

                {/* Candidates awaiting review — never auto-applied. */}
                {Array.isArray(p.shipping_spec_candidates) && p.shipping_spec_candidates.length > 0 &&
                  p.shipping_spec_status === 'needs_review' && (
                  <div className="rounded-md border border-amber-600/40 bg-amber-500/10 p-3 space-y-2 text-sm">
                    <div className="font-medium">Found online — needs your confirmation</div>
                    {(p.shipping_spec_candidates as any[]).map((c, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 border-t border-amber-600/20 pt-2 first:border-0 first:pt-0">
                        <div>
                          <div>
                            {c.weight_oz ?? '—'} oz · {c.length_in ?? '—'} × {c.width_in ?? '—'} × {c.height_in ?? '—'} in
                            {' '}<span className="text-xs text-muted-foreground">
                              ({c.packaged ? 'package dimensions' : 'item dimensions'})
                            </span>
                          </div>
                          <a href={c.source_url} target="_blank" rel="noreferrer"
                            className="text-xs underline text-muted-foreground break-all">
                            {c.source_name} · matched on {(c.matched_on ?? []).join(', ') || 'title'}
                          </a>
                        </div>
                        <Button size="sm" variant="outline" disabled={saving}
                          onClick={() => applyCandidate(c)}>Use these</Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Weight (oz)</Label>
                    <Input type="number" step="0.01" min="0" disabled={!editingShipping}
                      value={shipping.weight_oz ?? ''}
                      onChange={e => setShipping({ ...shipping, weight_oz: e.target.value as any })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Length (in)</Label>
                    <Input type="number" step="0.01" min="0" disabled={!editingShipping}
                      value={shipping.length_in ?? ''}
                      onChange={e => setShipping({ ...shipping, length_in: e.target.value as any })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Width (in)</Label>
                    <Input type="number" step="0.01" min="0" disabled={!editingShipping}
                      value={shipping.width_in ?? ''}
                      onChange={e => setShipping({ ...shipping, width_in: e.target.value as any })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Height (in)</Label>
                    <Input type="number" step="0.01" min="0" disabled={!editingShipping}
                      value={shipping.height_in ?? ''}
                      onChange={e => setShipping({ ...shipping, height_in: e.target.value as any })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Units are fixed: ounces and inches — the same units the carrier rate and the packing
                  algorithm use. Enter the packed item, not the bare product.
                </p>

                {/* Where did these numbers come from? */}
                {(p.spec_source || p.shipping_data_source || p.shipping_spec_checked_at) && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Source details</summary>
                    <div className="mt-2 space-y-1">
                      <div>Source: {p.spec_source ?? '—'}{p.shipping_data_source ? ` (${p.shipping_data_source})` : ''}</div>
                      {p.spec_source_ref?.source_url && (
                        <div>
                          Page: <a className="underline break-all" href={p.spec_source_ref.source_url}
                            target="_blank" rel="noreferrer">{p.spec_source_ref.source_url}</a>
                        </div>
                      )}
                      {p.spec_source_ref?.matched_on && (
                        <div>Matched on: {(p.spec_source_ref.matched_on as string[]).join(', ')}</div>
                      )}
                      {p.spec_source_ref?.packaged_dimensions != null && (
                        <div>{p.spec_source_ref.packaged_dimensions ? 'Package/shipping dimensions' : 'Item dimensions (reviewed)'}</div>
                      )}
                      <div>Last looked up: {p.shipping_spec_checked_at ? new Date(p.shipping_spec_checked_at).toLocaleString() : '—'}</div>
                      <div>Confirmed at: {p.specs_verified_at ? new Date(p.specs_verified_at).toLocaleString() : '—'}</div>
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>


            {/* AI DESCRIPTION */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: GOLD }} /> AI Description
                </CardTitle>
                <Button size="sm" variant="outline" disabled={regenerating} onClick={regenerateDescription}>
                  <Sparkles className="h-4 w-4 mr-1" /> {regenerating ? 'Regenerating…' : 'Regenerate'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Short</Label>
                  <Textarea readOnly value={p.ai_description_short ?? ''} className="min-h-[60px]"
                    placeholder="Not generated yet" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Full</Label>
                  <Textarea readOnly value={p.ai_description ?? p.description ?? ''} className="min-h-[120px]"
                    placeholder="Not generated yet" />
                </div>
                {p.description_generated_at && (
                  <div className="text-xs text-muted-foreground">
                    Generated {new Date(p.description_generated_at).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PriceBox({ label, v }: { label: string; v: string }) {
  return (
    <div className="border rounded p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}

function MarginBar({ label, pct, min, target }: {
  label: string; pct: number | null; min: number | null; target: number | null;
}) {
  const value = pct ?? 0;
  const minV = min ?? 0;
  const targetV = target ?? 0;
  const max = Math.max(targetV * 1.5, value, 80);
  const belowFloor = value < minV;
  const belowTarget = value < targetV;
  const barColor = belowFloor ? '#dc2626' : belowTarget ? '#f59e0b' : GOLD;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          {belowFloor && <AlertTriangle className="h-3 w-3 text-red-600" />}
          <span style={{ color: barColor }}>{pct == null ? '—' : `${Number(pct).toFixed(1)}%`}</span>
          <span className="text-muted-foreground"> (min {minV}% / target {targetV}%)</span>
        </span>
      </div>
      <div className="relative h-2 bg-muted rounded overflow-hidden">
        <div className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: barColor }} />
        <div className="absolute top-0 bottom-0 w-px bg-foreground/40" style={{ left: `${(minV / max) * 100}%` }} title="min" />
        <div className="absolute top-0 bottom-0 w-px bg-foreground/70" style={{ left: `${(targetV / max) * 100}%` }} title="target" />
      </div>
    </div>
  );
}
