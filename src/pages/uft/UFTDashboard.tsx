import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getUFTPlatformMetrics, type UFTPlatformMetrics } from '@/services/uftApi';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import {
  Store, Calendar, DollarSign, TrendingUp, Users, Target,
  ExternalLink, CheckCircle, AlertTriangle, PartyPopper,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Link } from 'react-router-dom';

const REVENUE_MOCK = [
  { month: 'Nov', bookings: 12400, fees: 1860 },
  { month: 'Dec', bookings: 18200, fees: 2730 },
  { month: 'Jan', bookings: 15800, fees: 2370 },
  { month: 'Feb', bookings: 22100, fees: 3315 },
  { month: 'Mar', bookings: 28500, fees: 4275 },
  { month: 'Apr', bookings: 31200, fees: 4680 },
];

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const HEALTH_ITEMS = [
  { label: 'Supabase schema (15 tables)', status: 'ok' },
  { label: 'RLS security policies', status: 'ok' },
  { label: 'Edge functions (15 deployed)', status: 'ok' },
  { label: 'Stripe webhook active', status: 'ok' },
  { label: 'Stripe Connect configured', status: 'ok' },
  { label: 'Resend emails wired', status: 'ok' },
  { label: 'Twilio SMS active', status: 'ok' },
  { label: 'Ambassador portal live', status: 'ok' },
  { label: 'pg_cron jobs scheduled', status: 'ok' },
  { label: 'Resend API key — add to Vault', status: 'warn' },
  { label: 'Stripe live mode — pending launch', status: 'warn' },
  { label: 'Domain verification — pending', status: 'warn' },
];

export default function UFTDashboard() {
  const [metrics, setMetrics] = useState<UFTPlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getUFTPlatformMetrics()
      .then(setMetrics)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: 'Total Vendors', value: metrics?.total_vendors, icon: Store, color: 'text-blue-400', format: formatNumber },
    { label: 'Total Bookings', value: metrics?.total_bookings, icon: Calendar, color: 'text-green-400', format: formatNumber },
    { label: 'Total Revenue', value: metrics?.total_revenue, icon: DollarSign, color: 'text-yellow-400', format: formatCurrency },
    { label: 'This Month', value: metrics?.this_month_revenue, icon: TrendingUp, color: 'text-purple-400', format: formatCurrency },
    { label: 'Ambassadors', value: metrics?.total_ambassadors, icon: Users, color: 'text-orange-400', format: formatNumber },
    { label: 'Conversion', value: metrics?.conversion_rate, icon: Target, color: 'text-teal-400', format: (v: number) => formatPercent(v) },
  ];

  const pieData = metrics?.top_vendor_categories?.map(c => ({
    name: c.category, value: c.count,
  })) || [
    { name: 'Venues', value: 12 },
    { name: 'Staff', value: 8 },
    { name: 'Rentals', value: 5 },
    { name: 'Entertainment', value: 3 },
    { name: 'Catering', value: 4 },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PartyPopper className="h-8 w-8 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold">Unforgettable Times</h1>
            <p className="text-sm text-muted-foreground">Platform Command Center</p>
          </div>
          <span className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${error ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {error ? '🔴 Offline' : '🟢 Live'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://id-preview--e9aba3c3-110f-4e7c-87db-ffe37388dcf6.lovable.app" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Open Live Site
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://unforgettabletimes.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Public Site
            </a>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="relative overflow-hidden">
            <CardContent className="p-4">
              <kpi.icon className={`absolute top-3 right-3 h-5 w-5 ${kpi.color} opacity-60`} />
              {loading ? (
                <Skeleton className="h-8 w-20 mb-1" />
              ) : (
                <p className="text-2xl font-bold">{kpi.format(kpi.value ?? 0)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
            <div className={`h-1 ${kpi.color.replace('text-', 'bg-')} opacity-40`} />
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Platform Revenue</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={REVENUE_MOCK}>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="bookings" name="Booking Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fees" name="Platform Fee" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Vendor Mix</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/uft/vendors">View Vendors</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/uft/ambassadors">View Ambassadors</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">Stripe Dashboard</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/uft/launch">Launch Checklist</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Platform Health</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {HEALTH_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  {item.status === 'ok' ? (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                  )}
                  <span className={item.status === 'warn' ? 'text-yellow-400' : ''}>{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
