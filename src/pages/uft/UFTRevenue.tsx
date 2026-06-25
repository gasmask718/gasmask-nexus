import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import {
  DollarSign, TrendingUp, Calendar, Target, CreditCard, Users, ShoppingBag,
  ExternalLink, AlertCircle, Car,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getUFTPlatformMetrics, getUFTTransportReferrals } from '@/services/uftApi';

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  confirmed: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  completed: 'bg-green-500/20 text-green-300 border-green-500/40',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/40',
};

export default function UFTRevenue() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['uft-platform-metrics'],
    queryFn: getUFTPlatformMetrics,
  });

  const { data: transportData, isLoading: transportLoading } = useQuery({
    queryKey: ['uft-transport-referrals'],
    queryFn: () => getUFTTransportReferrals(),
  });

  const referrals = transportData?.referrals || [];
  const totalFees = referrals.reduce((s, r) => s + Number(r.uft_fee_10pct || 0), 0);
  const avgFee = referrals.length ? totalFees / referrals.length : 0;
  const vehicleCounts = referrals.reduce<Record<string, number>>((acc, r) => {
    acc[r.vehicle_type] = (acc[r.vehicle_type] || 0) + 1;
    return acc;
  }, {});
  const topVehicle = Object.entries(vehicleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="external">External Dashboards</TabsTrigger>
          <TabsTrigger value="transportation">Transportation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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

          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 text-sm text-yellow-200">
              <strong>Note:</strong> Full monthly revenue breakdown will populate after the first 30 days of live
              transactions. Add Stripe keys to UFT to begin processing payments.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="transportation" className="space-y-6">
          <Card>
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Referrals</p>
                <p className="text-2xl font-bold">{referrals.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total UFT Fees Earned</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(totalFees)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Fee / Booking</p>
                <p className="text-2xl font-bold">{formatCurrency(avgFee)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Top Vehicle Type</p>
                <p className="text-2xl font-bold capitalize">{topVehicle}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4 text-slate-400" /> Transportation Referrals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transportLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : referrals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No transportation referrals yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Booking Amount</TableHead>
                      <TableHead className="text-right">UFT Fee (10%)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="capitalize">{r.vehicle_type}</TableCell>
                        <TableCell>{r.city}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(r.booking_amount || 0))}</TableCell>
                        <TableCell className="text-right text-green-400">{formatCurrency(Number(r.uft_fee_10pct || 0))}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColor[r.status] || ''}>{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-500/30 bg-slate-500/5">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center mb-2">
                <Car className="h-5 w-5 text-slate-300" />
              </div>
              <CardTitle className="text-base">TopTier Experience Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                View full transportation bookings, partner payouts, and dispatch logs.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/os/toptier">
                  <ExternalLink className="h-4 w-4 mr-1" /> Open TopTier OS →
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
