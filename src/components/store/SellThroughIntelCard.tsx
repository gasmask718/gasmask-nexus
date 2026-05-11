import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, formatDistanceToNow } from "date-fns";
import { dynastyDate } from '@/lib/dates';
import {
  TrendingUp,
  Package,
  DollarSign,
  Calendar,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import {
  useStoreSellThroughSummary,
  useStoreSellThroughTotals,
  type BrandSellThroughSummary,
} from "@/hooks/useStoreSellThroughIntel";
import { SellThroughBrandTimelineDrawer } from "./SellThroughBrandTimelineDrawer";
import { classifySellThroughHealth, getHealthColors } from "@/lib/sellThroughHealth";
import { GRABBA_BRAND_IDS, GRABBA_BRAND_CONFIG, type GrabbaBrand } from "@/config/grabbaSkyscraper";

interface Props {
  storeId: string;
}

const frequencyColors: Record<string, string> = {
  Fast: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  Medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  Slow: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  New: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
};

/** Build an empty-state placeholder for a brand with no orders */
function emptyBrandRow(storeId: string, brandId: string): BrandSellThroughSummary {
  return {
    store_id: storeId,
    brand_name: brandId,
    total_orders_lifetime: 0,
    total_units_lifetime: 0,
    total_tubes_lifetime: 0,
    total_revenue_lifetime: 0,
    first_order_date: null,
    last_order_date: null,
    days_since_last_order: null,
    avg_days_between_orders: null,
    min_days_between: null,
    max_days_between: null,
    orders_last_30d: 0,
    orders_last_90d: 0,
    revenue_last_30d: null,
    revenue_last_90d: null,
    revenue_per_day: null,
    order_frequency_class: "New",
    projected_next_order: null,
  };
}

function getBrandDisplayName(brandId: string): string {
  const config = GRABBA_BRAND_CONFIG[brandId as GrabbaBrand];
  return config?.name || brandId;
}

export function SellThroughIntelCard({ storeId }: Props) {
  const { data: summaries = [], isLoading, dataUpdatedAt } = useStoreSellThroughSummary(storeId);
  const totals = useStoreSellThroughTotals(summaries);
  const [selectedBrand, setSelectedBrand] = useState<BrandSellThroughSummary | null>(null);

  // Enumerate all 4 canonical brands, merging DB data where it exists
  const allBrandRows = useMemo(() => {
    const dataByBrand = new Map(summaries.map((s) => [s.brand_name, s]));

    return GRABBA_BRAND_IDS.map((brandId) => {
      const existing = dataByBrand.get(brandId);
      return {
        data: existing || emptyBrandRow(storeId, brandId),
        hasData: !!existing,
        displayName: getBrandDisplayName(brandId),
      };
    });
  }, [summaries, storeId]);

  const hasAnyData = allBrandRows.some((b) => b.hasData);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Sell-Through Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground animate-pulse">
            Loading intelligence…
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Sell-Through Intelligence
            </CardTitle>
            {dataUpdatedAt > 0 && (
              <span className="text-[10px] text-muted-foreground">
                Updated {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* KPI Strip — only when data exists */}
          {hasAnyData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiTile
                icon={<Package className="h-5 w-5 text-primary" />}
                label="Total Orders"
                value={totals.totalOrders.toString()}
              />
              <KpiTile
                icon={<DollarSign className="h-5 w-5 text-primary" />}
                label="Lifetime Revenue"
                value={`$${totals.totalRevenue.toLocaleString()}`}
              />
              <KpiTile
                icon={<Calendar className="h-5 w-5 text-primary" />}
                label="Last Order"
                value={
                  totals.lastOrderDate
                    ? dynastyDate(totals.lastOrderDate)
                    : "—"
                }
              />
              <KpiTile
                icon={<TrendingUp className="h-5 w-5 text-primary" />}
                label="Avg Days Between"
                value={totals.avgDaysBetween != null ? `${totals.avgDaysBetween}d` : "—"}
              />
            </div>
          )}

          {/* Per-Brand Table — ALL 4 brands always shown */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Revenue</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Last Order</TableHead>
                  <TableHead className="text-right">Days Since</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Avg Gap</TableHead>
                  <TableHead className="text-center">Velocity</TableHead>
                  <TableHead className="text-center">Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allBrandRows.map(({ data: brand, hasData, displayName }) => {
                  const health = classifySellThroughHealth(
                    brand.days_since_last_order,
                    brand.avg_days_between_orders,
                    brand.total_orders_lifetime
                  );
                  const healthColors = getHealthColors(health.status);
                  const brandConfig = GRABBA_BRAND_CONFIG[brand.brand_name as GrabbaBrand];

                  return (
                    <TableRow
                      key={brand.brand_name}
                      className={`transition-colors ${
                        hasData
                          ? "cursor-pointer hover:bg-accent/50"
                          : "opacity-50"
                      }`}
                      onClick={() => hasData && setSelectedBrand(brand)}
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          {brandConfig && (
                            <span className="text-sm">{brandConfig.icon}</span>
                          )}
                          {displayName}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {hasData ? brand.total_orders_lifetime : "—"}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {hasData
                          ? `$${(brand.total_revenue_lifetime || 0).toLocaleString()}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {brand.last_order_date
                          ? dynastyDate(brand.last_order_date)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {brand.days_since_last_order != null ? (
                          <span
                            className={
                              brand.days_since_last_order > 60
                                ? "text-destructive font-semibold"
                                : brand.days_since_last_order > 30
                                ? "text-amber-500"
                                : ""
                            }
                          >
                            {brand.days_since_last_order}d
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {brand.avg_days_between_orders != null
                          ? `${brand.avg_days_between_orders}d`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasData ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${frequencyColors[brand.order_frequency_class] || ""}`}
                          >
                            {brand.order_frequency_class}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No data</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasData ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${healthColors.bgColor} ${healthColors.color}`}
                            >
                              {health.label}
                            </Badge>
                            {health.varianceLabel && (
                              <span className={`text-[9px] ${healthColors.color}`}>
                                {health.varianceLabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Warning for missing line-item data */}
          {summaries.some((b) => b.total_units_lifetime === 0 && b.total_tubes_lifetime === 0) && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
              <span>
                Unit/tube counts are not available for some brands. Revenue-based analytics are
                fully operational.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline Drawer */}
      <SellThroughBrandTimelineDrawer
        open={selectedBrand !== null}
        onOpenChange={(open) => !open && setSelectedBrand(null)}
        storeId={storeId}
        brand={selectedBrand}
      />
    </>
  );
}

function KpiTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <div className="text-lg font-bold leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
