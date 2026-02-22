import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Hourglass } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/crud/ExportButton';
import {
  DollarSign, CheckCircle2, AlertCircle, Clock, Ban,
  ShieldAlert, Loader2, Undo2
} from 'lucide-react';
import { useMarketplacePayouts } from '@/hooks/useMarketplacePayouts';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved_pending_delivery: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  in_settlement: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  approved: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  held: 'bg-red-500/15 text-red-400 border-red-500/30',
  reversed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved_pending_delivery: 'Shipped',
  in_settlement: 'Settlement',
  approved: 'Approved',
  paid: 'Paid',
  held: 'Held',
  reversed: 'Reversed',
};

export default function AdminMarketplacePayoutsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionDialog, setActionDialog] = useState<{ type: 'hold' | 'reverse'; payoutId: string } | null>(null);
  const [reason, setReason] = useState('');

  const { payouts, stats, isLoading, markPaid, holdPayout, reversePayout, isProcessing } = useMarketplacePayouts(statusFilter);

  const handleAction = async () => {
    if (!actionDialog || !reason.trim()) return;
    if (actionDialog.type === 'hold') {
      await holdPayout({ payoutId: actionDialog.payoutId, reason });
    } else {
      await reversePayout({ payoutId: actionDialog.payoutId, reason });
    }
    setActionDialog(null);
    setReason('');
  };

  const exportColumns = [
    { key: 'id', label: 'Payout ID' },
    { key: 'wholesaler_name', label: 'Vendor' },
    { key: 'order_id', label: 'Order ID' },
    { key: 'amount', label: 'Gross' },
    { key: 'platform_fee', label: 'Fee' },
    { key: 'net_amount', label: 'Net' },
    { key: 'status', label: 'Status' },
    { key: 'approved_at', label: 'Approved At' },
    { key: 'paid_at', label: 'Paid At' },
    { key: 'created_at', label: 'Created At' },
  ];

  const exportData = payouts.map(p => ({
    id: p.id,
    wholesaler_name: p.wholesaler?.business_name || p.wholesaler?.contact_name || 'Unknown',
    order_id: p.order_id || '',
    amount: p.amount,
    platform_fee: p.platform_fee || 0,
    net_amount: p.net_amount,
    status: p.status || '',
    approved_at: p.approved_at || '',
    paid_at: p.paid_at || '',
    created_at: p.created_at || '',
  }));

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Marketplace Payouts</h1>
              <p className="text-muted-foreground">Manage vendor payout lifecycle: approve → pay</p>
            </div>
          </div>
          <ExportButton data={exportData} filename="marketplace-payouts" columns={exportColumns} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: 'Pending', value: stats?.pendingAmount, count: stats?.pendingCount, color: 'text-amber-400', icon: Clock },
            { label: 'Shipped', value: stats?.approvedPendingDeliveryAmount, count: stats?.approvedPendingDeliveryCount, color: 'text-purple-400', icon: Clock },
            { label: 'In Settlement', value: stats?.inSettlementAmount, count: stats?.inSettlementCount, color: 'text-cyan-400', icon: Hourglass },
            { label: 'Approved', value: stats?.approvedAmount, count: stats?.approvedCount, color: 'text-blue-400', icon: CheckCircle2 },
            { label: 'Paid', value: stats?.paidAmount, count: stats?.paidCount, color: 'text-emerald-400', icon: DollarSign },
            { label: 'Held', value: stats?.heldAmount, count: stats?.heldCount, color: 'text-red-400', icon: ShieldAlert },
            { label: 'Fees Earned', value: stats?.totalFees, color: 'text-primary', icon: DollarSign },
          ].map(s => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <s.icon className="h-3.5 w-3.5" /> {s.label}
                  {s.count !== undefined && <Badge variant="outline" className="ml-auto text-[10px]">{s.count}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${s.color}`}>
                  ${(s.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payout Ledger</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved_pending_delivery">Shipped</SelectItem>
                  <SelectItem value="in_settlement">In Settlement</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="held">Held</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : payouts.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No payouts found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.wholesaler?.business_name || p.wholesaler?.contact_name || p.wholesaler_id?.slice(0, 8) || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.order_id?.slice(0, 8) || '—'}
                      </TableCell>
                      <TableCell className="text-right">${Number(p.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">${Number(p.platform_fee || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">${Number(p.net_amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${statusColors[p.status || ''] || ''}`}>
                          {statusLabels[p.status || ''] || p.status || 'unknown'}
                        </Badge>
                        {p.hold_reason && <p className="text-xs text-red-400 mt-1">{p.hold_reason}</p>}
                        {p.reversal_reason && <p className="text-xs text-zinc-400 mt-1">{p.reversal_reason}</p>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.approved_at ? format(new Date(p.approved_at), 'MMM d, h:mm a') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.paid_at ? format(new Date(p.paid_at), 'MMM d, h:mm a') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {p.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => markPaid(p.id)}
                              disabled={isProcessing}
                              className="gap-1 text-xs"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Pay
                            </Button>
                          )}
                          {(p.status === 'pending' || p.status === 'approved') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setActionDialog({ type: 'hold', payoutId: p.id }); setReason(''); }}
                              disabled={isProcessing}
                              className="gap-1 text-xs"
                            >
                              <Ban className="h-3 w-3" /> Hold
                            </Button>
                          )}
                          {(p.status === 'approved' || p.status === 'paid') && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => { setActionDialog({ type: 'reverse', payoutId: p.id }); setReason(''); }}
                              disabled={isProcessing}
                              className="gap-1 text-xs"
                            >
                              <Undo2 className="h-3 w-3" /> Reverse
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Hold / Reverse Dialog */}
        <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionDialog?.type === 'hold' ? 'Hold Payout' : 'Reverse Payout'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reason (required)</Label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={actionDialog?.type === 'hold' ? 'Why is this payout being held?' : 'Why is this payout being reversed?'}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button
                variant={actionDialog?.type === 'reverse' ? 'destructive' : 'default'}
                onClick={handleAction}
                disabled={!reason.trim() || isProcessing}
              >
                {actionDialog?.type === 'hold' ? 'Place Hold' : 'Reverse Payout'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
