import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  Users, DollarSign, Target, TrendingUp, Trophy, Phone, Plus,
  Zap, Brain, BookOpen, BarChart3, Award,
  GraduationCap, PhoneCall, CheckCircle2, Clock, Flame,
  Shield, MessageSquare, Headphones, Globe, Link2, Building2
} from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const CATEGORIES = ['solar', 'real_estate', 'funding'] as const;
const VERTICALS = ['solar', 'real_estate', 'funding', 'surplus', 'sports'] as const;
const SOURCE_TYPES = ['affiliate', 'inbound', 'brand', 'ai', 'cold'] as const;
const REVENUE_CHANNELS = ['affiliate', 'sales', 'brand'] as const;
const LEAD_STATUSES = ['new', 'assigned', 'appointment', 'closed', 'paid', 'lost'] as const;
const CALL_OUTCOMES = ['connected', 'voicemail', 'no_answer', 'callback', 'closed'] as const;

// ─── COMMISSION SPLIT CONFIG ───
const SPLIT_CONFIG = {
  affiliate: { affiliate: 15, setter: 15, closer: 45, platform: 25 },
  sales:     { affiliate: 0,  setter: 20, closer: 55, platform: 25 },
  brand:     { affiliate: 10, setter: 10, closer: 40, platform: 40 },
};

