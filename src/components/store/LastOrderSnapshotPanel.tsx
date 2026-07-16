/**
 * LastOrderSnapshotPanel — Shows the PRODUCT line items of the store's most
 * recent invoice (from invoices + invoice_line_items). Replaces the previous
 * 4-brand rollup so operators see exactly what was on the last order.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { skuDisplayName } from '@/lib/inventory/skuDisplay';
import { dynastyDate } from '@/lib/dates';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  storeId: string;
}

interface LastOrderLine {
  product_id: string | null;
  display: string;
  quantity: number;
  unit_label: string; // 'bags' or 'tubes' (based on products.track_by / unit_type)
  computed_tubes_total: number;
  line_total: number;
  unit_price: number;
}

interface LastOrderResult {
  invoice_id: string;
  invoice_number: string | null;
  created_at: string;
  total: number;
  payment_status: string | null;
  lines: LastOrderLine[];
}

function useLastOrderLineItems(storeId: string) {
  return useQuery({
    queryKey: ['store-last-order-line-items', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<LastOrderResult | null> => {
      const { data: inv, error: iErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, created_at, payment_status')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (iErr) throw iErr;
      if (!inv) return null;

      const { data: lines, error: lErr } = await supabase
        .from('invoice_line_items')
        .select('product_id, product_name, product_name_snapshot, quantity, unit_price, total, computed_tubes_total')
        .eq('invoice_id', inv.id);
      if (lErr) throw lErr;

      // Resolve unit label per product from products table
      const productIds = Array.from(new Set((lines || []).map((l) => l.product_id).filter(Boolean))) as string[];
      const unitLabelById = new Map<string, string>();
      if (productIds.length) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, track_by, unit_type')
          .in('id', productIds);
        prods?.forEach((p: any) => {
          const t = (p.track_by || p.unit_type || 'tubes').toString().toLowerCase();
          unitLabelById.set(p.id, t.startsWith('bag') ? 'bags' : 'tubes');
        });
      }

      return {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        created_at: inv.created_at,
        total: Number(inv.total ?? 0),
        payment_status: (inv as any).payment_status ?? null,
        lines: (lines || []).map((l) => ({
          product_id: l.product_id,
          display: skuDisplayName(l.product_id, l.product_name_snapshot ?? l.product_name),
          quantity: Number(l.quantity ?? 0),
          unit_label: (l.product_id && unitLabelById.get(l.product_id)) || 'tubes',
          computed_tubes_total: Number(l.computed_tubes_total ?? 0),
          line_total: Number(l.total ?? 0),
          unit_price: Number(l.unit_price ?? 0),
        })),
      };
    },
  });
}

export function LastOrderSnapshotPanel({ storeId }: Props) {
  const { data, isLoading } = useLastOrderLineItems(storeId);

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Last Order
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No order history found for this store.</p>
        </CardContent>
      </Card>
    );
  }

  const status = (data.payment_status || 'unknown').toLowerCase();
  const statusClass =
    status === 'paid'
      ? 'border-emerald-500/40 text-emerald-600'
      : status === 'partial'
      ? 'border-amber-500/40 text-amber-600'
      : status === 'unpaid'
      ? 'border-red-500/40 text-red-600'
      : 'border-muted-foreground/30 text-muted-foreground';

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Last Order · Line Items
          <Badge variant="outline" className={`text-xs ml-auto ${statusClass}`}>{status}</Badge>
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <span className="font-mono">{data.invoice_number || data.invoice_id.slice(0, 8)}</span>
          <span>·</span>
          <span>{dynastyDate(data.created_at)}</span>
          <span className="text-[10px]">({formatDistanceToNow(new Date(data.created_at), { addSuffix: true })})</span>
          <span className="ml-auto font-semibold text-foreground">${data.total.toFixed(2)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.lines.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">No line items on this invoice</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {data.lines.map((l, idx) => {
              const boxes = Math.floor(l.computed_tubes_total / 100);
              const loose = l.computed_tubes_total % 100;
              return (
                <li key={idx} className="flex items-center gap-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.display}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {l.quantity} {l.unit_label}
                      {l.unit_label === 'tubes' && l.computed_tubes_total >= 50 && (
                        <>
                          {' · '}
                          {boxes > 0 && `${boxes} box${boxes !== 1 ? 'es' : ''}`}
                          {boxes > 0 && loose > 0 && ' + '}
                          {loose > 0 && `${loose} loose`}
                        </>
                      )}
                      {' · '}${l.unit_price.toFixed(2)}/{l.unit_label === 'bags' ? 'bag' : 'tube'}
                    </p>
                  </div>
                  <div className="font-mono text-sm font-semibold">${l.line_total.toFixed(2)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
