import { useNavigate } from 'react-router-dom';
import ApiBudgetCard from '@/components/unforgettable/ApiBudgetCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUTPenthouseStats } from '@/hooks/useUTPenthouseStats';
import {
  PartyPopper, Target, Phone, ClipboardCheck, Store, TrendingUp, Users,
  AlertTriangle, ArrowRight, BarChart3, Bot, Package, DollarSign, Plus,
  PhoneCall, UserPlus, Eye, Zap, MapPin
} from 'lucide-react';

const PINK = '#E91E8C';

// Quick actions
const QUICK_ACTIONS = [
  { label: 'Add Leads', icon: Plus, path: '/os/unforgettable/places', color: 'text-pink-500 hover:bg-pink-500/10' },
  { label: 'Outreach Command', icon: PhoneCall, path: '/os/unforgettable/outreach', color: 'text-purple-500 hover:bg-purple-500/10' },
  { label: 'Start AI Calls', icon: Bot, path: '/os/unforgettable/automation', color: 'text-blue-500 hover:bg-blue-500/10' },
  { label: 'Review Onboarding', icon: UserPlus, path: '/os/unforgettable/onboarding', color: 'text-emerald-500 hover:bg-emerald-500/10' },
  { label: 'View Marketplace', icon: Eye, path: '/os/unforgettable/marketplace', color: 'text-amber-500 hover:bg-amber-500/10' },
  { label: 'Analytics', icon: BarChart3, path: '/os/unforgettable/analytics', color: 'text-cyan-500 hover:bg-cyan-500/10' },
];

