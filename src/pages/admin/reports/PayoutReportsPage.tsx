import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, CreditCard, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { usePayoutBatchSummary, exportToCSV } from '@/hooks/useReporting';
import { format } from 'date-fns';

export default function PayoutReportsPage() {
  const { data: batches, isLoading } = usePayoutBatchSummary();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Stats
  const totalBatches = batches?.length || 0;
  const paidBatches = batches?.filter(b => b.status === 'paid') || [];
  const pendingBatches = batches?.filter(b => ['draft', 'review', 'approved'].includes(b.status)) || [];
  const totalPaid = paidBatches.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const totalPending = pendingBatches.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'review':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Review</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleExport = () => {
    if (batches?.length) {
      exportToCSV(batches, 'payout_batches_report');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payout Reports</h1>
          <p className="text-muted-foreground">Batch reconciliation and payout history</p>
        </div>
        <Button onClick={handleExport} variant="outline" disabled={!batches?.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Batches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{totalBatches}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalPaid)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{paidBatches.length} batches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalPending)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{pendingBatches.length} batches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Batch Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">
                {totalBatches > 0 
                  ? formatCurrency((totalPaid + totalPending) / totalBatches)
                  : '-'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Batches</CardTitle>
          <CardDescription>All payout runs with status and amounts</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ambassador</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Adjustments</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Paid At</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches?.map((batch) => (
                  <TableRow key={batch.batch_id}>
                    <TableCell>
                      <div className="font-medium">{batch.ambassador_name || 'Unknown'}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {batch.period_start && batch.period_end
                        ? `${format(new Date(batch.period_start), 'MMM d, yyyy')} - ${format(new Date(batch.period_end), 'MMM d, yyyy')}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(batch.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(batch.subtotal_amount || 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(batch.adjustments_amount || 0) !== 0 && (
                        <span className={Number(batch.adjustments_amount) > 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(Number(batch.adjustments_amount))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(batch.total_amount || 0))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {batch.paid_at 
                        ? format(new Date(batch.paid_at), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {batch.created_at 
                        ? format(new Date(batch.created_at), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {(!batches || batches.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No payout batches found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
