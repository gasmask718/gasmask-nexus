// ════════════════════════════════════════════════════════════════════
// SKU DISPLAY MAP — canonical operator-facing names for the 9 active
// product SKUs. Keyed by products.id (UUID). Drives chip expansions
// (Lifetime, Prior Month, Last 30d) on the store master profile.
//
// Owner-approved labels (Roso deferred — Mix Pack stays as-is for now).
// ════════════════════════════════════════════════════════════════════

export type SkuStatus = 'bought' | 'staged' | 'never_offered';

export interface CanonicalSku {
  product_id: string;
  display: string;
  parent_brand: string;
  order: number;
}

export const CANONICAL_TUBE_SKUS: CanonicalSku[] = [
  { product_id: 'dd5e14c0-d6c5-403a-a2d7-504181b0f4ea', display: 'GasMask Tubes',       parent_brand: 'GasMask',     order: 1 },
  { product_id: '170adb8f-ac4e-40f4-a283-38730d30c5de', display: 'GasMask Bags',        parent_brand: 'GasMask',     order: 2 },
  { product_id: 'e3eea682-831e-4913-8b0e-563bc1325a1f', display: 'GasMask Redtops',     parent_brand: 'GasMask',     order: 3 },
  { product_id: '04336f6d-d69b-4ec8-8571-7088783b31d6', display: 'HotScalati Mix Pack', parent_brand: 'HotScalati',  order: 4 },
  { product_id: '1c4f112e-97a1-4430-aae0-f1fcc0229a85', display: 'HotScalati Dark',     parent_brand: 'HotScalati',  order: 5 },
  { product_id: '27e21aec-21a2-4ce7-9515-dbfd618a27c6', display: 'HotScalati Light',    parent_brand: 'HotScalati',  order: 6 },
  { product_id: 'fcfe5469-e9d3-40f3-8bf4-a4349086e1c3', display: 'HotScalati Bros',     parent_brand: 'HotScalati',  order: 7 },
  { product_id: '2dfcbd00-0e44-4cd1-b80d-b00a33b123c5', display: 'Hot Mama',            parent_brand: 'Hot Mama',    order: 8 },
  { product_id: '2d28e463-5296-4d42-b548-896d18ee906e', display: 'Grabba R Us',         parent_brand: 'Grabba R Us', order: 9 },
];

export const SKU_DISPLAY_NAME: Record<string, string> = Object.fromEntries(
  CANONICAL_TUBE_SKUS.map((s) => [s.product_id, s.display]),
);

export function skuDisplayName(productId: string | null | undefined, fallback?: string | null): string {
  if (productId && SKU_DISPLAY_NAME[productId]) return SKU_DISPLAY_NAME[productId];
  return (fallback?.trim() || 'Unknown SKU');
}

// Canonical parent-brand display names for the Stock chip and footer bar.
// Maps raw store_tube_inventory.brand strings → operator-facing label.
export const BRAND_DISPLAY_MAP: Record<string, string> = {
  gasmask: 'GasMask',
  gasmasktubes: 'GasMask',
  hotscolatti: 'HotScalati',
  hotscalati: 'HotScalati',
  hotmama: 'Hot Mama',
  grabba: 'Grabba R Us',
};

export function brandDisplayName(raw: string | null | undefined): string {
  const key = (raw || '').toLowerCase().replace(/\s+/g, '');
  return BRAND_DISPLAY_MAP[key] || (raw || 'Unknown');
}

// ════════════════════════════════════════════════════════════════════
// BRAND → DEFAULT SKU product_id resolver
// When a writer only knows the brand string (legacy UI, Bland AI parser),
// route the row to the canonical "default" SKU for that parent brand so
// store_tube_inventory.product_id is always populated.
// Default policy:
//   gasmask (bare)     → GasMask Bags (current operator UI label)
//   gasmasktubes       → GasMask Tubes
//   hotscalati family  → HotScalati Mix Pack (entry SKU)
//   hot mama / grabba  → their single SKU
// Specific tube variants (light / dark / bros / redtops) resolve to themselves.
// Specific tube variants (light / dark / bros) resolve to themselves.
// ════════════════════════════════════════════════════════════════════
export const BRAND_TO_DEFAULT_PRODUCT_ID: Record<string, string> = {
  gasmask:              '170adb8f-ac4e-40f4-a283-38730d30c5de', // GasMask Bags (UI label)
  gasmaskbags:          '170adb8f-ac4e-40f4-a283-38730d30c5de', // GasMask Bags
  gasmasktubes:         'dd5e14c0-d6c5-403a-a2d7-504181b0f4ea', // GasMask Tubes
  gasmaskredtops:       'e3eea682-831e-4913-8b0e-563bc1325a1f', // GasMask Redtops
  hotscolatti:          '04336f6d-d69b-4ec8-8571-7088783b31d6', // HotScalati Mix Pack
  hotscalati:           '04336f6d-d69b-4ec8-8571-7088783b31d6', // HotScalati Mix Pack
  hotscalatimixpack:    '04336f6d-d69b-4ec8-8571-7088783b31d6',
  'hotscolatti-dark':   '1c4f112e-97a1-4430-aae0-f1fcc0229a85', // HotScalati Dark
  'hotscolatti-light':  '27e21aec-21a2-4ce7-9515-dbfd618a27c6', // HotScalati Light
  hotscolattidark:      '1c4f112e-97a1-4430-aae0-f1fcc0229a85',
  hotscolattilight:     '27e21aec-21a2-4ce7-9515-dbfd618a27c6',
  hotscalatidark:       '1c4f112e-97a1-4430-aae0-f1fcc0229a85',
  hotscalatilight:      '27e21aec-21a2-4ce7-9515-dbfd618a27c6',
  hotscalatibros:       'fcfe5469-e9d3-40f3-8bf4-a4349086e1c3', // HotScalati Bros
  hotscolattibros:      'fcfe5469-e9d3-40f3-8bf4-a4349086e1c3',
  hotmama:              '2dfcbd00-0e44-4cd1-b80d-b00a33b123c5', // Hot Mama
  grabba:               '2d28e463-5296-4d42-b548-896d18ee906e', // Grabba R Us
  grabbarus:            '2d28e463-5296-4d42-b548-896d18ee906e',
};

export function resolveProductIdForBrand(brand: string | null | undefined): string | null {
  if (!brand) return null;
  // Preserve the original key (with hyphen) for variant lookups, then try collapsed.
  const lower = brand.toLowerCase();
  if (BRAND_TO_DEFAULT_PRODUCT_ID[lower]) return BRAND_TO_DEFAULT_PRODUCT_ID[lower];
  const collapsed = lower.replace(/[\s-]+/g, '');
  return BRAND_TO_DEFAULT_PRODUCT_ID[collapsed] ?? null;
}

export function getSkuStatusIcon(status: SkuStatus): string {
  return status === 'bought' ? '🟢' : status === 'staged' ? '🟡' : '🔴';
}

export function getSkuStatusLabel(status: SkuStatus, inventoryCount?: number): string {
  if (status === 'bought') return 'sold';
  if (status === 'staged') return `stocked: ${inventoryCount ?? 0}`;
  return 'pitch';
}
