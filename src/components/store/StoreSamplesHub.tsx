// ════════════════════════════════════════════════════════════════════
// STORE SAMPLES HUB — the permanent, always-visible Samples home on the
// customer profile. Three panels, one workflow:
//   A. Available Samples  → products.promo_sample_available_qty (authoritative)
//   B. Bring Samples      → store_tube_inventory_status (one promo item/brand)
//   C. Samples Given      → existing store_samples_given history (reused)
// No parallel sample system, no new history table, no invented quantities.
// ════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Boxes, Gift, Loader2, PackageCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { CANONICAL_TUBE_SKUS } from '@/lib/inventory/skuDisplay';
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
}

function parentBrandFor(productId: string, fallback: string) {
  return CANONICAL_TUBE_SKUS.find((s) => s.product_id === productId)?.parent_brand ?? fallback;
}

function displayFor(productId: string, fallback: string) {
  return CANONICAL_TUBE_SKUS.find((s) => s.product_id === productId)?.display ?? fallback;
}

export function StoreSamplesHub({ storeId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [availableDraft, setAvailableDraft] = useState<Record<string, string>>({});
  const [bringDraft, setBringDraft] = useState<Record<string, string>>({});

  // ── A. Configured promotional samples (one per brand, authoritative flag) ──
  const { data: promos = [], isLoading: promosLoading } = useQuery({
    queryKey: ['promo-samples'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,promo_sample_available_qty')
        .eq('is_promo_sample', true)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        parent_brand: parentBrandFor(p.id, p.name),
        display: displayFor(p.id, p.name),
      })) as PromoSample[];
    },
  });

  // ── B. This store's per-brand bring-samples rows ──
  const { data: bringRows = [] } = useQuery({
    queryKey: ['store-bring-samples', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .select('id,brand_name,bring_samples,sample_qty_to_bring')
        .eq('store_id', storeId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

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
      const existing = (bringRows as any[]).find((r) => r.brand_name === promo.display);
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
            brand_name: promo.display,
            sample_qty_to_bring: qty,
            bring_samples: !!qty,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Samples to bring saved');
      qc.invalidateQueries({ queryKey: ['store-bring-samples', storeId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save samples to bring'),
  });

  return (
    <div className="space-y-4">
      {/* ── A. AVAILABLE SAMPLES ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Boxes className="h-4 w-4" /> Available Samples
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {promosLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : promos.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              No promotional sample is configured yet.
            </p>
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

      {/* ── B. BRING SAMPLES ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4" /> Bring Samples
            <Badge variant="outline" className="text-[10px]">One promo item per brand</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {promos.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              No promotional sample is configured yet.
            </p>
          ) : (
            promos.map((p) => {
              const row = (bringRows as any[]).find((r) => r.brand_name === p.display);
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
                    <span className="text-xs text-muted-foreground">Quantity to bring:</span>
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
            })
          )}
        </CardContent>
      </Card>

      {/* ── C. SAMPLES GIVEN (existing history, unchanged storage) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gift className="h-4 w-4" /> Samples Given
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SamplesGivenSection storeId={storeId} variant="full" />
        </CardContent>
      </Card>
    </div>
  );
}
