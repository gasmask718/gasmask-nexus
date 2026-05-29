// ═══════════════════════════════════════════════════════════════════════════════
// FORMAT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format a number as currency (USD)
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format a percentage
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Render "Product Name — $X.XX" using the default store-price tier.
 * Price is joined at RENDER time (never stored in product.name).
 * Pass a different tier (wholesale/street) when a surface needs it.
 */
export function nameWithPrice(
  name: string | null | undefined,
  price: number | null | undefined,
): string {
  const n = (name ?? '').trim() || 'Unknown';
  if (price === null || price === undefined) return n;
  return `${n} — ${formatCurrency(price)}`;
}
