import { useQuery } from '@tanstack/react-query';
import { fetchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, CalendarCheck, Users, UserCheck, Clock,
  AlertTriangle, TrendingUp
} from 'lucide-react';

export default function PenthouseDashboard() {
  const { data: bookings = [], isLoading: lb } = useQuery({
    queryKey: ['ph-bookings'],
    queryFn: () => fetchTopTierData('tt_bookings', { select: '*' }),
  });

  const { data: partners = [], isLoading: lp } = useQuery({
    queryKey: ['ph-partners'],
    queryFn: () => fetchTopTierData('tt_partners', { select: '*' }),
  });

  const { data: earnings = [], isLoading: le } = useQuery({
    queryKey: ['ph-earnings'],
    queryFn: () => fetchTopTierData('tt_partner_earnings', { select: '*' }),
  });

  const { data: affiliates = [], isLoading: la } = useQuery({
    queryKey: ['ph-affiliates'],
    queryFn: () => fetchTopTierData('tt_affiliates', { select: '*' }),
  });

  const loading = lb || lp || le || la;

  const today = new Date().toISOString().split('T')[0];
  const revenueToday = bookings
    .filter((b: any) => b.created_at?.startsWith(today))
    .reduce((s: number, b: any) => s + (Number(b.total_price) || 0), 0);
  const revenueMonth = bookings
    .filter((b: any) => b.created_at?.startsWith(today.slice(0, 7)))
    .reduce((s: number, b: any) => s + (Number(b.total_price) || 0), 0);
  const revenueLifetime = bookings.reduce((s: number, b: any) => s + (Number(b.total_price) || 0), 0);
  const activePartners = partners.filter((p: any) => p.status === 'active').length;
  const pendingApprovals = partners.filter((p: any) => p.status === 'pending').length;
  const activeAffiliates = affiliates.filter((a: any) => a.status === 'active').length;
  const pendingPayouts = earnings.filter((e: any) => e.status === 'pending').length;
  const systemAlerts = bookings.filter((b: any) => b.status === 'pending').length;

  const stats = [
    { label: 'Revenue Today', value: `$${revenueToday.toLocaleString()}`, icon: DollarSign, color: '#C9A84C' },
    { label: 'Revenue This Month', value: `$${revenueMonth.toLocaleString()}`, icon: TrendingUp, color: '#C9A84C' },
    { label: 'Revenue Lifetime', value: `$${revenueLifetime.toLocaleString()}`, icon: DollarSign, color: '#22c55e' },
    { label: 'Total Bookings', value: bookings.length, icon: CalendarCheck, color: '#3b82f6' },
    { label: 'Active Partners', value: activePartners, icon: Users, color: '#22c55e' },
    { label: 'Active Affiliates', value: activeAffiliates, icon: UserCheck, color: '#8b5cf6' },
    { label: 'Pending Approvals', value: pendingApprovals, icon: Clock, color: pendingApprovals > 0 ? '#f59e0b' : '#22c55e' },
    { label: 'Pending Payouts', value: pendingPayouts, icon: DollarSign, color: pendingPayouts > 0 ? '#f59e0b' : '#22c55e' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Penthouse Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Real-time overview of TopTier Experience operations</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-[#111] border-white/5">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 bg-white/5" />
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                  <stat.icon className="h-5 w-5" style={{ color: stat.color, opacity: 0.5 }} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Alerts */}
      {systemAlerts > 0 && (
        <Card className="bg-[#111] border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              System Alerts ({systemAlerts})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookings.filter((b: any) => b.status === 'pending').slice(0, 5).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                <div>
                  <p className="text-sm text-white/80">{b.service_name || b.service_type}</p>
                  <p className="text-xs text-white/40">{b.client_name} — pending since {new Date(b.created_at).toLocaleDateString()}</p>
                </div>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">PENDING</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Bookings */}
      <Card className="bg-[#111] border-white/5">
        <CardHeader>
          <CardTitle className="text-sm text-white/70">Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {bookings.slice(0, 8).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[10px] text-[#C9A84C] font-bold">
                    {(b.client_name || '?')[0]}
                  </div>
                  <div>
                    <p className="text-sm text-white/80">{b.client_name}</p>
                    <p className="text-xs text-white/40">{b.service_name || b.service_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#C9A84C] font-medium">${Number(b.total_price || 0).toLocaleString()}</p>
                  <Badge className={`text-[9px] ${
                    b.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                    b.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>{b.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
