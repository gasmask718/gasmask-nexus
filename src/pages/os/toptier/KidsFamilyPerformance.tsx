import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, DollarSign, TrendingUp, Users, MapPin, Package } from 'lucide-react';

export default function KidsFamilyPerformance() {
  const { data: bundles = [] } = useQuery({
    queryKey: ['kf-bundles-perf'],
    queryFn: async () => {
      const { data } = await supabase.from('kf_bundles').select('*').order('total_sold', { ascending: false });
      return data || [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['kf-vendors-perf'],
    queryFn: async () => {
      const { data } = await supabase.from('kf_vendors').select('*').eq('status', 'approved');
      return data || [];
    },
  });

  const { data: families = [] } = useQuery({
    queryKey: ['kf-families-perf'],
    queryFn: async () => {
      const { data } = await supabase.from('kf_family_profiles').select('*').order('total_spend', { ascending: false }).limit(10);
      return data || [];
    },
  });

  const totalBundleRevenue = bundles.reduce((a: number, b: any) => a + ((b.final_price || 0) * (b.total_sold || 0)), 0);
  const totalVendorRevenue = vendors.reduce((a: number, v: any) => a + (v.total_revenue || 0), 0);
  const avgMarkup = bundles.length ? (bundles.reduce((a: number, b: any) => a + (b.markup_pct || 0), 0) / bundles.length).toFixed(1) : '0';

  const cityBreakdown = vendors.reduce((acc: Record<string, number>, v: any) => {
    if (v.city) acc[v.city] = (acc[v.city] || 0) + 1;
    return acc;
  }, {});
  const topCities = Object.entries(cityBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Performance Dashboard</h1>
        <p className="text-sm text-white/50">Kids & Family revenue, bookings & intelligence</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Bundle Revenue', value: `$${totalBundleRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[#C9A84C]' },
          { label: 'Vendor Revenue', value: `$${totalVendorRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Avg Markup', value: `${avgMarkup}%`, icon: BarChart3, color: 'text-blue-400' },
          { label: 'Active Vendors', value: vendors.length, icon: Users, color: 'text-purple-400' },
        ].map(s => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-xs text-white/40">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><Package className="h-5 w-5 text-[#C9A84C]" /> Top Bundles</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {bundles.slice(0, 5).map((b: any, i: number) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-[#C9A84C] font-bold text-lg">#{i + 1}</span>
                  <div>
                    <p className="text-white font-medium text-sm">{b.bundle_name}</p>
                    <p className="text-white/40 text-xs">{b.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#C9A84C] font-bold">${b.final_price?.toFixed(2)}</p>
                  <p className="text-white/40 text-xs">{b.total_sold || 0} sold</p>
                </div>
              </div>
            ))}
            {bundles.length === 0 && <p className="text-white/30 text-center py-4">No bundles yet</p>}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><MapPin className="h-5 w-5 text-blue-400" /> Revenue by City</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {topCities.map(([city, count], i) => (
              <div key={city} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 font-bold">#{i + 1}</span>
                  <p className="text-white font-medium text-sm">{city}</p>
                </div>
                <Badge className="bg-blue-500/20 text-blue-400">{count as number} vendors</Badge>
              </div>
            ))}
            {topCities.length === 0 && <p className="text-white/30 text-center py-4">No city data yet</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><Users className="h-5 w-5 text-purple-400" /> Top Family Profiles</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {families.map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div>
                <p className="text-white font-medium text-sm">{f.parent_name || f.email || 'Unknown'}</p>
                <p className="text-white/40 text-xs">{f.city}, {f.state} · {f.total_bookings || 0} bookings</p>
              </div>
              <div className="text-right">
                <p className="text-[#C9A84C] font-bold">${(f.total_spend || 0).toLocaleString()}</p>
                {f.vip_status && <Badge className="bg-purple-500/20 text-purple-400">VIP</Badge>}
              </div>
            </div>
          ))}
          {families.length === 0 && <p className="text-white/30 text-center py-4">No family profiles yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}
