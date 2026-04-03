import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, CalendarCheck, Users, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const SERVICE_ICONS: Record<string, string> = {
  luxury_transport: '🚗', yacht: '🛥️', chef: '👨‍🍳', jet: '✈️', event: '🎉', default: '✨'
};

function KPICard({ title, value, subtitle, detail, detailColor, icon: Icon, loading }: any) {
  if (loading) return <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5"><Skeleton className="h-16 bg-white/5" /></CardContent></Card>;
  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10 hover:border-[#C9A84C]/25 transition-colors">
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-[#C9A84C] mt-1">{value}</p>
            <p className="text-xs text-white/30 mt-1">{subtitle}</p>
            {detail && <p className={`text-xs mt-1 ${detailColor || 'text-emerald-400'}`}>{detail}</p>}
          </div>
          <div className="p-2.5 rounded-lg bg-[#C9A84C]/10">
            <Icon className="h-5 w-5 text-[#C9A84C]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveBookingFeed() {
  const [bookings, setBookings] = useState<any[]>([]);
  
  const { data, isLoading } = useQuery({
    queryKey: ['tt-live-bookings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tt_bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    refetchInterval: 30000,
  });

  useEffect(() => { if (data) setBookings(data); }, [data]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('tt-bookings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tt_bookings' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setBookings(prev => [payload.new as any, ...prev].slice(0, 10));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const statusColor = (s: string) => s === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : s === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400';

  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10 flex-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Bookings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
        {isLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 bg-white/5" />) :
          bookings.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-8">No bookings yet</p>
          ) : bookings.map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-lg">{SERVICE_ICONS[b.service_type] || SERVICE_ICONS.default}</span>
                <div>
                  <p className="text-sm font-medium text-white/80">{b.service_name}</p>
                  <p className="text-xs text-white/30">{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-[#C9A84C]">${Number(b.total_price).toLocaleString()}</span>
                <Badge className={`text-[10px] ${statusColor(b.status)}`}>{b.status}</Badge>
              </div>
            </div>
          ))
        }
      </CardContent>
    </Card>
  );
}

function RevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['tt-revenue-7d'],
    queryFn: async () => {
      const { data } = await supabase.rpc('', {}).catch(() => ({ data: null }));
      // Fallback: query bookings directly
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: bookings } = await supabase
        .from('tt_bookings')
        .select('created_at, total_price')
        .neq('status', 'cancelled')
        .gte('created_at', sevenDaysAgo.toISOString());
      
      if (!bookings) return [];
      
      const byDate = bookings.reduce((acc: any, b) => {
        const date = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        acc[date] = (acc[date] || 0) + Number(b.total_price);
        return acc;
      }, {});
      
      return Object.entries(byDate).map(([date, revenue]) => ({ date, revenue }));
    },
    refetchInterval: 30000,
  });

  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Revenue — Last 7 Days</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-[250px] bg-white/5" /> : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data || []}>
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
  );
}

function StatusCards() {
  const { data: responseRate, isLoading: l1 } = useQuery({
    queryKey: ['tt-partner-response-rate'],
    queryFn: async () => {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const { data } = await supabase
        .from('tt_confirmation_requests')
        .select('status')
        .gte('created_at', weekAgo.toISOString());
      if (!data || data.length === 0) return 0;
      const confirmed = data.filter(d => d.status === 'confirmed').length;
      return Math.round((confirmed / data.length) * 100);
    },
    refetchInterval: 30000,
  });

  const { data: topService, isLoading: l2 } = useQuery({
    queryKey: ['tt-top-service'],
    queryFn: async () => {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const { data } = await supabase
        .from('tt_bookings')
        .select('service_type, total_price')
        .gte('created_at', weekAgo.toISOString());
      if (!data || data.length === 0) return { name: 'N/A', count: 0, revenue: 0 };
      const grouped: Record<string, { count: number; revenue: number }> = {};
      data.forEach(b => {
        if (!grouped[b.service_type]) grouped[b.service_type] = { count: 0, revenue: 0 };
        grouped[b.service_type].count++;
        grouped[b.service_type].revenue += Number(b.total_price);
      });
      const [name, vals] = Object.entries(grouped).sort((a, b) => b[1].revenue - a[1].revenue)[0];
      return { name, ...vals };
    },
    refetchInterval: 30000,
  });

  const rateColor = (responseRate ?? 0) > 80 ? 'text-emerald-400' : (responseRate ?? 0) > 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardContent className="p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider">Partner Response Rate</p>
          <p className={`text-4xl font-bold mt-2 ${rateColor}`}>
            {l1 ? '—' : `${responseRate}%`}
          </p>
          <p className="text-xs text-white/30 mt-1">Last 7 days</p>
        </CardContent>
      </Card>
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardContent className="p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider">Top Service This Week</p>
          <p className="text-xl font-bold text-white/90 mt-2">{l2 ? '—' : topService?.name}</p>
          <p className="text-xs text-white/30 mt-1">{l2 ? '' : `${topService?.count} bookings · $${topService?.revenue?.toLocaleString()}`}</p>
        </CardContent>
      </Card>
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardContent className="p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider">Ambassador Activity</p>
          <p className="text-2xl font-bold text-white/90 mt-2">—</p>
          <p className="text-xs text-white/30 mt-1">Coming in Phase 2</p>
        </CardContent>
      </Card>
    </div>
  );
}

