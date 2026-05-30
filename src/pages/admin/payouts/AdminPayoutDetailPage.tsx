import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft,
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  XCircle,
  Send,
  Download,
  SkipForward,
  Play,
  RefreshCcw,
  AlertTriangle
} from 'lucide-react';
import { 
  usePayoutBatch, 
  usePayoutBatchItems, 
  usePayoutBatchExport,
  useSubmitBatchForReview,
  useApproveBatch,
  useCancelBatch,
  useStartBatchProcessing,
  useSkipPayoutItem
} from '@/hooks/usePayouts';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: Clock },
  review: { label: 'Review', variant: 'outline', icon: Clock },
  approved: { label: 'Approved', variant: 'default', icon: CheckCircle2 },
  processing: { label: 'Processing', variant: 'outline', icon: RefreshCcw },
  paid: { label: 'Paid', variant: 'default', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', icon: AlertCircle },
  cancelled: { label: 'Cancelled', variant: 'secondary', icon: XCircle },
  queued: { label: 'Queued', variant: 'secondary', icon: Clock },
  skipped: { label: 'Skipped', variant: 'outline', icon: SkipForward },
};

export default function AdminPayoutDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');

  const { data: batch, isLoading: batchLoading } = usePayoutBatch(batchId);
  const { data: items, isLoading: itemsLoading } = usePayoutBatchItems(batchId);
  const { data: exportData } = usePayoutBatchExport(batchId);

  const submitForReview = useSubmitBatchForReview();
  const approveBatch = useApproveBatch();
  const cancelBatch = useCancelBatch();
  const startProcessing = useStartBatchProcessing();
  const skipItem = useSkipPayoutItem();

  const handleSkip = async () => {
    if (!selectedItem || !skipReason) return;
    await skipItem.mutateAsync({ itemId: selectedItem, reason: skipReason });
    setSkipDialogOpen(false);
    setSelectedItem(null);
    setSkipReason('');
  };

  const handleExportCSV = () => {
    if (!exportData || exportData.length === 0) return;
    
    const headers = ['Ambassador', 'Amount', 'Currency', 'Status', 'Transfer ID'];
    const rows = exportData.map((row: any) => [
      row.ambassador_name,
      row.amount,
      row.currency,
      row.status,
      row.provider_transfer_id || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-batch-${batchId?.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (batchLoading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Loading batch...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Batch not found</p>
      </div>
    );
  }

  const batchConfig = statusConfig[batch.status] || statusConfig.draft;
  const StatusIcon = batchConfig.icon;

  const itemsWithIssues = items?.filter(i => 
    !i.payout_account_id || 
    i.payout_account?.kyc_status !== 'verified' ||
    !i.payout_account?.payouts_enabled
  ) || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/payouts')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                Payout Batch: {format(new Date(batch.period_start), 'MMM d, yyyy')} - {format(new Date(batch.period_end), 'MMM d, yyyy')}
              </h1>
              <Badge variant={batchConfig.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {batchConfig.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {batch.items_count} ambassadors • ${batch.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} total
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              {batch.status === 'draft' && (
                <>
                  <Button onClick={() => submitForReview.mutate(batch.id)} disabled={submitForReview.isPending}>
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Review
                  </Button>
                  <Button variant="outline" onClick={() => approveBatch.mutate(batch.id)} disabled={approveBatch.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve Directly
                  </Button>
                  <Button variant="destructive" onClick={() => cancelBatch.mutate(batch.id)} disabled={cancelBatch.isPending}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Batch
                  </Button>
                </>
              )}
              
              {batch.status === 'review' && (
                <>
                  <Button onClick={() => approveBatch.mutate(batch.id)} disabled={approveBatch.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve Batch
                  </Button>
                  <Button variant="destructive" onClick={() => cancelBatch.mutate(batch.id)} disabled={cancelBatch.isPending}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Batch
                  </Button>
                </>
              )}

              {batch.status === 'approved' && (
                <Button onClick={() => startProcessing.mutate(batch.id)} disabled={startProcessing.isPending}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Processing
                </Button>
              )}

              <div className="flex-1" />
              
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Warnings */}
        {itemsWithIssues.length > 0 && batch.status !== 'paid' && batch.status !== 'cancelled' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {itemsWithIssues.length} item(s) have payout account issues. They will be skipped during processing unless resolved.
            </AlertDescription>
          </Alert>
        )}

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payout Items</CardTitle>
            <CardDescription>Individual ambassador payouts in this batch</CardDescription>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading items...</div>
            ) : items?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No items in this batch. This may indicate no eligible commissions in the selected period.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ambassador</TableHead>
                    <TableHead>Payout Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transfer ID</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item) => {
                    const itemConfig = statusConfig[item.status] || statusConfig.queued;
                    const ItemIcon = itemConfig.icon;
                    
                    const hasAccountIssue = !item.payout_account_id || 
                      item.payout_account?.kyc_status !== 'verified' ||
                      !item.payout_account?.payouts_enabled;
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.ambassador_name || 'Unknown'}</TableCell>
                        <TableCell>
                          {item.payout_account_id ? (
                            <div className="space-y-1">
                              <Badge variant={item.payout_account?.payouts_enabled ? 'default' : 'secondary'}>
                                {item.payout_account?.payouts_enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                              <Badge variant={item.payout_account?.kyc_status === 'verified' ? 'default' : 'destructive'}>
                                KYC: {item.payout_account?.kyc_status}
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="destructive">No Account</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={itemConfig.variant} className="gap-1">
                            <ItemIcon className="h-3 w-3" />
                            {itemConfig.label}
                          </Badge>
                          {item.failure_reason && (
                            <p className="text-xs text-destructive mt-1">{item.failure_reason}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.provider_transfer_id || '—'}
                        </TableCell>
                        <TableCell>
                          {item.status === 'queued' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedItem(item.id);
                                setSkipDialogOpen(true);
                              }}
                            >
                              <SkipForward className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Skip Dialog */}
        <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Skip Payout Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reason for skipping</Label>
                <Textarea 
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  placeholder="Enter reason..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSkip} disabled={!skipReason || skipItem.isPending}>
                Skip Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
