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
  Package, DollarSign, Image as ImageIcon, Sparkles, Upload, Save, X, Star, AlertTriangle, Trash2,
} from 'lucide-react';

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
  const fileRef = useRef<HTMLInputElement>(null);

  const detailQ = useQuery({
    enabled: !!productId && open,
    queryKey: ['dd-product-detail', productId],
    queryFn: async (): Promise<ProductDetail | null> => {
      if (!productId) return null;
      const { data, error } = await supabase
        .from('products_all')
        .select('id, product_name, category, brand, supplier_id, status, inventory_qty, supplier_cost, store_price_a, dtc_price_b, map_price, store_margin_pct, dtc_margin_pct, min_store_margin_pct, target_store_margin_pct, min_dtc_margin_pct, target_dtc_margin_pct, description, ai_description, ai_description_short, description_generated_at, primary_image_url, image_urls, image_enhanced_at')
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

  async function handleImageUpload(file: File) {
    if (!productId) return;
    setUploading(true);
    const toastId = toast.loading('Processing image…');
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
      if (data?.demo_mode) {
        toast.message('Image saved in demo mode — Cloudinary/Remove.bg keys not configured yet', { id: toastId });
      } else {
        toast.success('Image processed and attached', { id: toastId });
      }
      qc.invalidateQueries({ queryKey: ['dd-product-detail', productId] });
    } catch (e: any) {
      toast.error(e.message ?? 'Upload failed', { id: toastId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
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
                    No images yet. Upload one to run <code>dd-process-image</code>.
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
