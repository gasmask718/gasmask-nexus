
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, ShoppingBag, Rocket } from 'lucide-react';

export default function UTRevenueDashboard() {
  const { data: bookings } = useQuery({
    queryKey: ['ut-revenue-bookings'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_event_bookings' as any).select('*') as any);
      return (data || []) as any[];
    },
  });

  const { data: kitOrders } = useQuery({
    queryKey: ['ut-revenue-kits'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_kit_orders' as any).select('*') as any);
      return (data || []) as any[];
    },
  });

  const eventRevenue = (bookings || []).reduce((s: number, b: any) => s + Number(b.total_price || b.budget || 0), 0);
  const kitRevenue = (kitOrders || []).reduce((s: number, k: any) => s + Number(k.total_paid || 0), 0);
  const totalGross = eventRevenue + kitRevenue;
  const netEstimate = totalGross * 0.29; // ~29% net margin based on simulator

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">💰 Revenue Dashboard</h1>
        <p className="text-muted-foreground">Your complete Dynasty financial picture</p>
      </div>

      <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
        <CardContent className="p-6 text-center">
          <DollarSign className="mx-auto h-8 w-8 text-green-500 mb-2" />
          <p className="text-4xl font-bold text-green-500">${totalGross.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Total Gross Revenue</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><span className="text-lg">🎉</span><p className="font-semibold">Event Bookings</p></div>
            <p className="text-2xl font-bold">${eventRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{(bookings || []).length} bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><span className="text-lg">🛍️</span><p className="font-semibold">Shop Sales</p></div>
            <p className="text-2xl font-bold">$0</p>
            <p className="text-xs text-muted-foreground">Connect Shopify</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><span className="text-lg">🚀</span><p className="font-semibold">Kit Sales</p></div>
            <p className="text-2xl font-bold">${kitRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{(kitOrders || []).length} orders</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Estimated Net Profit</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between"><span>📊 Gross Revenue</span><span className="font-bold">${totalGross.toLocaleString()}</span></div>
            <div className="flex justify-between text-red-400"><span>🤝 Est. Ambassador Commissions</span><span>-${(totalGross * 0.12).toLocaleString()}</span></div>
            <div className="flex justify-between text-red-400"><span>🏭 Est. Vendor Costs (57%)</span><span>-${(totalGross * 0.57).toLocaleString()}</span></div>
            <hr className="border-border" />
            <div className="flex justify-between text-green-500 font-bold text-lg"><span>💰 Est. Net Profit</span><span>${netEstimate.toLocaleString()}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
