import { useState, useMemo, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
const AmbassadorNetworkTab = lazy(() => import('./AmbassadorNetworkTab'));
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Users, TrendingUp, TrendingDown, DollarSign, ShieldCheck, Plus, Upload, FileText,
  Calendar, BarChart3, Building2, Download, AlertTriangle, Clock, CheckCircle,
  ArrowUpRight, Activity, Heart, UserPlus, Network, Zap
} from 'lucide-react';
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════
// UBEN HQ — Non-Profit Operations Tracker + Ambassador Network
// Navy + Gold accent design inside Dynasty OS dark theme
// ═══════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C';
const NAVY = '#1B2A4A';

const ACTIVITY_TYPES = ['Referral', 'Training Delivery', 'Community Placement', 'Contract'];
const DOC_CATEGORIES = ['Formation', 'Governance', 'Filings', 'Programs', 'Reports'];
const COMPLIANCE_CATEGORIES = ['Filings', 'Governance', 'Reports', 'Programs', 'Other'];

// ── Hooks ──────────────────────────────────────────────────────────────

function useUbenPrograms() {
  return useQuery({
    queryKey: ['uben-programs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_programs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenImpactLog() {
  return useQuery({
    queryKey: ['uben-impact-log'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_impact_log').select('*, uben_programs(name)').order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenPartnerActivity() {
  return useQuery({
    queryKey: ['uben-partner-activity'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_partner_activity').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenCompliance() {
  return useQuery({
    queryKey: ['uben-compliance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_compliance_calendar').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenDocuments() {
  return useQuery({
    queryKey: ['uben-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_documents').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenAmbassadors() {
  return useQuery({
    queryKey: ['uben-ambassadors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_ambassadors').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenAmbassadorSales() {
  return useQuery({
    queryKey: ['uben-ambassador-sales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_ambassador_sales').select('*, uben_ambassadors(full_name, business_unit)').order('sale_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenActivityLog() {
  return useQuery({
    queryKey: ['uben-activity-log'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_activity_log').select('*').order('created_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data || [];
    },
  });
}

// ── KPI Card (upgraded with trend) ─────────────────────────────────────

function KPICard({ title, value, icon: Icon, accent = false, trend }: {
  title: string; value: string | number; icon: any; accent?: boolean;
  trend?: { direction: 'up' | 'down' | 'neutral'; label: string };
}) {
  return (
    <Card className="border-0 bg-gradient-to-br from-[#1B2A4A] to-[#0F1A2E] backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{title}</p>
            <p className="text-xl font-bold mt-1 font-mono" style={{ color: GOLD }}>{value}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-1">
                {trend.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : trend.direction === 'down' ? (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                ) : null}
                <span className={`text-[10px] ${trend.direction === 'up' ? 'text-emerald-400' : trend.direction === 'down' ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {trend.label}
                </span>
              </div>
            )}
          </div>
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}20` }}>
            <Icon className="h-4 w-4" style={{ color: GOLD }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Compliance Chip ────────────────────────────────────────────────────

function DeadlineChip({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === 'completed') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completed</Badge>;
  const days = differenceInDays(new Date(dueDate), new Date());
  if (days < 0) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">Overdue</Badge>;
  if (days <= 30) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{days}d left</Badge>;
  return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{days}d left</Badge>;
}

// ── Activity Icon Map ──────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, any> = {
    ambassador_joined: UserPlus,
    impact_logged: Heart,
    grant_submitted: DollarSign,
    compliance_completed: ShieldCheck,
    document_uploaded: FileText,
    partner_activity: Building2,
    sale_recorded: TrendingUp,
  };
  const Icon = map[type] || Activity;
  return <Icon className="h-3.5 w-3.5" style={{ color: GOLD }} />;
}

// ── Quick Action FAB ───────────────────────────────────────────────────

function QuickActionFAB({ onAction }: { onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false);
  const actions = [
    { key: 'impact', label: 'Log Impact', icon: Heart },
    { key: 'ambassador', label: 'Add Ambassador', icon: UserPlus },
    { key: 'document', label: 'Upload Document', icon: Upload },
    { key: 'compliance', label: 'Add Compliance Item', icon: ShieldCheck },
    { key: 'partner', label: 'Log Partner Activity', icon: Building2 },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 p-0"
          style={{ backgroundColor: GOLD, color: '#000' }}
        >
          <Plus className={`h-6 w-6 transition-transform ${open ? 'rotate-45' : ''}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-56 p-2 bg-[#0F1A2E] border-[#1B2A4A]">
        {actions.map(a => (
          <button
            key={a.key}
            onClick={() => { onAction(a.key); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-[#1B2A4A] transition-colors text-left"
          >
            <a.icon className="h-4 w-4" style={{ color: GOLD }} />
            {a.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── TAB 1: Dashboard (UPGRADED) ────────────────────────────────────────

function DashboardTab() {
  const queryClient = useQueryClient();
  const { data: programs = [] } = useUbenPrograms();
  const { data: impactLog = [] } = useUbenImpactLog();
  const { data: compliance = [] } = useUbenCompliance();
  const { data: ambassadors = [] } = useUbenAmbassadors();
  const { data: ambassadorSales = [] } = useUbenAmbassadorSales();
  const { data: activityLog = [] } = useUbenActivityLog();

  // Quick action dialogs
  const [quickAction, setQuickAction] = useState<string | null>(null);

  // ── KPI Calculations ──
  const now = new Date();
  const ytdStart = startOfYear(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const thisMonthStart = startOfMonth(now);

  const ytdImpact = impactLog.filter(e => new Date(e.date) >= ytdStart);
  const totalServedYTD = ytdImpact.reduce((sum, e) => sum + (e.participants || 0), 0);

  const thisMonthServed = impactLog
    .filter(e => new Date(e.date) >= thisMonthStart)
    .reduce((sum, e) => sum + (e.participants || 0), 0);
  const lastMonthServed = impactLog
    .filter(e => { const d = new Date(e.date); return d >= lastMonthStart && d <= lastMonthEnd; })
    .reduce((sum, e) => sum + (e.participants || 0), 0);

  const activePrograms = programs.filter(p => p.status === 'active').length;

  const totalGrantFunding = 0; // Placeholder — no grants table yet, using partner activity contracts
  const grantFromPartners = impactLog.length; // placeholder trend

  const ambassadorCount = ambassadors.length;
  const activeAmbassadors = ambassadors.filter(a => a.status === 'active').length;

  const totalAmbassadorRevenue = ambassadorSales.reduce((sum, s) => sum + Number(s.sale_amount || 0), 0);
  const thisMonthRevenue = ambassadorSales
    .filter(s => new Date(s.sale_date) >= thisMonthStart)
    .reduce((sum, s) => sum + Number(s.sale_amount || 0), 0);
  const lastMonthRevenue = ambassadorSales
    .filter(s => { const d = new Date(s.sale_date); return d >= lastMonthStart && d <= lastMonthEnd; })
    .reduce((sum, s) => sum + Number(s.sale_amount || 0), 0);

  const completedCompliance = compliance.filter(c => c.status === 'completed').length;
  const complianceScore = compliance.length > 0 ? Math.round((completedCompliance / compliance.length) * 100) : 100;

  // ── Chart Data ──
  const monthlyServedData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const count = impactLog
        .filter(e => { const ed = new Date(e.date); return ed >= start && ed <= end; })
        .reduce((sum, e) => sum + (e.participants || 0), 0);
      months.push({ month: format(d, 'MMM yyyy'), short: format(d, 'MMM'), served: count });
    }
    return months;
  }, [impactLog]);

  const ambassadorGrowthData = useMemo(() => {
    const months = [];
    let cumulative = 0;
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      const end = endOfMonth(d);
      const joinedByMonth = ambassadors.filter(a => new Date(a.joined_at) <= end).length;
      cumulative = joinedByMonth;
      months.push({ month: format(d, 'MMM'), count: cumulative });
    }
    return months;
  }, [ambassadors]);

  // ── Top 5 Ambassadors This Month ──
  const topAmbassadorsThisMonth = useMemo(() => {
    const thisMonthSales = ambassadorSales.filter(s => new Date(s.sale_date) >= thisMonthStart);
    const byAmbassador: Record<string, { name: string; unit: string; sales: number; earnings: number }> = {};
    thisMonthSales.forEach(s => {
      const id = s.ambassador_id;
      if (!byAmbassador[id]) {
        const amb = (s as any).uben_ambassadors;
        byAmbassador[id] = {
          name: amb?.full_name || 'Unknown',
          unit: amb?.business_unit || '—',
          sales: 0,
          earnings: 0,
        };
      }
      byAmbassador[id].sales++;
      byAmbassador[id].earnings += Number(s.commission_amount || 0);
    });
    return Object.values(byAmbassador).sort((a, b) => b.sales - a.sales).slice(0, 5);
  }, [ambassadorSales, thisMonthStart]);

  // ── Compliance Deadlines ──
  const pendingCompliance = compliance.filter(c => c.status !== 'completed');

  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('uben_compliance_calendar').update({ status: 'completed' }).eq('id', id);
      if (error) throw error;
      // Log activity
      await supabase.from('uben_activity_log').insert({
        action_type: 'compliance_completed',
        description: 'Compliance item marked complete',
        entity_type: 'compliance',
        entity_id: id,
        actor_name: 'Admin',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uben-compliance'] });
      queryClient.invalidateQueries({ queryKey: ['uben-activity-log'] });
      toast.success('Marked complete');
    },
  });

  // Trend helpers
  const serveTrend = lastMonthServed > 0
    ? { direction: thisMonthServed >= lastMonthServed ? 'up' as const : 'down' as const, label: `${lastMonthServed > 0 ? Math.round(((thisMonthServed - lastMonthServed) / lastMonthServed) * 100) : 0}% vs last mo` }
    : { direction: 'neutral' as const, label: 'No prior data' };

  const revTrend = lastMonthRevenue > 0
    ? { direction: thisMonthRevenue >= lastMonthRevenue ? 'up' as const : 'down' as const, label: `${Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)}% vs last mo` }
    : { direction: 'neutral' as const, label: 'No prior data' };

  return (
    <div className="space-y-6">
      {/* ROW 1 — 6 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard title="People Served YTD" value={totalServedYTD.toLocaleString()} icon={Users} accent trend={serveTrend} />
        <KPICard title="Active Programs" value={activePrograms} icon={Activity} trend={{ direction: 'neutral', label: `${programs.length} total` }} />
        <KPICard title="Grant Funding" value={`$${totalGrantFunding.toLocaleString()}`} icon={DollarSign} accent trend={{ direction: 'neutral', label: 'via partners' }} />
        <KPICard title="Ambassador Network" value={ambassadorCount} icon={Network} trend={{ direction: 'up', label: `${activeAmbassadors} active` }} />
        <KPICard title="Ambassador Revenue" value={`$${totalAmbassadorRevenue.toLocaleString()}`} icon={TrendingUp} accent trend={revTrend} />
        <KPICard title="Compliance Score" value={`${complianceScore}%`} icon={ShieldCheck} trend={{ direction: complianceScore >= 80 ? 'up' : 'down', label: `${completedCompliance}/${compliance.length}` }} />
      </div>

      {/* ROW 2 — Two Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left 60% — Bar Chart */}
        <Card className="lg:col-span-3 border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: GOLD }} />
              Monthly People Served
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyServedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="short" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#0F1A2E', border: `1px solid ${NAVY}`, borderRadius: 8, color: '#fff' }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.month || ''}
                />
                <Bar dataKey="served" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right 40% — Line Chart */}
        <Card className="lg:col-span-2 border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4" style={{ color: GOLD }} />
              Ambassador Network Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ambassadorGrowthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0F1A2E', border: `1px solid ${NAVY}`, borderRadius: 8, color: '#fff' }}
                />
                <Line type="monotone" dataKey="count" stroke={GOLD} strokeWidth={2} dot={{ fill: GOLD, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ROW 3 — Three Column Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Compliance Deadlines */}
        <Card className="border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: GOLD }} />
              Upcoming Compliance Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingCompliance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All clear ✅</p>
            ) : (
              pendingCompliance.slice(0, 6).map(d => {
                const days = differenceInDays(new Date(d.due_date), new Date());
                const colorClass = days < 0 ? 'border-l-red-500' : days <= 30 ? 'border-l-yellow-500' : 'border-l-emerald-500';
                return (
                  <div key={d.id} className={`flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30 border-l-2 ${colorClass}`}>
                    <div className="flex-1 min-w-0 mr-2">
                      <span className="truncate block text-xs font-medium">{d.title}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(d.due_date), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <DeadlineChip dueDate={d.due_date} status={d.status} />
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => markComplete.mutate(d.id)}>
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Center: Top 5 Ambassadors */}
        <Card className="border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: GOLD }} />
              Top 5 Ambassadors This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topAmbassadorsThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No ambassador sales this month</p>
            ) : (
              <div className="space-y-2">
                {topAmbassadorsThisMonth.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${GOLD}30`, color: GOLD }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.unit}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono" style={{ color: GOLD }}>{a.sales} sales</p>
                      <p className="text-[10px] text-muted-foreground">${a.earnings.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Recent Activity Feed */}
        <Card className="border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: GOLD }} />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {activityLog.map(a => (
                  <div key={a.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${GOLD}15` }}>
                      <ActivityIcon type={a.action_type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-tight">{a.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {a.actor_name && `${a.actor_name} · `}
                        {format(new Date(a.created_at), 'MMM d, yyyy, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Dialogs */}
      <QuickActionDialogs action={quickAction} onClose={() => setQuickAction(null)} />
    </div>
  );
}

// ── Quick Action Dialog Router ─────────────────────────────────────────

function QuickActionDialogs({ action, onClose }: { action: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();

  const addImpact = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_impact_log').insert(form);
      if (error) throw error;
      await supabase.from('uben_activity_log').insert({ action_type: 'impact_logged', description: `Impact logged: ${form.participants} participants`, actor_name: form.logged_by || 'Admin' });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-impact-log'] }); queryClient.invalidateQueries({ queryKey: ['uben-activity-log'] }); toast.success('Impact logged'); onClose(); },
  });

  const addAmbassador = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_ambassadors').insert(form);
      if (error) throw error;
      await supabase.from('uben_activity_log').insert({ action_type: 'ambassador_joined', description: `New ambassador: ${form.full_name}`, actor_name: 'Admin' });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-ambassadors'] }); queryClient.invalidateQueries({ queryKey: ['uben-activity-log'] }); toast.success('Ambassador added'); onClose(); },
  });

  const addCompliance = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_compliance_calendar').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-compliance'] }); toast.success('Compliance item added'); onClose(); },
  });

  const addPartner = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_partner_activity').insert(form);
      if (error) throw error;
      await supabase.from('uben_activity_log').insert({ action_type: 'partner_activity', description: `Partner activity: ${form.company_name}`, actor_name: 'Admin' });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-partner-activity'] }); queryClient.invalidateQueries({ queryKey: ['uben-activity-log'] }); toast.success('Partner activity logged'); onClose(); },
  });

  const { data: programs = [] } = useUbenPrograms();

  return (
    <>
      {/* Log Impact */}
      <Dialog open={action === 'impact'} onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Impact</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addImpact.mutate({ program_id: fd.get('program_id'), date: fd.get('date'), participants: Number(fd.get('participants')), outcome_notes: fd.get('outcome_notes'), logged_by: fd.get('logged_by') }); }} className="space-y-3">
            <div><Label>Program</Label>
              <select name="program_id" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Select program</option>
                {programs.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label>Date</Label><Input name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required /></div>
            <div><Label># Participants</Label><Input name="participants" type="number" min="0" required /></div>
            <div><Label>Outcome Notes</Label><Textarea name="outcome_notes" /></div>
            <div><Label>Logged By</Label><Input name="logged_by" /></div>
            <Button type="submit" disabled={addImpact.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Ambassador */}
      <Dialog open={action === 'ambassador'} onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Ambassador</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addAmbassador.mutate({ full_name: fd.get('full_name'), email: fd.get('email'), phone: fd.get('phone'), business_unit: fd.get('business_unit'), referral_code: fd.get('referral_code') }); }} className="space-y-3">
            <div><Label>Full Name</Label><Input name="full_name" required /></div>
            <div><Label>Email</Label><Input name="email" type="email" /></div>
            <div><Label>Phone</Label><Input name="phone" /></div>
            <div><Label>Business Unit</Label><Input name="business_unit" placeholder="e.g. Dynasty OS, Unforgettable Times" /></div>
            <div><Label>Referral Code</Label><Input name="referral_code" /></div>
            <Button type="submit" disabled={addAmbassador.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Document — just opens documents tab hint */}
      <Dialog open={action === 'document'} onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Switch to the Document Vault tab to upload files with full categorization and storage.</p>
          <Button onClick={onClose} variant="outline">Close</Button>
        </DialogContent>
      </Dialog>

      {/* Add Compliance Item */}
      <Dialog open={action === 'compliance'} onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Compliance Item</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addCompliance.mutate({ title: fd.get('title'), due_date: fd.get('due_date'), category: fd.get('category'), notes: fd.get('notes') }); }} className="space-y-3">
            <div><Label>Title</Label><Input name="title" required /></div>
            <div><Label>Due Date</Label><Input name="due_date" type="date" required /></div>
            <div><Label>Category</Label>
              <select name="category" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                {COMPLIANCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Notes</Label><Textarea name="notes" /></div>
            <Button type="submit" disabled={addCompliance.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Log Partner Activity */}
      <Dialog open={action === 'partner'} onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Partner Activity</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addPartner.mutate({ company_name: fd.get('company_name'), activity_type: fd.get('activity_type'), date: fd.get('date'), people_count: Number(fd.get('people_count') || 0), value: Number(fd.get('value') || 0), notes: fd.get('notes') }); }} className="space-y-3">
            <div><Label>Company Name</Label><Input name="company_name" required /></div>
            <div><Label>Activity Type</Label>
              <select name="activity_type" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Date</Label><Input name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required /></div>
            <div><Label># of People</Label><Input name="people_count" type="number" min="0" /></div>
            <div><Label>Value ($)</Label><Input name="value" type="number" min="0" step="0.01" /></div>
            <div><Label>Notes</Label><Textarea name="notes" /></div>
            <Button type="submit" disabled={addPartner.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── TAB 2: Programs & Impact Log ───────────────────────────────────────

function ProgramsTab() {
  const queryClient = useQueryClient();
  const { data: programs = [], isLoading } = useUbenPrograms();
  const { data: impactLog = [] } = useUbenImpactLog();
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [showAddImpact, setShowAddImpact] = useState(false);

  const addProgram = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_programs').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-programs'] }); toast.success('Program added'); setShowAddProgram(false); },
  });

  const addImpact = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_impact_log').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-impact-log'] }); toast.success('Impact logged'); setShowAddImpact(false); },
  });

  const archiveProgram = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('uben_programs').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-programs'] }); toast.success('Program archived'); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active Programs</h3>
        <div className="flex gap-2">
          <Dialog open={showAddProgram} onOpenChange={setShowAddProgram}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }}><Plus className="h-4 w-4 mr-1" /> Add Program</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Program</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addProgram.mutate({ name: fd.get('name'), description: fd.get('description'), start_date: fd.get('start_date') || null }); }} className="space-y-3">
                <div><Label>Name</Label><Input name="name" required /></div>
                <div><Label>Description</Label><Textarea name="description" /></div>
                <div><Label>Start Date</Label><Input name="start_date" type="date" /></div>
                <Button type="submit" disabled={addProgram.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={showAddImpact} onOpenChange={setShowAddImpact}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Log Impact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log Impact Entry</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addImpact.mutate({ program_id: fd.get('program_id'), date: fd.get('date'), participants: Number(fd.get('participants')), outcome_notes: fd.get('outcome_notes'), logged_by: fd.get('logged_by') }); }} className="space-y-3">
                <div><Label>Program</Label>
                  <select name="program_id" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                    <option value="">Select program</option>
                    {programs.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><Label>Date</Label><Input name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required /></div>
                <div><Label># Participants</Label><Input name="participants" type="number" min="0" required /></div>
                <div><Label>Outcome Notes</Label><Textarea name="outcome_notes" /></div>
                <div><Label>Logged By</Label><Input name="logged_by" /></div>
                <Button type="submit" disabled={addImpact.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {programs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No programs yet. Add your first program above.</TableCell></TableRow>
            ) : programs.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{p.description}</TableCell>
                <TableCell>{p.start_date ? format(new Date(p.start_date), 'MMM d, yyyy') : '—'}</TableCell>
                <TableCell>{p.participant_count}</TableCell>
                <TableCell><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                <TableCell>
                  {p.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => archiveProgram.mutate(p.id)}>Archive</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <h3 className="text-lg font-semibold">Impact Log</h3>
      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Outcome Notes</TableHead>
              <TableHead>Logged By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {impactLog.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No impact entries logged yet.</TableCell></TableRow>
            ) : impactLog.map(e => (
              <TableRow key={e.id}>
                <TableCell>{format(new Date(e.date), 'MMM d, yyyy')}</TableCell>
                <TableCell>{(e as any).uben_programs?.name || '—'}</TableCell>
                <TableCell className="font-medium">{e.participants}</TableCell>
                <TableCell className="max-w-[250px] truncate text-muted-foreground">{e.outcome_notes}</TableCell>
                <TableCell>{e.logged_by || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── TAB 3: Partner Activity ────────────────────────────────────────────

function PartnerActivityTab() {
  const queryClient = useQueryClient();
  const { data: activities = [] } = useUbenPartnerActivity();
  const [showAdd, setShowAdd] = useState(false);

  const addActivity = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_partner_activity').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-partner-activity'] }); toast.success('Activity logged'); setShowAdd(false); },
  });

  const byCompany = activities.reduce((acc: Record<string, { count: number; value: number }>, a) => {
    if (!acc[a.company_name]) acc[a.company_name] = { count: 0, value: 0 };
    acc[a.company_name].count++;
    acc[a.company_name].value += Number(a.value || 0);
    return acc;
  }, {});

  const totalValue = activities.reduce((sum, a) => sum + Number(a.value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Partner Activity Log</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }}><Plus className="h-4 w-4 mr-1" /> Log Activity</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Partner Activity</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addActivity.mutate({ company_name: fd.get('company_name'), activity_type: fd.get('activity_type'), date: fd.get('date'), people_count: Number(fd.get('people_count') || 0), value: Number(fd.get('value') || 0), notes: fd.get('notes') }); }} className="space-y-3">
              <div><Label>Company Name</Label><Input name="company_name" required /></div>
              <div><Label>Activity Type</Label>
                <select name="activity_type" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label>Date</Label><Input name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required /></div>
              <div><Label># of People</Label><Input name="people_count" type="number" min="0" /></div>
              <div><Label>Value ($)</Label><Input name="value" type="number" min="0" step="0.01" /></div>
              <div><Label>Notes</Label><Textarea name="notes" /></div>
              <Button type="submit" disabled={addActivity.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Activities" value={activities.length} icon={Activity} />
        <KPICard title="Companies Supported" value={Object.keys(byCompany).length} icon={Building2} />
        <KPICard title="Total Value Delivered" value={`$${totalValue.toLocaleString()}`} icon={DollarSign} accent />
      </div>

      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>People</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No partner activities logged yet.</TableCell></TableRow>
            ) : activities.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.company_name}</TableCell>
                <TableCell><Badge variant="outline">{a.activity_type}</Badge></TableCell>
                <TableCell>{format(new Date(a.date), 'MMM d, yyyy')}</TableCell>
                <TableCell>{a.people_count}</TableCell>
                <TableCell>${Number(a.value || 0).toLocaleString()}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{a.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── TAB 4: Document Vault ──────────────────────────────────────────────

function DocumentVaultTab() {
  const queryClient = useQueryClient();
  const { data: docs = [] } = useUbenDocuments();
  const [filterCat, setFilterCat] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const filtered = filterCat === 'all' ? docs : docs.filter(d => d.category === filterCat);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = (e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement)?.files?.[0];
    if (!file) { toast.error('Select a file'); return; }
    setUploading(true);
    try {
      const filePath = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('uben-docs').upload(filePath, file);
      if (uploadError) throw uploadError;
      // uben-docs is private: persist the object path, sign it at read time.
      await supabase.from('uben_documents').insert({
        name: fd.get('name') as string || file.name,
        category: fd.get('category') as string,
        file_url: filePath,
        file_size: file.size,
        uploaded_by: fd.get('uploaded_by') as string || 'Admin',
      });
      queryClient.invalidateQueries({ queryKey: ['uben-documents'] });
      toast.success('Document uploaded');
      setShowUpload(false);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Document Vault</h3>
        <div className="flex gap-2">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }}><Upload className="h-4 w-4 mr-1" /> Upload</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
              <form onSubmit={handleUpload} className="space-y-3">
                <div><Label>Document Name</Label><Input name="name" placeholder="Optional — defaults to filename" /></div>
                <div><Label>Category</Label>
                  <select name="category" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                    {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label>File</Label><Input name="file" type="file" required /></div>
                <div><Label>Uploaded By</Label><Input name="uploaded_by" defaultValue="Admin" /></div>
                <Button type="submit" disabled={uploading} style={{ backgroundColor: GOLD, color: '#000' }}>{uploading ? 'Uploading...' : 'Upload'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Size</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No documents uploaded yet.</TableCell></TableRow>
            ) : filtered.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium flex items-center gap-2"><FileText className="h-4 w-4" style={{ color: GOLD }} />{d.name}</TableCell>
                <TableCell><Badge variant="outline">{d.category}</Badge></TableCell>
                <TableCell>{d.uploaded_by || '—'}</TableCell>
                <TableCell>{format(new Date(d.created_at), 'MMM d, yyyy')}</TableCell>
                <TableCell>{d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : '—'}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openSignedStorageObject('uben-docs', d.file_url).catch((e: any) => toast.error(e.message || 'Could not open document'))}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── TAB 5: Compliance Calendar ─────────────────────────────────────────

function ComplianceTab() {
  const queryClient = useQueryClient();
  const { data: deadlines = [] } = useUbenCompliance();
  const [showAdd, setShowAdd] = useState(false);

  const addDeadline = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_compliance_calendar').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-compliance'] }); toast.success('Deadline added'); setShowAdd(false); },
  });

  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('uben_compliance_calendar').update({ status: 'completed' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-compliance'] }); toast.success('Marked complete'); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Compliance Calendar</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }}><Plus className="h-4 w-4 mr-1" /> Add Deadline</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Compliance Deadline</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addDeadline.mutate({ title: fd.get('title'), due_date: fd.get('due_date'), category: fd.get('category'), notes: fd.get('notes') }); }} className="space-y-3">
              <div><Label>Title</Label><Input name="title" required /></div>
              <div><Label>Due Date</Label><Input name="due_date" type="date" required /></div>
              <div><Label>Category</Label>
                <select name="category" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                  {COMPLIANCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><Label>Notes</Label><Textarea name="notes" /></div>
              <Button type="submit" disabled={addDeadline.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {deadlines.length === 0 ? (
          <Card className="border-0 bg-card/80 p-8 text-center text-muted-foreground">No compliance deadlines configured.</Card>
        ) : deadlines.map(d => (
          <Card key={d.id} className="border-0 bg-card/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${NAVY}80` }}>
                  <Calendar className="h-5 w-5" style={{ color: GOLD }} />
                </div>
                <div>
                  <p className="font-medium text-sm">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.category} · Due {format(new Date(d.due_date), 'MMM d, yyyy')}</p>
                  {d.notes && <p className="text-xs text-muted-foreground mt-0.5">{d.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DeadlineChip dueDate={d.due_date} status={d.status} />
                {d.status !== 'completed' && (
                  <Button size="sm" variant="ghost" onClick={() => markComplete.mutate(d.id)}>
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── TAB 6: Impact Report Generator ─────────────────────────────────────

function ImpactReportTab() {
  const { data: impactLog = [] } = useUbenImpactLog();
  const { data: programs = [] } = useUbenPrograms();
  const { data: partnerActivity = [] } = useUbenPartnerActivity();

  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [narrative, setNarrative] = useState('');

  const filtered = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    return {
      impacts: impactLog.filter(i => { const d = new Date(i.date); return d >= s && d <= e; }),
      activities: partnerActivity.filter(a => { const d = new Date(a.date); return d >= s && d <= e; }),
    };
  }, [impactLog, partnerActivity, startDate, endDate]);

  const totalParticipants = filtered.impacts.reduce((sum, i) => sum + (i.participants || 0), 0);
  const programsDelivered = new Set(filtered.impacts.map(i => i.program_id)).size;
  const companiesSupported = new Set(filtered.activities.map(a => a.company_name)).size;
  const totalValue = filtered.activities.reduce((sum, a) => sum + Number(a.value || 0), 0);

  const copyReport = () => {
    const report = `
UBEN IMPACT REPORT
Period: ${format(new Date(startDate), 'MMM d, yyyy')} — ${format(new Date(endDate), 'MMM d, yyyy')}

SUMMARY
- Total Participants Served: ${totalParticipants.toLocaleString()}
- Programs Delivered: ${programsDelivered}
- Partner Companies Supported: ${companiesSupported}
- Value of Services Delivered: $${totalValue.toLocaleString()}

OUTCOMES NARRATIVE
${narrative || '(No narrative provided)'}
    `.trim();
    navigator.clipboard.writeText(report);
    toast.success('Report copied to clipboard');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Impact Report Generator</h3>
        <div className="flex items-center gap-2">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[160px]" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Participants Served" value={totalParticipants.toLocaleString()} icon={Users} accent />
        <KPICard title="Programs Delivered" value={programsDelivered} icon={Activity} />
        <KPICard title="Companies Supported" value={companiesSupported} icon={Building2} />
        <KPICard title="Value Delivered" value={`$${totalValue.toLocaleString()}`} icon={DollarSign} accent />
      </div>

      <Card className="border-0 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Outcomes Narrative</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={narrative}
            onChange={e => setNarrative(e.target.value)}
            placeholder="Enter qualitative summary of outcomes, stories, and impact highlights..."
            rows={6}
          />
        </CardContent>
      </Card>

      <Button onClick={copyReport} style={{ backgroundColor: GOLD, color: '#000' }}>
        <Download className="h-4 w-4 mr-2" /> Copy Report to Clipboard
      </Button>
    </div>
  );
}

// ── Main UBEN HQ Page ──────────────────────────────────────────────────

export default function UbenHQ() {
  const [quickAction, setQuickAction] = useState<string | null>(null);

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY}, ${GOLD}40)` }}>
          <Heart className="h-6 w-6" style={{ color: GOLD }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">UBEN HQ</h1>
          <p className="text-sm text-muted-foreground">Non-Profit Operations + Ambassador Network — Internal Use Only</p>
        </div>
      </div>

      {/* Tabbed Layout */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="ambassadors" className="text-xs">Ambassador Network</TabsTrigger>
          <TabsTrigger value="programs" className="text-xs">Programs & Impact</TabsTrigger>
          <TabsTrigger value="partners" className="text-xs">Partner Activity</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Document Vault</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs">Compliance Calendar</TabsTrigger>
          <TabsTrigger value="report" className="text-xs">Impact Report</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="ambassadors"><Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading...</div>}><AmbassadorNetworkTab /></Suspense></TabsContent>
        <TabsContent value="programs"><ProgramsTab /></TabsContent>
        <TabsContent value="partners"><PartnerActivityTab /></TabsContent>
        <TabsContent value="documents"><DocumentVaultTab /></TabsContent>
        <TabsContent value="compliance"><ComplianceTab /></TabsContent>
        <TabsContent value="report"><ImpactReportTab /></TabsContent>
      </Tabs>

      {/* Floating Quick Action Button */}
      <QuickActionFAB onAction={setQuickAction} />
      <QuickActionDialogs action={quickAction} onClose={() => setQuickAction(null)} />
    </div>
  );
}
