import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { skuDisplayName } from '@/lib/inventory/skuDisplay';

export interface RecentInvoiceRow {
  id: string;
  invoice_number: string | null;
  brand: string | null; // primary SKU label derived from line items (largest tube share)
  total: number;
  tubes: number;
  boxes: number;
  created_at: string;
  payment_status: string | null;
  status: string | null;
  paid_at: string | null;
  partial_amount: number | null;
  amount_paid: number | null;
}

export interface UseStoreRecentInvoicesOptions {
  /** Restrict to open invoices (payment_status IN ('unpaid','partial')) and drop the row cap. */
  openOnly?: boolean;
}

export function useStoreRecentInvoices(
  storeId: string | null | undefined,
  limit: number = 5,
  options: UseStoreRecentInvoicesOptions = {},
) {
  const openOnly = !!options.openOnly;
  return useQuery({
    queryKey: ['store-recent-invoices-sku', storeId, limit, openOnly ? 'open' : 'all'],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<RecentInvoiceRow[]> => {
      if (!storeId) return [];

      let q = supabase
        .from('invoices')
        .select('id, invoice_number, total, created_at, payment_status, status, paid_at, partial_amount, amount_paid')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (openOnly) {
        // Server-side filter — only finalized/open invoices belong in Resolve Payment.
        // Draft/draft_ai/null-status legacy order shells are excluded.
        q = q.eq('status', 'finalized').in('payment_status', ['unpaid', 'partial']).gt('total', 0);
      } else {
        q = q.limit(limit);
      }

      const { data: invoices, error } = await q;
      if (error) throw error;
      if (!invoices?.length) return [];

      const openInvoices = openOnly
        ? invoices.filter((i: any) => {
            const total = Number(i.total ?? 0);
            const paid = Number(i.amount_paid ?? i.partial_amount ?? 0);
            return i.status === 'finalized'
              && ['unpaid', 'partial'].includes(i.payment_status ?? '')
              && Math.max(total - paid, 0) > 0;
          })
        : invoices;
      if (!openInvoices.length) return [];

      const invoiceIds = openInvoices.map((i) => i.id);
      const { data: lineItems, error: liErr } = await supabase
        .from('invoice_line_items')
        .select('invoice_id, product_id, product_name, product_name_snapshot, computed_tubes_total')
        .is('deleted_at', null)
        .in('invoice_id', invoiceIds);
      if (liErr) throw liErr;

      const tubesByInvoice = new Map<string, number>();
      const skuTubesByInvoice = new Map<string, Map<string, number>>();
      lineItems?.forEach((li) => {
        const id = li.invoice_id as string;
        const tubes = Number(li.computed_tubes_total ?? 0);
        tubesByInvoice.set(id, (tubesByInvoice.get(id) ?? 0) + tubes);
        const skuLabel = skuDisplayName(li.product_id, li.product_name_snapshot ?? li.product_name);
        const inner = skuTubesByInvoice.get(id) ?? new Map<string, number>();
        inner.set(skuLabel, (inner.get(skuLabel) ?? 0) + tubes);
        skuTubesByInvoice.set(id, inner);
      });

      return openInvoices.map((i) => {
        const tubes = tubesByInvoice.get(i.id) ?? 0;
        const skuMap = skuTubesByInvoice.get(i.id);
        let topSku: string | null = null;
        if (skuMap && skuMap.size) {
          const sorted = Array.from(skuMap.entries()).sort((a, b) => b[1] - a[1]);
          topSku = sorted[0][0];
          if (skuMap.size > 1) topSku = `${topSku} +${skuMap.size - 1}`;
        }
        return {
          id: i.id,
          invoice_number: i.invoice_number,
          brand: topSku,
          total: Number(i.total ?? 0),
          tubes,
          boxes: Math.round(tubes / 100),
          created_at: i.created_at,
          payment_status: (i as any).payment_status ?? null,
          status: (i as any).status ?? null,
          paid_at: (i as any).paid_at ?? null,
          partial_amount: (i as any).partial_amount != null ? Number((i as any).partial_amount) : null,
          amount_paid: (i as any).amount_paid != null ? Number((i as any).amount_paid) : null,
        };
      });
    },
  });
}
