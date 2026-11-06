export type BrandKey = 'gasmask_tubes' | 'gasmask_bags' | 'hotmama' | 'hotscolatti' | 'grabba_r_us';

export const BRAND_ROWS: { key: BrandKey; label: string; match: (name: string) => boolean }[] = [
  { key: 'gasmask_tubes', label: 'GasMask Tubes', match: n => /^gasmask tubes$/i.test(n.trim()) },
  { key: 'gasmask_bags', label: 'GasMask Bags', match: n => /^gasmask bags$/i.test(n.trim()) },
  { key: 'hotmama', label: 'Hot Mama', match: n => /^hot\s?mama/i.test(n.trim()) },
  { key: 'hotscolatti', label: 'Hotscolatti', match: n => /^hotscolatti/i.test(n.trim()) },
  { key: 'grabba_r_us', label: 'Grabba R Us', match: n => /^grabba r us$/i.test(n.trim()) },
];

export interface OrderItem { brand_key: BrandKey; product_id?: string | null; name: string; quantity: number; store_price?: number | null }

/** "1/2 box", "1 box", "2 boxes" */
export function boxLabel(q: number): string {
  if (q === 0.5) return '1/2 box';
  if (q === 1) return '1 box';
  return `${Number.isInteger(q) ? q : q.toFixed(1)} boxes`;
}

export function itemsText(items: OrderItem[]): string {
  return items.map(i => `${boxLabel(Number(i.quantity))} ${i.name}`).join(', ');
}

/** Load-sheet totals: boxes per product name across requests (cancelled excluded). */
export function brandTotals(requests: { status: string; items: OrderItem[] }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of requests) {
    if (r.status === 'cancelled') continue;
    for (const i of r.items || []) out[i.name] = (out[i.name] || 0) + Number(i.quantity || 0);
  }
  return out;
}

export function isValidQuantity(q: number): boolean {
  return Number.isFinite(q) && q > 0 && q <= 100 && Math.round(q * 2) === q * 2;
}
