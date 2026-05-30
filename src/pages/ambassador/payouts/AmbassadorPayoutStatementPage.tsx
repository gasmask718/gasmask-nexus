import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowLeft,
  DollarSign, 
  Download,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { usePayoutStatement } from '@/hooks/usePayouts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function AmbassadorPayoutStatementPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  
  const { data: lines, isLoading: linesLoading } = usePayoutStatement(itemId);
  
  // Fetch the payout item details
  const { data: item } = useQuery({
    queryKey: ['payout-item', itemId],
    queryFn: async () => {
      if (!itemId) return null;
      const { data, error } = await (supabase as any)
        .from('payout_batch_items')
        .select(`
          *,
          payout_batches(period_start, period_end, payout_provider)
        `)
        .eq('id', itemId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  const handleExportCSV = () => {
    if (!lines || lines.length === 0) return;
    
    const headers = ['Date', 'Source', 'Channel', 'Amount'];
    const rows = lines.map((line: any) => [
      format(new Date(line.earned_at), 'yyyy-MM-dd'),
      line.source_name,
      line.source_channel,
      line.commission_amount
    ]);
    
    const csv = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-statement-${itemId?.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: any }> = {
    queued: { label: 'Pending', variant: 'secondary', icon: Clock },
    processing: { label: 'Processing', variant: 'secondary', icon: Clock },
    paid: { label: 'Paid', variant: 'default', icon: CheckCircle2 },
    failed: { label: 'Failed', variant: 'destructive', icon: AlertCircle },
    skipped: { label: 'Skipped', variant: 'secondary', icon: AlertCircle },
  };

  const config = item ? (statusConfig[item.status] || statusConfig.queued) : statusConfig.queued;
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ambassador/payouts')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Payout Statement</h1>
            {item?.payout_batches && (
              <p className="text-muted-foreground">
                {format(new Date(item.payout_batches.period_start), 'MMM d, yyyy')} - {format(new Date(item.payout_batches.period_end), 'MMM d, yyyy')}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleExportCSV} disabled={!lines || lines.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </div>

        {/* Summary */}
        {item && (
          <Card>
            <CardContent className="py-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={config.variant} className="gap-1 mt-1">
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium">{item.payout_batches?.payout_provider === 'stripe' ? 'Stripe' : 'Manual'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Line Items</p>
                  <p className="font-medium">{lines?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Commission Details</CardTitle>
            <CardDescription>Individual commissions included in this payout</CardDescription>
          </CardHeader>
          <CardContent>
            {linesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading statement...</div>
            ) : !lines || lines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No line items found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line: any) => (
                    <TableRow key={line.commission_id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(line.earned_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{line.source_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{line.source_channel}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${line.commission_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
