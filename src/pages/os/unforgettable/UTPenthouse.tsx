import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PartyPopper, Target, Phone, ClipboardCheck, Store, TrendingUp, Users,
  AlertTriangle, ArrowRight, BarChart3, Bot, Package, DollarSign, Plus,
  PhoneCall, UserPlus, Eye, Zap
} from 'lucide-react';

const PINK = '#E91E8C';

// KPI cards
const KPI_CARDS = [
  { label: 'Total Leads', value: '2,847', icon: Target, change: '+312 this week', color: PINK },
  { label: 'Contacted', value: '1,204', icon: Phone, change: '42% contact rate', color: '#8B5CF6' },
  { label: 'Interested', value: '387', icon: Users, change: '32% interest rate', color: '#3B82F6' },
  { label: 'Onboarded', value: '94', icon: ClipboardCheck, change: '24% conversion', color: '#10B981' },
  { label: 'Active Listings', value: '72', icon: Store, change: '12 pending review', color: '#F59E0B' },
  { label: 'Conversion Rate', value: '3.3%', icon: TrendingUp, change: 'Lead → Listing', color: '#EC4899' },
];

// Funnel stages
const FUNNEL = [
  { stage: 'New Leads', count: 1643, pct: 100, color: 'bg-pink-500' },
  { stage: 'Contacted', count: 1204, pct: 73, color: 'bg-purple-500' },
  { stage: 'Interested', count: 387, pct: 24, color: 'bg-blue-500' },
  { stage: 'Onboarded', count: 94, pct: 6, color: 'bg-emerald-500' },
  { stage: 'Live Listing', count: 72, pct: 4, color: 'bg-amber-500' },
];

// Quick actions
const QUICK_ACTIONS = [
  { label: 'Add Leads', icon: Plus, path: '/os/unforgettable/places', color: 'text-pink-500 hover:bg-pink-500/10' },
  { label: 'Outreach Command', icon: PhoneCall, path: '/os/unforgettable/outreach', color: 'text-purple-500 hover:bg-purple-500/10' },
  { label: 'Start AI Calls', icon: Bot, path: '/os/unforgettable/automation', color: 'text-blue-500 hover:bg-blue-500/10' },
  { label: 'Review Onboarding', icon: UserPlus, path: '/os/unforgettable/onboarding', color: 'text-emerald-500 hover:bg-emerald-500/10' },
  { label: 'View Marketplace', icon: Eye, path: '/os/unforgettable/marketplace', color: 'text-amber-500 hover:bg-amber-500/10' },
  { label: 'Analytics', icon: BarChart3, path: '/os/unforgettable/analytics', color: 'text-cyan-500 hover:bg-cyan-500/10' },
];

// Alerts
const ALERTS = [
  { text: '8 vendors stuck in onboarding > 7 days', severity: 'high', action: '/os/unforgettable/onboarding' },
  { text: '143 leads not contacted in 48+ hours', severity: 'high', action: '/os/unforgettable/outreach' },
  { text: '12 listings blocked by marketplace gate', severity: 'medium', action: '/os/unforgettable/marketplace' },
  { text: '3 callback leads overdue', severity: 'medium', action: '/os/unforgettable/outreach' },
];

export default function UTPenthouse() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
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

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.change}</p>
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
            {FUNNEL.map((f) => (
              <div key={f.stage}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{f.stage}</span>
                  <span className="font-medium">{f.count.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${f.color} rounded-full transition-all`} style={{ width: `${f.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Outreach Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-purple-500" />
              Outreach Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Calls Today</p>
                <p className="text-2xl font-bold">47</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">AI Calls</p>
                <p className="text-2xl font-bold">128</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Connect Rate</p>
                <p className="text-2xl font-bold">34%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Callbacks Due</p>
                <p className="text-2xl font-bold text-amber-500">12</p>
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
                <p className="text-2xl font-bold">94</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Listings Live</p>
                <p className="text-2xl font-bold text-emerald-500">72</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-amber-500">12</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Blocked by Gate</p>
                <p className="text-2xl font-bold text-red-500">5</p>
              </div>
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

      {/* Alerts */}
      <Card className="border-amber-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Alerts
            <Badge className="ml-auto bg-amber-500/10 text-amber-600 border-amber-500/30" variant="outline">
              {ALERTS.length} active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ALERTS.map((alert, i) => (
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
