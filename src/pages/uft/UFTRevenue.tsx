import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { DollarSign, TrendingUp, Calendar, Target, CreditCard, Users, ShoppingBag, ExternalLink, AlertCircle } from 'lucide-react';
import { getUFTPlatformMetrics } from '@/services/uftApi';

export default function UFTRevenue() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['uft-platform-metrics'],
    queryFn: getUFTPlatformMetrics,
  });

  const stats = [
    { label: 'Total Revenue', value: formatCurrency(metrics?.total_revenue ?? 0), icon: DollarSign, color: 'text-green-400' },
    { label: 'This Month', value: formatCurrency(metrics?.this_month_revenue ?? 0), icon: TrendingUp, color: 'text-purple-400' },
    { label: 'Total Bookings', value: String(metrics?.total_bookings ?? 0), icon: Calendar, color: 'text-blue-400' },
    { label: 'Conversion Rate', value: `${(metrics?.conversion_rate ?? 0).toFixed(1)}%`, icon: Target, color: 'text-orange-400' },
  ];

  const externalCards = [
    {
      icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-500/10',
      title: 'Stripe Dashboard',
      text: 'Live transactions, payouts, disputes, and refunds',
      href: 'https://dashboard.stripe.com',
      label: 'Open Stripe',
    },
    {
      icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10',
      title: 'Vendor Payouts',
      text: 'Vendor Stripe Connect accounts and payout status (85% per booking)',
      href: 'https://dashboard.stripe.com/connect/accounts',
      label: 'View Connect Accounts',
    },
    {
      icon: ShoppingBag, color: 'text-green-400', bg: 'bg-green-500/10',
      title: 'Shop Revenue',
      text: 'Dropship orders, product performance, and shop analytics',
      href: 'https://unforgettable-times-usa.myshopify.com/admin',
      label: 'Open Shopify Admin',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          <AlertCircle className="h-4 w-4" /> Live UFT metrics unavailable.
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Revenue & Financial Overview</h1>
        <p className="text-sm text-muted-foreground">Unforgettable Times platform earnings</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
              {isLoading ? <Skeleton className="h-7 w-24" /> : <p className="text-2xl font-bold">{s.value}</p>}
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {externalCards.map(c => (
          <Card key={c.title}>
            <CardHeader>
              <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <CardTitle className="text-base">{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{c.text}</p>
              <Button variant="outline" size="sm" asChild className="w-full">
                <a href={c.href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> {c.label} →
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-4 text-sm text-yellow-200">
          <strong>Note:</strong> Full monthly revenue breakdown will populate after the first 30 days of live
          transactions. Add Stripe keys to UFT to begin processing payments.
        </CardContent>
      </Card>
    </div>
  );
}
