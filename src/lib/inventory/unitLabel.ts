// ════════════════════════════════════════════════════════════════════
// Shared unit-label helper — resolves whether a given product/brand
// sells in "bags" (GasMask Bags) or "tubes" (everything else).
//
// Root fix so every surface (order create, tube-intel KPI card,
// tube inventory card, last-order snapshot, lifetime-by-brand table)
// derives the unit label from one source of truth.
// ════════════════════════════════════════════════════════════════════

// GasMask Bags product_id — the only bag-tracked SKU today.
export const BAG_PRODUCT_IDS = new Set<string>([
  '170adb8f-ac4e-40f4-a283-38730d30c5de', // GasMask Bags
]);

// The KPI-card VALID_TUBE_BRANDS entry for GasMask Bags uses id 'gasmask'.
const BAG_BRAND_IDS = new Set<string>(['gasmask', 'gasmaskbags']);

export type UnitLabel = 'bags' | 'tubes';

export interface ProductForUnit {
  id?: string | null;
  track_by?: string | null;
  unit_type?: string | null;
}

/** Prefer products.track_by / unit_type; fall back to the bag product_id set. */
export function unitLabelForProduct(p: ProductForUnit | null | undefined): UnitLabel {
  if (!p) return 'tubes';
  const t = (p.track_by || p.unit_type || '').toString().toLowerCase();
  if (t.startsWith('bag')) return 'bags';
  if (t.startsWith('tube') || t.startsWith('unit')) return 'tubes';
  if (p.id && BAG_PRODUCT_IDS.has(p.id)) return 'bags';
  return 'tubes';
}

export function unitLabelForProductId(productId: string | null | undefined): UnitLabel {
  return productId && BAG_PRODUCT_IDS.has(productId) ? 'bags' : 'tubes';
}

export function unitLabelForBrandId(brandId: string | null | undefined): UnitLabel {
  return brandId && BAG_BRAND_IDS.has(brandId) ? 'bags' : 'tubes';
}

export function unitSingular(u: UnitLabel): 'bag' | 'tube' {
  return u === 'bags' ? 'bag' : 'tube';
}
