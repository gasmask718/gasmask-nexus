/**
 * BrandaroInvoicesDataTable — Unified Brandaro invoice data table.
 * Used in /crm/brandaro (business-wide) and /va/dashboard (per-VA scope).
 * Surfaces paid / unpaid statuses, search, pagination, and quick actions.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import {
  Eye, Send, Copy, Loader2, FileText, Search,
  CheckCircle2, AlertCircle, DollarSign, Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { VAInvoiceDetailDialog } from '@/components/va/VAInvoiceDetailDialog';
import { SendInvoiceDialog } from '@/components/invoice/SendInvoiceDialog';

type FilterKey = 'all' | 'paid' | 'unpaid' | 'draft' | 'sent';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
];

const PAGE_SIZE_DEFAULT = 25;

interface Props {
  /** When set, scope to a single VA (used in /va/dashboard). */
  vaId?: string | null;
  title?: string;
  description?: string;
}

function isPaid(inv: any) {
  if (inv.status === 'paid') return true;
  const total = Number(inv.total ?? 0);
  const paid = Number(inv.amount_paid ?? 0);
  return total > 0 && paid >= total;
}

export function BrandaroInvoicesDataTable({
  vaId,
  title = 'Invoices',
  description = 'All Brandaro invoices — paid & unpaid tracking.',
}: Props) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [selected, setSelected] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sendInvoice, setSendInvoice] = useState<any | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['brandaro-invoices-table', vaId ?? 'all'],
    queryFn: async () => {
      let q = (supabase as any)
        .from('va_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (vaId) q = q.eq('va_id', vaId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const counts = useMemo(() => {
    const c = { all: invoices.length, paid: 0, unpaid: 0, draft: 0, sent: 0 };
    invoices.forEach((i: any) => {
      if (isPaid(i)) c.paid++;
      else c.unpaid++;
      if (i.status === 'draft') c.draft++;
      if (i.status === 'sent') c.sent++;
    });
    return c;
  }, [invoices]);

  const totals = useMemo(() => {
    let collected = 0, outstanding = 0;
    invoices.forEach((i: any) => {
      const t = Number(i.total ?? 0);
      const p = Number(i.amount_paid ?? 0);
      if (isPaid(i)) collected += t || p;
      else outstanding += Math.max(0, t - p);
    });
    return { collected, outstanding };
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((i: any) => {
      const matchFilter =
        filter === 'all' ||
        (filter === 'paid' && isPaid(i)) ||
        (filter === 'unpaid' && !isPaid(i)) ||
        (filter === 'draft' && i.status === 'draft') ||
        (filter === 'sent' && i.status === 'sent');
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        i.invoice_number?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q) ||
        i.customer_email?.toLowerCase().includes(q) ||
        i.service_type?.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [invoices, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  );

  const copyLink = (link: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success('Payment link copied');
  };

  const paidBadge = (inv: any) => {
    if (isPaid(inv)) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Paid
        </Badge>
      );
    }
    return (
      <Badge className="bg-rose-500/15 text-rose-600 border border-rose-500/30 gap-1">
        <AlertCircle className="h-3 w-3" /> Unpaid
      </Badge>
    );
  };

  const stageBadge = (s: string) => {
    if (s === 'paid') return <Badge variant="outline" className="text-[10px]">paid</Badge>;
    if (s === 'sent') return <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-600">sent</Badge>;
    return <Badge variant="outline" className="text-[10px]">draft</Badge>;
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-lg border bg-emerald-500/5 px-3 py-2 min-w-[120px]">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700/80 flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Collected
              </div>
              <div className="text-sm font-bold text-emerald-600">${totals.collected.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border bg-rose-500/5 px-3 py-2 min-w-[120px]">
              <div className="text-[10px] uppercase tracking-wide text-rose-700/80 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Outstanding
              </div>
              <div className="text-sm font-bold text-rose-600">${totals.outstanding.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                filter === f.key
                  ? 'bg-sky-500/15 text-sky-600 border-sky-500/40'
                  : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted'
              }`}
            >
              {f.label} <span className="ml-1 opacity-60">{(counts as any)[f.key] ?? 0}</span>
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search # / customer / email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {filter === 'all' ? 'No invoices yet.' : `No ${filter} invoices.`}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border-y">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Service</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Paid</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="hidden lg:table-cell">Stage</TableHead>
                    <TableHead className="hidden lg:table-cell">Due</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((inv: any) => {
                    const total = Number(inv.total ?? 0);
                    const paid = Number(inv.amount_paid ?? 0);
                    return (
                      <TableRow key={inv.id} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-xs text-sky-600">
                          {inv.invoice_number || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{inv.customer_name || '—'}</div>
                          {inv.customer_email && (
                            <div className="text-xs text-muted-foreground">{inv.customer_email}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                          {inv.service_type || '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ${total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm hidden md:table-cell text-emerald-600">
                          ${paid.toFixed(2)}
                        </TableCell>
                        <TableCell>{paidBadge(inv)}</TableCell>
                        <TableCell className="hidden lg:table-cell">{stageBadge(inv.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                          {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                          {format(new Date(inv.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => { setSelected(inv); setDetailOpen(true); }}
                            >
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                            {!isPaid(inv) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-cyan-600 hover:bg-cyan-500/10"
                                onClick={() => setSendInvoice(inv)}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                {inv.status === 'draft' ? 'Send' : 'Resend'}
                              </Button>
                            )}
                            {inv.payment_link && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-amber-600 hover:bg-amber-500/10"
                                onClick={() => copyLink(inv.payment_link)}
                              >
                                <Copy className="h-3 w-3 mr-1" /> Link
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </CardContent>

      <VAInvoiceDetailDialog
        invoice={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      <SendInvoiceDialog
        open={!!sendInvoice}
        invoice={sendInvoice}
        onClose={() => setSendInvoice(null)}
        invalidateKeys={[['brandaro-invoices-table'], ['brandaro-invoices-table', vaId ?? 'all']]}
      />
    </Card>
  );
}
