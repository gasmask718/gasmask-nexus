import { describe, it, expect } from 'vitest';
import { orderTotal, buildBatchPayload, type StoreOrder } from '@/lib/multiStoreOrder';

const catalog = [{ product_id: 'p1', name: 'GasMask Tubes', unit_price: 2 }, { product_id: 'p2', name: 'Hot Mama', unit_price: 1.5 }];
const o: StoreOrder = { qty: { p1: 0.5, p2: 2 }, note: 'side door', deliverBy: 'asap', date: '2026-11-07' };

describe('multi-store order', () => {
  it('estimates total at store price per box (100 units)', () => {
    expect(orderTotal(o, { p1: 200, p2: 150 })).toBe(400);
  });
  it('same order for all checked stores makes one entry per store', () => {
    const p = buildBatchPayload(['a', 'b', 'c'], () => o, catalog);
    expect(p.map((x) => x.store_id)).toEqual(['a', 'b', 'c']);
    expect(p[2].items).toEqual([
      { product_id: 'p1', name: 'GasMask Tubes', unit: 'box', quantity: 0.5, unit_price: 200 },
      { product_id: 'p2', name: 'Hot Mama', unit: 'box', quantity: 2, unit_price: 150 },
    ]);
  });
});
