// ════════════════════════════════════════════════════════════════════
// STORE SAMPLES HUB — the permanent, always-visible Samples home on the
// customer profile. One workflow, four panels:
//   A. Available Samples  → products.promo_sample_available_qty (authoritative)
//   B. Amount To Give     → store_tube_inventory_status (one promo item/brand)
//   C. Samples Left       → store_sample_checks (dated checks, never overwritten)
//   D. Samples Given      → existing store_samples_given history (reused as-is)
// Brands come from the authoritative promo-sample flag on products, so every
// configured brand shows up automatically. No parallel sample system.
// ════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Boxes, ClipboardList, Loader2, PackageCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { CANONICAL_TUBE_SKUS, brandForProductId } from '@/lib/inventory/skuDisplay';
import { SamplesGivenSection } from '@/components/store/SamplesGivenSection';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  storeId: string;
}

interface PromoSample {
  id: string;
  name: string;
  promo_sample_available_qty: number | null;
  parent_brand: string;
  display: string;
  brand_key: string;
}

function skuFor(productId: string) {
  return CANONICAL_TUBE_SKUS.find((s) => s.product_id === productId);
}

export function StoreSamplesHub({ storeId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [availableDraft, setAvailableDraft] = useState<Record<string, string>>({});
  const [bringDraft, setBringDraft] = useState<Record<string, string>>({});
  const [leftDraft, setLeftDraft] = useState<Record<string, string>>({});

  // ── Configured promotional samples: one per brand (authoritative flag) ──
  const { data: promos = [], isLoading: promosLoading } = useQuery({
    queryKey: ['promo-samples'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,promo_sample_available_qty')
        .eq('is_promo_sample', true)
        .eq('is_active', true);
      if (error) throw error;
      return (data || [])
        .map((p: any) => {
          const sku = skuFor(p.id);
          return {
            ...p,
            parent_brand: sku?.parent_brand ?? p.name,
            display: sku?.display ?? p.name,
            brand_key: brandForProductId(p.id) ?? '',
            order: sku?.order ?? 99,
          } as PromoSample & { order: number };
        })
        .sort((a, b) => a.order - b.order) as PromoSample[];
    },
  });

  // ── This store's per-brand bring-samples rows ──
  const { data: bringRows = [] } = useQuery({
    queryKey: ['store-bring-samples', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .select('id,brand_id,brand_name,bring_samples,sample_qty_to_bring')
        .eq('store_id', storeId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  // ── Samples-left checks (dated history, newest first) ──
  const { data: checks = [] } = useQuery({
    queryKey: ['store-sample-checks', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_sample_checks' as any)
        .select('id,product_id,brand,qty_remaining,checked_at,checked_by,note')
        .eq('store_id', storeId)
        .order('checked_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!storeId,
  });

  const rowFor = (p: PromoSample) =>
    (bringRows as any[]).find(
      (r) =>
        (r.brand_id && p.brand_key && r.brand_id.toLowerCase().replace(/[\s_-]/g, '') === p.brand_key.toLowerCase().replace(/[\s_-]/g, '')) ||
        r.brand_name === p.display,
    );

  const saveAvailable = useMutation({
    mutationFn: async (productId: string) => {
      const raw = availableDraft[productId];
      const qty = raw === '' || raw == null ? null : Math.max(0, parseInt(raw, 10) || 0);
      const { error } = await supabase
        .from('products')
        .update({
          promo_sample_available_qty: qty,
          promo_sample_qty_updated_at: new Date().toISOString(),
          promo_sample_qty_updated_by: user?.id ?? null,
        } as any)
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Available samples updated');
      qc.invalidateQueries({ queryKey: ['promo-samples'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update available samples'),
  });

  const saveBring = useMutation({
    mutationFn: async (promo: PromoSample) => {
      const raw = bringDraft[promo.id];
      const qty = raw === '' || raw == null ? null : Math.max(0, parseInt(raw, 10) || 0);
      const existing = rowFor(promo);
      if (existing) {
        const { error } = await supabase
          .from('store_tube_inventory_status')
          .update({ sample_qty_to_bring: qty, bring_samples: !!qty } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_tube_inventory_status')
          .insert({
            store_id: storeId,
            // brand_id must resolve to the brand's promo product, otherwise the
            // one-promo-per-brand rule in the database clears the flag.
            brand_id: promo.brand_key,
            brand_name: promo.display,
            sample_qty_to_bring: qty,
            bring_samples: !!qty,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Amount to give saved');
      qc.invalidateQueries({ queryKey: ['store-bring-samples', storeId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save amount to give'),
  });

  const saveLeft = useMutation({
    mutationFn: async (promo: PromoSample) => {
      const raw = leftDraft[promo.id];
      if (raw === '' || raw == null) throw new Error('Enter how many are left');
      const qty = Math.max(0, parseInt(raw, 10) || 0);
      const { error } = await supabase.from('store_sample_checks' as any).insert({
        store_id: storeId,
        product_id: promo.id,
        brand: promo.parent_brand,
        qty_remaining: qty,
        checked_by: user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, promo) => {
      toast.success('Sample check recorded');
      setLeftDraft((d) => ({ ...d, [promo.id]: '' }));
      qc.invalidateQueries({ queryKey: ['store-sample-checks', storeId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to record sample check'),
  });

  const latestCheck = (productId: string) => checks.find((c) => c.product_id === productId);

  const emptyState = (
    <p className="text-sm italic text-muted-foreground">No promotional sample is configured yet.</p>
  );

  return (
    <div className="space-y-4">
      {/* ── A. AVAILABLE SAMPLES ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Boxes className="h-4 w-4" /> Available Samples
            <Badge variant="outline" className="text-[10px]">{promos.length} brands</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {promosLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : promos.length === 0 ? (
            emptyState
          ) : (
            promos.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {p.parent_brand}
                  </p>
                  <p className="text-sm font-medium">{p.display}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Available:</span>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 w-24 text-sm"
                    placeholder={p.promo_sample_available_qty == null ? '—' : ''}
                    value={availableDraft[p.id] ?? (p.promo_sample_available_qty ?? '').toString()}
                    onChange={(e) => setAvailableDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => saveAvailable.mutate(p.id)}
                    disabled={saveAvailable.isPending}
                  >
                    {saveAvailable.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            ))
          )}
          <p className="text-[11px] text-muted-foreground">
            Quantity is entered manually. Logging a sample as given does not deduct it automatically.
          </p>
        </CardContent>
      </Card>

      {/* ── B. AMOUNT TO GIVE (BRING SAMPLES) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4" /> Amount To Give
            <Badge variant="outline" className="text-[10px]">One promo item per brand</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {promos.length === 0
            ? emptyState
            : promos.map((p) => {
                const row = rowFor(p);
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border/50 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {p.parent_brand}
                      </p>
                      <p className="text-sm font-medium">{p.display}</p>
                    </div>
                    {row?.bring_samples && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <PackageCheck className="h-3 w-3" /> Flagged
                      </Badge>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Amount to give:</span>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-24 text-sm"
                        placeholder={row?.sample_qty_to_bring == null ? '—' : ''}
                        value={bringDraft[p.id] ?? (row?.sample_qty_to_bring ?? '').toString()}
                        onChange={(e) => setBringDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => saveBring.mutate(p)}
                        disabled={saveBring.isPending}
                      >
                        {saveBring.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  </div>
                );
              })}
        </CardContent>
      </Card>

      {/* ── C. SAMPLES LEFT (DATED CHECKS) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ClipboardList className="h-4 w-4" /> Samples Left At This Store
            <Badge variant="outline" className="text-[10px]">Every check is kept</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {promos.length === 0
            ? emptyState
            : promos.map((p) => {
                const last = latestCheck(p.id);
                return (
                  <div key={p.id} className="rounded-md border border-border/50 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {p.parent_brand}
                        </p>
                        <p className="text-sm font-medium">{p.display}</p>
                        {last ? (
                          <p className="text-[11px] text-muted-foreground">
                            Last check: {last.qty_remaining} left ·{' '}
                            {new Date(last.checked_at).toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-[11px] italic text-muted-foreground">No check recorded yet</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Left now:</span>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-24 text-sm"
                          placeholder="—"
                          value={leftDraft[p.id] ?? ''}
                          onChange={(e) => setLeftDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => saveLeft.mutate(p)}
                          disabled={saveLeft.isPending}
                        >
                          {saveLeft.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Record'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

          {checks.length > 0 && (
            <div className="rounded-md border border-border/40 bg-muted/20 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Check history
              </p>
              <ul className="space-y-1">
                {checks.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span>
                      <span className="font-medium">{skuFor(c.product_id)?.display ?? c.brand ?? 'Sample'}</span>
                      <span className="text-muted-foreground"> · {c.qty_remaining} left</span>
                    </span>
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {new Date(c.checked_at).toLocaleString()}
                      {c.checked_by ? ' · logged by rep' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── D. SAMPLES GIVEN (existing history, untouched) ── */}
      <SamplesGivenSection storeId={storeId} variant="full" />
    </div>
  );
}

export default StoreSamplesHub;
