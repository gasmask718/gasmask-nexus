import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExportButton } from '@/components/crud/ExportButton';
import { Search, ExternalLink, ArrowUpDown, ChevronLeft, ChevronRight, Route as RouteIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import type { BrandCRMStoreRow } from '@/hooks/useBrandCRMAnalytics';
import { getBrandDisplayName } from '@/config/brands';

interface BrandStoresTableProps {
  stores: BrandCRMStoreRow[];
  isLoading: boolean;
  brandColor: string;
  brandId: string;
}

type SortKey = 'store_name' | 'total_orders_lifetime' | 'total_revenue_lifetime' | 'days_since_last_order' | 'avg_days_between_orders' | 'order_frequency_class';
type SortDir = 'asc' | 'desc';

const PAGE_SIZES = [25, 50, 100, 250];

function HealthBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    healthy: { label: '🟢', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    'at-risk': { label: '🟡', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    critical: { label: '🔴', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    new: { label: '🔵', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  };
  const c = config[status] || config.new;
  return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label} {status}</Badge>;
}

function VelocityBadge({ velocity }: { velocity: string }) {
  const config: Record<string, string> = {
    Fast: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Slow: 'bg-destructive/15 text-destructive border-destructive/30',
    New: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  return (
    <Badge variant="outline" className={`text-xs ${config[velocity] || config.New}`}>
      {velocity}
    </Badge>
  );
}

export function BrandStoresTable({ stores, isLoading, brandColor, brandId }: BrandStoresTableProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [velocityFilter, setVelocityFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('days_since_last_order');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dispatchStores, setDispatchStores] = useState<string[]>([]);

  const filtered = useMemo(() => {
    let rows = stores;

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.store_name.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q) ||
        r.ambassador_name?.toLowerCase().includes(q)
      );
    }

    if (velocityFilter !== 'all') {
      rows = rows.filter(r => r.order_frequency_class === velocityFilter);
    }
    if (healthFilter !== 'all') {
      rows = rows.filter(r => r.health_status === healthFilter);
    }
    if (overdueOnly) {
      rows = rows.filter(r => r.is_overdue);
    }

    // Sort
    rows = [...rows].sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];
      if (aVal == null) aVal = sortDir === 'asc' ? Infinity : -Infinity;
      if (bVal == null) bVal = sortDir === 'asc' ? Infinity : -Infinity;
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return rows;
  }, [stores, search, velocityFilter, healthFilter, overdueOnly, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const exportColumns = [
    { key: 'store_name', label: 'Store Name' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'total_orders_lifetime', label: 'Total Orders' },
    { key: 'total_revenue_lifetime', label: 'Revenue ($)' },
    { key: 'avg_days_between_orders', label: 'Avg Days Between Orders' },
    { key: 'days_since_last_order', label: 'Days Since Last Order' },
    { key: 'last_order_date', label: 'Last Order Date' },
    { key: 'order_frequency_class', label: 'Velocity' },
    { key: 'health_status', label: 'Health' },
    { key: 'ambassador_name', label: 'Ambassador' },
  ];

  const SortHeader = ({ label, sortKeyVal }: { label: string; sortKeyVal: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => handleSort(sortKeyVal)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </div>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <CardTitle className="text-lg">
            {getBrandDisplayName(brandId)} Store Performance
          </CardTitle>

          {/* Pagination + Export at top */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(s => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {filtered.length} stores
            </span>
            <ExportButton
              data={filtered as any}
              filename={`${getBrandDisplayName(brandId)}_Brand_CRM`}
              columns={exportColumns}
              disabled={filtered.length === 0}
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={selectedIds.length === 0}
              onClick={() => setDispatchStores(selectedIds)}
            >
              <RouteIcon className="h-3 w-3 mr-1" />
              Dispatch Selected ({selectedIds.length})
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stores, city, ambassador..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <Select value={velocityFilter} onValueChange={v => { setVelocityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Velocity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Velocity</SelectItem>
              <SelectItem value="Fast">Fast</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Slow">Slow</SelectItem>
              <SelectItem value="New">New</SelectItem>
            </SelectContent>
          </Select>
          <Select value={healthFilter} onValueChange={v => { setHealthFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Health" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Health</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="at-risk">At Risk</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="new">New</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={overdueOnly ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setOverdueOnly(o => !o); setPage(0); }}
          >
            Overdue Only
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={pageRows.length > 0 && pageRows.every(r => selectedIds.includes(r.store_id))}
                        onCheckedChange={(c) => {
                          const ids = pageRows.map(r => r.store_id);
                          setSelectedIds(prev => c
                            ? Array.from(new Set([...prev, ...ids]))
                            : prev.filter(id => !ids.includes(id)));
                        }}
                      />
                    </TableHead>
                    <SortHeader label="Store" sortKeyVal="store_name" />
                    <TableHead>Location</TableHead>
                    <SortHeader label="Orders" sortKeyVal="total_orders_lifetime" />
                    <SortHeader label="Revenue" sortKeyVal="total_revenue_lifetime" />
                    <SortHeader label="Avg Gap" sortKeyVal="avg_days_between_orders" />
                    <SortHeader label="Days Since" sortKeyVal="days_since_last_order" />
                    <TableHead>Last Order</TableHead>
                    <SortHeader label="Velocity" sortKeyVal="order_frequency_class" />
                    <TableHead>Health</TableHead>
                    <TableHead>Ambassador</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        No stores found for current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map(row => (
                      <TableRow
                        key={row.store_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/store-master/${row.store_id}`)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(row.store_id)}
                            onCheckedChange={(c) => {
                              setSelectedIds(prev => c
                                ? [...prev, row.store_id]
                                : prev.filter(id => id !== row.store_id));
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {row.store_name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {[row.city, row.state].filter(Boolean).join(', ') || '—'}
                        </TableCell>
                        <TableCell className="tabular-nums">{row.total_orders_lifetime}</TableCell>
                        <TableCell className="tabular-nums">${row.total_revenue_lifetime.toLocaleString()}</TableCell>
                        <TableCell className="tabular-nums">
                          {row.avg_days_between_orders ? `${Math.round(row.avg_days_between_orders)}d` : '—'}
                        </TableCell>
                        <TableCell className={`tabular-nums ${row.is_overdue ? 'text-destructive font-medium' : ''}`}>
                          {row.days_since_last_order != null ? `${row.days_since_last_order}d` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.last_order_date
                            ? new Date(row.last_order_date).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell><VelocityBadge velocity={row.order_frequency_class} /></TableCell>
                        <TableCell><HealthBadge status={row.health_status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                          {row.ambassador_name || '—'}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Add to Route"
                              onClick={() => setDispatchStores([row.store_id])}
                            >
                              <RouteIcon className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => navigate(`/store-master/${row.store_id}`)}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-xs text-muted-foreground">
                  Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-xs px-2">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
    <RouteAssignmentDialog
      open={dispatchStores.length > 0}
      onOpenChange={(o) => {
        if (!o) {
          setDispatchStores([]);
        }
      }}
      assigneeId=""
      assigneeName=""
      assigneeType="driver"
      bulkMode={dispatchStores.length > 1}
      preselectedStores={dispatchStores}
    />
    </>
  );
}
