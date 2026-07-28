// ════════════════════════════════════════════════════════════════════
// PER-BRAND STORE FLAGS — "Needs order" / "Bring samples" stickers
//
// SOURCE OF TRUTH: public.store_brand_flags (store_id, brand_id -> brands.id, flag_type)
// BRAND SOURCE:    public.brands (only brands that have active products —
//                  dynamic, so a new product brand appears automatically)
//
// Legacy mirror: store_tube_inventory_status.needs_order / bring_samples is
// still read by delivery scheduling + SLA alerts, so every toggle mirrors
// into the matching per-SKU rows for that brand.
// ════════════════════════════════════════════════════════════════════
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type StoreFlagType = 'needs_order' | 'bring_samples';

export interface FlagBrand {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
}

/** Canonical brand name -> legacy store_tube_inventory_status.brand_id keys */
function legacyKeysForBrandName(name: string): string[] {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  if (n.includes('gasmask')) return ['gasmask', 'gasmasktubes', 'gasmaskredtops'];
  if (n.includes('hotmama')) return ['hotmama'];
  if (n.includes('grabba')) return ['grabba_r_us', 'grabba', 'grabbarus'];
  if (n.includes('hotsc') || n.includes('scolatti') || n.includes('scalati')) {
    return ['hotscolatti-light', 'hotscolatti-dark', 'hotscalati', 'hotscalatibros', 'hotscolatti'];
  }
  return [];
}

/** Brands available for flagging — pulled live from the brands table. */
export function useFlagBrands() {
  return useQuery({
    queryKey: ['flag-brands'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FlagBrand[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('brand_id, brands!inner(id, name, color, logo_url, active)')
        .eq('is_active', true)
        .not('brand_id', 'is', null);
      if (error) throw new Error(`FLAG_BRANDS_FAILED: ${error.message}`);

      const byId = new Map<string, FlagBrand>();
      for (const row of (data ?? []) as any[]) {
        const b = row.brands;
        if (!b || b.active === false) continue;
        if (!byId.has(b.id)) {
          byId.set(b.id, { id: b.id, name: b.name, color: b.color, logo_url: b.logo_url });
        }
      }
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export interface StoreBrandFlagRow {
  brand_id: string;
  flag_type: StoreFlagType;
}

export function useStoreBrandFlags(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['store-brand-flags', storeId],
    enabled: !!storeId,
    staleTime: 15_000,
    queryFn: async (): Promise<StoreBrandFlagRow[]> => {
      const { data, error } = await supabase
        .from('store_brand_flags')
        .select('brand_id, flag_type')
        .eq('store_id', storeId!);
      if (error) throw new Error(`STORE_BRAND_FLAGS_FAILED: ${error.message}`);
      return (data ?? []) as StoreBrandFlagRow[];
    },
  });
}

export function useToggleStoreBrandFlag(storeId: string | null | undefined) {
  const qc = useQueryClient();
  const key = ['store-brand-flags', storeId];

  return useMutation({
    mutationFn: async (vars: {
      brand: FlagBrand;
      flagType: StoreFlagType;
      next: boolean;
      userId?: string | null;
    }) => {
      const { brand, flagType, next, userId } = vars;
      if (!storeId) throw new Error('NO_STORE_ID');

      if (next) {
        const { error } = await supabase
          .from('store_brand_flags')
          .upsert(
            { store_id: storeId, brand_id: brand.id, flag_type: flagType, set_by: userId ?? null },
            { onConflict: 'store_id,brand_id,flag_type' }
          );
        if (error) throw new Error(`FLAG_SAVE_FAILED: ${error.message}`);
      } else {
        const { error } = await supabase
          .from('store_brand_flags')
          .delete()
          .eq('store_id', storeId)
          .eq('brand_id', brand.id)
          .eq('flag_type', flagType);
        if (error) throw new Error(`FLAG_CLEAR_FAILED: ${error.message}`);
      }

      // Mirror into the legacy per-SKU table that delivery/SLA views read.
      const keys = legacyKeysForBrandName(brand.name);
      if (keys.length) {
        const { error: mirrorErr } = await supabase
          .from('store_tube_inventory_status')
          .update({
            [flagType]: next,
            last_updated_at: new Date().toISOString(),
            last_updated_by: userId ?? null,
            last_updated_method: 'brand_sticker',
          } as any)
          .eq('store_id', storeId)
          .in('brand_id', keys);
        if (mirrorErr) throw new Error(`FLAG_MIRROR_FAILED: ${mirrorErr.message}`);
      }
    },
    // Optimistic UI so an in-store tap feels instant on flaky mobile.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<StoreBrandFlagRow[]>(key) ?? [];
      const nextRows = vars.next
        ? [...prev, { brand_id: vars.brand.id, flag_type: vars.flagType }]
        : prev.filter(r => !(r.brand_id === vars.brand.id && r.flag_type === vars.flagType));
      qc.setQueryData(key, nextRows);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['store-flags', storeId] });
      qc.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
      qc.invalidateQueries({ queryKey: ['orders-requested'] });
      qc.invalidateQueries({ queryKey: ['dispatch-intake'] });
      qc.invalidateQueries({ queryKey: ['sla-alerts'] });
    },
  });
}
