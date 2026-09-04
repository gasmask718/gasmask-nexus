// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT ACTIVITY TABLE — the one operational activity table.
//
// Reused by: the Activity page, Route Engine, Delivery Floor and the store
// profile. It always reads the same canonical feed (public.v_store_activity)
// and always links to the exact canonical store row (/stores/:id).
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Activity as ActivityIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { dynastyStamp, dynastyRelative } from '@/lib/dates';
import {
  ACTIVITY_FILTERS,
  useAccountActivity,
  useActivityWorkers,
  type ActivityKind,
  type ActivityRow,
} from '@/hooks/useAccountActivity';

const KIND_LABEL: Record<ActivityKind, string> = {
  review: 'Review',
  review_audit: 'Review (history)',
  note: 'Note',
  call: 'Call',
  text: 'Text',
  visit: 'Visit',
  delivery: 'Delivery',
  route: 'Route',
  order: 'Order',
  samples: 'Samples',
  followup: 'Follow-up',
  inventory: 'Inventory',
  invoice: 'Invoice',
  field: 'Field update',
};

const KIND_TONE: Record<ActivityKind, string> = {
  review: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  review_audit: 'bg-muted text-muted-foreground',
  note: 'bg-muted text-muted-foreground',
  call: 'bg-sky-500/15 text-sky-600',
  text: 'bg-violet-500/15 text-violet-600',
  visit: 'bg-amber-500/15 text-amber-600',
  delivery: 'bg-blue-500/15 text-blue-600',
  route: 'bg-teal-500/15 text-teal-600',
  order: 'bg-indigo-500/15 text-indigo-600',
  samples: 'bg-pink-500/15 text-pink-600',
  followup: 'bg-orange-500/15 text-orange-600',
  inventory: 'bg-cyan-500/15 text-cyan-600',
  invoice: 'bg-yellow-500/15 text-yellow-700',
  field: 'bg-slate-500/15 text-slate-600',
};

interface Props {
  /** Scope to one account (store profile) */
  storeId?: string;
  /** Scope to a set of accounts (Route Engine / Delivery Floor) */
  storeIds?: string[];
  title?: string;
  /** Hide the store column when already scoped to a single account */
  showStoreColumn?: boolean;
  defaultKind?: string;
  defaultOpenState?: 'all' | 'open' | 'done';
  defaultPageSize?: number;
  className?: string;
}

function pageWindow(current: number, total: number): number[] {
  const span = 5;
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

export function AccountActivityTable({
  storeId,
  storeIds,
  title = 'Account activity',
  showStoreColumn = true,
  defaultKind = 'all',
  defaultOpenState = 'all',
  defaultPageSize = 25,
  className,
}: Props) {
  const [kindFilter, setKindFilter] = useState(defaultKind);
  const [workerId, setWorkerId] = useState<string>('all');
  const [openState, setOpenState] = useState<'all' | 'open' | 'done'>(defaultOpenState);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [showAudit, setShowAudit] = useState(false);

  const { data, isLoading, error } = useAccountActivity({
    storeId,
    storeIds,
    kindFilter,
    workerId: workerId === 'all' ? undefined : workerId,
    openState,
    search,
    page,
    pageSize,
    includeReviewAudit: showAudit,
  });
  const { data: workers } = useActivityWorkers();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = useMemo(() => pageWindow(page, totalPages), [page, totalPages]);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivityIcon className="h-4 w-4" />
            {title}
            {total > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({total})</span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => reset(() => setShowAudit((v) => !v))}
            className="text-xs"
          >
            {showAudit ? 'Hide review history' : 'Show full review history'}
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') reset(() => setSearch(searchInput));
              }}
              onBlur={() => reset(() => setSearch(searchInput))}
              placeholder="Search store or contact…"
              className="pl-8"
            />
          </div>

          <Select value={kindFilter} onValueChange={(v) => reset(() => setKindFilter(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={workerId} onValueChange={(v) => reset(() => setWorkerId(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Worker" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workers</SelectItem>
              {(workers || []).map((w: any) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={openState} onValueChange={(v) => reset(() => setOpenState(v as any))}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Done + needs action</SelectItem>
              <SelectItem value="open">Needs action / open</SelectItem>
              <SelectItem value="done">Done / completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {(error as any).message}
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Type</TableHead>
                <TableHead>Action</TableHead>
                {showStoreColumn && <TableHead>Account</TableHead>}
                <TableHead className="w-[150px]">Worker</TableHead>
                <TableHead className="w-[170px]">When</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={showStoreColumn ? 6 : 5}>
                      <div className="h-6 animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={showStoreColumn ? 6 : 5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No activity for these filters
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.activity_id} className={cn(r.is_open && 'bg-amber-500/5')}>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[11px]', KIND_TONE[r.kind])}>
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[380px]">
                    <div className="text-sm font-medium">{r.title}</div>
                    {r.detail && (
                      <div className="truncate text-xs text-muted-foreground">{r.detail}</div>
                    )}
                    {r.contactName && (
                      <div className="text-[11px] text-muted-foreground">
                        Contact: {r.contactName}
                      </div>
                    )}
                  </TableCell>
                  {showStoreColumn && (
                    <TableCell>
                      <Link
                        to={`/stores/${r.store_id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        {r.storeName || 'Unnamed account'}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  )}
                  <TableCell className="text-sm">
                    {r.actorName || <span className="text-muted-foreground">System</span>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium">{dynastyStamp(r.occurred_at)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {dynastyRelative(r.occurred_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        className={cn(
                          'w-fit text-[10px]',
                          r.is_open
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                        )}
                      >
                        {r.is_open ? 'NEEDS ACTION' : 'DONE'}
                      </Badge>
                      {r.status && (
                        <span className="text-[10px] text-muted-foreground">{r.status}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile / tablet cards */}
        <div className="space-y-2 md:hidden">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          {!isLoading && rows.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No activity for these filters
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.activity_id}
              className={cn('rounded-lg border p-3', r.is_open && 'border-amber-500/40 bg-amber-500/5')}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className={cn('text-[10px]', KIND_TONE[r.kind])}>
                  {KIND_LABEL[r.kind] ?? r.kind}
                </Badge>
                <Badge
                  className={cn(
                    'text-[10px]',
                    r.is_open
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                  )}
                >
                  {r.is_open ? 'NEEDS ACTION' : 'DONE'}
                </Badge>
              </div>
              <div className="mt-1 text-sm font-medium">{r.title}</div>
              {r.detail && <div className="text-xs text-muted-foreground">{r.detail}</div>}
              {showStoreColumn && (
                <Link
                  to={`/stores/${r.store_id}`}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"
                >
                  {r.storeName || 'Unnamed account'}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              <div className="mt-1 text-[11px] text-muted-foreground">
                {r.actorName || 'System'} · {dynastyStamp(r.occurred_at)}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination with page numbers */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => reset(() => setPageSize(Number(v)))}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pages.map((p) => (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { ActivityRow };