// ─── DATA HOOK ───
function useDSDS() {
  const qc = useQueryClient();
  const q = (key: string, table: string, order = 'created_at', limit = 500) => useQuery({
    queryKey: [key],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(table).select('*').order(order, { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
  });

  const agents = useQuery({ queryKey: ['dsn-agents'], queryFn: async () => { const { data, error } = await (supabase as any).from('dsn_sales_agents').select('*').order('performance_score', { ascending: false }); if (error) throw error; return data || []; } });
  const leads = q('dsn-leads', 'dsn_leads');
  const deals = q('dsn-deals', 'dsn_deals');
  const commissions = q('dsn-commissions', 'dsn_commissions');
  const modules = useQuery({ queryKey: ['dsn-training-modules'], queryFn: async () => { const { data, error } = await (supabase as any).from('dsn_training_modules').select('*').order('sort_order'); if (error) throw error; return data || []; } });
  const progress = useQuery({ queryKey: ['dsn-agent-progress'], queryFn: async () => { const { data, error } = await (supabase as any).from('dsn_agent_progress').select('*'); if (error) throw error; return data || []; } });
  const certifications = useQuery({ queryKey: ['dsn-certifications'], queryFn: async () => { const { data, error } = await (supabase as any).from('dsn_certifications').select('*'); if (error) throw error; return data || []; } });
  const callLogs = q('dsn-call-logs', 'dsn_call_logs');
  const bridge = q('dsn-bridge', 'dsn_affiliate_sales_bridge');

  const invalidateAll = () => {
    ['dsn-agents', 'dsn-leads', 'dsn-deals', 'dsn-commissions', 'dsn-training-modules', 'dsn-agent-progress', 'dsn-certifications', 'dsn-call-logs', 'dsn-bridge'].forEach(k =>
      qc.invalidateQueries({ queryKey: [k] })
    );
  };

  return {
    agents: agents.data || [], leads: leads.data || [], deals: deals.data || [],
    commissions: commissions.data || [], modules: modules.data || [],
    progress: progress.data || [], certifications: certifications.data || [],
    callLogs: callLogs.data || [], bridge: bridge.data || [],
    isLoading: agents.isLoading || leads.isLoading, invalidateAll, qc,
  };
}

// ─── GLOBAL OVERVIEW TAB ───
function GlobalOverviewTab({ agents, leads, deals, commissions, callLogs, certifications, bridge }: any) {
  const totalRevenue = deals.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
  const totalPlatformProfit = commissions.reduce((s: number, c: any) => s + Number(c.platform_total_profit || c.platform_fee || 0), 0);
  const totalAffiliatePayout = commissions.reduce((s: number, c: any) => s + Number(c.affiliate_payout || 0), 0);
  const totalAgentPayout = commissions.reduce((s: number, c: any) => s + Number(c.closer_payout || 0) + Number(c.setter_payout || 0), 0);
  const closedDeals = deals.filter((d: any) => d.status === 'approved' || d.status === 'paid').length;
  const activeLeads = leads.filter((l: any) => !['closed', 'paid', 'lost'].includes(l.status)).length;

  const kpis = [
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
    { label: 'Platform Profit', value: `$${totalPlatformProfit.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Active Leads', value: activeLeads, icon: Target, color: 'text-blue-400' },
    { label: 'Deals Closed', value: closedDeals, icon: Trophy, color: 'text-yellow-400' },
    { label: 'Affiliate Payouts', value: `$${totalAffiliatePayout.toLocaleString()}`, icon: Link2, color: 'text-purple-400' },
    { label: 'Agent Payouts', value: `$${totalAgentPayout.toLocaleString()}`, icon: Users, color: 'text-cyan-400' },
  ];

  // Revenue by vertical
  const verticalData = VERTICALS.map(v => ({
    name: v.replace('_', ' '),
    revenue: deals.filter((d: any) => d.business_vertical === v).reduce((s: number, d: any) => s + Number(d.value || 0), 0),
    leads: leads.filter((l: any) => l.business_vertical === v).length,
  }));

  // Revenue by channel
  const channelData = REVENUE_CHANNELS.map(ch => ({
    name: ch, value: deals.filter((d: any) => d.revenue_channel === ch).reduce((s: number, d: any) => s + Number(d.value || 0), 0),
  }));

  // Source type distribution
  const sourceData = SOURCE_TYPES.map(s => ({
    name: s, count: leads.filter((l: any) => l.source_type === s).length,
  }));

  // Top agents
  const topAgents = [...agents]
    .map((a: any) => ({
      ...a,
      revenue: deals.filter((d: any) => d.closer_id === a.id).reduce((s: number, d: any) => s + Number(d.value || 0), 0),
    }))
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top affiliates from bridge
  const affiliateMap = new Map<string, { id: string; revenue: number; deals: number }>();
  bridge.forEach((b: any) => {
    if (!b.affiliate_id) return;
    const existing = affiliateMap.get(b.affiliate_id) || { id: b.affiliate_id, revenue: 0, deals: 0 };
    const split = b.revenue_split || {};
    existing.revenue += Number(split.affiliate_amount || 0);
    existing.deals += 1;
    affiliateMap.set(b.affiliate_id, existing);
  });
  const topAffiliates = [...affiliateMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><k.icon className={`h-4 w-4 ${k.color}`} /><span className="text-xs text-muted-foreground">{k.label}</span></div>
              <p className="text-xl font-bold text-foreground">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Revenue by Vertical */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Revenue by Vertical</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={verticalData}>
                <XAxis dataKey="name" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Channel */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" /> Revenue by Channel</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={channelData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, value }) => `${name}: $${Number(value).toLocaleString()}`}>
                  {channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">Lead Source Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sourceData}>
                <XAxis dataKey="name" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Agents & Top Affiliates */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-400" /> Top 5 Agents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topAgents.map((a: any, i: number) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className={`font-black w-6 text-center ${i === 0 ? 'text-yellow-400' : 'text-muted-foreground'}`}>#{i + 1}</span>
                <div className="flex-1"><p className="text-sm font-medium text-foreground">{a.name}</p><p className="text-[10px] text-muted-foreground capitalize">{a.role} · {a.category?.replace('_', ' ')}</p></div>
                <span className="text-sm font-bold text-green-400">${a.revenue.toLocaleString()}</span>
              </div>
            ))}
            {topAgents.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No agents</p>}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4 text-purple-400" /> Top 5 Affiliates</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topAffiliates.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className={`font-black w-6 text-center ${i === 0 ? 'text-purple-400' : 'text-muted-foreground'}`}>#{i + 1}</span>
                <div className="flex-1"><p className="text-sm font-medium text-foreground">{a.id}</p><p className="text-[10px] text-muted-foreground">{a.deals} deals</p></div>
                <span className="text-sm font-bold text-purple-400">${a.revenue.toLocaleString()}</span>
              </div>
            ))}
            {topAffiliates.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No affiliate data yet</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── AGENTS TAB ───
function AgentsTab({ agents, certifications, invalidateAll }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'setter', category: 'solar', experience_level: 'junior' });

  const addAgent = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('dsn_sales_agents').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setOpen(false); setForm({ name: '', email: '', phone: '', role: 'setter', category: 'solar', experience_level: 'junior' }); toast.success('Agent added'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">Sales Agents</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Agent</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Sales Agent</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="setter">Setter</SelectItem><SelectItem value="closer">Closer</SelectItem></SelectContent></Select>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
              <Select value={form.experience_level} onValueChange={v => setForm({ ...form, experience_level: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="junior">Junior</SelectItem><SelectItem value="mid">Mid</SelectItem><SelectItem value="senior">Senior</SelectItem><SelectItem value="elite">Elite</SelectItem></SelectContent></Select>
              <Button onClick={() => addAgent.mutate()} disabled={!form.name} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Category</TableHead><TableHead>Level</TableHead><TableHead>Certified</TableHead><TableHead>Deals</TableHead><TableHead>Earnings</TableHead><TableHead>Score</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {agents.map((a: any) => {
            const certs = certifications.filter((c: any) => c.agent_id === a.id);
            return (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                <TableCell><Badge variant={a.role === 'closer' ? 'default' : 'secondary'}>{a.role}</Badge></TableCell>
                <TableCell className="capitalize">{a.category?.replace('_', ' ')}</TableCell>
                <TableCell className="capitalize">{a.experience_level || 'junior'}</TableCell>
                <TableCell>{certs.length > 0 ? <div className="flex gap-1">{certs.map((c: any) => <Badge key={c.id} variant="outline" className="text-[10px] text-green-400 border-green-500/30">{c.category}</Badge>)}</div> : <span className="text-xs text-muted-foreground">None</span>}</TableCell>
                <TableCell>{a.total_deals}</TableCell>
                <TableCell className="text-green-400">${Number(a.total_earnings || 0).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{Number(a.performance_score || 0).toFixed(0)}</Badge></TableCell>
              </TableRow>
            );
          })}
          {agents.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No agents yet</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── PIPELINE TAB ───
function PipelineTab({ leads, deals, agents, invalidateAll }: any) {
  const [open, setOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'inbound', category: 'solar', source_type: 'inbound' as string, business_vertical: 'solar' as string, affiliate_id: '', campaign_id: '' });
  const [dealForm, setDealForm] = useState({ closer_id: '', value: '', category: 'solar', platform_fee_pct: '10', source_type: 'direct', business_vertical: 'solar', revenue_channel: 'sales', affiliate_id: '', brand_id: '' });
  const [filter, setFilter] = useState('all');

  const addLead = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('dsn_leads').insert({
        name: form.name, email: form.email, phone: form.phone, source: form.source, category: form.category,
        source_type: form.source_type, business_vertical: form.business_vertical,
        affiliate_id: form.affiliate_id || null, campaign_id: form.campaign_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setOpen(false); toast.success('Lead added'); },
    onError: (e: any) => toast.error(e.message),
  });

  const assignLead = useMutation({
    mutationFn: async ({ leadId, agentId, role }: { leadId: string; agentId: string; role: string }) => {
      const field = role === 'closer' ? 'assigned_closer_id' : 'assigned_setter_id';
      const { error } = await (supabase as any).from('dsn_leads').update({ [field]: agentId, status: 'assigned', updated_at: new Date().toISOString() }).eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success('Lead assigned'); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const { error } = await (supabase as any).from('dsn_leads').update({ status, updated_at: new Date().toISOString() }).eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success('Status updated'); },
  });

  const createDeal = useMutation({
    mutationFn: async () => {
      const value = Number(dealForm.value);
      const channel = dealForm.revenue_channel as keyof typeof SPLIT_CONFIG;
      const split = SPLIT_CONFIG[channel] || SPLIT_CONFIG.sales;

      const { data: deal, error } = await (supabase as any).from('dsn_deals').insert({
        closer_id: dealForm.closer_id || null, value, category: dealForm.category,
        platform_fee_pct: Number(dealForm.platform_fee_pct),
        source_type: dealForm.source_type, business_vertical: dealForm.business_vertical,
        revenue_channel: dealForm.revenue_channel, affiliate_id: dealForm.affiliate_id || null,
        brand_id: dealForm.brand_id || null,
      }).select('id').single();
      if (error) throw error;

      const affiliatePayout = value * (split.affiliate / 100);
      const setterPayout = value * (split.setter / 100);
      const closerPayout = value * (split.closer / 100);
      const platformProfit = value * (split.platform / 100);

      await (supabase as any).from('dsn_commissions').insert({
        deal_id: deal.id, closer_id: dealForm.closer_id || null, deal_value: value,
        platform_fee: platformProfit, closer_payout: closerPayout, setter_payout: setterPayout,
        affiliate_payout: affiliatePayout, network_override: 0, platform_total_profit: platformProfit,
      });

      // Create bridge record
      if (dealForm.affiliate_id) {
        await (supabase as any).from('dsn_affiliate_sales_bridge').insert({
          deal_id: deal.id, affiliate_id: dealForm.affiliate_id, closer_id: dealForm.closer_id || null,
          revenue_split: { total: value, affiliate_pct: split.affiliate, setter_pct: split.setter, closer_pct: split.closer, platform_pct: split.platform, affiliate_amount: affiliatePayout, setter_amount: setterPayout, closer_amount: closerPayout, platform_amount: platformProfit },
        });
      }
    },
    onSuccess: () => { invalidateAll(); setDealOpen(false); toast.success('Deal created with auto-split'); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = filter === 'all' ? leads : leads.filter((l: any) => l.status === filter);
  const closers = agents.filter((a: any) => a.role === 'closer');
  const setters = agents.filter((a: any) => a.role === 'setter');

  const currentChannel = dealForm.revenue_channel as keyof typeof SPLIT_CONFIG;
  const previewSplit = SPLIT_CONFIG[currentChannel] || SPLIT_CONFIG.sales;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {LEAD_STATUSES.slice(0, 5).map(s => (
          <Card key={s} className="bg-card border-border"><CardContent className="p-3"><p className="text-xs text-muted-foreground capitalize">{s}</p><p className="text-xl font-bold text-foreground">{leads.filter((l: any) => l.status === s).length}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex gap-1 flex-wrap">
          {['all', ...LEAD_STATUSES].map(s => (
            <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)} className="capitalize text-xs">{s}</Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Lead</Button></DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <Select value={form.source_type} onValueChange={v => setForm({ ...form, source_type: v })}><SelectTrigger><SelectValue placeholder="Source Type" /></SelectTrigger><SelectContent>{SOURCE_TYPES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
                <Select value={form.business_vertical} onValueChange={v => setForm({ ...form, business_vertical: v })}><SelectTrigger><SelectValue placeholder="Vertical" /></SelectTrigger><SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v} className="capitalize">{v.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
                <Input placeholder="Affiliate ID (optional)" value={form.affiliate_id} onChange={e => setForm({ ...form, affiliate_id: e.target.value })} />
                <Input placeholder="Campaign ID (optional)" value={form.campaign_id} onChange={e => setForm({ ...form, campaign_id: e.target.value })} />
                <Button onClick={() => addLead.mutate()} disabled={!form.name} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dealOpen} onOpenChange={setDealOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><DollarSign className="h-4 w-4 mr-1" /> Log Deal</Button></DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Log Deal (Auto-Split)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Deal Value ($)" type="number" value={dealForm.value} onChange={e => setDealForm({ ...dealForm, value: e.target.value })} />
                <Select value={dealForm.revenue_channel} onValueChange={v => setDealForm({ ...dealForm, revenue_channel: v })}><SelectTrigger><SelectValue placeholder="Revenue Channel" /></SelectTrigger><SelectContent>{REVENUE_CHANNELS.map(ch => <SelectItem key={ch} value={ch} className="capitalize">{ch}</SelectItem>)}</SelectContent></Select>
                <Select value={dealForm.business_vertical} onValueChange={v => setDealForm({ ...dealForm, business_vertical: v })}><SelectTrigger><SelectValue placeholder="Vertical" /></SelectTrigger><SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v} className="capitalize">{v.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
                {closers.length > 0 && (
                  <Select value={dealForm.closer_id} onValueChange={v => setDealForm({ ...dealForm, closer_id: v })}><SelectTrigger><SelectValue placeholder="Assign Closer" /></SelectTrigger><SelectContent>{closers.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
                )}
                <Input placeholder="Affiliate ID (optional)" value={dealForm.affiliate_id} onChange={e => setDealForm({ ...dealForm, affiliate_id: e.target.value })} />
                <Input placeholder="Brand ID (optional)" value={dealForm.brand_id} onChange={e => setDealForm({ ...dealForm, brand_id: e.target.value })} />

                {/* Split preview */}
                {dealForm.value && (
                  <Card className="bg-muted/30 border-border">
                    <CardContent className="p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Auto-Split Preview ({dealForm.revenue_channel})</p>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span className="text-muted-foreground">Affiliate ({previewSplit.affiliate}%)</span>
                        <span className="text-purple-400 text-right">${(Number(dealForm.value) * previewSplit.affiliate / 100).toLocaleString()}</span>
                        <span className="text-muted-foreground">Setter ({previewSplit.setter}%)</span>
                        <span className="text-blue-400 text-right">${(Number(dealForm.value) * previewSplit.setter / 100).toLocaleString()}</span>
                        <span className="text-muted-foreground">Closer ({previewSplit.closer}%)</span>
                        <span className="text-green-400 text-right">${(Number(dealForm.value) * previewSplit.closer / 100).toLocaleString()}</span>
                        <span className="text-muted-foreground">Platform ({previewSplit.platform}%)</span>
                        <span className="text-foreground text-right font-bold">${(Number(dealForm.value) * previewSplit.platform / 100).toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Button onClick={() => createDeal.mutate()} disabled={!dealForm.value} className="w-full">Save Deal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Source</TableHead><TableHead>Vertical</TableHead><TableHead>Status</TableHead><TableHead>Affiliate</TableHead><TableHead>Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {filtered.slice(0, 100).map((l: any) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium text-foreground">{l.name}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px] capitalize">{l.source_type || l.source}</Badge></TableCell>
              <TableCell className="capitalize text-xs">{(l.business_vertical || l.category)?.replace('_', ' ')}</TableCell>
              <TableCell>
                <Select value={l.status} onValueChange={v => updateStatus.mutate({ leadId: l.id, status: v })}>
                  <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-xs text-purple-400">{l.affiliate_id || '-'}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {setters.length > 0 && !l.assigned_setter_id && (
                    <Select onValueChange={v => assignLead.mutate({ leadId: l.id, agentId: v, role: 'setter' })}><SelectTrigger className="w-24 h-7 text-xs"><SelectValue placeholder="Setter" /></SelectTrigger><SelectContent>{setters.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
                  )}
                  {closers.length > 0 && !l.assigned_closer_id && (
                    <Select onValueChange={v => assignLead.mutate({ leadId: l.id, agentId: v, role: 'closer' })}><SelectTrigger className="w-24 h-7 text-xs"><SelectValue placeholder="Closer" /></SelectTrigger><SelectContent>{closers.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No leads</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── TRAINING TAB ───
function TrainingTab({ agents, modules, progress, certifications, invalidateAll }: any) {
  const [modOpen, setModOpen] = useState(false);
  const [modForm, setModForm] = useState({ title: '', category: 'solar', content: '', difficulty_level: 'beginner', required_for_certification: true });
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  const addModule = useMutation({
    mutationFn: async () => { const { error } = await (supabase as any).from('dsn_training_modules').insert(modForm); if (error) throw error; },
    onSuccess: () => { invalidateAll(); setModOpen(false); toast.success('Module added'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ agentId, moduleId, status }: { agentId: string; moduleId: string; status: string }) => {
      const existing = progress.find((p: any) => p.agent_id === agentId && p.module_id === moduleId);
      if (existing) {
        const { error } = await (supabase as any).from('dsn_agent_progress').update({ completion_status: status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('dsn_agent_progress').insert({ agent_id: agentId, module_id: moduleId, completion_status: status, completed_at: status === 'completed' ? new Date().toISOString() : null });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); toast.success('Progress updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  const certifyAgent = useMutation({
    mutationFn: async ({ agentId, category }: { agentId: string; category: string }) => { const { error } = await (supabase as any).from('dsn_certifications').insert({ agent_id: agentId, category }); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success('Agent certified!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const agentModules = selectedAgent ? modules.map((m: any) => { const p = progress.find((p: any) => p.agent_id === selectedAgent && p.module_id === m.id); return { ...m, status: p?.completion_status || 'not_started' }; }) : [];
  const agentCerts = selectedAgent ? certifications.filter((c: any) => c.agent_id === selectedAgent) : [];
  const canCertify = (cat: string) => {
    if (!selectedAgent || agentCerts.some((c: any) => c.category === cat)) return false;
    const required = modules.filter((m: any) => m.category === cat && m.required_for_certification);
    return required.length > 0 && required.every((m: any) => { const p = progress.find((p: any) => p.agent_id === selectedAgent && p.module_id === m.id); return p?.completion_status === 'completed'; });
  };
  const completedCount = agentModules.filter((m: any) => m.status === 'completed').length;
  const pct = agentModules.length > 0 ? Math.round((completedCount / agentModules.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><GraduationCap className="h-5 w-5 text-blue-400" /> Training & Certification</h3>
        <div className="flex gap-2">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}><SelectTrigger className="w-48"><SelectValue placeholder="Select Agent" /></SelectTrigger><SelectContent>{agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
          <Dialog open={modOpen} onOpenChange={setModOpen}><DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Module</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Training Module</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Title" value={modForm.title} onChange={e => setModForm({ ...modForm, title: e.target.value })} />
                <Select value={modForm.category} onValueChange={v => setModForm({ ...modForm, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[...CATEGORIES, 'objection_handling' as const].map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
                <Select value={modForm.difficulty_level} onValueChange={v => setModForm({ ...modForm, difficulty_level: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent></Select>
                <Textarea placeholder="Content / script..." value={modForm.content} onChange={e => setModForm({ ...modForm, content: e.target.value })} rows={5} />
                <Button onClick={() => addModule.mutate()} disabled={!modForm.title} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {selectedAgent ? (
        <div className="space-y-4">
          <Card className="bg-card border-border"><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-foreground">Progress</span><span className="text-sm text-muted-foreground">{completedCount}/{agentModules.length}</span></div>
            <Progress value={pct} className="h-3" />
            <div className="flex gap-2 mt-3">{agentCerts.map((c: any) => <Badge key={c.id} className="bg-green-500/20 text-green-400 border-green-500/30"><Shield className="h-3 w-3 mr-1" />{c.category}</Badge>)}</div>
          </CardContent></Card>
          <div className="flex gap-2 flex-wrap">
            {[...CATEGORIES, 'objection_handling' as const].map(cat => (
              <Button key={cat} size="sm" variant={canCertify(cat) ? 'default' : 'outline'} disabled={!canCertify(cat) || agentCerts.some((c: any) => c.category === cat)} onClick={() => certifyAgent.mutate({ agentId: selectedAgent, category: cat })} className="capitalize text-xs">
                {agentCerts.some((c: any) => c.category === cat) ? <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : <Shield className="h-3 w-3 mr-1" />}{cat.replace('_', ' ')}
              </Button>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {agentModules.map((m: any) => (
              <Card key={m.id} className={`bg-card border-border ${m.status === 'completed' ? 'ring-1 ring-green-500/30' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div><p className="font-medium text-foreground text-sm">{m.title}</p><div className="flex gap-2 mt-1"><Badge variant="outline" className="text-[10px] capitalize">{m.category?.replace('_', ' ')}</Badge><Badge variant="outline" className="text-[10px]">{m.difficulty_level}</Badge></div></div>
                    <Select value={m.status} onValueChange={v => updateProgress.mutate({ agentId: selectedAgent, moduleId: m.id, status: v })}><SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_started">Not Started</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select>
                  </div>
                  {m.content && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{m.content}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground"><GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Select an agent to manage training</p></div>
      )}
    </div>
  );
}

// ─── CALL CENTER TAB ───
function CallCenterTab({ agents, leads, callLogs, invalidateAll }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ agent_id: '', lead_id: '', outcome: 'connected', duration_seconds: '', notes: '', recording_url: '' });

  const logCall = useMutation({
    mutationFn: async () => { const { error } = await (supabase as any).from('dsn_call_logs').insert({ ...form, duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null, lead_id: form.lead_id || null }); if (error) throw error; },
    onSuccess: () => { invalidateAll(); setOpen(false); toast.success('Call logged'); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalCalls = callLogs.length;
  const connected = callLogs.filter((c: any) => c.outcome === 'connected' || c.outcome === 'closed').length;
  const voicemails = callLogs.filter((c: any) => c.outcome === 'voicemail').length;
  const avgDuration = totalCalls > 0 ? Math.round(callLogs.reduce((s: number, c: any) => s + Number(c.duration_seconds || 0), 0) / totalCalls) : 0;
  const outcomeData = CALL_OUTCOMES.map(o => ({ name: o, count: callLogs.filter((c: any) => c.outcome === o).length }));

  const AI_SUGGESTIONS = [
    { trigger: 'price objection', tip: '"I understand budget is a concern. Many clients found the ROI exceeded expectations within 6 months…"' },
    { trigger: 'not interested', tip: '"Can I ask — what would make this worth exploring?"' },
    { trigger: 'need to think', tip: '"What specifically? I might be able to address it now."' },
    { trigger: 'already have one', tip: '"So you see the value. What would make you consider switching?"' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><PhoneCall className="h-4 w-4 text-blue-400" /><span className="text-xs text-muted-foreground">Total Calls</span></div><p className="text-xl font-bold text-foreground">{totalCalls}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-green-400" /><span className="text-xs text-muted-foreground">Connected</span></div><p className="text-xl font-bold text-green-400">{connected}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Headphones className="h-4 w-4 text-yellow-400" /><span className="text-xs text-muted-foreground">Voicemails</span></div><p className="text-xl font-bold text-yellow-400">{voicemails}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-cyan-400" /><span className="text-xs text-muted-foreground">Avg Duration</span></div><p className="text-xl font-bold text-foreground">{avgDuration}s</p></CardContent></Card>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader><CardTitle className="text-sm">Call Outcomes</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={outcomeData}><XAxis dataKey="name" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} /><YAxis fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent>
        </Card>
        <Card className="bg-card border-border ring-1 ring-purple-500/20">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-purple-400" /> AI Call Assist</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {AI_SUGGESTIONS.map((s, i) => (
              <div key={i} className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <p className="text-[10px] font-semibold text-purple-400 uppercase mb-1">"{s.trigger}"</p>
                <p className="text-xs text-foreground">{s.tip}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground">Recent Calls</h3>
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm"><Phone className="h-4 w-4 mr-1" /> Log Call</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Call</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.agent_id} onValueChange={v => setForm({ ...form, agent_id: v })}><SelectTrigger><SelectValue placeholder="Agent" /></SelectTrigger><SelectContent>{agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
              <Select value={form.lead_id} onValueChange={v => setForm({ ...form, lead_id: v })}><SelectTrigger><SelectValue placeholder="Lead (optional)" /></SelectTrigger><SelectContent>{leads.slice(0, 50).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
              <Select value={form.outcome} onValueChange={v => setForm({ ...form, outcome: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CALL_OUTCOMES.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Duration (seconds)" type="number" value={form.duration_seconds} onChange={e => setForm({ ...form, duration_seconds: e.target.value })} />
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={() => logCall.mutate()} disabled={!form.agent_id} className="w-full">Save Call</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Outcome</TableHead><TableHead>Duration</TableHead><TableHead>Notes</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
        <TableBody>
          {callLogs.slice(0, 50).map((c: any) => {
            const agent = agents.find((a: any) => a.id === c.agent_id);
            const oc: Record<string, string> = { connected: 'text-green-400', closed: 'text-yellow-400', voicemail: 'text-blue-400', no_answer: 'text-muted-foreground', callback: 'text-cyan-400' };
            return (<TableRow key={c.id}><TableCell className="font-medium text-foreground">{agent?.name || '?'}</TableCell><TableCell className={`capitalize ${oc[c.outcome] || ''}`}>{c.outcome}</TableCell><TableCell>{c.duration_seconds ? `${c.duration_seconds}s` : '-'}</TableCell><TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.notes || '-'}</TableCell><TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell></TableRow>);
          })}
          {callLogs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No calls</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── PERFORMANCE TAB ───
function PerformanceTab({ agents, deals, callLogs, commissions }: any) {
  const ranked = agents.map((a: any) => {
    const agentDeals = deals.filter((d: any) => d.closer_id === a.id);
    const agentCalls = callLogs.filter((c: any) => c.agent_id === a.id);
    const connected = agentCalls.filter((c: any) => c.outcome === 'connected' || c.outcome === 'closed').length;
    const revenue = agentDeals.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
    return { ...a, dealCount: agentDeals.length, revenue, callCount: agentCalls.length, connectedCalls: connected, closeRate: agentCalls.length > 0 ? ((agentDeals.length / agentCalls.length) * 100).toFixed(1) : '0', callSuccessRate: agentCalls.length > 0 ? ((connected / agentCalls.length) * 100).toFixed(1) : '0' };
  }).sort((a: any, b: any) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><BarChart3 className="h-5 w-5 text-cyan-400" /> Performance Analytics</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card border-border"><CardHeader><CardTitle className="text-sm">Revenue by Agent</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><BarChart data={ranked.slice(0, 10)} layout="vertical"><XAxis type="number" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} /><YAxis type="category" dataKey="name" fontSize={11} width={100} tick={{ fill: 'hsl(var(--muted-foreground))' }} /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} /><Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card className="bg-card border-border"><CardHeader><CardTitle className="text-sm">Call Success % by Agent</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><BarChart data={ranked.filter((a: any) => a.callCount > 0).slice(0, 10)} layout="vertical"><XAxis type="number" domain={[0, 100]} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} /><YAxis type="category" dataKey="name" fontSize={11} width={100} tick={{ fill: 'hsl(var(--muted-foreground))' }} /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(v: any) => `${v}%`} /><Bar dataKey="callSuccessRate" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Role</TableHead><TableHead>Calls</TableHead><TableHead>Connected</TableHead><TableHead>Call %</TableHead><TableHead>Deals</TableHead><TableHead>Close %</TableHead><TableHead>Revenue</TableHead></TableRow></TableHeader>
        <TableBody>
          {ranked.map((a: any) => (
            <TableRow key={a.id}><TableCell className="font-medium text-foreground">{a.name}</TableCell><TableCell><Badge variant={a.role === 'closer' ? 'default' : 'secondary'}>{a.role}</Badge></TableCell><TableCell>{a.callCount}</TableCell><TableCell className="text-green-400">{a.connectedCalls}</TableCell><TableCell>{a.callSuccessRate}%</TableCell><TableCell>{a.dealCount}</TableCell><TableCell>{a.closeRate}%</TableCell><TableCell className="text-green-400">${a.revenue.toLocaleString()}</TableCell></TableRow>
          ))}
          {ranked.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── LEADERBOARD TAB ───
function LeaderboardTab({ agents, deals, callLogs, commissions }: any) {
  const ranked = [...agents].map((a: any) => {
    const revenue = deals.filter((d: any) => d.closer_id === a.id).reduce((s: number, d: any) => s + Number(d.value || 0), 0);
    const dealCount = deals.filter((d: any) => d.closer_id === a.id || d.setter_id === a.id).length;
    const calls = callLogs.filter((c: any) => c.agent_id === a.id).length;
    const score = (revenue / 1000) * 0.5 + dealCount * 25 * 0.25 + calls * 5 * 0.25;
    return { ...a, revenue, dealCount, calls, score };
  }).sort((a, b) => b.score - a.score);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-400" /> Sales Domination Leaderboard</h3>
      {ranked.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {ranked.slice(0, 3).map((a, i) => (
            <Card key={a.id} className={`bg-card border-border ${i === 0 ? 'ring-2 ring-yellow-500/50' : i === 1 ? 'ring-1 ring-gray-400/30' : 'ring-1 ring-orange-500/30'}`}>
              <CardContent className="p-4 text-center">
                <span className="text-3xl">{medals[i]}</span>
                <p className="font-bold text-foreground mt-2">{a.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{a.role} · {a.category?.replace('_', ' ')}</p>
                <p className="text-lg font-bold text-green-400 mt-2">${a.revenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{a.dealCount} deals · {a.calls} calls</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {ranked.map((a, i) => (
          <Card key={a.id} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-4">
              <span className={`text-xl font-black w-8 text-center ${i < 3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>#{i + 1}</span>
              <div className="flex-1 min-w-0"><p className="font-semibold text-foreground">{a.name}</p><p className="text-xs text-muted-foreground capitalize">{a.role} · {a.category?.replace('_', ' ')}</p></div>
              <div className="flex gap-4 text-right text-sm">
                <div><p className="text-green-400 font-bold">${a.revenue.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Revenue</p></div>
                <div><p className="text-foreground font-bold">{a.dealCount}</p><p className="text-[10px] text-muted-foreground">Deals</p></div>
                <div><p className="text-yellow-400 font-bold">{Math.round(a.score)}</p><p className="text-[10px] text-muted-foreground">Score</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
        {ranked.length === 0 && <p className="text-center text-muted-foreground py-8">No agents</p>}
      </div>
    </div>
  );
}

// ─── AI ROUTING TAB ───
function AIRoutingTab({ leads, agents, certifications }: any) {
  const newLeads = leads.filter((l: any) => l.status === 'new');

  const assignBest = useMutation({
    mutationFn: async ({ leadId, agentId }: { leadId: string; agentId: string }) => {
      const { error } = await (supabase as any).from('dsn_leads').update({ assigned_closer_id: agentId, status: 'assigned', updated_at: new Date().toISOString() }).eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => toast.success('Lead auto-routed'),
  });

  // Smart routing: certified + category match + performance
  const findBestAgent = (lead: any) => {
    const vertical = lead.business_vertical || lead.category;
    const eligible = agents.filter((a: any) => a.role === 'closer' && a.status === 'active');
    // 1. Certified in vertical
    const certified = eligible.filter((a: any) => certifications.some((c: any) => c.agent_id === a.id && c.category === vertical));
    // 2. Category match
    const catMatch = eligible.filter((a: any) => a.category === vertical);
    const pool = certified.length > 0 ? certified : catMatch.length > 0 ? catMatch : eligible;
    return pool.sort((a: any, b: any) => Number(b.performance_score || 0) - Number(a.performance_score || 0))[0];
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-purple-400" /> AI Lead Routing — Cross-Vertical</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Routes leads by: <strong>1)</strong> Certification → <strong>2)</strong> Category match → <strong>3)</strong> Performance score</p>
          <div className="space-y-2">
            {newLeads.slice(0, 15).map((l: any) => {
              const best = findBestAgent(l);
              return (
                <div key={l.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">{l.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] capitalize">{(l.business_vertical || l.category)?.replace('_', ' ')}</Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{l.source_type || l.source}</Badge>
                      {l.affiliate_id && <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30">Affiliate</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {best && <span className="text-xs text-muted-foreground">→ {best.name} (Score: {Number(best.performance_score || 0).toFixed(0)})</span>}
                    <Button size="sm" variant="outline" disabled={!best} onClick={() => best && assignBest.mutate({ leadId: l.id, agentId: best.id })}>
                      <Zap className="h-3 w-3 mr-1" /> Route
                    </Button>
                  </div>
                </div>
              );
            })}
            {newLeads.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">All leads assigned</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── COMMISSIONS TAB ───
function CommissionsTab({ commissions, invalidateAll }: any) {
  const markPaid = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from('dsn_commissions').update({ status: 'paid' }).eq('id', id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success('Marked as paid'); },
  });

  const totalPending = commissions.filter((c: any) => c.status === 'pending').reduce((s: number, c: any) => s + Number(c.closer_payout || 0) + Number(c.setter_payout || 0) + Number(c.affiliate_payout || 0), 0);
  const totalPaid = commissions.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + Number(c.closer_payout || 0) + Number(c.setter_payout || 0) + Number(c.affiliate_payout || 0), 0);
  const totalPlatform = commissions.reduce((s: number, c: any) => s + Number(c.platform_total_profit || c.platform_fee || 0), 0);
  const totalAffiliate = commissions.reduce((s: number, c: any) => s + Number(c.affiliate_payout || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Records</p><p className="text-xl font-bold text-foreground">{commissions.length}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold text-yellow-400">${totalPending.toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid Out</p><p className="text-xl font-bold text-green-400">${totalPaid.toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Affiliate Total</p><p className="text-xl font-bold text-purple-400">${totalAffiliate.toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Platform Profit</p><p className="text-xl font-bold text-foreground">${totalPlatform.toLocaleString()}</p></CardContent></Card>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Deal Value</TableHead><TableHead>Closer</TableHead><TableHead>Setter</TableHead><TableHead>Affiliate</TableHead><TableHead>Platform</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {commissions.map((c: any) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium text-foreground">${Number(c.deal_value || 0).toLocaleString()}</TableCell>
              <TableCell className="text-green-400">${Number(c.closer_payout || 0).toLocaleString()}</TableCell>
              <TableCell className="text-blue-400">${Number(c.setter_payout || 0).toLocaleString()}</TableCell>
              <TableCell className="text-purple-400">${Number(c.affiliate_payout || 0).toLocaleString()}</TableCell>
              <TableCell className="text-foreground">${Number(c.platform_total_profit || c.platform_fee || 0).toLocaleString()}</TableCell>
              <TableCell><Badge variant={c.status === 'paid' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
              <TableCell>{c.status === 'approved' && <Button size="sm" variant="outline" onClick={() => markPaid.mutate(c.id)}>Mark Paid</Button>}</TableCell>
            </TableRow>
          ))}
          {commissions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No commissions</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── AFFILIATE VIEW TAB ───
function AffiliateViewTab({ bridge, leads, deals, commissions }: any) {
  const affiliateMap = useMemo(() => {
    const map = new Map<string, { id: string; leads: number; deals: number; earnings: number; networkEarnings: number }>();
    // From leads
    leads.forEach((l: any) => {
      if (!l.affiliate_id) return;
      const e = map.get(l.affiliate_id) || { id: l.affiliate_id, leads: 0, deals: 0, earnings: 0, networkEarnings: 0 };
      e.leads++;
      map.set(l.affiliate_id, e);
    });
    // From bridge
    bridge.forEach((b: any) => {
      if (!b.affiliate_id) return;
      const e = map.get(b.affiliate_id) || { id: b.affiliate_id, leads: 0, deals: 0, earnings: 0, networkEarnings: 0 };
      e.deals++;
      const split = b.revenue_split || {};
      e.earnings += Number(split.affiliate_amount || 0);
      map.set(b.affiliate_id, e);
    });
    // Network overrides from commissions
    commissions.forEach((c: any) => {
      if (!c.network_override || c.network_override <= 0) return;
      // Add to first affiliate found (simplified)
    });
    return [...map.values()].sort((a, b) => b.earnings - a.earnings);
  }, [bridge, leads, commissions]);

  const totalLeads = affiliateMap.reduce((s, a) => s + a.leads, 0);
  const totalDeals = affiliateMap.reduce((s, a) => s + a.deals, 0);
  const totalEarnings = affiliateMap.reduce((s, a) => s + a.earnings, 0);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Link2 className="h-5 w-5 text-purple-400" /> Affiliate Network View</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Affiliates</p><p className="text-xl font-bold text-foreground">{affiliateMap.length}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Leads Generated</p><p className="text-xl font-bold text-blue-400">{totalLeads}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Deals Closed</p><p className="text-xl font-bold text-green-400">{totalDeals}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Earnings</p><p className="text-xl font-bold text-purple-400">${totalEarnings.toLocaleString()}</p></CardContent></Card>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Affiliate ID</TableHead><TableHead>Leads</TableHead><TableHead>Deals</TableHead><TableHead>Earnings</TableHead><TableHead>Network</TableHead></TableRow></TableHeader>
        <TableBody>
          {affiliateMap.map(a => (
            <TableRow key={a.id}>
              <TableCell className="font-medium text-foreground">{a.id}</TableCell>
              <TableCell>{a.leads}</TableCell>
              <TableCell className="text-green-400">{a.deals}</TableCell>
              <TableCell className="text-purple-400">${a.earnings.toLocaleString()}</TableCell>
              <TableCell className="text-cyan-400">${a.networkEarnings.toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {affiliateMap.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No affiliate data yet — log deals with an affiliate ID</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── MAIN ───
export default function DynastySalesNetwork() {
  const data = useDSDS();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" /> Dynasty Sales Domination System
        </h1>
        <p className="text-sm text-muted-foreground">Unified Revenue Engine — Affiliates · Sales · Brands · All Verticals</p>
      </div>

      <Tabs defaultValue="global" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="global">🌐 Global</TabsTrigger>
          <TabsTrigger value="agents">👥 Agents</TabsTrigger>
          <TabsTrigger value="pipeline">🎯 Pipeline</TabsTrigger>
          <TabsTrigger value="training">🎓 Training</TabsTrigger>
          <TabsTrigger value="calls">📞 Calls</TabsTrigger>
          <TabsTrigger value="performance">📈 Performance</TabsTrigger>
          <TabsTrigger value="leaderboard">🏆 Leaderboard</TabsTrigger>
          <TabsTrigger value="ai-routing">🧠 AI Routing</TabsTrigger>
          <TabsTrigger value="commissions">💵 Commissions</TabsTrigger>
          <TabsTrigger value="affiliates">🔗 Affiliates</TabsTrigger>
        </TabsList>

        <TabsContent value="global"><GlobalOverviewTab {...data} /></TabsContent>
        <TabsContent value="agents"><AgentsTab agents={data.agents} certifications={data.certifications} invalidateAll={data.invalidateAll} /></TabsContent>
        <TabsContent value="pipeline"><PipelineTab leads={data.leads} deals={data.deals} agents={data.agents} invalidateAll={data.invalidateAll} /></TabsContent>
        <TabsContent value="training"><TrainingTab agents={data.agents} modules={data.modules} progress={data.progress} certifications={data.certifications} invalidateAll={data.invalidateAll} /></TabsContent>
        <TabsContent value="calls"><CallCenterTab agents={data.agents} leads={data.leads} callLogs={data.callLogs} invalidateAll={data.invalidateAll} /></TabsContent>
        <TabsContent value="performance"><PerformanceTab agents={data.agents} deals={data.deals} callLogs={data.callLogs} commissions={data.commissions} /></TabsContent>
        <TabsContent value="leaderboard"><LeaderboardTab agents={data.agents} deals={data.deals} callLogs={data.callLogs} commissions={data.commissions} /></TabsContent>
        <TabsContent value="ai-routing"><AIRoutingTab leads={data.leads} agents={data.agents} certifications={data.certifications} /></TabsContent>
        <TabsContent value="commissions"><CommissionsTab commissions={data.commissions} invalidateAll={data.invalidateAll} /></TabsContent>
        <TabsContent value="affiliates"><AffiliateViewTab bridge={data.bridge} leads={data.leads} deals={data.deals} commissions={data.commissions} /></TabsContent>
      </Tabs>
    </div>
  );
}
