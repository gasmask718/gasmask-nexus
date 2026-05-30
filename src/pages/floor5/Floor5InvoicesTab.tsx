import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileText, ArrowRight, BarChart3, Plus, CheckCircle, Clock } from 'lucide-react';
import { useUnifiedInvoiceFeed, useARAgingBuckets } from '@/hooks/useUnifiedInvoiceFeed';
import { useInvoiceSystemCounts } from '@/hooks/usePaginatedInvoiceFeed';
import { format } from 'date-fns';

export default function Floor5InvoicesTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useUnifiedInvoiceFeed();
  const agingBuckets = useARAgingBuckets();
  const { data: systemCounts } = useInvoiceSystemCounts();

  const stats = data?.stats;
  const recentInvoices = data?.invoices?.slice(0, 10) || [];
  const totalInvoiceCount = systemCounts?.totalSystemWide || stats?.invoiceCount || 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      paid: 'default', sent: 'secondary', overdue: 'destructive',
      partial: 'outline', unpaid: 'outline', draft: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Invoices & Billing</h2>
          <p className="text-sm text-muted-foreground">All invoices across brands</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/billing/invoices')}>
            All Invoices <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => navigate('/billing/invoices/new')}>
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Collected</p>
            <p className="text-2xl font-bold text-emerald-500">${stats?.totalPaid?.toLocaleString() || '0'}</p>
            <p className="text-xs text-muted-foreground">{stats?.paidCount || 0} paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold text-amber-500">${stats?.totalOutstanding?.toLocaleString() || '0'}</p>
            <p className="text-xs text-muted-foreground">{stats?.unpaidCount || 0} unpaid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold text-red-500">${stats?.overdueAmount?.toLocaleString() || '0'}</p>
            <p className="text-xs text-muted-foreground">{stats?.overdueCount || 0} overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Invoices</p>
            <p className="text-2xl font-bold">{totalInvoiceCount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AR Aging */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> AR Aging
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(agingBuckets).map(([bucket, bdata]) => {
              const label = bucket === 'current' ? 'Current' : `${bucket} days`;
              const isOverdue = bucket !== 'current';
              return (
                <div key={bucket} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={isOverdue && bdata.amount > 0 ? 'text-destructive font-medium' : ''}>
                      {label}
                    </span>
                    <span className="font-medium">${bdata.amount.toLocaleString()} ({bdata.count})</span>
                  </div>
                  <Progress
                    value={stats?.totalOutstanding ? (bdata.amount / stats.totalOutstanding) * 100 : 0}
                    className="h-2"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : recentInvoices.length > 0 ? (
              <div className="space-y-2">
                {recentInvoices.map(inv => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer"
                    onClick={() => navigate(`/billing/invoices/${inv.id}`)}
                  >
                    <div>
                      <p className="font-medium">{inv.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">{inv.entity_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold">${inv.total_amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}
                        </p>
                      </div>
                      {getStatusBadge(inv.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No invoices found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
