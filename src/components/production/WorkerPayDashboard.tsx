/**
 * WORKER PAY DASHBOARD
 * 
 * Read-only view for workers to see:
 * - Today's / this week's earnings
 * - Unpaid balance
 * - Payment history
 * - Batch-level earnings breakdown
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Clock, CheckCircle, Wallet, TrendingUp, Eye } from 'lucide-react';
import { format, isToday, isThisWeek, startOfWeek } from 'date-fns';
import { useMyEarnings, useMyPayments } from '@/hooks/useWorkerPay';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WorkerPayDashboardProps {
  workerId: string | undefined;
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
  pending: { variant: 'outline', label: 'Pending' },
  approved: { variant: 'secondary', label: 'Approved' },
  paid: { variant: 'default', label: 'Paid' },
  disputed: { variant: 'destructive', label: 'Disputed' },
};

export function WorkerPayDashboard({ workerId }: WorkerPayDashboardProps) {
  const { data: earnings = [], isLoading: earningsLoading } = useMyEarnings(workerId);
  const { data: payments = [], isLoading: paymentsLoading } = useMyPayments(workerId);

  const stats = useMemo(() => {
    const todayEarnings = earnings
      .filter(e => isToday(new Date(e.earned_at)))
      .reduce((sum, e) => sum + Number(e.earnings_amount), 0);

    const weekEarnings = earnings
      .filter(e => isThisWeek(new Date(e.earned_at), { weekStartsOn: 1 }))
      .reduce((sum, e) => sum + Number(e.earnings_amount), 0);

    const unpaidBalance = earnings
      .filter(e => e.status !== 'paid')
      .reduce((sum, e) => sum + Number(e.earnings_amount), 0);

    const totalPaid = earnings
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + Number(e.earnings_amount), 0);

    return { todayEarnings, weekEarnings, unpaidBalance, totalPaid };
  }, [earnings]);

  if (!workerId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">Worker profile not linked. Contact your manager.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transparency Banner */}
      <Alert className="border-primary/30 bg-primary/5">
        <Eye className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          Your earnings are calculated automatically from completed batches. All amounts are <strong>read-only</strong>.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Today
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">
              ${stats.todayEarnings.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> This Week
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              ${stats.weekEarnings.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-amber-300/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Unpaid Balance
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600">
              ${stats.unpaidBalance.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Total Paid
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              ${stats.totalPaid.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs: Earnings / Payments */}
      <Tabs defaultValue="earnings">
        <TabsList>
          <TabsTrigger value="earnings" className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Earnings
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="earnings">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Earnings History</CardTitle>
              <CardDescription>All batch completion earnings</CardDescription>
            </CardHeader>
            <CardContent>
              {earningsLoading ? (
                <p className="text-center text-muted-foreground py-6">Loading...</p>
              ) : earnings.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No earnings recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map(earning => {
                      const badge = STATUS_BADGE[earning.status] || STATUS_BADGE.pending;
                      return (
                        <TableRow key={earning.id}>
                          <TableCell className="text-sm">
                            {format(new Date(earning.earned_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {earning.batch?.brand || '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {earning.quantity_completed} {earning.unit_type}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            ${Number(earning.earnings_amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
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

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment History</CardTitle>
              <CardDescription>All payouts received</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <p className="text-center text-muted-foreground py-6">Loading...</p>
              ) : payments.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No payments recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Earnings Covered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-sm">
                          {format(new Date(payment.paid_at), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">
                          ${Number(payment.total_amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {payment.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.covered_earnings?.length || 0} items
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
    </div>
  );
}
