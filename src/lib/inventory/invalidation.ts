import type { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate every cache key that depends on a store's tube inventory or sales aggregates.
 * Call after any write to inventory/invoices so all hero chips and brand bars repaint.
 */
export function invalidateStoreInventoryQueries(qc: QueryClient, storeId: string) {
  qc.invalidateQueries({ queryKey: ['store-tube-inventory', storeId] });
  qc.invalidateQueries({ queryKey: ['store-tube-kpi', storeId] });
  qc.invalidateQueries({ queryKey: ['store-tube-summary', storeId] });
  qc.invalidateQueries({ queryKey: ['store-tube-brands-kpi', storeId] });
  qc.invalidateQueries({ queryKey: ['store-inventory-by-brand', storeId] });
  qc.invalidateQueries({ queryKey: ['store-tube-kpi-batch'] });
  qc.invalidateQueries({ queryKey: ['store-lifetime-by-brand', storeId] });
  qc.invalidateQueries({ queryKey: ['store-lifetime-by-sku', storeId] });
  qc.invalidateQueries({ queryKey: ['store-sold-by-brand-window', storeId] });
  qc.invalidateQueries({ queryKey: ['store-sold-by-sku-window', storeId] });
  qc.invalidateQueries({ queryKey: ['store-recent-invoices', storeId] });
  qc.invalidateQueries({ queryKey: ['store-recent-invoices-sku', storeId] });
  qc.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
}
