/**
 * Ambassador Sell-Through Intelligence Page
 * 
 * Read-only analytics surface showing sell-through velocity,
 * order frequency, and brand performance for ONLY the stores
 * each ambassador manages.
 * 
 * Reuses existing views + health classification — zero logic duplication.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import {
  BarChart3, Search, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, TrendingUp, Store, Clock, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { AmbassadorLayout } from "@/components/ambassador/AmbassadorLayout";
import { PortalRBACGate } from "@/components/portal/PortalRBACGate";
import { useAmbassadorSellThrough } from "@/hooks/useAmbassadorSellThrough";
import { classifySellThroughHealth, getHealthColors } from "@/lib/sellThroughHealth";
import { GRABBA_BRAND_IDS, GRABBA_BRAND_CONFIG, type GrabbaBrand } from "@/config/grabbaSkyscraper";
import { OverdueAlertBanner } from "@/components/sell-through/OverdueAlertBanner";
import { BrandHeatmapSummary } from "@/components/sell-through/BrandHeatmapSummary";
import { SellThroughFeedback } from "@/components/sell-through/SellThroughFeedback";
import { useSellThroughAnalyticsEvents } from "@/hooks/useSellThroughAnalyticsEvents";
import type { GlobalSellThroughRow } from "@/hooks/useGlobalSellThroughAnalytics";
import { Skeleton } from "@/components/ui/skeleton";

type SortField = "store_name" | "brand_name" | "total_orders_lifetime" | "avg_days_between_orders" | "days_since_last_order";
type SortDir = "asc" | "desc";

const frequencyColors: Record<string, string> = {
  Fast: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  Medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  Slow: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  New: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
};

function AmbassadorSellThroughContent() {
  const navigate = useNavigate();
  const { data: rows, isLoading, storeCount, ambassadorId } = useAmbassadorSellThrough();
  const { trackViewLoaded, trackFilterUsed, trackRowClicked, trackOverdueViewed } = useSellThroughAnalyticsEvents(ambassadorId);
  const hasTrackedLoad = useRef(false);
  // Filters
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("days_since_last_order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Phase VI-A: Track page load once data resolves
  useEffect(() => {
    if (!isLoading && rows.length > 0 && ambassadorId && !hasTrackedLoad.current) {
      hasTrackedLoad.current = true;
      trackViewLoaded(storeCount, rows.length);
    }
  }, [isLoading, rows.length, ambassadorId, storeCount, trackViewLoaded]);

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDir("asc");
      return field;
    });
    setPage(1);
  }, []);

  const toggleOverdueFilter = useCallback(() => {
    setOverdueOnly((prev) => {
      const next = !prev;
      if (next) trackOverdueViewed();
      return next;
    });
    setPage(1);
  }, [trackOverdueViewed]);

  // KPI summaries
  const kpis = useMemo(() => {
    const total = rows.length;
    const uniqueStores = new Set(rows.map((r) => r.store_id)).size;
    const withData = rows.filter((r) => r.total_orders_lifetime > 1);
    const totalOrders = rows.reduce((s, r) => s + (r.total_orders_lifetime || 0), 0);
    const avgGap = withData.length > 0
      ? Math.round(withData.reduce((s, r) => s + (r.avg_days_between_orders || 0), 0) / withData.length)
      : null;
    const fast = rows.filter((r) => r.order_frequency_class === "Fast").length;
    const medium = rows.filter((r) => r.order_frequency_class === "Medium").length;
    const slow = rows.filter((r) => r.order_frequency_class === "Slow").length;
    const overdue = withData.filter((r) => {
      if (r.avg_days_between_orders == null || r.days_since_last_order == null) return false;
      return r.days_since_last_order > r.avg_days_between_orders * 1.5;
    }).length;

    return { total, uniqueStores, totalOrders, avgGap, fast, medium, slow, overdue };
  }, [rows]);

  // Filtered + sorted data
  const processed = useMemo(() => {
    let result = [...rows];

    if (search) {
      const term = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.store_name?.toLowerCase().includes(term) ||
          r.city?.toLowerCase().includes(term) ||
          r.state?.toLowerCase().includes(term)
      );
    }

    if (brandFilter !== "all") {
      result = result.filter((r) => r.brand_name === brandFilter);
    }

    if (frequencyFilter !== "all") {
      result = result.filter((r) => r.order_frequency_class === frequencyFilter);
    }

    if (overdueOnly) {
      result = result.filter((r) => {
        if (r.total_orders_lifetime < 2) return false;
        if (r.avg_days_between_orders == null || r.days_since_last_order == null) return false;
        return r.days_since_last_order > r.avg_days_between_orders * 1.5;
      });
    }

    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string") { aVal = aVal.toLowerCase(); bVal = (bVal as string).toLowerCase(); }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, search, brandFilter, frequencyFilter, overdueOnly, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const paginated = processed.slice((page - 1) * pageSize, page * pageSize);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="py-12"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Store} label="Stores Managed" value={kpis.uniqueStores.toString()} />
        <KpiCard icon={TrendingUp} label="Total Orders" value={kpis.totalOrders.toLocaleString()} />
        <KpiCard icon={Clock} label="Avg Gap (days)" value={kpis.avgGap != null ? `${kpis.avgGap}d` : "—"} />
        <KpiCard icon={Zap} label="Fast / Slow / Overdue" value={`${kpis.fast} / ${kpis.slow} / ${kpis.overdue}`} />
      </div>

      {/* Overdue Alert Banner */}
      <OverdueAlertBanner
        rows={rows}
        onFilterOverdue={toggleOverdueFilter}
        isFilteringOverdue={overdueOnly}
      />

      {/* Brand Heatmap */}
      <BrandHeatmapSummary rows={rows} />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); trackFilterUsed('search', e.target.value); }}
                className="pl-9"
              />
            </div>
            <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); setPage(1); trackFilterUsed('brand', v); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {GRABBA_BRAND_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {GRABBA_BRAND_CONFIG[id].icon} {GRABBA_BRAND_CONFIG[id].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={frequencyFilter} onValueChange={(v) => { setFrequencyFilter(v); setPage(1); trackFilterUsed('velocity', v); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Velocities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Velocities</SelectItem>
                <SelectItem value="Fast">⚡ Fast</SelectItem>
                <SelectItem value="Medium">🟡 Medium</SelectItem>
                <SelectItem value="Slow">🔴 Slow</SelectItem>
                <SelectItem value="New">🔵 New</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pagination (top, per standard) */}
      <DataTablePagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={processed.length}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        pageSizeOptions={[25, 50, 100]}
      />

      {/* Table */}
      <Card>
        <div className="rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button className="flex items-center text-xs font-medium" onClick={() => toggleSort("store_name")}>
                    Store <SortIcon field="store_name" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center text-xs font-medium" onClick={() => toggleSort("brand_name")}>
                    Brand <SortIcon field="brand_name" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("total_orders_lifetime")}>
                    Orders <SortIcon field="total_orders_lifetime" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("avg_days_between_orders")}>
                    Avg Gap <SortIcon field="avg_days_between_orders" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("days_since_last_order")}>
                    Days Since <SortIcon field="days_since_last_order" />
                  </button>
                </TableHead>
                <TableHead className="text-center hidden md:table-cell">Velocity</TableHead>
                <TableHead className="text-center">Health</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Last Order</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    {rows.length === 0
                      ? "No sell-through data for your stores yet."
                      : "No results found. Adjust your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                 paginated.map((row) => (
                   <SellThroughRow
                     key={`${row.store_id}-${row.brand_name}`}
                     row={row}
                     onNavigate={(path) => {
                       trackRowClicked(row.store_id, row.brand_name);
                       navigate(path);
                     }}
                   />
                 ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Phase VI-B: Qualitative Feedback Capture */}
      <SellThroughFeedback ambassadorId={ambassadorId} />
    </div>
  );
}

