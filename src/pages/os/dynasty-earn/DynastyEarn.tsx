import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, Users, Link2, TrendingUp, Trophy, Bell,
  Plus, Search, Copy, ExternalLink, CheckCircle, Clock,
  BarChart3, Sparkles, Eye, MousePointer, ArrowUpRight, ArrowDownRight,
  Zap, Star, Award, Target
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const BUSINESS_UNITS = ['Unforgettable Times', 'TopTier Experience', 'iClean WeClean', 'GasMask', 'UBEN Programs'];
const CHART_COLORS = ['hsl(var(--primary))', '#f59e0b', '#10b981', '#6366f1', '#ec4899'];

type Affiliate = {
  id: string; name: string; email: string; phone: string | null; role: string;
  status: string; referral_code: string | null; business_units: string[] | null;
  lifetime_earnings: number; total_clicks: number; total_conversions: number;
  created_at: string;
};
type Program = {
  id: string; business_name: string; program_name: string; description: string | null;
  commission_type: string; commission_value: number; recurring: boolean;
  status: string; created_at: string;
};
type EarnLink = {
  id: string; affiliate_id: string; program_id: string; unique_code: string;
  destination_url: string | null; clicks: number; conversions: number; created_at: string;
};
type Commission = {
  id: string; affiliate_id: string; program_id: string; amount: number;
  status: string; source_description: string | null; created_at: string;
};
type Payout = {
  id: string; affiliate_id: string; total_amount: number; payout_method: string | null;
  status: string; processed_at: string | null; created_at: string;
};
type Notification = {
  id: string; affiliate_id: string; title: string; message: string;
  notification_type: string | null; is_read: boolean; created_at: string;
};

export default function DynastyEarn() {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const { data: affiliates = [] } = useQuery<Affiliate[]>({
    queryKey: ['dynasty-earn-affiliates'],
    queryFn: async () => {
      const { data } = await supabase.from('dynasty_earn_affiliates').select('*').order('created_at', { ascending: false });
      return (data || []) as Affiliate[];
    }
  });
  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['dynasty-earn-programs'],
    queryFn: async () => {
      const { data } = await supabase.from('dynasty_earn_programs').select('*').order('created_at', { ascending: false });
      return (data || []) as Program[];
    }
  });
  const { data: links = [] } = useQuery<EarnLink[]>({
    queryKey: ['dynasty-earn-links'],
    queryFn: async () => {
      const { data } = await supabase.from('dynasty_earn_links').select('*').order('created_at', { ascending: false });
      return (data || []) as EarnLink[];
    }
  });
  const { data: commissions = [] } = useQuery<Commission[]>({
    queryKey: ['dynasty-earn-commissions'],
    queryFn: async () => {
      const { data } = await supabase.from('dynasty_earn_commissions').select('*').order('created_at', { ascending: false });
      return (data || []) as Commission[];
    }
  });
  const { data: payouts = [] } = useQuery<Payout[]>({
    queryKey: ['dynasty-earn-payouts'],
    queryFn: async () => {
      const { data } = await supabase.from('dynasty_earn_payouts').select('*').order('created_at', { ascending: false });
      return (data || []) as Payout[];
    }
  });
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['dynasty-earn-notifications'],
    queryFn: async () => {
      const { data } = await supabase.from('dynasty_earn_notifications').select('*').order('created_at', { ascending: false }).limit(20);
      return (data || []) as Notification[];
    }
  });

  const kpis = useMemo(() => {
    const totalEarnings = commissions.reduce((s, c) => s + Number(c.amount), 0);
    const pendingComm = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0);
    const paidOut = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + Number(p.total_amount), 0);
    const totalClicks = links.reduce((s, l) => s + (l.clicks || 0), 0);
    const totalConversions = links.reduce((s, l) => s + (l.conversions || 0), 0);
    const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0';
    return { totalEarnings, pendingComm, paidOut, totalClicks, totalConversions, convRate, activePrograms: programs.filter(p => p.status === 'active').length, totalAffiliates: affiliates.length };
  }, [commissions, payouts, links, programs, affiliates]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-primary" /> Dynasty Earn — Affiliate Command
          </h1>
          <p className="text-muted-foreground text-sm">Centralized affiliate management across all Dynasty businesses</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1"><Bell className="h-3 w-3" />{notifications.filter(n => !n.is_read).length} new</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 flex-wrap h-auto p-1">
          <TabsTrigger value="overview">📊 Overview</TabsTrigger>
          <TabsTrigger value="programs">🎯 Programs</TabsTrigger>
          <TabsTrigger value="affiliates">👥 Affiliates</TabsTrigger>
          <TabsTrigger value="links">🔗 Links</TabsTrigger>
          <TabsTrigger value="commissions">💰 Commissions</TabsTrigger>
          <TabsTrigger value="payouts">💳 Payouts</TabsTrigger>
          <TabsTrigger value="leaderboard">🏆 Leaderboard</TabsTrigger>
          <TabsTrigger value="notifications">🔔 Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab kpis={kpis} commissions={commissions} links={links} programs={programs} affiliates={affiliates} /></TabsContent>
        <TabsContent value="programs"><ProgramsTab programs={programs} queryClient={queryClient} /></TabsContent>
        <TabsContent value="affiliates"><AffiliatesTab affiliates={affiliates} queryClient={queryClient} /></TabsContent>
        <TabsContent value="links"><LinksTab links={links} affiliates={affiliates} programs={programs} queryClient={queryClient} /></TabsContent>
        <TabsContent value="commissions"><CommissionsTab commissions={commissions} affiliates={affiliates} programs={programs} queryClient={queryClient} /></TabsContent>
        <TabsContent value="payouts"><PayoutsTab payouts={payouts} affiliates={affiliates} queryClient={queryClient} /></TabsContent>
        <TabsContent value="leaderboard"><LeaderboardTab affiliates={affiliates} commissions={commissions} /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab notifications={notifications} queryClient={queryClient} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ━━━━━━━━ OVERVIEW ━━━━━━━━ */
