import { useQuery } from '@tanstack/react-query';
import { fetchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Users, Star } from 'lucide-react';

export default function PenthouseAnalytics() {
  const { data: bookings = [] } = useQuery({
    queryKey: ['ph-analytics-bookings'],
    queryFn: () => fetchTopTierData('tt_bookings', { select: '*' }),
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['ph-analytics-partners'],
    queryFn: () => fetchTopTierData('tt_partners', { select: '*' }),
  });

  const { data: earnings = [] } = useQuery({
    queryKey: ['ph-analytics-earnings'],
    queryFn: () => fetchTopTierData('tt_partner_earnings', { select: '*' }),
  });

  // Revenue by category
  const revenueByCategory = bookings.reduce((acc: Record<string, number>, b: any) => {
    const cat = b.service_type || 'Other';
    acc[cat] = (acc[cat] || 0) + Number(b.total_price || 0);
    return acc;
  }, {});

  // Top partners by bookings
  const topPartners = [...partners]
    .sort((a: any, b: any) => (b.total_bookings || 0) - (a.total_bookings || 0))
    .slice(0, 5);

  // Booking status breakdown
  const statusBreakdown = bookings.reduce((acc: Record<string, number>, b: any) => {
    acc[b.status || 'unknown'] = (acc[b.status || 'unknown'] || 0) + 1;
    return acc;
  }, {});

  // Monthly trend
  const monthlyRevenue = bookings.reduce((acc: Record<string, number>, b: any) => {
    const month = b.created_at?.slice(0, 7) || 'unknown';
    acc[month] = (acc[month] || 0) + Number(b.total_price || 0);
    return acc;
  }, {});

  const cancellations = bookings.filter((b: any) => b.status === 'cancelled').length;
  const conversionRate = bookings.length > 0
    ? Math.round((bookings.filter((b: any) => b.status === 'confirmed').length / bookings.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Analytics & Intelligence</h1>
        <p className="text-white/40 text-sm mt-1">Business intelligence and performance metrics</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, color: '#22c55e' },
          { label: 'Cancellations', value: cancellations, icon: BarChart3, color: '#ef4444' },
          { label: 'Active Partners', value: partners.filter((p: any) => p.status === 'active').length, icon: Users, color: '#C9A84C' },
          { label: 'Avg Trust Score', value: partners.length ? (partners.reduce((s: number, p: any) => s + (p.trust_score || 0), 0) / partners.length).toFixed(1) : '0', icon: Star, color: '#C9A84C' },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111] border-white/5">
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
              <s.icon className="h-4 w-4" style={{ color: s.color, opacity: 0.5 }} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Revenue by Category */}
        <Card className="bg-[#111] border-white/5">
          <CardHeader><CardTitle className="text-sm text-white/70">Revenue by Category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(revenueByCategory).sort(([,a], [,b]) => (b as number) - (a as number)).map(([cat, rev]) => (
              <div key={cat} className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-2 h-2 rounded-full bg-[#C9A84C]" />
                  <span className="text-sm text-white/70">{cat}</span>
                  <div className="flex-1 mx-3">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#C9A84C]/60 rounded-full" style={{ width: `${Math.min(100, ((rev as number) / Math.max(...Object.values(revenueByCategory) as number[])) * 100)}%` }} />
                    </div>
                  </div>
                </div>
                <span className="text-sm text-[#C9A84C] font-medium">${(rev as number).toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(revenueByCategory).length === 0 && (
              <p className="text-white/30 text-center py-4">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Top Partners */}
        <Card className="bg-[#111] border-white/5">
          <CardHeader><CardTitle className="text-sm text-white/70">Top Partners</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {topPartners.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#C9A84C] font-bold w-5">#{i + 1}</span>
                  <div>
                    <p className="text-sm text-white/80">{p.name}</p>
                    <p className="text-xs text-white/40">{p.service_category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#C9A84C]">{p.total_bookings || 0} bookings</p>
                  <p className="text-xs text-white/40">${Number(p.total_earnings || 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {topPartners.length === 0 && (
              <p className="text-white/30 text-center py-4">No partners</p>
            )}
          </CardContent>
        </Card>

        {/* Booking Status */}
        <Card className="bg-[#111] border-white/5">
          <CardHeader><CardTitle className="text-sm text-white/70">Booking Status Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                <Badge className={`text-[10px] ${
                  status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                  status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                  status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                  'bg-white/10 text-white/40'
                }`}>{status}</Badge>
                <span className="text-sm text-white/70 font-medium">{count as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card className="bg-[#111] border-white/5">
          <CardHeader><CardTitle className="text-sm text-white/70">Monthly Revenue</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(monthlyRevenue).sort().map(([month, rev]) => (
              <div key={month} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                <span className="text-sm text-white/60">{month}</span>
                <span className="text-sm text-[#C9A84C] font-medium">${(rev as number).toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(monthlyRevenue).length === 0 && (
              <p className="text-white/30 text-center py-4">No data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
