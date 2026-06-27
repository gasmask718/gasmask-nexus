import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, AlertCircle, Clock, CreditCard, Users,
  Bell, Activity, RefreshCw, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface OpsMetrics {
  as_of: string;
  bookings_today: { count: number; revenue: number; by_service: Record<string, number> };
  pending_queue: { total: number; oldest_minutes: number; over_1hr: number };
  dispatch_failures_1hr: number;
  payment_failures_24hr: number;
  sla_breaches_active: number;
  partner_health: { platinum: number; gold: number; silver: number; bronze: number; at_risk: number };
  customer_alerts_24hr: number;
}

const tierColor: Record<string, string> = {
  platinum: 'bg-slate-200 text-slate-900 border-slate-300',
  gold: 'bg-amber-100 text-amber-900 border-amber-300',
  silver: 'bg-zinc-100 text-zinc-800 border-zinc-300',
  bronze: 'bg-orange-100 text-orange-900 border-orange-300',
  at_risk: 'bg-red-100 text-red-900 border-red-300',
};

function MetricCard({
  icon, label, value, subtitle, alert,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; subtitle?: string; alert?: boolean }) {
  return (
    <Card className={alert ? 'border-destructive/60' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={alert ? 'text-destructive' : 'text-muted-foreground'}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function AlertCard({
  icon, label, count, severity,
}: { icon: React.ReactNode; label: string; count: number; severity: 'ok' | 'high' }) {
  return (
    <Card className={severity === 'high' ? 'border-destructive/60 bg-destructive/5' : ''}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={severity === 'high' ? 'text-destructive' : 'text-muted-foreground'}>{icon}</div>
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{count}</div>
        </div>
        {severity === 'high' && <Badge variant="destructive">Action</Badge>}
      </CardContent>
    </Card>
  );
}

export default function AdminOpsDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<OpsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    const { data, error } = await supabase.rpc('get_ops_dashboard_metrics');
    if (error) {
      setError(error.message);
    } else {
      setMetrics(data as unknown as OpsMetrics);
      setLastRefresh(new Date());
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
    if (!autoRefresh) return;
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6 text-destructive">
            Failed to load ops metrics: {error ?? 'unknown error'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ops Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last refresh: {formatDistanceToNow(lastRefresh)} ago
            {autoRefresh && ' · Auto-refreshing every 30s'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh(v => !v)}>
            {autoRefresh ? 'Pause' : 'Resume'} Auto-Refresh
          </Button>
          <Button size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => navigate('/admin/bookings')} className="text-left">
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Bookings Today"
            value={metrics.bookings_today.count}
            subtitle={`$${Number(metrics.bookings_today.revenue).toFixed(2)} revenue`}
          />
        </button>
        <button onClick={() => navigate('/admin/bookings?status=pending')} className="text-left">
          <MetricCard
            icon={<Clock className="h-4 w-4" />}
            label="Pending Queue"
            value={metrics.pending_queue.total}
            subtitle={metrics.pending_queue.over_1hr > 0 ? `${metrics.pending_queue.over_1hr} over 1hr` : 'All within SLA'}
            alert={metrics.pending_queue.over_1hr > 0}
          />
        </button>
        <MetricCard
          icon={<CreditCard className="h-4 w-4" />}
          label="Payment Failures 24hr"
          value={metrics.payment_failures_24hr}
          subtitle="Unrecovered"
          alert={metrics.payment_failures_24hr > 0}
        />
        <MetricCard
          icon={<Bell className="h-4 w-4" />}
          label="Customer Alerts 24hr"
          value={metrics.customer_alerts_24hr}
          subtitle="High-value + flagged"
        />
      </div>

      {/* Bookings by service */}
      <Card>
        <CardHeader><CardTitle>Today's Bookings by Service</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(metrics.bookings_today.by_service || {}).length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet today.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(metrics.bookings_today.by_service).map(([service, count]) => (
                <div key={service} className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground capitalize mt-1">
                    {service.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Partner health */}
      <Card>
        <CardHeader><CardTitle>Partner Health Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(['platinum', 'gold', 'silver', 'bronze', 'at_risk'] as const).map(tier => (
              <div key={tier} className={`rounded-lg border p-4 ${tierColor[tier]}`}>
                <div className="text-2xl font-bold">{metrics.partner_health[tier]}</div>
                <div className="text-xs capitalize mt-1">{tier.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AlertCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Dispatch Failures 1hr"
          count={metrics.dispatch_failures_1hr}
          severity={metrics.dispatch_failures_1hr > 0 ? 'high' : 'ok'}
        />
        <AlertCard
          icon={<Activity className="h-5 w-5" />}
          label="SLA Breaches Active"
          count={metrics.sla_breaches_active}
          severity={metrics.sla_breaches_active > 0 ? 'high' : 'ok'}
        />
        <AlertCard
          icon={<Users className="h-5 w-5" />}
          label="Oldest Pending (min)"
          count={Math.round(metrics.pending_queue.oldest_minutes || 0)}
          severity={(metrics.pending_queue.oldest_minutes || 0) > 60 ? 'high' : 'ok'}
        />
      </div>
    </div>
  );
}
