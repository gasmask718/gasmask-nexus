import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, TrendingUp, AlertTriangle, FileText, Plus, 
  ArrowRight, Clock, CheckCircle, XCircle, Users, 
  CreditCard, Receipt, Wallet, BarChart3
} from 'lucide-react';
import { useUnifiedInvoiceFeed, useARAgingBuckets, UnifiedInvoice } from '@/hooks/useUnifiedInvoiceFeed';
import { format, differenceInDays } from 'date-fns';

export default function Floor5Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useUnifiedInvoiceFeed();
  const agingBuckets = useARAgingBuckets();

  const stats = data?.stats;
  const recentInvoices = data?.invoices?.slice(0, 8) || [];
  const overdueInvoices = data?.invoices?.filter(inv => {
    if (inv.status === 'paid' || inv.status === 'void') return false;
    if (!inv.due_date) return false;
    return new Date(inv.due_date) < new Date();
  }).slice(0, 5) || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      paid: 'default',
      sent: 'secondary',
      overdue: 'destructive',
      partial: 'outline',
      unpaid: 'outline',
      draft: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            Floor 5: Finance & Orders
          </h1>
          <p className="text-muted-foreground">Financial command center for billing, invoices, and payroll</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/billing/invoices')}>
            <FileText className="mr-2 h-4 w-4" />
            All Invoices
          </Button>
          <Button onClick={() => navigate('/billing/invoices/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  ${stats?.totalPaid?.toLocaleString() || '0'}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.paidCount || 0} paid invoices
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding AR</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${stats?.totalOutstanding?.toLocaleString() || '0'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.unpaidCount || 0} unpaid invoices
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">
                  ${stats?.overdueAmount?.toLocaleString() || '0'}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.overdueCount || 0} overdue invoices
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold">{stats?.invoiceCount || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-primary opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              All time invoice count
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AR Aging */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              AR Aging Buckets
            </CardTitle>
            <CardDescription>Accounts receivable by age</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(agingBuckets).map(([bucket, data]) => {
              const label = bucket === 'current' ? 'Current' : `${bucket} days`;
              const isOverdue = bucket !== 'current';
              return (
                <div key={bucket} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={isOverdue && data.amount > 0 ? 'text-red-500 font-medium' : ''}>
                      {label}
                    </span>
                    <span className="font-medium">
                      ${data.amount.toLocaleString()} ({data.count})
                    </span>
                  </div>
                  <Progress 
                    value={stats?.totalOutstanding ? (data.amount / stats.totalOutstanding) * 100 : 0} 
                    className={`h-2 ${isOverdue && data.amount > 0 ? 'bg-red-100' : ''}`}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Latest invoice activity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/billing/invoices')}>
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : recentInvoices.length > 0 ? (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/billing/invoices/${invoice.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">{invoice.entity_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">${invoice.total_amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d') : 'No due date'}
                        </p>
                      </div>
                      {getStatusBadge(invoice.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No invoices found</p>
                <Button className="mt-4" onClick={() => navigate('/billing/invoices/new')}>
                  Create First Invoice
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Queue + Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-5 w-5" />
                Overdue Invoices
              </CardTitle>
              <CardDescription>Requires immediate attention</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/unpaid-accounts')}>
              Collections <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {overdueInvoices.length > 0 ? (
              <div className="space-y-3">
                {overdueInvoices.map((invoice) => {
                  const daysOverdue = invoice.due_date 
                    ? differenceInDays(new Date(), new Date(invoice.due_date))
                    : 0;
                  return (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 border border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-900/10"
                    >
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">{invoice.entity_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">${invoice.balance_due.toLocaleString()}</p>
                        <Badge variant="destructive" className="text-xs">
                          {daysOverdue} days overdue
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                <p>No overdue invoices</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common finance operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate('/billing/invoices/new')}
            >
              <Plus className="mr-3 h-4 w-4" />
              Create New Invoice
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate('/billing/invoices')}
            >
              <FileText className="mr-3 h-4 w-4" />
              View All Invoices
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate('/unpaid-accounts')}
            >
              <AlertTriangle className="mr-3 h-4 w-4" />
              Unpaid Accounts / Collections
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate('/payroll')}
            >
              <Users className="mr-3 h-4 w-4" />
              Payroll Management
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate('/wholesale/fulfillment')}
            >
              <Receipt className="mr-3 h-4 w-4" />
              Wholesale Fulfillment
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate('/billing-center')}
            >
              <CreditCard className="mr-3 h-4 w-4" />
              Billing Center
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
