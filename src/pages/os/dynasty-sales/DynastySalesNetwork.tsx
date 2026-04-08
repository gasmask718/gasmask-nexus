import { useState } from 'react';
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  Users, DollarSign, Target, TrendingUp, Trophy, Phone, Plus,
  ArrowRight, Zap, Brain, BookOpen, BarChart3, Award, Bell
} from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const CATEGORIES = ['solar', 'real_estate', 'funding'] as const;
const LEAD_STATUSES = ['new', 'assigned', 'appointment', 'closed', 'paid', 'lost'] as const;

function useDSN() {
  const qc = useQueryClient();
  const agents = useQuery({
    queryKey: ['dsn-agents'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('dsn_sales_agents').select('*').order('performance_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const leads = useQuery({
    queryKey: ['dsn-leads'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('dsn_leads').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
  });
  const deals = useQuery({
    queryKey: ['dsn-deals'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('dsn_deals').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
  });
  const commissions = useQuery({
    queryKey: ['dsn-commissions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('dsn_commissions').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
  });
  const appointments = useQuery({
    queryKey: ['dsn-appointments'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('dsn_appointments').select('*').order('scheduled_time', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['dsn-agents'] });
    qc.invalidateQueries({ queryKey: ['dsn-leads'] });
    qc.invalidateQueries({ queryKey: ['dsn-deals'] });
    qc.invalidateQueries({ queryKey: ['dsn-commissions'] });
    qc.invalidateQueries({ queryKey: ['dsn-appointments'] });
  };

  return { agents: agents.data || [], leads: leads.data || [], deals: deals.data || [], commissions: commissions.data || [], appointments: appointments.data || [], isLoading: agents.isLoading || leads.isLoading, invalidateAll, qc };
}

// ─── OVERVIEW TAB ───
function OverviewTab({ agents, leads, deals, commissions }: any) {
  const totalRevenue = deals.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
  const totalCommissions = commissions.reduce((s: number, c: any) => s + Number(c.closer_payout || 0) + Number(c.setter_payout || 0), 0);
  const closedDeals = deals.filter((d: any) => d.status === 'approved' || d.status === 'paid').length;
  const activeLeads = leads.filter((l: any) => !['closed', 'paid', 'lost'].includes(l.status)).length;

  const pipelineData = LEAD_STATUSES.map(s => ({ name: s, count: leads.filter((l: any) => l.status === s).length }));
  const categoryData = CATEGORIES.map(c => ({ name: c.replace('_', ' '), value: deals.filter((d: any) => d.category === c).reduce((s: number, d: any) => s + Number(d.value || 0), 0) }));

  const kpis = [
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
    { label: 'Active Leads', value: activeLeads, icon: Target, color: 'text-blue-400' },
    { label: 'Deals Closed', value: closedDeals, icon: Trophy, color: 'text-yellow-400' },
    { label: 'Active Agents', value: agents.filter((a: any) => a.status === 'active').length, icon: Users, color: 'text-purple-400' },
    { label: 'Commissions Paid', value: `$${totalCommissions.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Avg Deal Size', value: `$${closedDeals > 0 ? Math.round(totalRevenue / closedDeals).toLocaleString() : 0}`, icon: BarChart3, color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <k.icon className={`h-4 w-4 ${k.color}`} />
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">Pipeline Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipelineData}>
                <XAxis dataKey="name" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">Revenue by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: $${value.toLocaleString()}`}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── AGENTS TAB ───
function AgentsTab({ agents, invalidateAll }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'setter', category: 'solar' });

  const addAgent = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('dsn_sales_agents').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setOpen(false); setForm({ name: '', email: '', phone: '', role: 'setter', category: 'solar' }); toast.success('Agent added'); },
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
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="setter">Setter</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => addAgent.mutate()} disabled={!form.name} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Deals</TableHead>
            <TableHead>Earnings</TableHead>
            <TableHead>Close Rate</TableHead>
            <TableHead>Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((a: any) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium text-foreground">{a.name}</TableCell>
              <TableCell><Badge variant={a.role === 'closer' ? 'default' : 'secondary'}>{a.role}</Badge></TableCell>
              <TableCell className="capitalize">{a.category?.replace('_', ' ')}</TableCell>
              <TableCell>{a.total_deals}</TableCell>
              <TableCell className="text-green-400">${Number(a.total_earnings || 0).toLocaleString()}</TableCell>
              <TableCell>{Number(a.close_rate || 0).toFixed(1)}%</TableCell>
              <TableCell><Badge variant="outline">{Number(a.performance_score || 0).toFixed(0)}</Badge></TableCell>
            </TableRow>
          ))}
          {agents.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No agents yet</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── LEADS TAB ───
function LeadsTab({ leads, agents, invalidateAll }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'inbound', category: 'solar' });
  const [filter, setFilter] = useState('all');

  const addLead = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('dsn_leads').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setOpen(false); setForm({ name: '', email: '', phone: '', source: 'inbound', category: 'solar' }); toast.success('Lead added'); },
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

  const filtered = filter === 'all' ? leads : leads.filter((l: any) => l.status === filter);
  const closers = agents.filter((a: any) => a.role === 'closer');
  const setters = agents.filter((a: any) => a.role === 'setter');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex gap-1 flex-wrap">
          {['all', ...LEAD_STATUSES].map(s => (
            <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)} className="capitalize text-xs">{s}</Button>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Lead</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="affiliate">Affiliate</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => addLead.mutate()} disabled={!form.name} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((l: any) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium text-foreground">{l.name}</TableCell>
              <TableCell className="capitalize">{l.source}</TableCell>
              <TableCell className="capitalize">{l.category?.replace('_', ' ')}</TableCell>
              <TableCell>
                <Select value={l.status} onValueChange={v => updateStatus.mutate({ leadId: l.id, status: v })}>
                  <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>{Number(l.lead_score || 0).toFixed(0)}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {setters.length > 0 && !l.assigned_setter_id && (
                    <Select onValueChange={v => assignLead.mutate({ leadId: l.id, agentId: v, role: 'setter' })}>
                      <SelectTrigger className="w-24 h-7 text-xs"><SelectValue placeholder="Setter" /></SelectTrigger>
                      <SelectContent>{setters.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {closers.length > 0 && !l.assigned_closer_id && (
                    <Select onValueChange={v => assignLead.mutate({ leadId: l.id, agentId: v, role: 'closer' })}>
                      <SelectTrigger className="w-24 h-7 text-xs"><SelectValue placeholder="Closer" /></SelectTrigger>
                      <SelectContent>{closers.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
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

// ─── DEALS TAB ───
function DealsTab({ deals, agents, invalidateAll }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ closer_id: '', value: '', category: 'solar', platform_fee_pct: '10' });

  const createDeal = useMutation({
    mutationFn: async () => {
      const value = Number(form.value);
      const feePct = Number(form.platform_fee_pct);
      const { data: deal, error } = await (supabase as any).from('dsn_deals').insert({
        closer_id: form.closer_id || null,
        value,
        category: form.category,
        platform_fee_pct: feePct,
      }).select('id').single();
      if (error) throw error;

      // Auto-create commission
      const fee = value * (feePct / 100);
      const closerPayout = (value - fee) * 0.6;
      const setterPayout = (value - fee) * 0.2;
      await (supabase as any).from('dsn_commissions').insert({
        deal_id: deal.id,
        closer_id: form.closer_id || null,
        deal_value: value,
        platform_fee: fee,
        closer_payout: closerPayout,
        setter_payout: setterPayout,
      });
    },
    onSuccess: () => { invalidateAll(); setOpen(false); setForm({ closer_id: '', value: '', category: 'solar', platform_fee_pct: '10' }); toast.success('Deal created'); },
    onError: (e: any) => toast.error(e.message),
  });

  const approveDeal = useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await (supabase as any).from('dsn_deals').update({ status: 'approved' }).eq('id', dealId);
      if (error) throw error;
      await (supabase as any).from('dsn_commissions').update({ status: 'approved' }).eq('deal_id', dealId);
    },
    onSuccess: () => { invalidateAll(); toast.success('Deal approved'); },
  });

  const closers = agents.filter((a: any) => a.role === 'closer');
  const statusColor: Record<string, string> = { pending: 'bg-yellow-500/20 text-yellow-400', approved: 'bg-green-500/20 text-green-400', paid: 'bg-blue-500/20 text-blue-400', disputed: 'bg-red-500/20 text-red-400' };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">Deals</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log Deal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Deal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Deal Value ($)" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
              {closers.length > 0 && (
                <Select value={form.closer_id} onValueChange={v => setForm({ ...form, closer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Assign Closer" /></SelectTrigger>
                  <SelectContent>{closers.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Input placeholder="Platform Fee %" type="number" value={form.platform_fee_pct} onChange={e => setForm({ ...form, platform_fee_pct: e.target.value })} />
              <Button onClick={() => createDeal.mutate()} disabled={!form.value} className="w-full">Save Deal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Value</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Fee %</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((d: any) => (
            <TableRow key={d.id}>
              <TableCell className="font-bold text-foreground">${Number(d.value || 0).toLocaleString()}</TableCell>
              <TableCell className="capitalize">{d.category?.replace('_', ' ')}</TableCell>
              <TableCell><Badge className={statusColor[d.status] || ''}>{d.status}</Badge></TableCell>
              <TableCell>{d.platform_fee_pct}%</TableCell>
              <TableCell className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                {d.status === 'pending' && <Button size="sm" variant="outline" onClick={() => approveDeal.mutate(d.id)}>Approve</Button>}
              </TableCell>
            </TableRow>
          ))}
          {deals.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No deals yet</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── COMMISSIONS TAB ───
function CommissionsTab({ commissions, invalidateAll }: any) {
  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('dsn_commissions').update({ status: 'paid' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success('Marked as paid'); },
  });

  const totalPending = commissions.filter((c: any) => c.status === 'pending').reduce((s: number, c: any) => s + Number(c.closer_payout || 0) + Number(c.setter_payout || 0), 0);
  const totalPaid = commissions.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + Number(c.closer_payout || 0) + Number(c.setter_payout || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Records</p><p className="text-xl font-bold text-foreground">{commissions.length}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending Payout</p><p className="text-xl font-bold text-yellow-400">${totalPending.toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Paid</p><p className="text-xl font-bold text-green-400">${totalPaid.toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Platform Fees</p><p className="text-xl font-bold text-foreground">${commissions.reduce((s: number, c: any) => s + Number(c.platform_fee || 0), 0).toLocaleString()}</p></CardContent></Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deal Value</TableHead>
            <TableHead>Platform Fee</TableHead>
            <TableHead>Closer</TableHead>
            <TableHead>Setter</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {commissions.map((c: any) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium text-foreground">${Number(c.deal_value || 0).toLocaleString()}</TableCell>
              <TableCell className="text-red-400">${Number(c.platform_fee || 0).toLocaleString()}</TableCell>
              <TableCell className="text-green-400">${Number(c.closer_payout || 0).toLocaleString()}</TableCell>
              <TableCell className="text-blue-400">${Number(c.setter_payout || 0).toLocaleString()}</TableCell>
              <TableCell><Badge variant={c.status === 'paid' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
              <TableCell>
                {c.status === 'approved' && <Button size="sm" variant="outline" onClick={() => markPaid.mutate(c.id)}>Mark Paid</Button>}
              </TableCell>
            </TableRow>
          ))}
          {commissions.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No commissions</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── LEADERBOARD TAB ───
function LeaderboardTab({ agents, deals }: any) {
  const ranked = [...agents]
    .map((a: any) => ({
      ...a,
      dealCount: deals.filter((d: any) => d.closer_id === a.id || d.setter_id === a.id).length,
      revenue: deals.filter((d: any) => d.closer_id === a.id).reduce((s: number, d: any) => s + Number(d.value || 0), 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-400" /> Performance Leaderboard</h3>
      <div className="space-y-2">
        {ranked.map((a, i) => (
          <Card key={a.id} className={`bg-card border-border ${i < 3 ? 'ring-1 ring-yellow-500/30' : ''}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <span className={`text-2xl font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>#{i + 1}</span>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{a.role} · {a.category?.replace('_', ' ')}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-400">${a.revenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{a.dealCount} deals</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {ranked.length === 0 && <p className="text-center text-muted-foreground py-8">No agents to rank</p>}
      </div>
    </div>
  );
}

// ─── AI ROUTING TAB ───
function AIRoutingTab({ leads, agents }: any) {
  const newLeads = leads.filter((l: any) => l.status === 'new');
  const topClosers = [...agents].filter((a: any) => a.role === 'closer' && a.status === 'active').sort((a, b) => Number(b.performance_score || 0) - Number(a.performance_score || 0)).slice(0, 5);

  const assignBest = useMutation({
    mutationFn: async ({ leadId, agentId }: { leadId: string; agentId: string }) => {
      const { error } = await (supabase as any).from('dsn_leads').update({ assigned_closer_id: agentId, status: 'assigned', updated_at: new Date().toISOString() }).eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => toast.success('Lead auto-routed to top closer'),
  });

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-purple-400" /> AI Lead Routing Engine</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Routes unassigned leads to the highest-performing closer in matching category.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Unassigned Leads ({newLeads.length})</p>
              {newLeads.slice(0, 10).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-2 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{l.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{l.category?.replace('_', ' ')} · {l.source}</p>
                  </div>
                  {topClosers.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => {
                      const best = topClosers.find((c: any) => c.category === l.category) || topClosers[0];
                      assignBest.mutate({ leadId: l.id, agentId: best.id });
                    }}>
                      <Zap className="h-3 w-3 mr-1" /> Auto-Route
                    </Button>
                  )}
                </div>
              ))}
              {newLeads.length === 0 && <p className="text-sm text-muted-foreground">All leads assigned</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Top Closers</p>
              {topClosers.map((a: any, i: number) => (
                <div key={a.id} className="flex items-center gap-3 p-2 border-b border-border">
                  <Award className={`h-4 w-4 ${i === 0 ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">Score: {Number(a.performance_score || 0).toFixed(0)} · {a.category?.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
              {topClosers.length === 0 && <p className="text-sm text-muted-foreground">No closers available</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── TRAINING TAB ───
function TrainingTab() {
  const scripts = [
    { title: 'Solar Opener', category: 'solar', content: 'Hi [Name], this is [Agent] from Dynasty Solar. I noticed your home at [Address] qualifies for significant energy savings...' },
    { title: 'Real Estate Cold Call', category: 'real_estate', content: 'Hi [Name], I\'m reaching out because I noticed your property at [Address]. Have you considered what it might be worth in today\'s market?' },
    { title: 'Funding Pitch', category: 'funding', content: 'Hi [Name], I work with business owners to secure capital. I see your business has been growing — have you explored funding options?' },
    { title: 'Objection: Not Interested', category: 'general', content: 'I totally understand. Most of our clients felt the same way initially. Can I just ask — what would make this worth exploring for you?' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-400" /> Training Scripts & Resources</h3>
      <div className="grid md:grid-cols-2 gap-4">
        {scripts.map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                {s.title}
                <Badge variant="outline" className="capitalize">{s.category}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ───
export default function DynastySalesNetwork() {
  const { agents, leads, deals, commissions, appointments, isLoading, invalidateAll, qc } = useDSN();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" /> Dynasty Sales Network
        </h1>
        <p className="text-sm text-muted-foreground">High-ticket sales pipelines, agents, commissions & performance</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">📊 Overview</TabsTrigger>
          <TabsTrigger value="agents">👥 Agents</TabsTrigger>
          <TabsTrigger value="leads">🎯 Leads</TabsTrigger>
          <TabsTrigger value="deals">💰 Deals</TabsTrigger>
          <TabsTrigger value="commissions">💵 Commissions</TabsTrigger>
          <TabsTrigger value="leaderboard">🏆 Leaderboard</TabsTrigger>
          <TabsTrigger value="ai-routing">🧠 AI Routing</TabsTrigger>
          <TabsTrigger value="training">📚 Training</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab agents={agents} leads={leads} deals={deals} commissions={commissions} /></TabsContent>
        <TabsContent value="agents"><AgentsTab agents={agents} invalidateAll={invalidateAll} /></TabsContent>
        <TabsContent value="leads"><LeadsTab leads={leads} agents={agents} invalidateAll={invalidateAll} /></TabsContent>
        <TabsContent value="deals"><DealsTab deals={deals} agents={agents} invalidateAll={invalidateAll} /></TabsContent>
        <TabsContent value="commissions"><CommissionsTab commissions={commissions} invalidateAll={invalidateAll} /></TabsContent>
        <TabsContent value="leaderboard"><LeaderboardTab agents={agents} deals={deals} /></TabsContent>
        <TabsContent value="ai-routing"><AIRoutingTab leads={leads} agents={agents} /></TabsContent>
        <TabsContent value="training"><TrainingTab /></TabsContent>
      </Tabs>
    </div>
  );
}
