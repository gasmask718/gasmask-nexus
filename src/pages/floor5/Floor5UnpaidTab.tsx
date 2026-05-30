import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, Calendar, DollarSign } from 'lucide-react';
import { useUnifiedInvoiceFeed } from '@/hooks/useUnifiedInvoiceFeed';
import { differenceInDays, format } from 'date-fns';

export default function Floor5UnpaidTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useUnifiedInvoiceFeed();

  const unpaidInvoices = data?.invoices?.filter(inv =>
    inv.status !== 'paid' && inv.status !== 'void' && inv.balance_due > 0
  ) || [];

  const overdueInvoices = unpaidInvoices.filter(inv =>
    inv.due_date && new Date(inv.due_date) < new Date()
  );

  const totalUnpaid = unpaidInvoices.reduce((s, inv) => s + inv.balance_due, 0);
  const totalOverdue = overdueInvoices.reduce((s, inv) => s + inv.balance_due, 0);

  // Group by overdue severity
  const tiers = {
    current: unpaidInvoices.filter(inv => !inv.due_date || new Date(inv.due_date) >= new Date()),
    '1-30': overdueInvoices.filter(inv => {
      const days = differenceInDays(new Date(), new Date(inv.due_date!));
      return days >= 1 && days <= 30;
    }),
    '31-60': overdueInvoices.filter(inv => {
      const days = differenceInDays(new Date(), new Date(inv.due_date!));
      return days > 30 && days <= 60;
    }),
    '61+': overdueInvoices.filter(inv => {
      const days = differenceInDays(new Date(), new Date(inv.due_date!));
      return days > 60;
    }),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Unpaid Accounts
          </h2>
          <p className="text-sm text-muted-foreground">Follow-up tracking and collection management</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/unpaid-accounts')}>
          Full Collections <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Unpaid</p>
            <p className="text-2xl font-bold text-amber-500">${totalUnpaid.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{unpaidInvoices.length} accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold text-destructive">${totalOverdue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{overdueInvoices.length} past due</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Current (Not Due)</p>
            <p className="text-2xl font-bold text-emerald-500">${(totalUnpaid - totalOverdue).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{tiers.current.length} accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Tiers */}
      {Object.entries(tiers).map(([tier, invoices]) => {
        if (invoices.length === 0) return null;
        const tierLabels: Record<string, string> = {
          current: '✅ Current (Not Due Yet)',
          '1-30': '⚠️ 1–30 Days Overdue',
          '31-60': '🔴 31–60 Days Overdue',
          '61+': '🚨 61+ Days Overdue (Critical)',
        };
        return (
          <Card key={tier} className={tier === '61+' ? 'border-destructive/50' : ''}>
            <CardHeader>
              <CardTitle className="text-base">{tierLabels[tier]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {invoices.slice(0, 10).map(inv => {
                  const daysOverdue = inv.due_date
                    ? differenceInDays(new Date(), new Date(inv.due_date))
                    : 0;
                  return (
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
                          <p className="font-bold">${inv.balance_due.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}
                          </p>
                        </div>
                        {daysOverdue > 0 && (
                          <Badge variant="destructive" className="text-xs">{daysOverdue}d</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {invoices.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{invoices.length - 10} more accounts
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {!isLoading && unpaidInvoices.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">All accounts are current</p>
            <p className="text-sm">No unpaid invoices found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