/** Individual table row — read-only, click navigates to store profile */
function SellThroughRow({
  row,
  onNavigate,
}: {
  row: GlobalSellThroughRow;
  onNavigate: (path: string) => void;
}) {
  const health = classifySellThroughHealth(
    row.days_since_last_order,
    row.avg_days_between_orders,
    row.total_orders_lifetime
  );
  const healthColors = getHealthColors(health.status);
  const brandConfig = GRABBA_BRAND_CONFIG[row.brand_name as GrabbaBrand];

  return (
    <TableRow
      className="cursor-pointer hover:bg-accent/50"
      onClick={() => onNavigate(`/ambassador/stores/${row.store_id}`)}
    >
      <TableCell className="font-medium max-w-[200px] truncate">
        {row.store_name || "Unknown Store"}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1.5 text-sm">
          {brandConfig && <span>{brandConfig.icon}</span>}
          {brandConfig?.name || row.brand_name}
        </span>
      </TableCell>
      <TableCell className="text-right">{row.total_orders_lifetime}</TableCell>
      <TableCell className="text-right">
        {row.avg_days_between_orders != null ? `${row.avg_days_between_orders}d` : "—"}
      </TableCell>
      <TableCell className="text-right">
        {row.days_since_last_order != null ? (
          <span
            className={
              row.days_since_last_order > 60
                ? "text-destructive font-semibold"
                : row.days_since_last_order > 30
                ? "text-amber-500"
                : ""
            }
          >
            {row.days_since_last_order}d
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-center hidden md:table-cell">
        <Badge variant="outline" className={`text-[10px] ${frequencyColors[row.order_frequency_class] || ""}`}>
          {row.order_frequency_class}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col items-center gap-0.5">
          <Badge variant="outline" className={`text-[10px] ${healthColors.bgColor} ${healthColors.color}`}>
            {health.label}
          </Badge>
          {health.varianceLabel && (
            <span className={`text-[9px] ${healthColors.color}`}>{health.varianceLabel}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right hidden lg:table-cell text-xs text-muted-foreground">
        {row.last_order_date ? format(new Date(row.last_order_date), "MMM d, yyyy") : "—"}
      </TableCell>
      <TableCell>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

/** Simple KPI card with icon */
function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

/** Page wrapper with RBAC gate and ambassador layout */
export default function AmbassadorSellThrough() {
  return (
    <PortalRBACGate allowedRoles={['ambassador']} portalName="Ambassador Portal">
      <AmbassadorLayout
        title="Sell-Through Intelligence"
        subtitle="Order velocity and brand performance across your stores"
      >
        <AmbassadorSellThroughContent />
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
