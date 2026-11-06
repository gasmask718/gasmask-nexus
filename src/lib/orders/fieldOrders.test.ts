import { describe, it, expect } from 'vitest';
import { boxLabel, brandTotals, isValidQuantity, itemsText } from './fieldOrders';

describe('field order requests', () => {
  it('labels half, one and two boxes', () => {
    expect(itemsText([{ brand_key: 'gasmask_tubes', name: 'GasMask Tubes', quantity: 1 }, { brand_key: 'gasmask_bags', name: 'GasMask Bags', quantity: 0.5 }]))
      .toBe('1 box GasMask Tubes, 1/2 box GasMask Bags');
    expect(boxLabel(2)).toBe('2 boxes');
  });
  it('load sheet totals skip cancelled requests', () => {
    const t = brandTotals([
      { status: 'new', items: [{ brand_key: 'gasmask_tubes', name: 'GasMask Tubes', quantity: 1 }] },
      { status: 'scheduled', items: [{ brand_key: 'gasmask_tubes', name: 'GasMask Tubes', quantity: 0.5 }] },
      { status: 'cancelled', items: [{ brand_key: 'gasmask_tubes', name: 'GasMask Tubes', quantity: 5 }] },
    ]);
    expect(t['GasMask Tubes']).toBe(1.5);
  });
  it('only half-box steps up to 100 are allowed', () => {
    expect(isValidQuantity(0.5)).toBe(true);
    expect(isValidQuantity(0.3)).toBe(false);
    expect(isValidQuantity(101)).toBe(false);
  });
});
