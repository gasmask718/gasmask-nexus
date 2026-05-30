import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import { ExportButton } from "@/components/crud/ExportButton";
import { RouteAssignmentDialog } from "@/components/delivery/RouteAssignmentDialog";
import {
  BarChart3, Search, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Route as RouteIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useGlobalSellThroughAnalytics, type GlobalSellThroughRow } from "@/hooks/useGlobalSellThroughAnalytics";
import { useInactiveStores } from "@/hooks/useInactiveStores";
import { classifySellThroughHealth, getHealthColors } from "@/lib/sellThroughHealth";
import { GRABBA_BRAND_IDS, GRABBA_BRAND_CONFIG, type GrabbaBrand } from "@/config/grabbaSkyscraper";
import { OverdueAlertBanner } from "@/components/sell-through/OverdueAlertBanner";
import { BrandHeatmapSummary } from "@/components/sell-through/BrandHeatmapSummary";

type SortField = "store_name" | "brand_name" | "total_orders_lifetime" | "avg_days_between_orders" | "days_since_last_order" | "total_revenue_lifetime";
type SortDir = "asc" | "desc";

const frequencyColors: Record<string, string> = {
  Fast: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  Medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  Slow: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  New: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
};

export default function SellThroughAnalytics() {
  const navigate = useNavigate();
  const { data: activeRows = [], isLoading } = useGlobalSellThroughAnalytics();

  // Inactive stores toggle
  const [showInactive, setShowInactive] = useState(false);
  const activeStoreIds = useMemo(() => new Set(activeRows.map((r) => r.store_id)), [activeRows]);
  const { data: inactiveRows = [] } = useInactiveStores(activeStoreIds, showInactive);

  // Merge active + optional inactive rows
  const allRows = useMemo(() => {
    if (!showInactive) return activeRows;
    return [...activeRows, ...inactiveRows];
  }, [activeRows, inactiveRows, showInactive]);

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

  // Dispatch selection
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [dispatchStores, setDispatchStores] = useState<string[] | null>(null);

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
    setOverdueOnly((prev) => !prev);
    setPage(1);
  }, []);

  // Filtered + sorted data
  const processed = useMemo(() => {
    let result = [...allRows];

    // Search
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.store_name?.toLowerCase().includes(term) ||
          r.city?.toLowerCase().includes(term) ||
          r.state?.toLowerCase().includes(term)
      );
    }

    // Brand filter
    if (brandFilter !== "all") {
      result = result.filter((r) => r.brand_name === brandFilter);
    }

    // Frequency filter
    if (frequencyFilter !== "all") {
      result = result.filter((r) => r.order_frequency_class === frequencyFilter);
    }

    // Overdue-only filter
    if (overdueOnly) {
      result = result.filter((r) => {
        if (r.total_orders_lifetime < 2) return false;
        if (r.avg_days_between_orders == null || r.days_since_last_order == null) return false;
        return r.days_since_last_order > r.avg_days_between_orders * 1.5;
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [allRows, search, brandFilter, frequencyFilter, overdueOnly, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const paginated = processed.slice((page - 1) * pageSize, page * pageSize);

  // KPI summaries (from full active dataset for accuracy)
  const kpis = useMemo(() => {
    const base = showInactive ? allRows : activeRows;
    const total = base.length;
    const withData = base.filter((r) => r.total_orders_lifetime > 1);
    const overdue = withData.filter((r) => {
      if (r.avg_days_between_orders == null || r.days_since_last_order == null) return false;
      return r.days_since_last_order > r.avg_days_between_orders * 1.5;
    }).length;
    const fast = base.filter((r) => r.order_frequency_class === "Fast").length;
    const avgGap = withData.length > 0
      ? Math.round(
          withData.reduce((s, r) => s + (r.avg_days_between_orders || 0), 0) / withData.length
        )
      : null;
    const inactive = showInactive ? inactiveRows.length / Math.max(GRABBA_BRAND_IDS.length, 1) : 0;

    return { total, overdue, fast, avgGap, inactive: Math.round(inactive) };
  }, [activeRows, allRows, inactiveRows, showInactive]);

  // Unique overdue store IDs for bulk dispatch
  const overdueStoreIds = useMemo(() => {
    const base = showInactive ? allRows : activeRows;
    const withData = base.filter((r) => r.total_orders_lifetime > 1);
    const ids = new Set<string>();
    withData.forEach((r) => {
      if (r.avg_days_between_orders != null && r.days_since_last_order != null) {
        if (r.days_since_last_order > r.avg_days_between_orders * 1.5) {
          ids.add(r.store_id);
        }
      }
    });
    return Array.from(ids);
  }, [activeRows, allRows, showInactive]);

  // Export columns
  const exportColumns = [
    { key: "store_name", label: "Store Name" },
    { key: "brand_name", label: "Brand" },
    { key: "total_orders_lifetime", label: "Total Orders" },
    { key: "total_revenue_lifetime", label: "Lifetime Revenue" },
    { key: "avg_days_between_orders", label: "Avg Days Between Orders" },
    { key: "days_since_last_order", label: "Days Since Last Order" },
    { key: "order_frequency_class", label: "Frequency Class" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "first_order_date", label: "First Order Date" },
    { key: "last_order_date", label: "Last Order Date" },
    { key: "orders_last_30d", label: "Orders Last 30d" },
    { key: "orders_last_90d", label: "Orders Last 90d" },
  ];

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Sell-Through Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Portfolio-level sell-through velocity across all stores and brands
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={selectedStoreIds.length === 0}
            onClick={() => setDispatchStores(selectedStoreIds)}
          >
            <RouteIcon className="h-4 w-4 mr-2" />
            Dispatch Selected{selectedStoreIds.length > 0 ? ` (${selectedStoreIds.length})` : ''}
          </Button>
          {overdueStoreIds.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setDispatchStores(overdueStoreIds)}
            >
              <RouteIcon className="h-4 w-4 mr-2" />
              Dispatch Severely Overdue ({overdueStoreIds.length})
            </Button>
          )}
          <ExportButton
            data={processed as unknown as Record<string, unknown>[]}
            filename="sell-through-analytics"
            columns={exportColumns}
            disabled={processed.length === 0}
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Store × Brand Pairs" value={kpis.total.toString()} />
        <KpiCard
          label="Overdue"
          value={kpis.overdue.toString()}
          className={kpis.overdue > 0 ? "border-destructive/30" : ""}
          valueClassName={kpis.overdue > 0 ? "text-destructive" : ""}
        />
        <KpiCard label="Fast Movers" value={kpis.fast.toString()} />
        <KpiCard label="Avg Gap (days)" value={kpis.avgGap != null ? `${kpis.avgGap}d` : "—"} />
      </div>

      {/* Overdue Alert Banner */}
      <OverdueAlertBanner
        rows={activeRows}
        onFilterOverdue={toggleOverdueFilter}
        isFilteringOverdue={overdueOnly}
      />

      {/* Brand Heatmap */}
      <BrandHeatmapSummary rows={allRows} />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); setPage(1); }}>
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
            <Select value={frequencyFilter} onValueChange={(v) => { setFrequencyFilter(v); setPage(1); }}>
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
            <div className="flex items-center gap-2">
              <Switch
                checked={showInactive}
                onCheckedChange={(checked) => { setShowInactive(checked); setPage(1); }}
                id="show-inactive"
              />
              <label htmlFor="show-inactive" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                Show Inactive
              </label>
            </div>
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
        pageSizeOptions={[25, 50, 100, 250]}
      />

      {/* Table */}
      <Card>
        <div className="rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={paginated.length > 0 && paginated.every((r) => selectedStoreIds.includes(r.store_id))}
                    onCheckedChange={(checked) => {
                      const pageIds = paginated.map((r) => r.store_id);
                      setSelectedStoreIds((prev) => {
                        const rest = prev.filter((id) => !pageIds.includes(id));
                        return checked ? Array.from(new Set([...rest, ...pageIds])) : rest;
                      });
                    }}
                    aria-label="Select all on page"
                  />
                </TableHead>
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
                <TableHead className="text-right hidden md:table-cell">
                  <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("total_revenue_lifetime")}>
                    Revenue <SortIcon field="total_revenue_lifetime" />
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground animate-pulse">
                    Loading sell-through analytics…
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    No results found. Adjust your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((row) => (
                  <SellThroughRow
                    key={`${row.store_id}-${row.brand_name}`}
                    row={row}
                    onNavigate={navigate}
                    isInactive={row.total_orders_lifetime === 0 && showInactive}
                    isSelected={selectedStoreIds.includes(row.store_id)}
                    onToggleSelect={() => {
                      setSelectedStoreIds((prev) =>
                        prev.includes(row.store_id)
                          ? prev.filter((id) => id !== row.store_id)
                          : [...prev, row.store_id]
                      );
                    }}
                    onDispatch={(storeId) => setDispatchStores([storeId])}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dispatch — reuses working RouteAssignmentDialog with empty assignee so picker opens */}
      {dispatchStores && (
        <RouteAssignmentDialog
          open={!!dispatchStores}
          onOpenChange={(open) => {
            if (!open) {
              setDispatchStores(null);
              setSelectedStoreIds([]);
            }
          }}
          assigneeId=""
          assigneeName=""
          assigneeType="driver"
          assigneeUserId={null}
          bulkMode={dispatchStores.length > 1}
          preselectedStores={dispatchStores}
        />
      )}
    </div>
  );
}

