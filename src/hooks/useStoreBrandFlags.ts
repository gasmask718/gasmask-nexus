// ════════════════════════════════════════════════════════════════════
// PER-PRODUCT STORE FLAGS — "Needs order" / "Bring samples"
//
// ⚠️ ONE SOURCE OF TRUTH (owner decision):
//   public.store_tube_inventory_status.needs_order / .bring_samples
//   keyed by (store_id, brand_id, is_simulation) where `brand_id` is the
//   canonical PER-PRODUCT / PER-TUBE-TYPE key (e.g. 'gasmasktubes').
//   It already drives delivery scheduling + SLA alerts + Tube Intelligence.
//
//   There is NO second copy. public.store_brand_flags is DELETED.
//
// PRODUCT ↔ BRAND ROLLUP RULE:
//   read  : product flag = that SKU row's column.
//           brand flag   = TRUE if ANY product under the brand is TRUE.
//   write : product toggle writes exactly ONE canonical SKU row.
//           brand toggle writes the same value to EVERY product of the brand.
//
// PRODUCT LABELLING (the join):
//   public.products (is_active, not deleted) INNER JOIN public.brands
//   → each product becomes one flaggable item, displayed "Brand — Product".
//   products.name is mapped to the canonical legacy SKU key via
//   `skuKeyForProductName` so existing rows keep working.
// ════════════════════════════════════════════════════════════════════
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

export type StoreFlagType = 'needs_order' | 'bring_samples';

export interface FlagBrand {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
  products: FlagProduct[];
}

