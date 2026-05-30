import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DollarSign, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  RefreshCcw
} from 'lucide-react';
import { usePayoutBatches, usePayoutStats, useCreatePayoutBatch } from '@/hooks/usePayouts';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: Clock },
  review: { label: 'Review', variant: 'outline', icon: Clock },
  approved: { label: 'Approved', variant: 'default', icon: CheckCircle2 },
  processing: { label: 'Processing', variant: 'outline', icon: RefreshCcw },
  paid: { label: 'Paid', variant: 'default', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', icon: AlertCircle },
  cancelled: { label: 'Cancelled', variant: 'secondary', icon: AlertCircle },
};

export default function AdminPayoutsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  
  // Default to last week
  const defaultStart = format(startOfWeek(subDays(new Date(), 7)), 'yyyy-MM-dd');
  const defaultEnd = format(endOfWeek(subDays(new Date(), 7)), 'yyyy-MM-dd');
  
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [provider, setProvider] = useState<'stripe' | 'manual'>('stripe');

  const { data: batches, isLoading } = usePayoutBatches(statusFilter);
  const { data: stats } = usePayoutStats();
  const createBatch = useCreatePayoutBatch();

  const handleCreate = async () => {
    const batchId = await createBatch.mutateAsync({ 
      periodStart, 
      periodEnd, 
      provider 
    });
    setCreateOpen(false);
    if (batchId) {
      navigate(`/admin/payouts/${batchId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Payout Management</h1>
              <p className="text-muted-foreground">Create, review, and process ambassador payouts</p>
            </div>
          </div>
          
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Create Payout Batch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Payout Batch</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Period Start</Label>
                    <Input 
                      type="date" 
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Period End</Label>
                    <Input 
                      type="date" 
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payout Provider</Label>
                  <Select value={provider} onValueChange={(v: 'stripe' | 'manual') => setProvider(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stripe">Stripe Connect</SelectItem>
                      <SelectItem value="manual">Manual (Cash/ACH)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createBatch.isPending}>
                  {createBatch.isPending ? 'Creating...' : 'Create Batch'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${(stats?.totalPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                ${(stats?.pendingAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.reviewBatches || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.processingBatches || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Batch List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payout Batches</CardTitle>
                <CardDescription>All payout runs and their status</CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading batches...</div>
            ) : batches?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payout batches found. Create your first batch to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches?.map((batch) => {
                    const config = statusConfig[batch.status] || statusConfig.draft;
                    const StatusIcon = config.icon;
                    
                    return (
                      <TableRow 
                        key={batch.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/admin/payouts/${batch.id}`)}
                      >
                        <TableCell className="font-medium">
                          {format(new Date(batch.period_start), 'MMM d, yyyy')} - {format(new Date(batch.period_end), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {batch.payout_provider === 'stripe' ? 'Stripe' : 'Manual'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{batch.items_count}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${batch.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {format(new Date(batch.created_at), 'MMM d, yyyy, h:mm a')}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
