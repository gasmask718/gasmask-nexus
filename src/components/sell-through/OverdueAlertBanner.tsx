import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GlobalSellThroughRow } from "@/hooks/useGlobalSellThroughAnalytics";
import { GRABBA_BRAND_CONFIG, type GrabbaBrand } from "@/config/grabbaSkyscraper";

interface Props {
  rows: GlobalSellThroughRow[];
  onFilterOverdue: () => void;
  isFilteringOverdue: boolean;
}

interface OverdueItem {
  store_name: string;
  store_id: string;
  brand_name: string;
  days_since_last_order: number;
  avg_days_between_orders: number;
  days_overdue: number;
}

export function OverdueAlertBanner({ rows, onFilterOverdue, isFilteringOverdue }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Find severely overdue: days_since > avg × 2
  const overdueItems: OverdueItem[] = rows
    .filter((r) => {
      if (r.total_orders_lifetime < 2) return false;
      if (r.avg_days_between_orders == null || r.days_since_last_order == null) return false;
      return r.days_since_last_order > r.avg_days_between_orders * 2;
    })
    .map((r) => ({
      store_name: r.store_name,
      store_id: r.store_id,
      brand_name: r.brand_name,
      days_since_last_order: r.days_since_last_order!,
      avg_days_between_orders: r.avg_days_between_orders!,
      days_overdue: Math.round(r.days_since_last_order! - r.avg_days_between_orders!),
    }))
    .sort((a, b) => b.days_overdue - a.days_overdue);

  if (overdueItems.length === 0) return null;

  const displayItems = expanded ? overdueItems : overdueItems.slice(0, 3);

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-semibold text-destructive">
            {overdueItems.length} Severely Overdue
          </span>
          <span className="text-xs text-muted-foreground">
            (2× avg gap exceeded)
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={onFilterOverdue}
          >
            {isFilteringOverdue ? "Clear Filter" : "Show Overdue Only"}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {displayItems.map((item) => {
          const brandConfig = GRABBA_BRAND_CONFIG[item.brand_name as GrabbaBrand];
          return (
            <div
              key={`${item.store_id}-${item.brand_name}`}
              className="flex items-center justify-between text-xs bg-background/50 rounded px-3 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium truncate max-w-[200px]">{item.store_name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {brandConfig?.icon} {brandConfig?.name || item.brand_name}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{item.days_since_last_order}d since last</span>
                <span className="text-destructive font-semibold">+{item.days_overdue}d overdue</span>
                <span>avg {item.avg_days_between_orders}d</span>
              </div>
            </div>
          );
        })}
      </div>

      {overdueItems.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3 mr-1" /> Show Less</>
          ) : (
            <><ChevronDown className="h-3 w-3 mr-1" /> Show All {overdueItems.length}</>
          )}
        </Button>
      )}
    </div>
  );
}
