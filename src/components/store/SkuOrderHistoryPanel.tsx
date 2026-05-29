import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Clock, Loader2 } from 'lucide-react';
import { useStoreSkuOrderHistoryWithGaps } from '@/hooks/useStoreSkuOrderHistory';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

interface Props {
  storeId: string;
}

/**
 * Per-SKU last-ordered history. Reads from the canonical attribution stack
 * (live invoice_line_items + historical_invoice_line_repairs) so legacy
 * orders surface with verified tube counts instead of "qty unknown".
 *
 * Works for merged survivors because the underlying query keys on
 * `invoices.store_id` — repointed at merge time.
 */
export function SkuOrderHistoryPanel({ storeId }: Props) {
  const {
    rows,
    isLoading,
    error,
    totalInvoices,
    invoicesWithLineItems,
    invoicesVerified,
    invoicesEstimated,
    invoicesUnattributed,
  } = useStoreSkuOrderHistoryWithGaps(storeId);

  const activeSkuCount = rows.filter((r) => !r.never_ordered && !r.unattributed)
    .length;

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5 text-primary" />
          Last Ordered by SKU
          {!isLoading && (
            <Badge variant="outline" className="ml-auto text-xs font-normal">
              {activeSkuCount} SKU{activeSkuCount === 1 ? '' : 's'}
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
            {rows.map((r) => {
              const liveOnly =
                (r.live_count || 0) > 0 &&
                !(r.verified_count || 0) &&
                !(r.estimated_count || 0);
              return (
                <div
                  key={`${r.brand ?? ''}-${r.sku}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate">{r.sku}</p>
                      {!r.unattributed && !r.never_ordered && !liveOnly && (
                        <>
                          {(r.verified_count || 0) > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0"
                            >
                              verified
                            </Badge>
                          )}
                          {(r.estimated_count || 0) > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0"
                            >
                              estimated
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                    {r.brand && !r.never_ordered && !r.unattributed && (
                      <p className="text-xs text-muted-foreground">{r.brand}</p>
                    )}
                    {r.unattributed && (
                      <p className="text-xs text-muted-foreground">
                        Finalized invoices with no SKU breakdown and no
                        attribution on file
                      </p>
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
                    ) : r.unattributed ? (
                      <Badge
                        variant="outline"
                        className="bg-muted/40 text-muted-foreground border-border/50 text-xs"
                      >
                        {r.order_count} unattributed
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
                          {r.last_ordered_at
                            ? formatDistanceToNowStrict(
                                parseISO(r.last_ordered_at),
                                { addSuffix: true },
                              )
                            : '—'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && !error && totalInvoices > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border/30 leading-relaxed">
            {invoicesWithLineItems} live line-item
            {invoicesWithLineItems === 1 ? '' : 's'} ·{' '}
            <span className="text-emerald-400">
              {invoicesVerified} verified
            </span>{' '}
            ·{' '}
            <span className="text-amber-400">
              {invoicesEstimated} estimated
            </span>{' '}
            ·{' '}
            <span>
              {invoicesUnattributed} unattributed
            </span>{' '}
            of {totalInvoices} invoice{totalInvoices === 1 ? '' : 's'}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
