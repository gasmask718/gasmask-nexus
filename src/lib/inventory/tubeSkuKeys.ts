// ════════════════════════════════════════════════════════════════════
// CANONICAL TUBE SKU KEYS
//
// public.store_tube_inventory_status is the ONE live inventory table.
// It is keyed by (store_id, brand_id, is_simulation) where `brand_id`
// is the per-SKU key (NOT the parent brand).
//
// public.store_tube_inventory is RETIRED (write-guarded at the DB).
//
// This module is the single translation layer between:
//   products.id (UUID SKU, used by the SKU chips / Quick View)
//   ↕
//   store_tube_inventory_status.brand_id (text SKU key, the write key)
// ════════════════════════════════════════════════════════════════════

export interface TubeSkuKey {
  /** store_tube_inventory_status.brand_id — the canonical write key */
  brandId: string;
  /** store_tube_inventory_status.brand_name */
  brandName: string;
  /** products.id */
  productId: string;
  order: number;
}

export const TUBE_SKU_KEYS: TubeSkuKey[] = [
  { brandId: 'gasmasktubes',      brandName: 'GasMask Tubes',     productId: 'dd5e14c0-d6c5-403a-a2d7-504181b0f4ea', order: 1 },
  { brandId: 'gasmask',           brandName: 'GasMask Bags',      productId: '170adb8f-ac4e-40f4-a283-38730d30c5de', order: 2 },
  { brandId: 'gasmaskredtops',    brandName: 'GasMask Redtops',   productId: 'e3eea682-831e-4913-8b0e-563bc1325a1f', order: 3 },
  { brandId: 'hotscalatimixpack', brandName: 'Hotscolatti Mix',   productId: '04336f6d-d69b-4ec8-8571-7088783b31d6', order: 4 },
  { brandId: 'hotscolatti-dark',  brandName: 'Hotscolatti Dark',  productId: '1c4f112e-97a1-4430-aae0-f1fcc0229a85', order: 5 },
  { brandId: 'hotscolatti-light', brandName: 'Hotscolatti Light', productId: '27e21aec-21a2-4ce7-9515-dbfd618a27c6', order: 6 },
  { brandId: 'hotscalatibros',    brandName: 'Hotscolatti Bros',  productId: 'fcfe5469-e9d3-40f3-8bf4-a4349086e1c3', order: 7 },
  { brandId: 'hotmama',           brandName: 'HotMama',           productId: '2dfcbd00-0e44-4cd1-b80d-b00a33b123c5', order: 8 },
  { brandId: 'grabba_r_us',       brandName: 'Grabba R Us',       productId: '2d28e463-5296-4d42-b548-896d18ee906e', order: 9 },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Legacy / UI aliases → canonical store_tube_inventory_status.brand_id */
const BRAND_ID_ALIASES: Record<string, string> = {
  gasmask: 'gasmask',
  gasmaskbag: 'gasmask',
  gasmaskbags: 'gasmask',
  gasmasktube: 'gasmasktubes',
  gasmasktubes: 'gasmasktubes',
  gasmaskredtop: 'gasmaskredtops',
  gasmaskredtops: 'gasmaskredtops',
  hotmama: 'hotmama',
  grabba: 'grabba_r_us',
  grabbarus: 'grabba_r_us',
  hotscolattilight: 'hotscolatti-light',
  hotscalatilight: 'hotscolatti-light',
  hotscolattidark: 'hotscolatti-dark',
  hotscalatidark: 'hotscolatti-dark',
  hotscolattibros: 'hotscalatibros',
  hotscalatibros: 'hotscalatibros',
  hotscolatti: 'hotscalatimixpack',
  hotscalati: 'hotscalatimixpack',
  hotscolattimix: 'hotscalatimixpack',
  hotscalatimix: 'hotscalatimixpack',
  hotscolattimixpack: 'hotscalatimixpack',
  hotscalatimixpack: 'hotscalatimixpack',
};

/** Normalize any legacy brand string / UI id to the canonical brand_id. */
export function normalizeTubeBrandId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const direct = TUBE_SKU_KEYS.find((s) => s.brandId === raw);
  if (direct) return direct.brandId;
  return BRAND_ID_ALIASES[norm(raw)] ?? null;
}

export function brandIdForProductId(productId: string | null | undefined): string | null {
  if (!productId) return null;
  return TUBE_SKU_KEYS.find((s) => s.productId === productId)?.brandId ?? null;
}

export function productIdForBrandId(brandId: string | null | undefined): string | null {
  const canonical = normalizeTubeBrandId(brandId);
  if (!canonical) return null;
  return TUBE_SKU_KEYS.find((s) => s.brandId === canonical)?.productId ?? null;
}

export function tubeBrandName(brandId: string | null | undefined, fallback?: string | null): string {
  const canonical = normalizeTubeBrandId(brandId);
  return TUBE_SKU_KEYS.find((s) => s.brandId === canonical)?.brandName ?? (fallback || brandId || 'Unknown');
}
