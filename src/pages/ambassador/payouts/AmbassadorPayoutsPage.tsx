import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Download,
  Settings,
  Wallet
} from 'lucide-react';
import { useMyPayoutHistory, useMyPayoutAccounts } from '@/hooks/usePayouts';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  queued: { label: 'Pending', variant: 'secondary', icon: Clock },
  processing: { label: 'Processing', variant: 'outline', icon: Clock },
  paid: { label: 'Paid', variant: 'default', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', icon: AlertCircle },
  skipped: { label: 'Skipped', variant: 'secondary', icon: AlertCircle },
};

export default function AmbassadorPayoutsPage() {
  const navigate = useNavigate();
  const { data: payouts, isLoading } = useMyPayoutHistory();
  const { data: accounts } = useMyPayoutAccounts();

  const totalPaid = payouts?.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
  const pendingAmount = payouts?.filter((p: any) => ['queued', 'processing'].includes(p.status)).reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
  const hasPayoutAccount = accounts && accounts.length > 0;
  const activeAccount = accounts?.find((a: any) => a.payouts_enabled);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">My Payouts</h1>
              <p className="text-muted-foreground">Track your commission payments</p>
            </div>
          </div>
          
          <Button variant="outline" onClick={() => navigate('/ambassador/settings/payouts')}>
            <Settings className="h-4 w-4 mr-2" />
            Payout Settings
          </Button>
        </div>

        {/* Cash Payout Notice */}
        {!hasPayoutAccount && (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div className="flex-1">
                  <p className="font-medium">Cash payouts handled directly</p>
                  <p className="text-sm text-muted-foreground">
                    Online payout setup is coming soon. You can add your contact details below for record-keeping.
                  </p>
                </div>
                <Button variant="outline" onClick={() => navigate('/ambassador/settings/payouts')}>
                  Add Details
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                ${pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Payout Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">
                {activeAccount ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {activeAccount.provider === 'stripe' ? 'Stripe Connected' : 'Manual'}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not configured</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payout History */}
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
            <CardDescription>Your commission payment history</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading payouts...</div>
            ) : !payouts || payouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payouts yet. Keep earning commissions!
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout: any) => {
                    const config = statusConfig[payout.status] || statusConfig.queued;
                    const StatusIcon = config.icon;
                    
                    return (
                      <TableRow 
                        key={payout.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/ambassador/payouts/${payout.id}`)}
                      >
                        <TableCell className="font-medium">
                          {payout.payout_batches ? (
                            <>
                              {format(new Date(payout.payout_batches.period_start), 'MMM d')} - {format(new Date(payout.payout_batches.period_end), 'MMM d, yyyy')}
                            </>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${payout.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {payout.payout_batches?.payout_provider === 'stripe' ? 'Stripe' : 'Manual'}
                          </Badge>
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