function NotTracked({ label, note = 'Not yet tracked' }: { label: string; note?: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-muted-foreground">—</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export default function UTPenthouse() {
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useUTPenthouseStats();

  const n = (v?: number) => (v ?? 0).toLocaleString();

  const kpis = [
    { label: 'Total Leads', value: n(stats?.totalLeads), icon: Target, sub: `${n(stats?.states)} states · ${n(stats?.cities)} cities`, color: PINK },
    { label: 'Contacted', value: n(stats?.contacted), icon: Phone, sub: stats?.totalLeads ? `${((stats.contacted / stats.totalLeads) * 100).toFixed(1)}% contact rate` : '—', color: '#8B5CF6' },
    { label: 'Interested', value: n(stats?.interested), icon: Users, sub: 'status = interested', color: '#3B82F6' },
    { label: 'Onboarded', value: n(stats?.onboarded), icon: ClipboardCheck, sub: 'onboarded_at set', color: '#10B981' },
    { label: 'Active Vendors', value: n(stats?.partners), icon: Store, sub: 'ut_partners records', color: '#F59E0B' },
    { label: 'Conversion Rate', value: `${(stats?.conversionRate ?? 0).toFixed(1)}%`, icon: TrendingUp, sub: 'Lead → Onboarded', color: '#EC4899' },
  ];

  const funnel = [
    { stage: 'Total Leads', count: stats?.totalLeads ?? 0, color: 'bg-pink-500' },
    { stage: 'Contacted', count: stats?.contacted ?? 0, color: 'bg-purple-500' },
    { stage: 'Interested', count: stats?.interested ?? 0, color: 'bg-blue-500' },
    { stage: 'Onboarded', count: stats?.onboarded ?? 0, color: 'bg-emerald-500' },
    { stage: 'Active Vendors', count: stats?.partners ?? 0, color: 'bg-amber-500' },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  // Alerts derived only from real queries. No fabricated entries.
  const alerts: { text: string; severity: 'high' | 'medium'; action: string }[] = [];
  if (stats) {
    const uncontacted = stats.totalLeads - stats.contacted;
    if (uncontacted > 0) alerts.push({ text: `${uncontacted.toLocaleString()} leads have never been contacted`, severity: 'high', action: '/os/unforgettable/outreach' });
    if (stats.needsEnrichment > 0) alerts.push({ text: `${stats.needsEnrichment.toLocaleString()} leads need enrichment`, severity: 'medium', action: '/os/unforgettable/places' });
    if (stats.callbacksDue > 0) alerts.push({ text: `${stats.callbacksDue.toLocaleString()} callbacks overdue`, severity: 'medium', action: '/os/unforgettable/outreach' });
    if (stats.onboarded > 0 && stats.partners === 0) alerts.push({ text: 'Onboarded leads exist but no vendor records created', severity: 'high', action: '/os/unforgettable/onboarding' });
  }

  return (
    <div className="space-y-6">
      {/* API budget balance (UT-006b) */}
      <ApiBudgetCard />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <PartyPopper className="h-8 w-8" style={{ color: PINK }} />
            <span style={{ color: PINK }}>Penthouse</span>
            <span className="text-foreground">— Command Center</span>
          </h1>
          <p className="text-muted-foreground mt-1">Full control over your event marketplace business</p>
        </div>
        <Badge className="text-sm px-3 py-1" style={{ backgroundColor: `${PINK}20`, color: PINK, border: `1px solid ${PINK}40` }}>
          <Zap className="h-3 w-3 mr-1" /> Live
        </Badge>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load live stats: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{kpi.value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid: Funnel + Outreach + Marketplace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lead Funnel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: PINK }} />
              Lead Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.map((f) => (
              <div key={f.stage}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{f.stage}</span>
                  <span className="font-medium">{isLoading ? '…' : f.count.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${f.color} rounded-full transition-all`}
                    style={{ width: `${Math.max(f.count > 0 ? 2 : 0, (f.count / funnelMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Outreach Activity — no call/SMS activity source is wired yet */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-purple-500" />
              Outreach Activity
              <Badge variant="outline" className="text-xs ml-auto">Not yet tracked</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <NotTracked label="Calls Today" note="No call log wired" />
              <NotTracked label="AI Calls" note="AI dialer disabled" />
              <NotTracked label="Connect Rate" note="No call log wired" />
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Callbacks Due</p>
                {isLoading ? <Skeleton className="h-8 w-12" /> : (
                  <p className="text-2xl font-bold text-amber-500">{n(stats?.callbacksDue)}</p>
                )}
                <p className="text-xs text-muted-foreground">From lead records</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate('/os/unforgettable/outreach')}>
              Open Outreach Command <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Marketplace Health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-amber-500" />
              Marketplace Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Active Vendors</p>
                {isLoading ? <Skeleton className="h-8 w-12" /> : (
                  <p className="text-2xl font-bold">{n(stats?.partners)}</p>
                )}
                <p className="text-xs text-muted-foreground">ut_partners</p>
              </div>
              <NotTracked label="Listings Live" note="No listings source" />
              <NotTracked label="Pending Review" note="No listings source" />
              <NotTracked label="Blocked by Gate" note="No listings source" />
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate('/os/unforgettable/marketplace')}>
              Marketplace Control <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Revenue + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue (Future-Ready) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Revenue
              <Badge variant="outline" className="text-xs ml-auto">Coming Soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold">—</p>
                <p className="text-xs text-muted-foreground">Awaiting integration</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Projected Revenue</p>
                <p className="text-2xl font-bold">—</p>
                <p className="text-xs text-muted-foreground">Awaiting integration</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: PINK }} />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {QUICK_ACTIONS.map((a) => (
                <Button
                  key={a.label}
                  variant="ghost"
                  className={`h-auto py-3 flex flex-col items-center gap-1.5 ${a.color}`}
                  onClick={() => navigate(a.path)}
                >
                  <a.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{a.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts — derived from live queries only */}
      {alerts.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alerts
              <Badge className="ml-auto bg-amber-500/10 text-amber-600 border-amber-500/30" variant="outline">
                {alerts.length} active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 cursor-pointer transition-colors"
                onClick={() => navigate(alert.action)}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${alert.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="text-sm">{alert.text}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Coverage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" style={{ color: PINK }} />
            Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">States</p>
              <p className="text-2xl font-bold">{isLoading ? '…' : n(stats?.states)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Cities</p>
              <p className="text-2xl font-bold">{isLoading ? '…' : n(stats?.cities)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Needs Enrichment</p>
              <p className="text-2xl font-bold">{isLoading ? '…' : n(stats?.needsEnrichment)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Duplicates Excluded</p>
              <p className="text-2xl font-bold text-muted-foreground">{isLoading ? '…' : n(stats?.duplicates)}</p>
              <p className="text-xs text-muted-foreground">Filtered from all counts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floor Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" style={{ color: PINK }} />
            All Floors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { label: 'F1 — Intelligence', path: '/os/unforgettable/intelligence', icon: Target },
              { label: 'F2 — Outreach', path: '/os/unforgettable/outreach', icon: Phone },
              { label: 'F3 — Onboarding', path: '/os/unforgettable/onboarding', icon: ClipboardCheck },
              { label: 'F4 — Marketplace', path: '/os/unforgettable/marketplace', icon: Store },
              { label: 'F5 — Products', path: '/os/unforgettable/products', icon: Package },
              { label: 'F6 — AI & Ops', path: '/os/unforgettable/automation', icon: Bot },
              { label: 'F7 — Analytics', path: '/os/unforgettable/analytics', icon: BarChart3 },
            ].map((f) => (
              <Button
                key={f.path}
                variant="outline"
                className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                onClick={() => navigate(f.path)}
              >
                <f.icon className="h-4 w-4" style={{ color: PINK }} />
                {f.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
