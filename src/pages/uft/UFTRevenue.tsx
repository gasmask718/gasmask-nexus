import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { DollarSign, TrendingUp, CreditCard, Wallet, ExternalLink } from 'lucide-react';

const REVENUE_DATA = [
  { month: 'Nov 2025', bookings: 18, gross: 12400, fee: 1860, payouts: 10540, net: 1860 },
  { month: 'Dec 2025', bookings: 24, gross: 18200, fee: 2730, payouts: 15470, net: 2730 },
  { month: 'Jan 2026', bookings: 21, gross: 15800, fee: 2370, payouts: 13430, net: 2370 },
  { month: 'Feb 2026', bookings: 29, gross: 22100, fee: 3315, payouts: 18785, net: 3315 },
  { month: 'Mar 2026', bookings: 35, gross: 28500, fee: 4275, payouts: 24225, net: 4275 },
  { month: 'Apr 2026', bookings: 38, gross: 31200, fee: 4680, payouts: 26520, net: 4680 },
];

const totals = REVENUE_DATA.reduce((acc, r) => ({
  bookings: acc.bookings + r.bookings,
  gross: acc.gross + r.gross,
  fee: acc.fee + r.fee,
  payouts: acc.payouts + r.payouts,
}), { bookings: 0, gross: 0, fee: 0, payouts: 0 });

const stats = [
  { label: 'Total Gross Revenue', value: formatCurrency(totals.gross), icon: DollarSign, color: 'text-green-400' },
  { label: 'Platform Fees (15%)', value: formatCurrency(totals.fee), icon: TrendingUp, color: 'text-purple-400' },
  { label: 'Avg Booking Value', value: formatCurrency(totals.gross / totals.bookings), icon: CreditCard, color: 'text-blue-400' },
  { label: 'Vendor Payouts', value: formatCurrency(totals.payouts), icon: Wallet, color: 'text-orange-400' },
];

export default function UFTRevenue() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revenue & Financial Overview</h1>
          <p className="text-sm text-muted-foreground">Unforgettable Times platform earnings</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" /> Stripe Dashboard
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue Breakdown</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Gross Revenue</TableHead>
                <TableHead className="text-right">Platform Fee</TableHead>
                <TableHead className="text-right">Vendor Payouts</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REVENUE_DATA.map((r) => (
                <TableRow key={r.month}>
                  <TableCell className="font-medium">{r.month}</TableCell>
                  <TableCell className="text-right">{r.bookings}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.gross)}</TableCell>
                  <TableCell className="text-right text-purple-400">{formatCurrency(r.fee)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.payouts)}</TableCell>
                  <TableCell className="text-right text-green-400">{formatCurrency(r.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">* Live data will pull from Stripe once in production mode.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pending Vendor Payouts</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Stripe Connect handles automatic transfers. Manual review required for flagged accounts.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="https://dashboard.stripe.com/connect/transfers" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Stripe Connect Dashboard
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
