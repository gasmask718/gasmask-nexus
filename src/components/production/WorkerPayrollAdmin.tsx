/**
 * WORKER PAYROLL ADMIN
 * 
 * Admin/Manager view for:
 * - Worker balance summaries
 * - "Pay Worker" action
 * - Earnings approval
 * - Payment audit log
 * - CSV export
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ExportButton } from '@/components/crud/ExportButton';
import {
  DollarSign,
  Users,
  CheckCircle,
  Wallet,
  History,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useWorkerPaySummaries,
  useOfficeEarnings,
  useOfficePayments,
  useIssuePayment,
  useApproveEarnings,
  type WorkerPaySummary,
} from '@/hooks/useWorkerPay';

interface WorkerPayrollAdminProps {
  officeId: string;
}

export function WorkerPayrollAdmin({ officeId }: WorkerPayrollAdminProps) {
  const { data: summaries = [], isLoading: summariesLoading } = useWorkerPaySummaries(officeId);
  const { data: earnings = [] } = useOfficeEarnings(officeId);
  const { data: payments = [] } = useOfficePayments(officeId);

  const issuePayment = useIssuePayment();
  const approveEarnings = useApproveEarnings();

  const [payDialog, setPayDialog] = useState<WorkerPaySummary | null>(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');

  const totalUnpaid = summaries.reduce((sum, s) => sum + s.unpaid_balance, 0);
  const totalPendingApproval = summaries.reduce((sum, s) => sum + s.pending_count, 0);

  const handlePay = async () => {
    if (!payDialog) return;
    await issuePayment.mutateAsync({
      worker_id: payDialog.worker_id,
      office_id: officeId,
      payment_method: payMethod,
      admin_notes: payNotes || undefined,
    });
    setPayDialog(null);
    setPayNotes('');
  };

  const handleApprovePending = async (workerId: string) => {
    const pendingIds = earnings
      .filter(e => e.worker_id === workerId && e.status === 'pending')
      .map(e => e.id);
    if (!pendingIds.length) return;
    await approveEarnings.mutateAsync({ earningIds: pendingIds, officeId });
  };

  // Export columns
  const payrollExportColumns = [
    { key: 'worker_name', label: 'Worker' },
    { key: 'worker_role', label: 'Role' },
    { key: 'pay_type', label: 'Pay Type' },
    { key: 'pay_rate', label: 'Rate' },
    { key: 'total_earned', label: 'Total Earned' },
    { key: 'total_paid', label: 'Total Paid' },
    { key: 'unpaid_balance', label: 'Unpaid Balance' },
  ];

  const paymentExportColumns = [
    { key: 'worker_name', label: 'Worker' },
    { key: 'total_amount', label: 'Amount' },
    { key: 'payment_method', label: 'Method' },
    { key: 'paid_at', label: 'Date' },
    { key: 'admin_notes', label: 'Notes' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-3 w-3" /> Active Workers
            </CardDescription>
            <CardTitle className="text-2xl">{summaries.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-300/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Total Unpaid
            </CardDescription>
            <CardTitle className="text-2xl text-amber-600">${totalUnpaid.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Pending Approval
            </CardDescription>
            <CardTitle className="text-2xl">{totalPendingApproval}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="balances">
        <TabsList>
          <TabsTrigger value="balances" className="flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Balances
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <History className="h-3 w-3" /> Payment Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Worker Balances
                  </CardTitle>
                  <CardDescription>Approve pending earnings and issue payments</CardDescription>
                </div>
                <ExportButton
                  data={summaries as any}
                  filename="worker-payroll"
                  columns={payrollExportColumns}
                />
              </div>
            </CardHeader>
            <CardContent>
              {summariesLoading ? (
                <p className="text-center text-muted-foreground py-6">Loading...</p>
              ) : summaries.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No active workers in this office.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Pay Type</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Unpaid</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaries.map(summary => {
                      const payLabel = summary.pay_type.replace('per_', '/').replace('_', ' ');
                      return (
                        <TableRow key={summary.worker_id}>
                          <TableCell className="font-medium">{summary.worker_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{summary.worker_role}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium capitalize">{payLabel}</span>
                              <span className="text-xs text-muted-foreground">${summary.pay_rate.toFixed(2)}{payLabel}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">${summary.total_earned.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-emerald-600">${summary.total_paid.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-amber-600">
                            ${summary.unpaid_balance.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {summary.pending_count > 0 ? (
                              <Badge variant="destructive" className="text-xs">{summary.pending_count}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {summary.pending_count > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApprovePending(summary.worker_id)}
                                  disabled={approveEarnings.isPending}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                              )}
                              {summary.unpaid_balance > 0 && summary.approved_count > 0 && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setPayDialog(summary);
                                    setPayMethod('cash');
                                    setPayNotes('');
                                  }}
                                >
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" /> Payment Audit Log
                  </CardTitle>
                  <CardDescription>Complete history of all payments issued</CardDescription>
                </div>
                <ExportButton
                  data={payments.map(p => ({
                    worker_name: p.worker?.full_name || '—',
                    total_amount: p.total_amount,
                    payment_method: p.payment_method,
                    paid_at: format(new Date(p.paid_at), 'yyyy-MM-dd HH:mm'),
                    admin_notes: p.admin_notes || '',
                  }))}
                  filename="payment-audit-log"
                  columns={paymentExportColumns}
                />
              </div>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No payments issued yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Earnings</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-sm">
                          {format(new Date(payment.paid_at), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                        <TableCell className="font-medium">{payment.worker?.full_name || '—'}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">
                          ${Number(payment.total_amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{payment.payment_method}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.covered_earnings?.length || 0} items
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {payment.admin_notes || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pay Worker Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(open) => !open && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Pay {payDialog?.worker_name}
            </DialogTitle>
            <DialogDescription>
              Issue payment for all approved earnings. This action is permanent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Unpaid Balance</span>
                <span className="text-2xl font-bold text-primary">
                  ${payDialog?.unpaid_balance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                <span>Approved earnings ready to pay</span>
                <span>{payDialog?.approved_count} items</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="ach">ACH / Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="payroll">Payroll</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Notes (optional)</label>
              <Textarea
                placeholder="Payment notes for audit trail..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button
              onClick={handlePay}
              disabled={issuePayment.isPending || !payDialog?.approved_count}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Payment — ${payDialog?.unpaid_balance.toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
