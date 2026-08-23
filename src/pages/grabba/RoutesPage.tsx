// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MANAGER / DISPATCH CONTROL CENTER
// Single Source of Truth for All Dispatched Routes
// Reads from routes — nothing else. Never creates parallel state.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import {
  RefreshCw,
  Search,
  MapPin,
  Calendar,
  User,
  Truck,
  Bike,
  TrendingUp,
  Activity,
  CheckCircle2,
  Filter,
  X,
  Layers,
  BarChart3,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouteManager, DEFAULT_FILTERS, type RouteRow } from '@/hooks/useRouteManager';
import { RouteDetailDrawer } from '@/components/delivery/RouteDetailDrawer';

const statusBadge = (status: string | null) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    active: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    in_progress: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
    paused: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    draft: 'bg-muted text-muted-foreground',
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return map[status || ''] || 'bg-muted text-muted-foreground';
};

const profitScoreBadge = (score: number | null) => {
  if (score === null) return null;
  if (score >= 70) return { label: 'High', cls: 'bg-green-500/10 text-green-600 border-green-500/20' };
  if (score >= 40) return { label: 'Med', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
  return { label: 'Low', cls: 'bg-red-500/10 text-red-600 border-red-500/20' };
};

export default function RoutesPage() {
  const {
    routes,
    isLoading,
    refetch,
    invalidate,
    filters,
    updateFilter,
    resetFilters,
    pagination,
    stats,
    territories,
    brands,
  } = useRouteManager();

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const handleRowClick = (route: RouteRow) => {
    setSelectedRouteId(route.id);
    setDrawerOpen(true);
  };

  const handleRouteChanged = () => {
    invalidate();
    setDrawerOpen(false);
  };

  return (
    <GrabbaLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dispatch Control Center</h1>
            <p className="text-muted-foreground">Every route ever dispatched — single source of truth</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-primary" />}
            </Button>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 text-center">
              <BarChart3 className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Routes</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 text-center">
              <Activity className="h-5 w-5 mx-auto text-blue-400 mb-1" />
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Active Now</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-400 mb-1" />
              <div className="text-2xl font-bold">{stats.completed}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 text-center">
              <Calendar className="h-5 w-5 mx-auto text-purple-400 mb-1" />
              <div className="text-2xl font-bold">{stats.today}</div>
              <div className="text-xs text-muted-foreground">Today</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={filters.status} onValueChange={v => updateFilter('status', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Type */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Worker Type</label>
                  <Select value={filters.type} onValueChange={v => updateFilter('type', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="biker">Biker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Territory */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Territory</label>
                  <Select value={filters.territory} onValueChange={v => updateFilter('territory', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {territories.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Brand */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Brand</label>
                  <Select value={filters.brand} onValueChange={v => updateFilter('brand', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {brands.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Profit Band */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Profitability</label>
                  <Select value={filters.profitBand} onValueChange={v => updateFilter('profitBand', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="high">High (70+)</SelectItem>
                      <SelectItem value="medium">Medium (40-69)</SelectItem>
                      <SelectItem value="low">Low (&lt;40)</SelectItem>
                      <SelectItem value="none">Not Scored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">From</label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={e => updateFilter('dateFrom', e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Date To */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">To</label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={e => updateFilter('dateTo', e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <X className="h-3 w-3 mr-1" /> Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Route Table */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Money on Route</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead>Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : routes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No routes found
                    </TableCell>
                  </TableRow>
                ) : (
                  routes.map(route => {
                    const pBadge = profitScoreBadge(route.profit_score);
                    const progress = route.stop_count > 0
                      ? Math.round((route.completed_stops / route.stop_count) * 100)
                      : 0;
                    const isUnassigned = !route.assigned_to || (route.assignment_state || '').startsWith('UNASSIGNED');

                    return (
                      <TableRow
                        key={route.id}
                        className={`cursor-pointer hover:bg-muted/50 ${isUnassigned ? 'bg-red-500/5' : ''}`}
                        onClick={() => handleRowClick(route)}
                      >
                        <TableCell className="font-medium text-sm">
                          <div>{format(new Date(route.date), 'MMM d, yyyy')}</div>
                          {route.stop_list && (
                            <div className="text-[11px] text-muted-foreground font-normal truncate max-w-[220px] mt-0.5">
                              {route.stop_list}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {route.type === 'driver' ? (
                              <Truck className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Bike className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="capitalize text-sm">{route.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isUnassigned ? (
                            <Badge className="bg-red-500/15 text-red-500 border-red-500/40 text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" /> UNASSIGNED
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm truncate max-w-[140px] font-medium">
                                {route.worker_name || route.assignee?.name || '—'}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusBadge(route.status)} text-xs`}>
                            {(route.status || 'unknown').replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                              {route.completed_stops}/{route.stop_count}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {route.money_on_this_route != null && route.money_on_this_route > 0 ? (
                            <span className="text-sm font-semibold tabular-nums text-amber-500">
                              ${route.money_on_this_route.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{route.territory || '—'}</span>
                        </TableCell>
                        <TableCell>
                          {route.brand_ids && route.brand_ids.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Layers className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">{route.brand_ids.length}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pBadge ? (
                            <div className="flex items-center gap-1.5">
                              <Badge className={`${pBadge.cls} text-xs`}>{pBadge.label}</Badge>
                              <span className="text-xs tabular-nums font-medium">{route.profit_score?.toFixed(0)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination.totalCount > 0 && (
              <DataTablePagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalCount}
                onPageChange={pagination.controls.goToPage}
                onPageSizeChange={pagination.controls.setPageSize}
                pageSizeOptions={[25, 50, 100, 250]}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Route Detail Drawer */}
      <RouteDetailDrawer
        routeId={selectedRouteId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onRouteChanged={handleRouteChanged}
      />
    </GrabbaLayout>
  );
}