function OperationsAlerts() {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['tt-ops-alerts'],
    queryFn: async () => {
      const items: any[] = [];
      // Bookings stuck pending > 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: stuck } = await supabase
        .from('tt_bookings')
        .select('id, service_name, created_at')
        .eq('status', 'pending')
        .lt('created_at', twoHoursAgo)
        .limit(5);
      stuck?.forEach(b => items.push({ type: 'stuck_booking', id: b.id, desc: `Booking "${b.service_name}" pending for over 2 hours`, severity: 'high' }));
      
      // Low trust partners
      const { data: lowTrust } = await supabase
        .from('tt_partners')
        .select('id, name, trust_score')
        .lt('trust_score', 3)
        .eq('status', 'active')
        .limit(5);
      lowTrust?.forEach(p => items.push({ type: 'low_trust', id: p.id, desc: `Partner "${p.name}" has trust score ${p.trust_score}/5`, severity: 'medium' }));
      
      return items;
    },
    refetchInterval: 60000,
  });

  if (isLoading) return <Skeleton className="h-24 bg-white/5" />;
  if (!alerts?.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        Operations Alerts
      </h3>
      {alerts.map((a, i) => (
        <Card key={i} className={`border-l-2 ${a.severity === 'high' ? 'border-l-red-500 bg-red-500/5' : 'border-l-amber-500 bg-amber-500/5'} border-[#C9A84C]/10`}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-4 w-4 ${a.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
              <p className="text-sm text-white/70">{a.desc}</p>
            </div>
            <Button variant="outline" size="sm" className="text-xs border-white/10 text-white/50 hover:text-white">
              Resolve
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function TTOverview() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['tt-kpis'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const [rev, revYest, active, pending, partners, newPartners] = await Promise.all([
        supabase.from('tt_bookings').select('total_price').neq('status', 'cancelled').gte('created_at', today),
        supabase.from('tt_bookings').select('total_price').neq('status', 'cancelled').gte('created_at', yesterday).lt('created_at', today),
        supabase.from('tt_bookings').select('id', { count: 'exact', head: true }).in('status', ['confirmed', 'pending']),
        supabase.from('tt_bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('tt_partners').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('tt_confirmation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const todayRev = (rev.data || []).reduce((s, b) => s + Number(b.total_price), 0);
      const yesterdayRev = (revYest.data || []).reduce((s, b) => s + Number(b.total_price), 0);
      const revTrend = yesterdayRev > 0 ? Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100) : 0;

      return {
        revenue: todayRev,
        revTrend,
        activeBookings: active.count || 0,
        pendingBookings: pending.count || 0,
        activePartners: partners.count || 0,
        pendingConfirmations: newPartners.count || 0,
      };
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Revenue Today"
          value={isLoading ? '—' : `$${kpis?.revenue?.toLocaleString() ?? '0'}`}
          subtitle="Today's revenue"
          detail={kpis?.revTrend ? `${kpis.revTrend > 0 ? '+' : ''}${kpis.revTrend}% vs yesterday` : undefined}
          detailColor={kpis?.revTrend && kpis.revTrend >= 0 ? 'text-emerald-400' : 'text-red-400'}
          icon={DollarSign}
          loading={isLoading}
        />
        <KPICard
          title="Active Bookings"
          value={isLoading ? '—' : kpis?.activeBookings}
          subtitle="Active bookings"
          detail={kpis?.pendingBookings ? `${kpis.pendingBookings} pending confirmation` : undefined}
          detailColor="text-amber-400"
          icon={CalendarCheck}
          loading={isLoading}
        />
        <KPICard
          title="Partners Active"
          value={isLoading ? '—' : kpis?.activePartners}
          subtitle="Active partners"
          icon={Users}
          loading={isLoading}
        />
        <KPICard
          title="Pending Issues"
          value={isLoading ? '—' : kpis?.pendingConfirmations}
          subtitle="Pending confirmations"
          icon={AlertTriangle}
          loading={isLoading}
        />
      </div>

      {/* Live Feed + Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <LiveBookingFeed />
        </div>
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
      </div>

      {/* Status Cards */}
      <StatusCards />

      {/* Operations Alerts */}
      <OperationsAlerts />
    </div>
  );
}
