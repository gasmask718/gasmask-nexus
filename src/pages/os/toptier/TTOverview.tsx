import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { fetchTopTierData, fetchTopTierCount } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, CalendarCheck, Users, AlertTriangle, TrendingUp, Car, Star, Percent, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-500/20 text-blue-400',
  driver_assigned: 'bg-emerald-500/20 text-emerald-400',
  en_route: 'bg-amber-500/20 text-amber-400',
  arrived: 'bg-purple-500/20 text-purple-400',
  in_progress: 'bg-[#C9A84C]/20 text-[#C9A84C]',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
  pending: 'bg-gray-500/20 text-gray-400',
};

function KPICard({ title, value, subtitle, detail, detailColor, icon: Icon, loading, warning }: any) {
  if (loading) return <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5"><Skeleton className="h-16 bg-white/5" /></CardContent></Card>;
  return (
    <Card className={`bg-[#111111] border-[#C9A84C]/10 hover:border-[#C9A84C]/25 transition-colors ${warning ? 'border-amber-500/30' : ''}`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${warning ? 'text-amber-400' : 'text-[#C9A84C]'}`}>{value}</p>
            <p className="text-xs text-white/30 mt-1">{subtitle}</p>
            {detail && <p className={`text-xs mt-1 ${detailColor || 'text-emerald-400'}`}>{detail}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${warning ? 'bg-amber-500/10' : 'bg-[#C9A84C]/10'}`}>
            <Icon className={`h-5 w-5 ${warning ? 'text-amber-400' : 'text-[#C9A84C]'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TTOverview() {
  const navigate = useNavigate();
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

  // ── 7 Live KPIs ──
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['tt-dashboard-kpis'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const [
        bookingsTodayData,
        revenueTodayData,
        activeDriversCount,
        vehiclesOnRoadCount,
        pendingAssignmentsCount,
        reviewsData,
        cancelledCount,
        totalCount30d,
      ] = await Promise.all([
        fetchTopTierData('tt_bookings', { select: 'id', filters: { 'created_at': `gte.${today}` } }),
        fetchTopTierData('tt_bookings', { select: 'total_price', filters: { 'payment_status': 'eq.paid', 'created_at': `gte.${today}` } }),
        fetchTopTierCount('tt_drivers', { 'status': 'in.(available,on_assignment)' }),
        fetchTopTierCount('tt_dispatches', { 'status': 'in.(en_route,arrived,in_progress)' }),
        fetchTopTierData('tt_bookings', { select: 'id', filters: { 'status': 'eq.confirmed', 'driver_id': 'is.null' } }),
        fetchTopTierData('tt_customer_reviews', { select: 'rating' }),
        fetchTopTierData('tt_bookings', { select: 'id', filters: { 'status': 'eq.cancelled', 'created_at': `gte.${thirtyDaysAgo}` } }),
        fetchTopTierData('tt_bookings', { select: 'id', filters: { 'created_at': `gte.${thirtyDaysAgo}` } }),
      ]);

      const revenueToday = revenueTodayData.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
      const avgRating = reviewsData.length > 0
        ? (reviewsData.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / reviewsData.length).toFixed(1)
        : null;
      const cancRate = totalCount30d.length > 0
        ? ((cancelledCount.length / totalCount30d.length) * 100).toFixed(1)
        : '0.0';

      return {
        bookingsToday: bookingsTodayData.length,
        revenueToday,
        activeDrivers: activeDriversCount,
        vehiclesOnRoad: vehiclesOnRoadCount,
        pendingAssignments: pendingAssignmentsCount.length,
        avgRating,
        cancellationRate: cancRate,
      };
    },
    refetchInterval: 30000,
  });

  // ── Recent Bookings ──
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['tt-recent-bookings'],
    queryFn: () => fetchTopTierData('tt_bookings', {
      select: '*',
      order: 'created_at.desc',
      limit: 10,
    }),
    refetchInterval: 30000,
  });

  useEffect(() => { if (recentData) setRecentBookings(recentData); }, [recentData]);

  // ── Realtime ──
  useEffect(() => {
    const channel = supabase
      .channel('tt-overview-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tt_bookings' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRecentBookings(prev => [payload.new as any, ...prev].slice(0, 10));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Revenue Chart (7 days) ──
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['tt-revenue-7d'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const bookings = await fetchTopTierData('tt_bookings', {
        select: 'created_at,total_price',
        filters: { 'status': 'neq.cancelled', 'created_at': `gte.${sevenDaysAgo.toISOString()}` },
      });
      const byDate = bookings.reduce((acc: any, b: any) => {
        const date = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        acc[date] = (acc[date] || 0) + Number(b.total_price);
        return acc;
      }, {});
      return Object.entries(byDate).map(([date, revenue]) => ({ date, revenue }));
    },
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-6">
      {/* 7 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <KPICard title="Bookings Today" value={isLoading ? '—' : kpis?.bookingsToday ?? 0} subtitle="New bookings" icon={CalendarCheck} loading={isLoading} />
        <KPICard title="Revenue Today" value={isLoading ? '—' : `$${(kpis?.revenueToday ?? 0).toLocaleString()}`} subtitle="Paid bookings" icon={DollarSign} loading={isLoading} />
        <KPICard title="Active Drivers" value={isLoading ? '—' : kpis?.activeDrivers ?? 0} subtitle="Available + on assignment" icon={Users} loading={isLoading} />
        <KPICard title="Vehicles On Road" value={isLoading ? '—' : kpis?.vehiclesOnRoad ?? 0} subtitle="Currently dispatched" icon={Car} loading={isLoading} />
        <KPICard title="Pending Assigns" value={isLoading ? '—' : kpis?.pendingAssignments ?? 0} subtitle="No driver assigned" icon={AlertTriangle} loading={isLoading} warning={(kpis?.pendingAssignments ?? 0) > 0} />
        <KPICard title="Avg Rating" value={isLoading ? '—' : kpis?.avgRating ? `⭐ ${kpis.avgRating}` : 'N/A'} subtitle="Customer reviews" icon={Star} loading={isLoading} />
        <KPICard title="Cancel Rate" value={isLoading ? '—' : `${kpis?.cancellationRate ?? '0.0'}%`} subtitle="Last 30 days" icon={Percent} loading={isLoading} />
      </div>

      {/* Revenue Chart + Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2 bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-3"><CardTitle className="text-base">Revenue — Last 7 Days</CardTitle></CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-[220px] bg-white/5" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData || []}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #C9A84C30', borderRadius: 8, color: '#fff' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#C9A84C" fill="url(#goldGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Recent Bookings
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/5">
                <tr>
                  {['Ref', 'Client', 'Pickup', 'Scheduled', 'Status', 'Amount', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-white/40 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLoading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-8 bg-white/5" /></td></tr>
                )) : recentBookings.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-white/30">No bookings yet</td></tr>
                ) : recentBookings.map(b => (
                  <tr key={b.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-xs font-mono text-[#C9A84C]">{b.booking_reference || b.id?.slice(0, 8)}</td>
                    <td className="px-3 py-2.5 text-sm text-white/80">{b.client_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-white/60 max-w-[120px] truncate">{b.pickup_location || b.pickup_city || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-white/60">
                      {b.scheduled_at ? format(new Date(b.scheduled_at), 'MMM d, yyyy, h:mm a') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={`text-[10px] ${STATUS_COLORS[b.status] || ''}`}>{b.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-[#C9A84C]">${Number(b.total_price || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      {!b.driver_id && b.status !== 'cancelled' && b.status !== 'completed' && (
                        <Button size="sm" className="h-6 text-[10px] bg-[#C9A84C] text-black" onClick={() => navigate('/os/toptier/dispatch')}>
                          Assign
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
