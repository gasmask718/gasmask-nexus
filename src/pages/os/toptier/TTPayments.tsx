import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Download, CreditCard, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const GOLD = '#C9A84C';

export default function TTPayments() {
  const [dateRange, setDateRange] = useState(30);
  const [statusFilter, setStatusFilter] = useState('all');

  const startDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - dateRange);
    return d.toISOString();
  }, [dateRange]);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['tt-payments', dateRange],
    queryFn: () => fetchTopTierData('tt_bookings', {
      select: 'id,booking_reference,client_name,service_type,total_price,payment_status,status,created_at,vehicle_id',
      filters: { 'created_at': `gte.${startDate}` },
      order: 'created_at.desc',
    }),
    refetchInterval: 30000,
  });

  const kpis = useMemo(() => {
    if (!bookings?.length) return { today: 0, mtd: 0, ytd: 0, outstanding: 0, avg: 0, refunds: 0 };
    const todayStr = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

    const paid = bookings.filter((b: any) => b.payment_status === 'paid');
    const today = paid.filter((b: any) => b.created_at >= todayStr).reduce((s: number, b: any) => s + Number(b.total_price), 0);
    const mtd = paid.filter((b: any) => b.created_at >= monthStart).reduce((s: number, b: any) => s + Number(b.total_price), 0);
    const ytd = paid.filter((b: any) => b.created_at >= yearStart).reduce((s: number, b: any) => s + Number(b.total_price), 0);
    const outstanding = bookings.filter((b: any) => b.payment_status === 'pending').reduce((s: number, b: any) => s + Number(b.total_price), 0);
    const refunds = bookings.filter((b: any) => b.payment_status === 'refunded').reduce((s: number, b: any) => s + Number(b.total_price), 0);
    const avg = paid.length ? Math.round(paid.reduce((s: number, b: any) => s + Number(b.total_price), 0) / paid.length) : 0;
    return { today, mtd, ytd, outstanding, avg, refunds };
  }, [bookings]);

  const revenueByDay = useMemo(() => {
    if (!bookings?.length) return [];
    const byDate: Record<string, number> = {};
    bookings.filter((b: any) => b.payment_status === 'paid').forEach((b: any) => {
      const d = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      byDate[d] = (byDate[d] || 0) + Number(b.total_price);
    });
    return Object.entries(byDate).map(([date, revenue]) => ({ date, revenue }));
  }, [bookings]);

  const revenueByVehicle = useMemo(() => {
    if (!bookings?.length) return [];
    const byType: Record<string, number> = {};
    bookings.filter((b: any) => b.payment_status === 'paid').forEach((b: any) => {
      byType[b.service_type || 'Other'] = (byType[b.service_type || 'Other'] || 0) + Number(b.total_price);
    });
    return Object.entries(byType).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  const filtered = useMemo(() => {
    if (!bookings) return [];
    if (statusFilter === 'all') return bookings;
    return bookings.filter((b: any) => b.payment_status === statusFilter);
  }, [bookings, statusFilter]);

  const exportCSV = () => {
    const headers = ['Date', 'Ref', 'Customer', 'Service', 'Amount', 'Payment Status'];
    const rows = filtered.map((b: any) => [format(new Date(b.created_at), 'yyyy-MM-dd'), b.booking_reference || b.id.slice(0, 8), b.client_name, b.service_type, b.total_price, b.payment_status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tt-payments-${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
  };

  const tooltipStyle = { backgroundColor: '#1A1A1A', border: '1px solid #C9A84C30', borderRadius: 8, color: '#fff' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white/90">Payments & Revenue</h1>
        <Button variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C]" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Today', value: `$${kpis.today.toLocaleString()}`, icon: DollarSign },
          { label: 'MTD', value: `$${kpis.mtd.toLocaleString()}`, icon: TrendingUp },
          { label: 'YTD', value: `$${kpis.ytd.toLocaleString()}`, icon: CreditCard },
          { label: 'Outstanding', value: `$${kpis.outstanding.toLocaleString()}`, icon: AlertTriangle },
          { label: 'Avg Booking', value: `$${kpis.avg.toLocaleString()}`, icon: DollarSign },
          { label: 'Refunds MTD', value: `$${kpis.refunds.toLocaleString()}`, icon: DollarSign },
        ].map(m => (
          <Card key={m.label} className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-4">
            <m.icon className="h-4 w-4 text-[#C9A84C] mb-1" />
            <p className="text-lg font-bold text-white/90">{isLoading ? '—' : m.value}</p>
            <p className="text-[10px] text-white/40 uppercase">{m.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/60">Revenue by Day</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-[250px] bg-white/5" /> : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={revenueByDay}>
                <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GOLD} stopOpacity={0.3} /><stop offset="95%" stopColor={GOLD} stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="date" tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke={GOLD} fill="url(#pg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}</CardContent>
        </Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/60">Revenue by Service Type</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-[250px] bg-white/5" /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueByVehicle}>
                <XAxis dataKey="name" tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="revenue" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}</CardContent>
        </Card>
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-white/70">Transactions</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-white/10">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/5"><tr>
              {['Date', 'Ref', 'Customer', 'Service', 'Amount', 'Payment'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs text-white/40 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-8 bg-white/5" /></td></tr>) :
                filtered.map((b: any) => (
                  <tr key={b.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-white/60">{format(new Date(b.created_at), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 text-xs font-mono text-[#C9A84C]">{b.booking_reference || b.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm text-white/80">{b.client_name}</td>
                    <td className="px-4 py-3 text-xs text-white/60">{b.service_type}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#C9A84C]">${Number(b.total_price).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] ${b.payment_status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : b.payment_status === 'refunded' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {b.payment_status}
                      </Badge>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
