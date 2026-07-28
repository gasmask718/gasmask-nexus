// ════════════════════════════════════════════════════════════════════
// PER-BRAND STORE FLAGS — "Needs order" / "Bring samples" stickers
//
// ⚠️ ONE SOURCE OF TRUTH (owner decision):
//   public.store_tube_inventory_status.needs_order / .bring_samples
//   is the ONLY canonical store of these two states. It already drives
//   delivery scheduling + SLA alerts + Tube Intelligence.
//
//   The brand stickers are a per-BRAND VIEW/CONTROL over that same
//   per-SKU data — not a second table. public.store_brand_flags is
//   DEPRECATED and is no longer read or written by any surface.
//
// BRAND ↔ SKU ROLLUP RULE:
//   read  : brand flag = TRUE if ANY SKU row of that brand has it TRUE
//   write : setting the brand flag writes the SAME value to EVERY SKU row
//           of that brand (missing rows are created), so read-back is exact.
// ════════════════════════════════════════════════════════════════════
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { TUBE_BRANDS } from '@/hooks/useTubeIntelligence';

export type StoreFlagType = 'needs_order' | 'bring_samples';

export interface FlagBrand {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
}

/**
 * Canonical brand name -> store_tube_inventory_status.brand_id (SKU) keys.
 * These are the SKU rows that make up a brand.
 */
export function skuKeysForBrandName(name: string): string[] {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  if (n.includes('gasmask')) return ['gasmask', 'gasmasktubes', 'gasmaskredtops'];
  if (n.includes('hotmama')) return ['hotmama'];
  if (n.includes('grabba')) return ['grabba_r_us'];
  if (n.includes('hotsc') || n.includes('scolatti') || n.includes('scalati')) {
    return ['hotscolatti-light', 'hotscolatti-dark'];
  }
  // Unmapped brand: use a stable slug so it still lives in the canonical table.
  return [n || name.toLowerCase()];
}

function skuDisplayName(skuKey: string, fallback: string): string {
  return TUBE_BRANDS.find(b => b.id === skuKey)?.name ?? fallback;
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

/**
 * Reads the canonical per-SKU state and rolls it up to brand level.
 * Returns rows keyed by brands.id so the sticker UI is unchanged.
 */
export function useStoreBrandFlags(storeId: string | null | undefined) {
  const { simulationMode } = useSimulationMode();
  const { data: brands = [] } = useFlagBrands();

  return useQuery({
    queryKey: ['store-brand-flags', storeId, simulationMode, brands.map(b => b.id).join(',')],
    enabled: !!storeId && brands.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<StoreBrandFlagRow[]> => {
      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .select('brand_id, needs_order, bring_samples')
        .eq('store_id', storeId!)
        .eq('is_simulation', simulationMode);
      if (error) throw new Error(`STORE_BRAND_FLAGS_FAILED: ${error.message}`);

      const rows = (data ?? []) as Array<{
        brand_id: string;
        needs_order: boolean | null;
        bring_samples: boolean | null;
      }>;

      const out: StoreBrandFlagRow[] = [];
      for (const brand of brands) {
        const keys = skuKeysForBrandName(brand.name);
        const mine = rows.filter(r => keys.includes(r.brand_id));
        // ROLLUP: brand is flagged if ANY of its SKUs is flagged.
        if (mine.some(r => r.needs_order)) out.push({ brand_id: brand.id, flag_type: 'needs_order' });
        if (mine.some(r => r.bring_samples)) out.push({ brand_id: brand.id, flag_type: 'bring_samples' });
      }
      return out;
    },
  });
}

export function useToggleStoreBrandFlag(storeId: string | null | undefined) {
  const qc = useQueryClient();
  const { simulationMode } = useSimulationMode();

  return useMutation({
    mutationFn: async (vars: {
      brand: FlagBrand;
      flagType: StoreFlagType;
      next: boolean;
      userId?: string | null;
      /** 'in_person' | 'call' | ... — how the state was captured */
      updateMethod?: string;
    }) => {
      const { brand, flagType, next, userId, updateMethod } = vars;
      if (!storeId) throw new Error('NO_STORE_ID');

      const keys = skuKeysForBrandName(brand.name);
      const now = new Date().toISOString();

      // WRITE the canonical per-SKU rows (create any that are missing) so a
      // read-back rollup returns exactly what was set. No second copy exists.
      const payload = keys.map(key => ({
        store_id: storeId,
        brand_id: key,
        brand_name: skuDisplayName(key, brand.name),
        [flagType]: next,
        last_updated_at: now,
        last_updated_by: userId ?? null,
        last_updated_method: updateMethod ?? 'brand_sticker',
        is_simulation: simulationMode,
      }));

      const { error } = await supabase
        .from('store_tube_inventory_status')
        .upsert(payload as any, { onConflict: 'store_id,brand_id,is_simulation' });
      if (error) throw new Error(`FLAG_SAVE_FAILED: ${error.message}`);
    },
    // Optimistic UI so an in-store tap feels instant on flaky mobile.
    onMutate: async (vars) => {
      const keys = qc.getQueryCache()
        .findAll({ queryKey: ['store-brand-flags', storeId] })
        .map(q => q.queryKey);
      await qc.cancelQueries({ queryKey: ['store-brand-flags', storeId] });
      const snapshots = keys.map(k => [k, qc.getQueryData<StoreBrandFlagRow[]>(k as any)] as const);
      for (const [k, prev] of snapshots) {
        if (!prev) continue;
        const nextRows = vars.next
          ? [...prev, { brand_id: vars.brand.id, flag_type: vars.flagType }]
          : prev.filter(r => !(r.brand_id === vars.brand.id && r.flag_type === vars.flagType));
        qc.setQueryData(k as any, nextRows);
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshots?.forEach(([k, prev]) => {
        if (prev) qc.setQueryData(k as any, prev);
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['store-brand-flags', storeId] });
      qc.invalidateQueries({ queryKey: ['store-flags', storeId] });
      qc.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
      qc.invalidateQueries({ queryKey: ['global-tube-intelligence'] });
      qc.invalidateQueries({ queryKey: ['orders-requested'] });
      qc.invalidateQueries({ queryKey: ['dispatch-intake'] });
      qc.invalidateQueries({ queryKey: ['sla-alerts'] });
    },
  });
}