export interface FlagProduct {
  /** products.id */
  productId: string;
  /** canonical store_tube_inventory_status.brand_id (the SKU key) */
  skuKey: string;
  /** full product name, e.g. "GasMask Tubes" */
  productName: string;
  /** product name with the brand prefix stripped, e.g. "Tubes" */
  shortName: string;
  brandId: string;
  brandName: string;
  color: string | null;
  /** "GasMask — Tubes" */
  label: string;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * products.name -> canonical store_tube_inventory_status.brand_id.
 * Legacy keys are preserved so historical rows stay addressable.
 */
export function skuKeyForProductName(productName: string): string {
  const n = normalize(productName);
  if (n === 'gasmask' || n.includes('gasmaskbag')) return 'gasmask';
  if (n.includes('gasmaskredtop')) return 'gasmaskredtops';
  if (n.includes('gasmasktube')) return 'gasmasktubes';
  if (n.includes('hotmama')) return 'hotmama';
  if (n.includes('grabba')) return 'grabba_r_us';
  if (n.includes('light') && (n.includes('scolatti') || n.includes('scalati'))) return 'hotscolatti-light';
  if (n.includes('dark') && (n.includes('scolatti') || n.includes('scalati'))) return 'hotscolatti-dark';
  if (n.includes('bros') && (n.includes('scolatti') || n.includes('scalati'))) return 'hotscalatibros';
  return n;
}

/** "GasMask" + "GasMask Tubes" -> "Tubes" */
function shortProductName(brandName: string, productName: string): string {
  const bn = normalize(brandName);
  const words = productName.trim().split(/\s+/);
  const out: string[] = [];
  let consumed = '';
  let i = 0;
  for (; i < words.length; i++) {
    const cand = normalize(consumed + words[i]);
    if (bn.startsWith(cand)) {
      consumed += words[i];
      if (normalize(consumed) === bn) { i++; break; }
    } else break;
  }
  for (; i < words.length; i++) out.push(words[i]);
  return out.length ? out.join(' ') : productName;
}

/**
 * Flaggable catalog — brands with their individual products / tube types.
 * This is the join that gives every SKU a human "Brand — Product" label.
 */
export function useFlagBrands() {
  return useQuery({
    queryKey: ['flag-brands-with-products'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FlagBrand[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, brand_id, is_deleted, brands!inner(id, name, color, logo_url, active)')
        .eq('is_active', true)
        .not('brand_id', 'is', null);
      if (error) throw new Error(`FLAG_BRANDS_FAILED: ${error.message}`);

      const byId = new Map<string, FlagBrand>();
      for (const row of (data ?? []) as any[]) {
        const b = row.brands;
        if (!b || b.active === false) continue;
        if (row.is_deleted) continue;
        if (!byId.has(b.id)) {
          byId.set(b.id, { id: b.id, name: b.name, color: b.color, logo_url: b.logo_url, products: [] });
        }
        const brand = byId.get(b.id)!;
        const skuKey = skuKeyForProductName(row.name);
        if (brand.products.some(p => p.skuKey === skuKey)) continue;
        brand.products.push({
          productId: row.id,
          skuKey,
          productName: row.name,
          shortName: shortProductName(b.name, row.name),
          brandId: b.id,
          brandName: b.name,
          color: b.color,
          label: `${b.name} — ${shortProductName(b.name, row.name)}`,
        });
      }
      const brands = Array.from(byId.values());
      brands.forEach(b => b.products.sort((x, y) => x.shortName.localeCompare(y.shortName)));
      return brands.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/** Every flaggable product across all brands, flat. */
export function flattenProducts(brands: FlagBrand[]): FlagProduct[] {
  return brands.flatMap(b => b.products);
}

export interface StoreProductFlagRow {
  /** canonical SKU key */
  skuKey: string;
  flag_type: StoreFlagType;
}

/**
 * Reads the canonical per-SKU state. Returns one entry per (SKU, flag) that
 * is currently ON. Brand rollup is derived in `isBrandOn`.
 */
export function useStoreBrandFlags(storeId: string | null | undefined) {
  const { simulationMode } = useSimulationMode();

  return useQuery({
    queryKey: ['store-brand-flags', storeId, simulationMode],
    enabled: !!storeId,
    staleTime: 15_000,
    queryFn: async (): Promise<StoreProductFlagRow[]> => {
      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .select('brand_id, needs_order, bring_samples')
        .eq('store_id', storeId!)
        .eq('is_simulation', simulationMode);
      if (error) throw new Error(`STORE_BRAND_FLAGS_FAILED: ${error.message}`);

      const out: StoreProductFlagRow[] = [];
      for (const r of (data ?? []) as any[]) {
        if (r.needs_order) out.push({ skuKey: r.brand_id, flag_type: 'needs_order' });
        if (r.bring_samples) out.push({ skuKey: r.brand_id, flag_type: 'bring_samples' });
      }
      return out;
    },
  });
}

export function isProductOn(rows: StoreProductFlagRow[], skuKey: string, type: StoreFlagType) {
  return rows.some(r => r.skuKey === skuKey && r.flag_type === type);
}

/** Brand rollup: ON when ANY product under the brand is ON. */
export function isBrandOn(rows: StoreProductFlagRow[], brand: FlagBrand, type: StoreFlagType) {
  return brand.products.some(p => isProductOn(rows, p.skuKey, type));
}

/** The specific products currently flagged, for "GasMask — Tubes" display. */
export function flaggedProducts(
  rows: StoreProductFlagRow[],
  brands: FlagBrand[],
  type: StoreFlagType,
): FlagProduct[] {
  return flattenProducts(brands).filter(p => isProductOn(rows, p.skuKey, type));
}

/**
 * Toggle at PRODUCT level (one canonical row) or BRAND level (all its
 * products). Both write the same table — no second copy.
 */
export function useToggleStoreBrandFlag(storeId: string | null | undefined) {
  const qc = useQueryClient();
  const { simulationMode } = useSimulationMode();

  return useMutation({
    mutationFn: async (vars: {
      /** Target products — one for a product tap, all of them for a brand tap. */
      products: FlagProduct[];
      flagType: StoreFlagType;
      next: boolean;
      userId?: string | null;
      /** 'in_person' | 'call' | ... — how the state was captured */
      updateMethod?: string;
    }) => {
      const { products, flagType, next, userId, updateMethod } = vars;
      if (!storeId) throw new Error('NO_STORE_ID');
      if (!products.length) throw new Error('NO_PRODUCTS');

      const now = new Date().toISOString();
      const payload = products.map(p => ({
        store_id: storeId,
        brand_id: p.skuKey,
        brand_name: p.productName,
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
      const snapshots = keys.map(k => [k, qc.getQueryData<StoreProductFlagRow[]>(k as any)] as const);
      for (const [k, prev] of snapshots) {
        if (!prev) continue;
        const targets = new Set(vars.products.map(p => p.skuKey));
        const cleared = prev.filter(r => !(targets.has(r.skuKey) && r.flag_type === vars.flagType));
        const nextRows = vars.next
          ? [...cleared, ...vars.products.map(p => ({ skuKey: p.skuKey, flag_type: vars.flagType }))]
          : cleared;
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
      // Canonical inventory stamps feed every product-card surface
      qc.invalidateQueries({ queryKey: ['store-inventory-stamps'] });

      qc.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
      qc.invalidateQueries({ queryKey: ['global-tube-intelligence'] });
      qc.invalidateQueries({ queryKey: ['orders-requested'] });
      qc.invalidateQueries({ queryKey: ['dispatch-intake'] });
      qc.invalidateQueries({ queryKey: ['sla-alerts'] });
    },
  });
}
