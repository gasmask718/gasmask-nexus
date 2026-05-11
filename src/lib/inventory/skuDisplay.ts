// ════════════════════════════════════════════════════════════════════
// SKU DISPLAY MAP — canonical operator-facing names for the 9 active
// product SKUs. Keyed by products.id (UUID). Drives chip expansions
// (Lifetime, Prior Month, Last 30d) on the store master profile.
//
// Owner-approved labels (Roso deferred — Mix Pack stays as-is for now).
// ════════════════════════════════════════════════════════════════════

export const SKU_DISPLAY_NAME: Record<string, string> = {
  '170adb8f-ac4e-40f4-a283-38730d30c5de': 'GasMask Bags',
  'e3eea682-831e-4913-8b0e-563bc1325a1f': 'GasMask Redtops',
  'dd5e14c0-d6c5-403a-a2d7-504181b0f4ea': 'GasMask Tubes',
  '2d28e463-5296-4d42-b548-896d18ee906e': 'Grabba R Us',
  '2dfcbd00-0e44-4cd1-b80d-b00a33b123c5': 'Hot Mama',
  'fcfe5469-e9d3-40f3-8bf4-a4349086e1c3': 'HotScalati Bros',
  '27e21aec-21a2-4ce7-9515-dbfd618a27c6': 'HotScalati Light',
  '04336f6d-d69b-4ec8-8571-7088783b31d6': 'HotScalati Mix Pack',
  '1c4f112e-97a1-4430-aae0-f1fcc0229a85': 'HotScalati Dark',
};

export function skuDisplayName(productId: string | null | undefined, fallback?: string | null): string {
  if (productId && SKU_DISPLAY_NAME[productId]) return SKU_DISPLAY_NAME[productId];
  return (fallback?.trim() || 'Unknown SKU');
}
