import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format';
import { Download, DollarSign, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  getUFTPayoutRequests,
  updateUFTPayoutStatus,
  type UFTPayoutRequest,
} from '@/services/uftApi';

const STATUSES = ['all', 'requested', 'approved', 'processing', 'paid', 'rejected'] as const;
type StatusFilter = typeof STATUSES[number];

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-blue-500/20 text-blue-400',
  processing: 'bg-purple-500/20 text-purple-400',
  paid: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

const METHOD_COLORS: Record<string, string> = {
  paypal: 'bg-blue-500/20 text-blue-400',
  wise: 'bg-cyan-500/20 text-cyan-400',
  check: 'bg-gray-500/20 text-gray-300',
};

export default function PayoutRequestsPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [rejectModal, setRejectModal] = useState<UFTPayoutRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewModal, setViewModal] = useState<UFTPayoutRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const queryKey = ['uft-payouts', filter];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => getUFTPayoutRequests(filter === 'all' ? undefined : filter),
  });

  const requests = data?.requests ?? [];
  const stats = data?.stats;

  const update = async (id: string, status: string, notes?: string) => {
    setBusy(id);
    try {
      await updateUFTPayoutStatus(id, status, notes);
      toast.success(`Marked ${status}`);
      qc.invalidateQueries({ queryKey: ['uft-payouts'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    await update(rejectModal.id, 'rejected', rejectReason);
    setRejectModal(null);
    setRejectReason('');
  };

  const handlePaid = (r: UFTPayoutRequest) => {
    if (confirm(`Mark ${formatCurrency(r.amount)} to ${r.ambassador_name} as PAID?`)) {
      update(r.id, 'paid');
    }
  };

  const handleExport = () => {
    const rows = [
      'Ambassador,RefCode,Amount,Method,Account,Status,Requested',
      ...requests.map(r =>
        `"${r.ambassador_name}",${r.ref_code},${r.amount},${r.method},"${r.account}",${r.status},${r.requested_at}`,
      ),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uft-payouts-${filter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const pendingCount = stats?.total_pending ?? requests.filter(r => r.status === 'requested').length;
  const pendingAmount = stats?.total_pending_amount ?? requests
    .filter(r => r.status === 'requested')
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const paidThisMonth = stats?.paid_this_month ?? 0;
  const avgPayout = stats?.average_payout ?? (
    requests.length ? requests.reduce((s, r) => s + Number(r.amount || 0), 0) / requests.length : 0
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pending Requests</p>
          {isLoading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold">{pendingCount}</p>}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pending Amount</p>
          {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-2xl font-bold text-yellow-400">{formatCurrency(pendingAmount)}</p>}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Paid This Month</p>
          {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-2xl font-bold text-green-400">{formatCurrency(paidThisMonth)}</p>}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Avg Payout</p>
          {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> : <p className="text-2xl font-bold">{formatCurrency(avgPayout)}</p>}
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Payout Requests</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!requests.length}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)} className="mt-3">
            <TabsList>
              {STATUSES.map(s => (
                <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-yellow-400 mb-3">Could not load payout requests. {(error as Error).message}</p>
          )}
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No payout requests in this view.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ambassador</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Account/Email</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.ambassador_name}</div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted">{r.ref_code}</span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-400">
                      {formatCurrency(Number(r.amount))}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${METHOD_COLORS[r.method?.toLowerCase()] || 'bg-muted'}`}>
                        {r.method}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{r.account}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.requested_at ? new Date(r.requested_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[r.status] || 'bg-muted'}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === 'requested' && (
                        <>
                          <Button size="sm" variant="outline" disabled={busy === r.id}
                            onClick={() => update(r.id, 'approved')}>✅ Approve</Button>
                          <Button size="sm" variant="outline" disabled={busy === r.id}
                            onClick={() => setRejectModal(r)}>❌ Reject</Button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <>
                          <Button size="sm" variant="outline" disabled={busy === r.id}
                            onClick={() => update(r.id, 'processing')}>📤 Processing</Button>
                          <Button size="sm" variant="outline" disabled={busy === r.id}
                            onClick={() => handlePaid(r)}>💰 Paid</Button>
                        </>
                      )}
                      {r.status === 'processing' && (
                        <Button size="sm" variant="outline" disabled={busy === r.id}
                          onClick={() => handlePaid(r)}>💰 Mark Paid</Button>
                      )}
                      {r.status === 'paid' && (
                        <Button size="sm" variant="ghost" onClick={() => setViewModal(r)}>View</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reject modal */}
      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payout</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {rejectModal && `Rejecting ${formatCurrency(Number(rejectModal.amount))} to ${rejectModal.ambassador_name}.`}
            </p>
            <Textarea
              placeholder="Reason for rejection (visible to the ambassador)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim()} onClick={handleReject}>
              <Send className="h-4 w-4 mr-1" /> Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View modal */}
      <Dialog open={!!viewModal} onOpenChange={(o) => !o && setViewModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payout Details</DialogTitle>
          </DialogHeader>
          {viewModal && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Ambassador:</span> <strong>{viewModal.ambassador_name}</strong></div>
              <div><span className="text-muted-foreground">Ref Code:</span> {viewModal.ref_code}</div>
              <div><span className="text-muted-foreground">Amount:</span> <strong className="text-green-400">{formatCurrency(Number(viewModal.amount))}</strong></div>
              <div><span className="text-muted-foreground">Method:</span> {viewModal.method}</div>
              <div><span className="text-muted-foreground">Account:</span> {viewModal.account}</div>
              <div><span className="text-muted-foreground">Status:</span> {viewModal.status}</div>
              <div><span className="text-muted-foreground">Requested:</span> {viewModal.requested_at}</div>
              {viewModal.paid_at && <div><span className="text-muted-foreground">Paid:</span> {viewModal.paid_at}</div>}
              {viewModal.notes && <div><span className="text-muted-foreground">Notes:</span> {viewModal.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
