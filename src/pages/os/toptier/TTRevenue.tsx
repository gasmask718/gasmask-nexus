import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { ExportButton } from '@/components/crud/ExportButton';

const GOLD = '#C9A84C';
const COLORS = ['#C9A84C', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'];

const RANGES = [
  { label: 'Today', days: 0 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'YTD', days: -1 },
];

export default function TTRevenue() {
  const [range, setRange] = useState(7);

  const startDate = useMemo(() => {
    if (range === -1) return new Date(new Date().getFullYear(), 0, 1).toISOString();
    if (range === 0) return new Date().toISOString().split('T')[0];
    const d = new Date(); d.setDate(d.getDate() - range);
    return d.toISOString();
  }, [range]);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['tt-revenue-bookings', range],
    queryFn: () => fetchTopTierData('bookings', {
      select: 'id,service_type,service_name,total_price,status,created_at,partner_name',
      filters: {
        'status': 'neq.cancelled',
        'created_at': `gte.${startDate}`,
      },
      order: 'created_at.asc',
    }),
    refetchInterval: 30000,
  });

  const metrics = useMemo(() => {
    if (!bookings?.length) return { total: 0, avg: 0, highest: 0, count: 0, avgBooking: 0, platform: 0 };
    const total = bookings.reduce((s: number, b: any) => s + Number(b.total_price), 0);
    const days = Math.max(1, range === 0 ? 1 : range === -1 ? Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000) : range);
    const byDate: Record<string, number> = {};
    bookings.forEach((b: any) => { const d = new Date(b.created_at).toISOString().split('T')[0]; byDate[d] = (byDate[d] || 0) + Number(b.total_price); });
    const highest = Math.max(...Object.values(byDate), 0);
    return { total, avg: Math.round(total / days), highest, count: bookings.length, avgBooking: Math.round(total / bookings.length), platform: Math.round(total * 0.2) };
  }, [bookings, range]);

  const revenueOverTime = useMemo(() => {
    if (!bookings?.length) return [];
    const byDate: Record<string, number> = {};
    bookings.forEach((b: any) => { const d = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); byDate[d] = (byDate[d] || 0) + Number(b.total_price); });
    return Object.entries(byDate).map(([date, revenue]) => ({ date, revenue }));
  }, [bookings]);

  const bookingsOverTime = useMemo(() => {
    if (!bookings?.length) return [];
    const byDate: Record<string, number> = {};
    bookings.forEach((b: any) => { const d = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); byDate[d] = (byDate[d] || 0) + 1; });
    return Object.entries(byDate).map(([date, count]) => ({ date, count }));
  }, [bookings]);

  const byCategory = useMemo(() => {
    if (!bookings?.length) return [];
    const grouped: Record<string, number> = {};
    bookings.forEach((b: any) => { grouped[b.service_type] = (grouped[b.service_type] || 0) + Number(b.total_price); });
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [bookings]);

  const topServices = useMemo(() => {
    if (!bookings?.length) return [];
    const grouped: Record<string, number> = {};
    bookings.forEach((b: any) => { grouped[b.service_name] = (grouped[b.service_name] || 0) + Number(b.total_price); });
    return Object.entries(grouped).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [bookings]);

  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ['tt-payout-queue'],
    queryFn: () => fetchTopTierData('partner_earnings', {
      select: '*,partners(name)',
      filters: { 'status': 'eq.pending' },
      order: 'created_at.desc',
    }),
    refetchInterval: 30000,
  });

  const tooltipStyle = { backgroundColor: '#1A1A1A', border: '1px solid #C9A84C30', borderRadius: 8, color: '#fff' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white/90">Revenue Dashboard</h1>
        <div className="flex gap-1 bg-[#111111] rounded-lg p-1 border border-white/5">
          {RANGES.map(r => (
            <Button key={r.label} variant="ghost" size="sm"
              className={`text-xs px-3 ${range === r.days ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-white/40 hover:text-white'}`}
              onClick={() => setRange(r.days)}>{r.label}</Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Revenue', value: `$${metrics.total.toLocaleString()}`, icon: DollarSign },
          { label: 'Avg Daily', value: `$${metrics.avg.toLocaleString()}`, icon: TrendingUp },
          { label: 'Highest Day', value: `$${metrics.highest.toLocaleString()}`, icon: BarChart3 },
          { label: 'Total Bookings', value: metrics.count, icon: Calendar },
          { label: 'Avg Booking', value: `$${metrics.avgBooking.toLocaleString()}`, icon: DollarSign },
          { label: 'Platform Rev', value: `$${metrics.platform.toLocaleString()}`, icon: DollarSign },
        ].map((m, i) => (
          <Card key={i} className="bg-[#111111] border-[#C9A84C]/10">
            <CardContent className="p-4">
              <m.icon className="h-4 w-4 text-[#C9A84C] mb-2" />
              <p className="text-lg font-bold text-white/90">{isLoading ? '—' : m.value}</p>
              <p className="text-[10px] text-white/40 uppercase">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/60">Revenue Over Time</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[250px] bg-white/5" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueOverTime}>
                  <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GOLD} stopOpacity={0.3} /><stop offset="95%" stopColor={GOLD} stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="date" tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="revenue" stroke={GOLD} fill="url(#rg)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/60">Bookings Over Time</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[250px] bg-white/5" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={bookingsOverTime}>
                  <XAxis dataKey="date" tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/60">Revenue by Category</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[250px] bg-white/5" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} stroke="none">
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#ffffff60' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/60">Top 10 Services by Revenue</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[250px] bg-white/5" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topServices} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#ffffff60', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="revenue" fill={GOLD} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-white/70">Partner Payout Queue</CardTitle>
          <ExportButton data={(payouts || []) as Record<string, unknown>[]} filename="toptier-payouts" columns={[
            { key: 'partners.name', label: 'Partner' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Date' },
          ]} />
        </CardHeader>
        <CardContent>
          {payoutsLoading ? <Skeleton className="h-32 bg-white/5" /> : !payouts?.length ? (
            <p className="text-sm text-white/30 text-center py-8">No pending payouts</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  <th className="px-4 py-2 text-left text-xs text-white/40 uppercase">Partner</th>
                  <th className="px-4 py-2 text-left text-xs text-white/40 uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs text-white/40 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs text-white/40 uppercase">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {payouts.map((p: any) => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-sm text-white/70">{p.partners?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#C9A84C]">${Number(p.amount).toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge className="bg-amber-500/20 text-amber-400 text-[10px]">{p.status}</Badge></td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" className="text-xs border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10">Process Payout</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
