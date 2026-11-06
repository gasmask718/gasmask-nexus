// Pure helpers for the store-portal "Order for my stores" screen.
import { UNITS_PER_BOX } from '@/lib/storePortal';

export type StoreOrder = { qty: Record<string, number>; note: string; deliverBy: 'asap' | 'scheduled'; date: string };
type Catalog = { product_id: string; name: string; unit_price: number }[];

/** Estimated total at store price; qty is in boxes, pricePerBox keyed by product id. */
export const orderTotal = (o: StoreOrder, pricePerBox: Record<string, number>) =>
  Object.entries(o.qty).reduce((s, [pid, q]) => s + q * (pricePerBox[pid] ?? 0), 0);

/** One entry per store for store_portal_send_order_batch. */
export function buildBatchPayload(storeIds: string[], orderFor: (id: string) => StoreOrder, catalog: Catalog) {
  return storeIds.map((id) => {
    const o = orderFor(id);
    return {
      store_id: id,
      request_type: o.deliverBy,
      requested_date: o.deliverBy === 'scheduled' ? o.date : null,
      time_window: o.deliverBy === 'scheduled' ? 'morning' : null,
      notes: o.note || null,
      items: catalog.filter((c) => o.qty[c.product_id]).map((c) => ({
        product_id: c.product_id, name: c.name, unit: 'box', quantity: o.qty[c.product_id],
        unit_price: Number(c.unit_price) * UNITS_PER_BOX,
      })),
    };
  });
}
