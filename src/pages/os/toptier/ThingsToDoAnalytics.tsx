import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, TrendingUp, Package, AlertTriangle } from 'lucide-react';

export default function ThingsToDoAnalytics() {
  const { data: bookings = [] } = useQuery({
    queryKey: ['experience_bookings_analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_bookings')
        .select('selected_addons, total_price, booking_status, created_at');
      if (error) throw error;
      return data;
    },
  });

  const { data: syncErrors = [] } = useQuery({
    queryKey: ['experience_sync_errors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_sync_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Aggregate add-on data
  const addonMap = new Map<string, { count: number; revenue: number }>();
  bookings.forEach((b: any) => {
    if (Array.isArray(b.selected_addons)) {
      b.selected_addons.forEach((a: any) => {
        const name = typeof a === 'string' ? a : a.name || 'Unknown';
        const price = typeof a === 'object' ? Number(a.price || 0) : 0;
        const existing = addonMap.get(name) || { count: 0, revenue: 0 };
        addonMap.set(name, { count: existing.count + 1, revenue: existing.revenue + price });
      });
    }
  });

  const addonStats = Array.from(addonMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalAddonRevenue = addonStats.reduce((s, a) => s + a.revenue, 0);
  const totalBookingRevenue = bookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-purple-500" />
          Things To Do — Analytics
        </h1>
        <p className="text-muted-foreground text-sm">Upsell performance, add-on tracking, and error monitoring</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Booking Revenue</p>
            <p className="text-2xl font-bold text-emerald-500">${totalBookingRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Add-on Revenue</p>
            <p className="text-2xl font-bold text-violet-500">${totalAddonRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Unique Add-ons Tracked</p>
            <p className="text-2xl font-bold">{addonStats.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Add-on Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" /> Add-on Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Add-on</TableHead>
                <TableHead>Times Selected</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addonStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                    No add-on data yet — bookings with add-ons will appear here
                  </TableCell>
                </TableRow>
              ) : (
                addonStats.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell><Badge variant="outline">{a.count}x</Badge></TableCell>
                    <TableCell className="font-semibold text-emerald-600">${a.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sync Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Sync & Error Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncErrors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                    No errors recorded
                  </TableCell>
                </TableRow>
              ) : (
                syncErrors.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">{e.error_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[400px] truncate">{e.error_message}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
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