function OverviewTab({ kpis, commissions, links, programs, affiliates }: any) {
  const kpiCards = [
    { label: 'Total Earnings', value: `$${kpis.totalEarnings.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
    { label: 'Pending Commissions', value: `$${kpis.pendingComm.toLocaleString()}`, icon: Clock, color: 'text-yellow-400' },
    { label: 'Total Paid Out', value: `$${kpis.paidOut.toLocaleString()}`, icon: CheckCircle, color: 'text-blue-400' },
    { label: 'Total Clicks', value: kpis.totalClicks.toLocaleString(), icon: MousePointer, color: 'text-purple-400' },
    { label: 'Conversions', value: kpis.totalConversions.toLocaleString(), icon: Target, color: 'text-pink-400' },
    { label: 'Conv. Rate', value: `${kpis.convRate}%`, icon: TrendingUp, color: 'text-primary' },
    { label: 'Active Programs', value: kpis.activePrograms, icon: Zap, color: 'text-orange-400' },
    { label: 'Total Affiliates', value: kpis.totalAffiliates, icon: Users, color: 'text-cyan-400' },
  ];

  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    commissions.forEach((c: Commission) => {
      const m = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      months[m] = (months[m] || 0) + Number(c.amount);
    });
    return Object.entries(months).slice(-12).map(([month, amount]) => ({ month, amount }));
  }, [commissions]);

  const programBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    commissions.forEach((c: Commission) => {
      const prog = programs.find((p: Program) => p.id === c.program_id);
      const name = prog?.business_name || 'Unknown';
      map[name] = (map[name] || 0) + Number(c.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [commissions, programs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map(k => (
          <Card key={k.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <k.icon className={`h-5 w-5 ${k.color}`} />
              </div>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">Monthly Earnings</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">Earnings by Business</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={programBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {programBreakdown.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendation placeholder */}
      <Card className="bg-card border-primary/20 border">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Program Recommendations</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {programs.filter((p: Program) => p.status === 'active').slice(0, 3).map((p: Program) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.program_name}</p>
                  <p className="text-xs text-muted-foreground">{p.business_name} • {p.commission_type === 'percentage' ? `${p.commission_value}%` : `$${p.commission_value}`} {p.recurring ? '(recurring)' : ''}</p>
                </div>
                <Badge className="bg-primary/10 text-primary border-0">Recommended</Badge>
              </div>
            ))}
            {programs.length === 0 && <p className="text-sm text-muted-foreground">Add programs to get AI recommendations</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ━━━━━━━━ PROGRAMS ━━━━━━━━ */
function ProgramsTab({ programs, queryClient }: { programs: Program[]; queryClient: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ business_name: '', program_name: '', description: '', commission_type: 'percentage', commission_value: '', recurring: false });

  const addProgram = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dynasty_earn_programs').insert({
        business_name: form.business_name,
        program_name: form.program_name,
        description: form.description || null,
        commission_type: form.commission_type,
        commission_value: Number(form.commission_value),
        recurring: form.recurring,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynasty-earn-programs'] });
      setShowAdd(false);
      setForm({ business_name: '', program_name: '', description: '', commission_type: 'percentage', commission_value: '', recurring: false });
      toast.success('Program created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Affiliate Programs</h2>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Program</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Program</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.business_name} onValueChange={v => setForm(f => ({ ...f, business_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Business Unit" /></SelectTrigger>
                <SelectContent>{BUSINESS_UNITS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Program Name" value={form.program_name} onChange={e => setForm(f => ({ ...f, program_name: e.target.value }))} />
              <Input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <div className="flex gap-2">
                <Select value={form.commission_type} onValueChange={v => setForm(f => ({ ...f, commission_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed $</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Value" value={form.commission_value} onChange={e => setForm(f => ({ ...f, commission_value: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} /> Recurring commission
              </label>
              <Button onClick={() => addProgram.mutate()} disabled={!form.business_name || !form.program_name || !form.commission_value} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {programs.map(p => (
          <Card key={p.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge>
                {p.recurring && <Badge variant="outline" className="text-xs">Recurring</Badge>}
              </div>
              <h3 className="font-semibold text-foreground">{p.program_name}</h3>
              <p className="text-xs text-muted-foreground mb-2">{p.business_name}</p>
              <p className="text-lg font-bold text-primary">
                {p.commission_type === 'percentage' ? `${p.commission_value}%` : `$${p.commission_value}`}
              </p>
              {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
            </CardContent>
          </Card>
        ))}
        {programs.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No programs yet</p>}
      </div>
    </div>
  );
}

/* ━━━━━━━━ AFFILIATES ━━━━━━━━ */
function AffiliatesTab({ affiliates, queryClient }: { affiliates: Affiliate[]; queryClient: any }) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'ambassador' });

  const filtered = affiliates.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    (a.referral_code || '').toLowerCase().includes(search.toLowerCase())
  );

  const addAffiliate = useMutation({
    mutationFn: async () => {
      const code = `DYN-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from('dynasty_earn_affiliates').insert({
        name: form.name, email: form.email, phone: form.phone || null,
        role: form.role, referral_code: code,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynasty-earn-affiliates'] });
      setShowAdd(false);
      setForm({ name: '', email: '', phone: '', role: 'ambassador' });
      toast.success('Affiliate added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const roleColor = (r: string) => r === 'ambassador' ? 'bg-blue-500/10 text-blue-400' : r === 'model' ? 'bg-pink-500/10 text-pink-400' : 'bg-emerald-500/10 text-emerald-400';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search affiliates..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Affiliate</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Affiliate</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambassador">Ambassador</SelectItem>
                  <SelectItem value="model">Model</SelectItem>
                  <SelectItem value="nonprofit">Non-Profit</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => addAffiliate.mutate()} disabled={!form.name || !form.email} className="w-full">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Role</th>
              <th className="text-left p-2">Ref Code</th>
              <th className="text-right p-2">Earnings</th>
              <th className="text-right p-2">Clicks</th>
              <th className="text-right p-2">Conv.</th>
              <th className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="p-2 font-medium text-foreground">{a.name}</td>
                <td className="p-2 text-muted-foreground">{a.email}</td>
                <td className="p-2"><Badge className={`${roleColor(a.role)} border-0 text-xs`}>{a.role}</Badge></td>
                <td className="p-2 font-mono text-xs text-muted-foreground">{a.referral_code || '—'}</td>
                <td className="p-2 text-right text-foreground">${Number(a.lifetime_earnings).toLocaleString()}</td>
                <td className="p-2 text-right text-muted-foreground">{a.total_clicks}</td>
                <td className="p-2 text-right text-muted-foreground">{a.total_conversions}</td>
                <td className="p-2"><Badge variant={a.status === 'active' ? 'default' : 'secondary'} className="text-xs">{a.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No affiliates found</p>}
      </div>
    </div>
  );
}

/* ━━━━━━━━ LINKS ━━━━━━━━ */
function LinksTab({ links, affiliates, programs, queryClient }: { links: EarnLink[]; affiliates: Affiliate[]; programs: Program[]; queryClient: any }) {
  const [showGen, setShowGen] = useState(false);
  const [form, setForm] = useState({ affiliate_id: '', program_id: '', destination_url: '' });

  const generateLink = useMutation({
    mutationFn: async () => {
      const code = `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from('dynasty_earn_links').insert({
        affiliate_id: form.affiliate_id, program_id: form.program_id,
        unique_code: code, destination_url: form.destination_url || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynasty-earn-links'] });
      setShowGen(false);
      toast.success('Link generated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Copied!');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Referral Links</h2>
        <Dialog open={showGen} onOpenChange={setShowGen}>
          <DialogTrigger asChild><Button size="sm"><Link2 className="h-4 w-4 mr-1" /> Generate Link</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Referral Link</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.affiliate_id} onValueChange={v => setForm(f => ({ ...f, affiliate_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select Affiliate" /></SelectTrigger>
                <SelectContent>{affiliates.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.program_id} onValueChange={v => setForm(f => ({ ...f, program_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select Program" /></SelectTrigger>
                <SelectContent>{programs.map(p => <SelectItem key={p.id} value={p.id}>{p.program_name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Destination URL" value={form.destination_url} onChange={e => setForm(f => ({ ...f, destination_url: e.target.value }))} />
              <Button onClick={() => generateLink.mutate()} disabled={!form.affiliate_id || !form.program_id} className="w-full">Generate</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {links.map(l => {
          const aff = affiliates.find(a => a.id === l.affiliate_id);
          const prog = programs.find(p => p.id === l.program_id);
          return (
            <Card key={l.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium text-foreground">{aff?.name || 'Unknown'}</p>
                  <Button size="sm" variant="ghost" onClick={() => copyCode(l.unique_code)}><Copy className="h-3 w-3" /></Button>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{prog?.program_name || 'Unknown Program'}</p>
                <p className="font-mono text-xs text-primary mb-3">{l.unique_code}</p>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground"><MousePointer className="h-3 w-3" /> {l.clicks} clicks</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><Target className="h-3 w-3" /> {l.conversions} conv.</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {links.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No links generated yet</p>}
      </div>
    </div>
  );
}

/* ━━━━━━━━ COMMISSIONS ━━━━━━━━ */
function CommissionsTab({ commissions, affiliates, programs, queryClient }: { commissions: Commission[]; affiliates: Affiliate[]; programs: Program[]; queryClient: any }) {
  const statusColor = (s: string) => s === 'paid' ? 'default' : s === 'approved' ? 'secondary' : s === 'disputed' ? 'destructive' : 'outline';

  const approve = async (id: string) => {
    await supabase.from('dynasty_earn_commissions').update({ status: 'approved', approved_at: new Date().toISOString() } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['dynasty-earn-commissions'] });
    toast.success('Commission approved');
  };
  const markPaid = async (id: string) => {
    await supabase.from('dynasty_earn_commissions').update({ status: 'paid', paid_at: new Date().toISOString() } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['dynasty-earn-commissions'] });
    toast.success('Marked as paid');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', val: `$${commissions.reduce((s, c) => s + Number(c.amount), 0).toLocaleString()}` },
          { label: 'Pending', val: `$${commissions.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0).toLocaleString()}` },
          { label: 'Approved', val: `$${commissions.filter(c => c.status === 'approved').reduce((s, c) => s + Number(c.amount), 0).toLocaleString()}` },
          { label: 'Paid', val: `$${commissions.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0).toLocaleString()}` },
        ].map(k => (
          <Card key={k.label} className="bg-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{k.label}</p><p className="text-lg font-bold text-foreground">{k.val}</p></CardContent></Card>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-muted-foreground">
            <th className="text-left p-2">Date</th><th className="text-left p-2">Affiliate</th><th className="text-left p-2">Program</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Status</th><th className="text-right p-2">Actions</th>
          </tr></thead>
          <tbody>
            {commissions.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="p-2 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="p-2 text-foreground">{affiliates.find(a => a.id === c.affiliate_id)?.name || '—'}</td>
                <td className="p-2 text-muted-foreground">{programs.find(p => p.id === c.program_id)?.program_name || '—'}</td>
                <td className="p-2 text-right font-semibold text-foreground">${Number(c.amount).toLocaleString()}</td>
                <td className="p-2"><Badge variant={statusColor(c.status)} className="text-xs">{c.status}</Badge></td>
                <td className="p-2 text-right">
                  {c.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => approve(c.id)} className="text-xs">Approve</Button>}
                  {c.status === 'approved' && <Button size="sm" variant="ghost" onClick={() => markPaid(c.id)} className="text-xs">Pay</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {commissions.length === 0 && <p className="text-center text-muted-foreground py-8">No commissions yet</p>}
      </div>
    </div>
  );
}

/* ━━━━━━━━ PAYOUTS ━━━━━━━━ */
function PayoutsTab({ payouts, affiliates, queryClient }: { payouts: Payout[]; affiliates: Affiliate[]; queryClient: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Payouts', val: `$${payouts.reduce((s, p) => s + Number(p.total_amount), 0).toLocaleString()}` },
          { label: 'Completed', val: payouts.filter(p => p.status === 'completed').length },
          { label: 'Pending', val: payouts.filter(p => p.status === 'pending').length },
        ].map(k => (
          <Card key={k.label} className="bg-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{k.label}</p><p className="text-lg font-bold text-foreground">{k.val}</p></CardContent></Card>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-muted-foreground">
            <th className="text-left p-2">Date</th><th className="text-left p-2">Affiliate</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Method</th><th className="text-left p-2">Status</th>
          </tr></thead>
          <tbody>
            {payouts.map(p => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="p-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="p-2 text-foreground">{affiliates.find(a => a.id === p.affiliate_id)?.name || '—'}</td>
                <td className="p-2 text-right font-semibold text-foreground">${Number(p.total_amount).toLocaleString()}</td>
                <td className="p-2 text-muted-foreground">{p.payout_method || '—'}</td>
                <td className="p-2"><Badge variant={p.status === 'completed' ? 'default' : 'outline'} className="text-xs">{p.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {payouts.length === 0 && <p className="text-center text-muted-foreground py-8">No payouts yet</p>}
      </div>
    </div>
  );
}

/* ━━━━━━━━ LEADERBOARD ━━━━━━━━ */
function LeaderboardTab({ affiliates, commissions }: { affiliates: Affiliate[]; commissions: Commission[] }) {
  const ranked = useMemo(() => {
    const map: Record<string, number> = {};
    commissions.forEach(c => { map[c.affiliate_id] = (map[c.affiliate_id] || 0) + Number(c.amount); });
    return affiliates
      .map(a => ({ ...a, totalComm: map[a.id] || 0 }))
      .sort((a, b) => b.totalComm - a.totalComm)
      .slice(0, 20);
  }, [affiliates, commissions]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-400" /> Top Earners Leaderboard</h2>
      <div className="space-y-2">
        {ranked.map((a, i) => (
          <Card key={a.id} className={`bg-card border-border ${i < 3 ? 'border-primary/30' : ''}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl w-10 text-center">{medals[i] || `#${i + 1}`}</span>
                <div>
                  <p className="font-semibold text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.role} • {a.referral_code}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">${a.totalComm.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{a.total_conversions} conversions</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {ranked.length === 0 && <p className="text-center text-muted-foreground py-8">No affiliate data yet</p>}
      </div>
    </div>
  );
}

/* ━━━━━━━━ NOTIFICATIONS ━━━━━━━━ */
function NotificationsTab({ notifications, queryClient }: { notifications: Notification[]; queryClient: any }) {
  const markRead = async (id: string) => {
    await supabase.from('dynasty_earn_notifications').update({ is_read: true } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['dynasty-earn-notifications'] });
  };

  const typeIcon = (t: string | null) => {
    if (t === 'earning') return <DollarSign className="h-4 w-4 text-emerald-400" />;
    if (t === 'campaign') return <Zap className="h-4 w-4 text-yellow-400" />;
    return <Bell className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
      {notifications.map(n => (
        <Card key={n.id} className={`bg-card border-border ${!n.is_read ? 'border-l-4 border-l-primary' : ''}`}>
          <CardContent className="p-4 flex items-start justify-between">
            <div className="flex gap-3">
              {typeIcon(n.notification_type)}
              <div>
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
            {!n.is_read && <Button size="sm" variant="ghost" onClick={() => markRead(n.id)} className="text-xs">Mark Read</Button>}
          </CardContent>
        </Card>
      ))}
      {notifications.length === 0 && <p className="text-center text-muted-foreground py-8">No notifications</p>}
    </div>
  );
}
