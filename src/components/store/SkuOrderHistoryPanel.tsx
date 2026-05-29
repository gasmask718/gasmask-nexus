import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Clock, Loader2 } from 'lucide-react';
import { useStoreSkuOrderHistoryWithGaps } from '@/hooks/useStoreSkuOrderHistory';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

interface Props {
  storeId: string;
}

/**
 * Per-SKU last-ordered history. Complements the brand-level
 * LastOrderSnapshotPanel by drilling down to individual SKUs.
 *
 * Works correctly for merged survivors because the underlying query keys on
 * `invoices.store_id` — which the merge engine repoints to the survivor.
 */
export function SkuOrderHistoryPanel({ storeId }: Props) {
  const { rows, isLoading, error, totalInvoices, invoicesWithLineItems } =
    useStoreSkuOrderHistoryWithGaps(storeId);

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5 text-primary" />
          Last Ordered by SKU
          {!isLoading && (
            <Badge variant="outline" className="ml-auto text-xs font-normal">
              {rows.filter((r) => !r.never_ordered).length} SKU
              {rows.filter((r) => !r.never_ordered).length === 1 ? '' : 's'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading SKU history…
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">
            Failed to load SKU history: {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No SKU activity on file for this store.
          </p>
        )}
        {!isLoading && rows.length > 0 && (
          <div className="divide-y divide-border/40">
            {rows.map((r) => (
              <div
                key={`${r.brand ?? ''}-${r.sku}`}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.sku}</p>
                  {r.brand && !r.never_ordered && (
                    <p className="text-xs text-muted-foreground">{r.brand}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.never_ordered ? (
                    <Badge
                      variant="outline"
                      className="bg-red-500/10 text-red-400 border-red-500/30 text-xs"
                    >
                      Never ordered
                    </Badge>
                  ) : (
                    <>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {r.last_qty} {r.last_qty === 1 ? 'unit' : 'units'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.order_count}× lifetime ({r.lifetime_qty})
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNowStrict(parseISO(r.last_ordered_at), {
                          addSuffix: true,
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && !error && totalInvoices > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border/30">
            Showing SKU detail for {invoicesWithLineItems} of {totalInvoices}{' '}
            invoice{totalInvoices === 1 ? '' : 's'}.
            {totalInvoices - invoicesWithLineItems > 0 && (
              <span>
                {' '}
                {totalInvoices - invoicesWithLineItems} legacy invoice
                {totalInvoices - invoicesWithLineItems === 1 ? '' : 's'} recorded
                as totals only (no SKU breakdown).
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
