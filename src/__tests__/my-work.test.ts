import { describe, expect, it } from 'vitest';
import { rangeDates, todayLine } from '@/lib/myWork';

describe('My Work', () => {
  it('writes the plain today summary', () => {
    expect(todayLine({ stores_visited: 14, orders: 6, money: 300, new_stores: 3, counts: 0, contacts: 0, notes: 0 }))
      .toBe('Today: 14 stores, 6 orders, $300 collected, 3 new stores.');
  });
  it('uses New York days for "today" and a 7-day week', () => {
    const base = new Date('2026-11-06T03:00:00Z'); // still Nov 5 in New York
    expect(rangeDates('today', { from: '', to: '' }, base)).toEqual({ from: '2026-11-05', to: '2026-11-05' });
    expect(rangeDates('week', { from: '', to: '' }, base)).toEqual({ from: '2026-10-30', to: '2026-11-05' });
  });
});
