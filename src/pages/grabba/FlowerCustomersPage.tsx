import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flower2, Download, Search, ArrowUpDown, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { fieldStamp, fieldRelative } from '@/lib/dates';
import {
  useFlowerDemandList,
  useFlowerDemandFacets,
  fetchFlowerDemandForExport,
  DEFAULT_FLOWER_FILTERS,
  type FlowerDemandFilters,
  type FlowerSortKey,
} from '@/hooks/useFlowerDemandList';

const ALL = '__all__';

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

export default function FlowerCustomersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filters, setFilters] = useState<FlowerDemandFilters>(DEFAULT_FLOWER_FILTERS);
  const [searchDraft, setSearchDraft] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error } = useFlowerDemandList(filters);
  const { data: facets } = useFlowerDemandFacets();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));

  const patch = (next: Partial<FlowerDemandFilters>) =>
    setFilters((f) => ({ ...f, page: 0, ...next }));

  const toggleSort = (key: FlowerSortKey) =>
    setFilters((f) => ({
      ...f,
      page: 0,
      sortKey: key,
      sortAsc: f.sortKey === key ? !f.sortAsc : false,
    }));

  const activeFilterCount = useMemo(
    () =>
      [filters.search, filters.borough, filters.flaggedBy, filters.from, filters.to].filter(
        Boolean,
      ).length,
    [filters],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const all = await fetchFlowerDemandForExport(filters);
      const header = [
        'Store',
        'Address',
        'Borough',
        'City',
        'Contact',
        'Contact Role',
        'Phone',
        'Flagged By',
        'Flagged At',
        'Note',
        'Last Visit',
      ];
      const body = all.map((r) =>
        [
          r.store_name ?? r.nickname,
          r.address,
          r.borough,
          r.city,
          r.contact_name,
          r.contact_role,
          r.contact_phone ?? r.store_phone,
          r.flagged_by_name,
          r.flagged_at ? fieldStamp(r.flagged_at) : '',
          r.flower_note,
          r.last_visit_at ? fieldStamp(r.last_visit_at) : '',
        ]
          .map(csvCell)
          .join(','),
      );
      const blob = new Blob([[header.map(csvCell).join(','), ...body].join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flower-demand-list-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export ready', description: `${all.length} stores exported.` });
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
        duration: 8000,
      });
    } finally {
      setExporting(false);
    }
  };

  const SortHead = ({ label, sortKey }: { label: string; sortKey: FlowerSortKey }) => (
    <TableHead>
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1 font-medium hover:text-primary"
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${filters.sortKey === sortKey ? 'text-primary' : 'opacity-40'}`}
        />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Flower2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Flower Customers</h1>
            <p className="text-sm text-muted-foreground">
              Demand list — stores that told us they buy flower. This is the targeting
              list, not a sales record.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{total} flagged</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || total === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Exporting…' : 'CSV'}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters(DEFAULT_FLOWER_FILTERS);
                  setSearchDraft('');
                }}
              >
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Store, address, contact, phone, note…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') patch({ search: searchDraft });
                }}
                onBlur={() => patch({ search: searchDraft })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Borough</Label>
            <Select
              value={filters.borough || ALL}
              onValueChange={(v) => patch({ borough: v === ALL ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All boroughs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All boroughs</SelectItem>
                {(facets?.boroughs ?? []).map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Flagged by</Label>
            <Select
              value={filters.flaggedBy || ALL}
              onValueChange={(v) => patch({ flaggedBy: v === ALL ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Anyone</SelectItem>
                {(facets?.flaggers ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => patch({ from: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => patch({ to: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-sm text-destructive">
              Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Flower2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No flagged stores</p>
              <p className="text-sm text-muted-foreground">
                Flip the &ldquo;Sells Flowers&rdquo; toggle on a store profile to build
                this list.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead label="Store" sortKey="store_name" />
                    <TableHead>Address</TableHead>
                    <SortHead label="Borough" sortKey="borough" />
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <SortHead label="Flagged by" sortKey="flagged_by_name" />
                    <SortHead label="Flagged" sortKey="flagged_at" />
                    <TableHead>Note</TableHead>
                    <SortHead label="Last visit" sortKey="last_visit_at" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.store_id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/grabba/store-master/${r.store_id}`)}
                    >
                      <TableCell className="font-medium">
                        {r.store_name || r.nickname || 'Unnamed store'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {r.address || '—'}
                      </TableCell>
                      <TableCell className="text-sm">{r.borough || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {r.contact_name || '—'}
                        {r.contact_role && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({r.contact_role})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {r.contact_phone || r.store_phone || '—'}
                      </TableCell>
                      <TableCell className="text-sm">{r.flagged_by_name || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {r.flagged_at ? (
                          <div>
                            <div>{fieldStamp(r.flagged_at)}</div>
                            <div className="text-xs text-muted-foreground">
                              {fieldRelative(r.flagged_at)}
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] text-sm">
                        {r.flower_note ? (
                          <span className="line-clamp-2">{r.flower_note}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.last_visit_at ? (
                          <div>
                            <div>{fieldStamp(r.last_visit_at)}</div>
                            <div className="text-xs text-muted-foreground">
                              {fieldRelative(r.last_visit_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Showing {filters.page * filters.pageSize + 1}–
            {Math.min((filters.page + 1) * filters.pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Select
              value={String(filters.pageSize)}
              onValueChange={(v) => patch({ pageSize: Number(v) })}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page === 0}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            >
              Previous
            </Button>
            <span className="text-sm tabular-nums">
              {filters.page + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page + 1 >= pageCount}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
