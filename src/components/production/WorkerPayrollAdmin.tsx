import { useTranslation } from "@/hooks/useTranslation";
import { BilingualLabel } from "@/components/portal/BilingualLabel";
/**
 * WORKER PAYROLL ADMIN — Command Console
 * 
 * Operational payroll tab for admins/managers:
 * - Sticky action bar with <BilingualLabel tKey="production.approve_all" en="Approve All" inline />, <BilingualLabel tKey="production.pay" en="Pay Worker" inline />, Export
 * - Worker balance table with inline actions
 * - <BilingualLabel tKey="production.pay" en="Pay Worker" inline /> modal with worker selector
 * - Payment audit log
 * - Empty state guidance
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ExportButton } from '@/components/crud/ExportButton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  DollarSign,
  Users,
  CheckCircle,
  Wallet,
  History,
  AlertTriangle,
  CreditCard,
  FileText,
  CheckCheck,
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
  const { t } = useTranslation();
  const { data: summaries = [], isLoading: summariesLoading } = useWorkerPaySummaries(officeId);
  const { data: earnings = [] } = useOfficeEarnings(officeId);
  const { data: payments = [] } = useOfficePayments(officeId);

  const issuePayment = useIssuePayment();
  const approveEarnings = useApproveEarnings();

  // <BilingualLabel tKey="production.pay" en="Pay Worker" inline /> dialog — can be opened from action bar or inline
  const [payDialog, setPayDialog] = useState<WorkerPaySummary | null>(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');

  // Standalone "<BilingualLabel tKey="production.pay" en="Pay Worker" inline />" flow (select worker from action bar)
  const [showWorkerSelector, setShowWorkerSelector] = useState(false);
  const [selectedPayWorkerId, setSelectedPayWorkerId] = useState('');

  // Aggregates
  const totalUnpaid = summaries.reduce((sum, s) => sum + s.unpaid_balance, 0);
  const totalPendingApproval = summaries.reduce((sum, s) => sum + s.pending_count, 0);
  const totalApprovedReady = summaries.reduce((sum, s) => sum + s.approved_count, 0);
  const payableWorkers = useMemo(
    () => summaries.filter(s => s.unpaid_balance > 0 && s.approved_count > 0),
    [summaries]
  );
  const pendingWorkers = useMemo(
    () => summaries.filter(s => s.pending_count > 0),
    [summaries]
  );

  // ---------- Handlers ----------

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

  const handleApproveAll = async () => {
    const allPendingIds = earnings
      .filter(e => e.status === 'pending')
      .map(e => e.id);
    if (!allPendingIds.length) return;
    await approveEarnings.mutateAsync({ earningIds: allPendingIds, officeId });
  };

  const openPayWorkerSelector = () => {
    setSelectedPayWorkerId('');
    setShowWorkerSelector(true);
  };

  const confirmWorkerSelection = () => {
    const worker = summaries.find(s => s.worker_id === selectedPayWorkerId);
    if (worker) {
      setPayDialog(worker);
      setPayMethod('cash');
      setPayNotes('');
    }
    setShowWorkerSelector(false);
  };

  const openPayForWorker = (summary: WorkerPaySummary) => {
    setPayDialog(summary);
    setPayMethod('cash');
    setPayNotes('');
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
      {/* ─── STICKY ACTION BAR ─── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm"><BilingualLabel tKey="production.payroll" en="Payroll Console" /></h3>
                <p className="text-xs text-muted-foreground">
                  {totalPendingApproval > 0 && (
                    <span className="text-amber-600 font-medium">{totalPendingApproval} {t("production.pending_approval")}</span>
                  )}
                  {totalPendingApproval > 0 && totalApprovedReady > 0 && ' · '}
                  {totalApprovedReady > 0 && (
                    <span className="text-primary font-medium">{payableWorkers.length} {t("production.ready_to_pay")}</span>
                  )}
                  {totalPendingApproval === 0 && totalApprovedReady === 0 && t("production.all_caught_up")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* <BilingualLabel tKey="production.approve_all" en="Approve All" inline /> Pending */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleApproveAll}
                disabled={totalPendingApproval === 0 || approveEarnings.isPending}
                title={totalPendingApproval === 0 ? 'No pending earnings to approve' : undefined}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                <BilingualLabel tKey="production.approve_all" en="Approve All" inline /> ({totalPendingApproval})
              </Button>

              {/* <BilingualLabel tKey="production.pay" en="Pay Worker" inline /> (opens selector) */}
              <Button
                size="sm"
                onClick={openPayWorkerSelector}
                disabled={payableWorkers.length === 0}
                title={payableWorkers.length === 0 ? 'No workers with approved unpaid earnings' : undefined}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                <BilingualLabel tKey="production.pay" en="Pay Worker" inline />
              </Button>

              {/* Export */}
              <ExportButton
                data={summaries as any}
                filename="worker-payroll"
                columns={payrollExportColumns}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── SUMMARY CARDS ─── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-3 w-3" /> <BilingualLabel tKey="production.active_workers" en="Active Workers" />
            </CardDescription>
            <CardTitle className="text-2xl">{summaries.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={totalUnpaid > 0 ? 'border-amber-300/50' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> <BilingualLabel tKey="production.total_unpaid" en="Total Unpaid" />
            </CardDescription>
            <CardTitle className={`text-2xl ${totalUnpaid > 0 ? 'text-amber-600' : ''}`}>
              ${totalUnpaid.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> <BilingualLabel tKey="production.pending_approval" en="Pending Approval" />
            </CardDescription>
            <CardTitle className="text-2xl">{totalPendingApproval}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* ─── TABS: BALANCES + AUDIT ─── */}
      <Tabs defaultValue="balances">
        <TabsList>
          <TabsTrigger value="balances" className="flex items-center gap-1">
            <Wallet className="h-3 w-3" /> <BilingualLabel tKey="production.balances" en="Balances" inline />
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <History className="h-3 w-3" /> <BilingualLabel tKey="production.payment_log" en="Payment Log" inline />
          </TabsTrigger>
        </TabsList>

        {/* ─── BALANCES TAB ─── */}
        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Worker <BilingualLabel tKey="production.balances" en="Balances" inline />
                  </CardTitle>
                  <CardDescription>{t("production.worker_balances_description")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {summariesLoading ? (
                <p className="text-center text-muted-foreground py-6">Loading...</p>
              ) : summaries.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t("production.no_active_workers")}
                  description={t("production.no_active_workers_description")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("production.worker")}</TableHead>
                      <TableHead>{t("production.role")}</TableHead>
                      <TableHead>{t("production.pay_type")}</TableHead>
                      <TableHead className="text-right">{t("production.earned")}</TableHead>
                      <TableHead className="text-right">{t("production.paid")}</TableHead>
                      <TableHead className="text-right">{t("production.unpaid")}</TableHead>
                      <TableHead className="text-center">{t("production.pending")}</TableHead>
                      <TableHead>{t("production.actions")}</TableHead>
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
                                  onClick={() => openPayForWorker(summary)}
                                >
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Pay
                                </Button>
                              )}
                              {summary.pending_count === 0 && (summary.approved_count === 0 || summary.unpaid_balance <= 0) && (
                                <span className="text-xs text-muted-foreground italic">{t("production.no_action_needed")}</span>
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

        {/* ─── PAYMENT AUDIT LOG TAB ─── */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" /> <BilingualLabel tKey="production.payment_audit_log" en="Payment Audit Log" />
                  </CardTitle>
                  <CardDescription>{t("production.payment_audit_log_description")}</CardDescription>
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
                <EmptyState
                  icon={FileText}
                  title={t("production.no_payments_yet")}
                  description="Payment records will appear here after you issue your first worker payout. Use the '<BilingualLabel tKey="production.pay" en="Pay Worker" inline />' button above to get started."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("production.date")}</TableHead>
                      <TableHead>{t("production.worker")}</TableHead>
                      <TableHead className="text-right">{t("production.amount")}</TableHead>
                      <TableHead>{t("production.method")}</TableHead>
                      <TableHead>{t("production.earnings")}</TableHead>
                      <TableHead>{t("production.notes")}</TableHead>
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

      {/* ─── WORKER SELECTOR DIALOG (from action bar) ─── */}
      <Dialog open={showWorkerSelector} onOpenChange={setShowWorkerSelector}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Select Worker to Pay
            </DialogTitle>
            <DialogDescription>
              Choose a worker with approved earnings to issue a payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {payableWorkers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No workers with approved unpaid earnings.
              </p>
            ) : (
              <Select value={selectedPayWorkerId} onValueChange={setSelectedPayWorkerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a worker..." />
                </SelectTrigger>
                <SelectContent>
                  {payableWorkers.map(w => (
                    <SelectItem key={w.worker_id} value={w.worker_id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{w.worker_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ${w.unpaid_balance.toFixed(2)} unpaid
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkerSelector(false)}>Cancel</Button>
            <Button
              onClick={confirmWorkerSelection}
              disabled={!selectedPayWorkerId}
            >
              Continue to Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── PAY WORKER CONFIRMATION DIALOG ─── */}
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
                <span>Approved earnings {t("production.ready_to_pay")}</span>
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
