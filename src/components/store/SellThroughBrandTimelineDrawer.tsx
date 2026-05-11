import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { dynastyDate } from '@/lib/dates';
import { ArrowDown, Calendar, Clock, Package, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useStoreBrandOrderTimeline, type BrandSellThroughSummary } from "@/hooks/useStoreSellThroughIntel";
import { classifySellThroughHealth, getHealthColors } from "@/lib/sellThroughHealth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  brand: BrandSellThroughSummary | null;
}

export function SellThroughBrandTimelineDrawer({ open, onOpenChange, storeId, brand }: Props) {
  const [limit, setLimit] = useState(12);
  const { data: timeline = [], isLoading } = useStoreBrandOrderTimeline(
    open ? storeId : null,
    brand?.brand_name,
    limit
  );

  if (!brand) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {brand.brand_name} — Order Timeline
            {(() => {
              const h = classifySellThroughHealth(brand.days_since_last_order, brand.avg_days_between_orders, brand.total_orders_lifetime);
              const c = getHealthColors(h.status);
              return (
                <Badge variant="outline" className={`text-[10px] ml-1 ${c.bgColor} ${c.color}`}>
                  {h.label}{h.varianceLabel ? ` · ${h.varianceLabel}` : ""}
                </Badge>
              );
            })()}
          </SheetTitle>
          <SheetDescription>
            {brand.total_orders_lifetime} orders · Avg {brand.avg_days_between_orders ?? "—"} days between orders
          </SheetDescription>
        </SheetHeader>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-lg font-bold">{brand.total_orders_lifetime}</div>
            <div className="text-xs text-muted-foreground">Total Orders</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-lg font-bold">${(brand.total_revenue_lifetime || 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Lifetime Rev</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-lg font-bold">{brand.days_since_last_order ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Days Since Last</div>
          </div>
        </div>

        {brand.projected_next_order && (
          <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm text-center">
            <Clock className="h-4 w-4 inline mr-1 text-primary" />
            Expected reorder around:{" "}
            <span className="font-semibold">
              {dynastyDate(brand.projected_next_order)}
            </span>
          </div>
        )}

        <Separator className="my-4" />

        {/* Timeline */}
        <div className="space-y-0">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading timeline…</div>
          ) : timeline.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No orders recorded</div>
          ) : (
            timeline.map((event, idx) => (
              <div key={event.order_id}>
                {/* Order event */}
                <div className="flex items-start gap-3 py-3">
                  <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {dynastyDate(event.order_date)}
                      </span>
                      <span className="text-sm font-semibold">
                        ${(event.total_amount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {event.total_units > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {event.total_units} units
                        </span>
                      )}
                      {event.payment_status && (
                        <Badge
                          variant={event.payment_status === "paid" ? "default" : "secondary"}
                          className="text-[10px] h-4"
                        >
                          {event.payment_status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Gap indicator */}
                {event.days_between_orders != null && event.days_between_orders > 0 && (
                  <div className="flex items-center gap-2 ml-[3px] py-1">
                    <div className="w-0.5 h-6 bg-border mx-auto" />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                      <ArrowDown className="h-3 w-3" />
                      Sold in {event.days_between_orders} days
                    </div>
                  </div>
                )}
                {idx < timeline.length - 1 && event.days_between_orders == null && (
                  <div className="ml-[3px] py-1">
                    <div className="w-0.5 h-4 bg-border mx-auto" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Load more */}
        {timeline.length >= limit && (
          <div className="text-center mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLimit((l) => l + 12)}
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Load more
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