function SellThroughRow({
  row,
  onNavigate,
  isInactive,
}: {
  row: GlobalSellThroughRow;
  onNavigate: (path: string) => void;
  isInactive?: boolean;
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
      className={`cursor-pointer hover:bg-accent/50 ${isInactive ? "opacity-50" : ""}`}
      onClick={() => onNavigate(`/stores/${row.store_id}`)}
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
      <TableCell className="text-right hidden md:table-cell">
        ${(row.total_revenue_lifetime || 0).toLocaleString()}
      </TableCell>
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
        {isInactive ? (
          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
            Inactive
          </Badge>
        ) : (
          <Badge variant="outline" className={`text-[10px] ${frequencyColors[row.order_frequency_class] || ""}`}>
            {row.order_frequency_class}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-center">
        {isInactive ? (
          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
            Inactive
          </Badge>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <Badge variant="outline" className={`text-[10px] ${healthColors.bgColor} ${healthColors.color}`}>
              {health.label}
            </Badge>
            {health.varianceLabel && (
              <span className={`text-[9px] ${healthColors.color}`}>{health.varianceLabel}</span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right hidden lg:table-cell text-xs text-muted-foreground">
        {row.last_order_date ? format(new Date(row.last_order_date), "MMM d, yy") : "—"}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onNavigate(`/stores/${row.store_id}`); }}>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function KpiCard({ label, value, className = "", valueClassName = "" }: { label: string; value: string; className?: string; valueClassName?: string }) {
  return (
    <Card className={className}>
      <CardContent className="pt-4 pb-3">
        <div className={`text-2xl font-bold ${valueClassName}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
