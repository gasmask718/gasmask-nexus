import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  TrendingUp, DollarSign, BarChart3, Package, Users,
  Percent, ShoppingBag, AlertTriangle
} from 'lucide-react';

export default function ThingsToDoProfitDashboard() {
  const { data: bookings = [] } = useQuery({
    queryKey: ['ttd_profit_bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_bookings')
        .select('*, experiences_master(title, city, category, price, markup_pct, display_price)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['experience_customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_customers')
        .select('*')
        .order('total_spend', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['experience_alerts_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Metrics
  const totalRevenue = bookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
  const totalProfit = bookings.reduce((s: number, b: any) => s + Number(b.profit || 0), 0);
  const totalAddonRevenue = bookings.reduce((s: number, b: any) => s + Number(b.addon_total || 0), 0);
  const avgMarkup = bookings.length
    ? bookings.reduce((s: number, b: any) => {
        const base = Number(b.base_price || b.experiences_master?.price || 0);
        const markup = Number(b.markup_amount || 0);
        return s + (base > 0 ? (markup / base) * 100 : Number(b.experiences_master?.markup_pct || 15));
      }, 0) / bookings.length
    : 15;

  const completedBookings = bookings.filter((b: any) => b.booking_status === 'completed');
  const conversionRate = bookings.length
    ? ((completedBookings.length / bookings.length) * 100).toFixed(1)
    : '0';

  // Top experiences by revenue
  const expRevMap = new Map<string, { title: string; revenue: number; count: number }>();
  bookings.forEach((b: any) => {
    const title = b.experiences_master?.title || 'Unknown';
    const existing = expRevMap.get(title) || { title, revenue: 0, count: 0 };
    expRevMap.set(title, {
      title,
      revenue: existing.revenue + Number(b.total_price || 0),
      count: existing.count + 1,
    });
  });
  const topExperiences = Array.from(expRevMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-emerald-500" />
          Profit Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Revenue, profit, and performance metrics for the Experience Engine</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> Total Bookings</p>
          <p className="text-2xl font-bold">{bookings.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Revenue</p>
          <p className="text-2xl font-bold text-emerald-500">${totalRevenue.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Profit</p>
          <p className="text-2xl font-bold text-violet-500">${totalProfit.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" /> Avg Markup</p>
          <p className="text-2xl font-bold">{avgMarkup.toFixed(1)}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Add-on Revenue</p>
          <p className="text-2xl font-bold text-blue-500">${totalAddonRevenue.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Conversion</p>
          <p className="text-2xl font-bold">{conversionRate}%</p>
        </CardContent></Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Active Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-2 rounded bg-muted/50">
                <Badge variant={a.severity === 'critical' ? 'destructive' : 'outline'} className="text-xs mt-0.5">
                  {a.severity}
                </Badge>
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Experiences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Experiences by Revenue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topExperiences.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No booking data yet</TableCell></TableRow>
              ) : (
                topExperiences.map((e, i) => (
                  <TableRow key={e.title}>
                    <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell><Badge variant="outline">{e.count}</Badge></TableCell>
                    <TableCell className="font-semibold text-emerald-600">${e.revenue.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Top Customers
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Spend</TableHead>
                <TableHead>Upsells</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No customer data yet</TableCell></TableRow>
              ) : (
                customers.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{c.email || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{c.total_bookings}</Badge></TableCell>
                    <TableCell className="font-semibold">${Number(c.total_spend).toLocaleString()}</TableCell>
                    <TableCell>{c.upsells_accepted}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
