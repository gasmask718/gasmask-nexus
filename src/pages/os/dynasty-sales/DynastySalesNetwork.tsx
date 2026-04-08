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
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import {
  Users, DollarSign, Target, TrendingUp, Trophy, Phone, Plus,
  ArrowRight, Zap, Brain, BookOpen, BarChart3, Award, Bell,
  GraduationCap, PhoneCall, CheckCircle2, XCircle, Clock, Flame,
  Shield, Star, MessageSquare, Headphones
} from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const CATEGORIES = ['solar', 'real_estate', 'funding'] as const;
const LEAD_STATUSES = ['new', 'assigned', 'appointment', 'closed', 'paid', 'lost'] as const;
const CALL_OUTCOMES = ['connected', 'voicemail', 'no_answer', 'callback', 'closed'] as const;

// ─── DATA HOOK ───
function useDSDS() {
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
  const modules = useQuery({
    queryKey: ['dsn-training-modules'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('dsn_training_modules').select('*').order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });
  const progress = useQuery({
    queryKey: ['dsn-agent-progress'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('dsn_agent_progress').select('*');
      if (error) throw error;
      return data || [];
    },
  });
  const certifications = useQuery({
    queryKey: ['dsn-certifications'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('dsn_certifications').select('*');
      if (error) throw error;
      return data || [];
    },
  });
  const callLogs = useQuery({
    queryKey: ['dsn-call-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('dsn_call_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const invalidateAll = () => {
    ['dsn-agents', 'dsn-leads', 'dsn-deals', 'dsn-commissions', 'dsn-training-modules', 'dsn-agent-progress', 'dsn-certifications', 'dsn-call-logs'].forEach(k =>
      qc.invalidateQueries({ queryKey: [k] })
    );
  };

  return {
    agents: agents.data || [], leads: leads.data || [], deals: deals.data || [],
    commissions: commissions.data || [], modules: modules.data || [],
    progress: progress.data || [], certifications: certifications.data || [],
    callLogs: callLogs.data || [], isLoading: agents.isLoading || leads.isLoading,
    invalidateAll, qc,
  };
}

// ─── OVERVIEW TAB ───
function OverviewTab({ agents, leads, deals, commissions, callLogs, certifications }: any) {
  const totalRevenue = deals.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
  const totalCommissions = commissions.reduce((s: number, c: any) => s + Number(c.closer_payout || 0) + Number(c.setter_payout || 0), 0);
  const closedDeals = deals.filter((d: any) => d.status === 'approved' || d.status === 'paid').length;
  const activeLeads = leads.filter((l: any) => !['closed', 'paid', 'lost'].includes(l.status)).length;
  const totalCalls = callLogs.length;
  const connectedCalls = callLogs.filter((c: any) => c.outcome === 'connected' || c.outcome === 'closed').length;
  const callSuccessRate = totalCalls > 0 ? ((connectedCalls / totalCalls) * 100).toFixed(1) : '0';
  const certifiedAgents = new Set(certifications.map((c: any) => c.agent_id)).size;

  const kpis = [
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
    { label: 'Active Leads', value: activeLeads, icon: Target, color: 'text-blue-400' },
    { label: 'Deals Closed', value: closedDeals, icon: Trophy, color: 'text-yellow-400' },
    { label: 'Active Agents', value: agents.filter((a: any) => a.status === 'active').length, icon: Users, color: 'text-purple-400' },
    { label: 'Call Success %', value: `${callSuccessRate}%`, icon: PhoneCall, color: 'text-cyan-400' },
    { label: 'Certified Agents', value: certifiedAgents, icon: Shield, color: 'text-emerald-400' },
  ];

  const pipelineData = LEAD_STATUSES.map(s => ({ name: s, count: leads.filter((l: any) => l.status === s).length }));
  const categoryData = CATEGORIES.map(c => ({ name: c.replace('_', ' '), value: deals.filter((d: any) => d.category === c).reduce((s: number, d: any) => s + Number(d.value || 0), 0) }));

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
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="setter">Setter</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.experience_level} onValueChange={v => setForm({ ...form, experience_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Mid-Level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="elite">Elite</SelectItem>
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
            <TableHead>Level</TableHead>
            <TableHead>Certified</TableHead>
            <TableHead>Deals</TableHead>
            <TableHead>Earnings</TableHead>
            <TableHead>Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((a: any) => {
            const certs = certifications.filter((c: any) => c.agent_id === a.id);
            return (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                <TableCell><Badge variant={a.role === 'closer' ? 'default' : 'secondary'}>{a.role}</Badge></TableCell>
                <TableCell className="capitalize">{a.category?.replace('_', ' ')}</TableCell>
                <TableCell className="capitalize">{a.experience_level || 'junior'}</TableCell>
                <TableCell>
                  {certs.length > 0 ? (
                    <div className="flex gap-1">{certs.map((c: any) => <Badge key={c.id} variant="outline" className="text-[10px] text-green-400 border-green-500/30">{c.category}</Badge>)}</div>
                  ) : <span className="text-xs text-muted-foreground">None</span>}
                </TableCell>
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

// ─── PIPELINE TAB (Leads + Deals combined) ───
function PipelineTab({ leads, deals, agents, invalidateAll }: any) {
  const [open, setOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'inbound', category: 'solar' });
  const [dealForm, setDealForm] = useState({ closer_id: '', value: '', category: 'solar', platform_fee_pct: '10' });
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

  const createDeal = useMutation({
    mutationFn: async () => {
      const value = Number(dealForm.value);
      const feePct = Number(dealForm.platform_fee_pct);
      const { data: deal, error } = await (supabase as any).from('dsn_deals').insert({
        closer_id: dealForm.closer_id || null, value, category: dealForm.category, platform_fee_pct: feePct,
      }).select('id').single();
      if (error) throw error;
      const fee = value * (feePct / 100);
      await (supabase as any).from('dsn_commissions').insert({
        deal_id: deal.id, closer_id: dealForm.closer_id || null, deal_value: value,
        platform_fee: fee, closer_payout: (value - fee) * 0.6, setter_payout: (value - fee) * 0.2,
      });
    },
    onSuccess: () => { invalidateAll(); setDealOpen(false); setDealForm({ closer_id: '', value: '', category: 'solar', platform_fee_pct: '10' }); toast.success('Deal created'); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = filter === 'all' ? leads : leads.filter((l: any) => l.status === filter);
  const closers = agents.filter((a: any) => a.role === 'closer');
  const setters = agents.filter((a: any) => a.role === 'setter');

  return (
    <div className="space-y-4">
      {/* Pipeline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {LEAD_STATUSES.slice(0, 5).map(s => (
          <Card key={s} className="bg-card border-border">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground capitalize">{s}</p>
              <p className="text-xl font-bold text-foreground">{leads.filter((l: any) => l.status === s).length}</p>
            </CardContent>
          </Card>
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
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
                <Button onClick={() => addLead.mutate()} disabled={!form.name} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dealOpen} onOpenChange={setDealOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><DollarSign className="h-4 w-4 mr-1" /> Log Deal</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log Deal</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Deal Value ($)" type="number" value={dealForm.value} onChange={e => setDealForm({ ...dealForm, value: e.target.value })} />
                <Select value={dealForm.category} onValueChange={v => setDealForm({ ...dealForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
                {closers.length > 0 && (
                  <Select value={dealForm.closer_id} onValueChange={v => setDealForm({ ...dealForm, closer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Assign Closer" /></SelectTrigger>
                    <SelectContent>{closers.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Input placeholder="Platform Fee %" type="number" value={dealForm.platform_fee_pct} onChange={e => setDealForm({ ...dealForm, platform_fee_pct: e.target.value })} />
                <Button onClick={() => createDeal.mutate()} disabled={!dealForm.value} className="w-full">Save Deal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
          {filtered.slice(0, 100).map((l: any) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium text-foreground">{l.name}</TableCell>
              <TableCell className="capitalize">{l.source}</TableCell>
              <TableCell className="capitalize">{l.category?.replace('_', ' ')}</TableCell>
              <TableCell>
                <Select value={l.status} onValueChange={v => updateStatus.mutate({ leadId: l.id, status: v })}>
                  <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
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

// ─── TRAINING & CERTIFICATION TAB ───
function TrainingTab({ agents, modules, progress, certifications, invalidateAll }: any) {
  const [modOpen, setModOpen] = useState(false);
  const [modForm, setModForm] = useState({ title: '', category: 'solar', content: '', difficulty_level: 'beginner', required_for_certification: true });
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  const addModule = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('dsn_training_modules').insert(modForm);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setModOpen(false); setModForm({ title: '', category: 'solar', content: '', difficulty_level: 'beginner', required_for_certification: true }); toast.success('Module added'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ agentId, moduleId, status }: { agentId: string; moduleId: string; status: string }) => {
      const existing = progress.find((p: any) => p.agent_id === agentId && p.module_id === moduleId);
      if (existing) {
        const { error } = await (supabase as any).from('dsn_agent_progress').update({
          completion_status: status, completed_at: status === 'completed' ? new Date().toISOString() : null,
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('dsn_agent_progress').insert({
          agent_id: agentId, module_id: moduleId, completion_status: status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); toast.success('Progress updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  const certifyAgent = useMutation({
    mutationFn: async ({ agentId, category }: { agentId: string; category: string }) => {
      const { error } = await (supabase as any).from('dsn_certifications').insert({ agent_id: agentId, category });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success('Agent certified!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const agentModules = selectedAgent ? modules.map((m: any) => {
    const p = progress.find((p: any) => p.agent_id === selectedAgent && p.module_id === m.id);
    return { ...m, status: p?.completion_status || 'not_started', score: p?.score };
  }) : [];

  const agentCerts = selectedAgent ? certifications.filter((c: any) => c.agent_id === selectedAgent) : [];
  const categoryModules = (cat: string) => modules.filter((m: any) => m.category === cat && m.required_for_certification);
  const canCertify = (cat: string) => {
    if (!selectedAgent) return false;
    if (agentCerts.some((c: any) => c.category === cat)) return false;
    const required = categoryModules(cat);
    return required.length > 0 && required.every((m: any) => {
      const p = progress.find((p: any) => p.agent_id === selectedAgent && p.module_id === m.id);
      return p?.completion_status === 'completed';
    });
  };

  const completedCount = agentModules.filter((m: any) => m.status === 'completed').length;
  const totalCount = agentModules.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-blue-400" /> Training & Certification
        </h3>
        <div className="flex gap-2">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select Agent" /></SelectTrigger>
            <SelectContent>{agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={modOpen} onOpenChange={setModOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add Module</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Training Module</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Module Title" value={modForm.title} onChange={e => setModForm({ ...modForm, title: e.target.value })} />
                <Select value={modForm.category} onValueChange={v => setModForm({ ...modForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...CATEGORIES, 'objection_handling' as const].map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={modForm.difficulty_level} onValueChange={v => setModForm({ ...modForm, difficulty_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Module content / script..." value={modForm.content} onChange={e => setModForm({ ...modForm, content: e.target.value })} rows={5} />
                <Button onClick={() => addModule.mutate()} disabled={!modForm.title} className="w-full">Save Module</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selectedAgent && (
        <div className="space-y-4">
          {/* Progress bar */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Overall Progress</span>
                <span className="text-sm text-muted-foreground">{completedCount}/{totalCount} modules</span>
              </div>
              <Progress value={pct} className="h-3" />
              <div className="flex gap-2 mt-3">
                {agentCerts.map((c: any) => (
                  <Badge key={c.id} className="bg-green-500/20 text-green-400 border-green-500/30">
                    <Shield className="h-3 w-3 mr-1" /> {c.category} Certified
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Certification buttons */}
          <div className="flex gap-2 flex-wrap">
            {[...CATEGORIES, 'objection_handling' as const].map(cat => (
              <Button key={cat} size="sm" variant={canCertify(cat) ? 'default' : 'outline'}
                disabled={!canCertify(cat) || agentCerts.some((c: any) => c.category === cat)}
                onClick={() => certifyAgent.mutate({ agentId: selectedAgent, category: cat })}
                className="capitalize text-xs">
                {agentCerts.some((c: any) => c.category === cat) ? <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : <Shield className="h-3 w-3 mr-1" />}
                {cat.replace('_', ' ')} {agentCerts.some((c: any) => c.category === cat) ? '✓' : ''}
              </Button>
            ))}
          </div>

          {/* Modules */}
          <div className="grid md:grid-cols-2 gap-3">
            {agentModules.map((m: any) => (
              <Card key={m.id} className={`bg-card border-border ${m.status === 'completed' ? 'ring-1 ring-green-500/30' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-foreground text-sm">{m.title}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] capitalize">{m.category?.replace('_', ' ')}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{m.difficulty_level}</Badge>
                      </div>
                    </div>
                    <Select value={m.status} onValueChange={v => updateProgress.mutate({ agentId: selectedAgent, moduleId: m.id, status: v })}>
                      <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {m.content && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{m.content}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!selectedAgent && (
        <div className="text-center py-12 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select an agent to manage their training progress</p>
          <p className="text-xs mt-1">{modules.length} modules available · {certifications.length} certifications issued</p>
        </div>
      )}
    </div>
  );
}

// ─── CALL CENTER TAB ───
function CallCenterTab({ agents, leads, callLogs, invalidateAll }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ agent_id: '', lead_id: '', outcome: 'connected', duration_seconds: '', notes: '', recording_url: '' });

  const logCall = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('dsn_call_logs').insert({
        ...form, duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
        lead_id: form.lead_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setOpen(false); setForm({ agent_id: '', lead_id: '', outcome: 'connected', duration_seconds: '', notes: '', recording_url: '' }); toast.success('Call logged'); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalCalls = callLogs.length;
  const connected = callLogs.filter((c: any) => c.outcome === 'connected' || c.outcome === 'closed').length;
  const voicemails = callLogs.filter((c: any) => c.outcome === 'voicemail').length;
  const avgDuration = totalCalls > 0 ? Math.round(callLogs.reduce((s: number, c: any) => s + Number(c.duration_seconds || 0), 0) / totalCalls) : 0;

  const outcomeData = CALL_OUTCOMES.map(o => ({ name: o, count: callLogs.filter((c: any) => c.outcome === o).length }));

  // AI Suggestions panel
  const AI_SUGGESTIONS = [
    { trigger: 'price objection', tip: '"I understand budget is a concern. Many of our clients found the ROI exceeded expectations within 6 months…"', icon: MessageSquare },
    { trigger: 'not interested', tip: '"I totally get it. Can I ask — what would make this worth exploring?"', icon: Brain },
    { trigger: 'need to think', tip: '"Of course! What specifically would you want to think about? I might be able to address it now."', icon: Clock },
    { trigger: 'already have one', tip: '"Great — so you see the value. What would make you consider switching?"', icon: Zap },
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
        {/* Call outcome chart */}
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader><CardTitle className="text-sm">Call Outcomes</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={outcomeData}>
                <XAxis dataKey="name" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Call Assist */}
        <Card className="bg-card border-border ring-1 ring-purple-500/20">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-purple-400" /> AI Call Assist</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {AI_SUGGESTIONS.map((s, i) => (
              <div key={i} className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <p className="text-[10px] font-semibold text-purple-400 uppercase mb-1">When: "{s.trigger}"</p>
                <p className="text-xs text-foreground">{s.tip}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Log call + recent calls */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground">Recent Calls</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Phone className="h-4 w-4 mr-1" /> Log Call</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Call</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.agent_id} onValueChange={v => setForm({ ...form, agent_id: v })}>
                <SelectTrigger><SelectValue placeholder="Agent" /></SelectTrigger>
                <SelectContent>{agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.lead_id} onValueChange={v => setForm({ ...form, lead_id: v })}>
                <SelectTrigger><SelectValue placeholder="Lead (optional)" /></SelectTrigger>
                <SelectContent>{leads.slice(0, 50).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.outcome} onValueChange={v => setForm({ ...form, outcome: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CALL_OUTCOMES.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Duration (seconds)" type="number" value={form.duration_seconds} onChange={e => setForm({ ...form, duration_seconds: e.target.value })} />
              <Input placeholder="Recording URL (optional)" value={form.recording_url} onChange={e => setForm({ ...form, recording_url: e.target.value })} />
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={() => logCall.mutate()} disabled={!form.agent_id} className="w-full">Save Call</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {callLogs.slice(0, 50).map((c: any) => {
            const agent = agents.find((a: any) => a.id === c.agent_id);
            const outcomeColors: Record<string, string> = { connected: 'text-green-400', closed: 'text-yellow-400', voicemail: 'text-blue-400', no_answer: 'text-muted-foreground', callback: 'text-cyan-400' };
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">{agent?.name || 'Unknown'}</TableCell>
                <TableCell className={`capitalize ${outcomeColors[c.outcome] || ''}`}>{c.outcome}</TableCell>
                <TableCell>{c.duration_seconds ? `${c.duration_seconds}s` : '-'}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.notes || '-'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            );
          })}
          {callLogs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No calls logged</TableCell></TableRow>}
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
    const earnings = commissions.filter((c: any) => c.closer_id === a.id).reduce((s: number, c: any) => s + Number(c.closer_payout || 0), 0)
      + commissions.filter((c: any) => c.setter_id === a.id).reduce((s: number, c: any) => s + Number(c.setter_payout || 0), 0);
    return {
      ...a, dealCount: agentDeals.length, revenue, earnings,
      callCount: agentCalls.length, connectedCalls: connected,
      closeRate: agentDeals.length > 0 && agentCalls.length > 0 ? ((agentDeals.length / agentCalls.length) * 100).toFixed(1) : '0',
      callSuccessRate: agentCalls.length > 0 ? ((connected / agentCalls.length) * 100).toFixed(1) : '0',
    };
  }).sort((a: any, b: any) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><BarChart3 className="h-5 w-5 text-cyan-400" /> Performance Analytics</h3>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">Revenue by Agent</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ranked.slice(0, 10)} layout="vertical">
                <XAxis type="number" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" fontSize={11} width={100} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">Call Success Rate by Agent</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ranked.filter((a: any) => a.callCount > 0).slice(0, 10)} layout="vertical">
                <XAxis type="number" domain={[0, 100]} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" fontSize={11} width={100} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(v: any) => `${v}%`} />
                <Bar dataKey="callSuccessRate" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Calls</TableHead>
            <TableHead>Connected</TableHead>
            <TableHead>Call %</TableHead>
            <TableHead>Deals</TableHead>
            <TableHead>Close Rate</TableHead>
            <TableHead>Revenue</TableHead>
            <TableHead>Earnings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranked.map((a: any) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium text-foreground">{a.name}</TableCell>
              <TableCell><Badge variant={a.role === 'closer' ? 'default' : 'secondary'}>{a.role}</Badge></TableCell>
              <TableCell>{a.callCount}</TableCell>
              <TableCell className="text-green-400">{a.connectedCalls}</TableCell>
              <TableCell>{a.callSuccessRate}%</TableCell>
              <TableCell>{a.dealCount}</TableCell>
              <TableCell>{a.closeRate}%</TableCell>
              <TableCell className="text-green-400">${a.revenue.toLocaleString()}</TableCell>
              <TableCell className="text-cyan-400">${a.earnings.toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {ranked.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── LEADERBOARD TAB ───
function LeaderboardTab({ agents, deals, callLogs, commissions }: any) {
  const ranked = [...agents]
    .map((a: any) => {
      const revenue = deals.filter((d: any) => d.closer_id === a.id).reduce((s: number, d: any) => s + Number(d.value || 0), 0);
      const dealCount = deals.filter((d: any) => d.closer_id === a.id || d.setter_id === a.id).length;
      const calls = callLogs.filter((c: any) => c.agent_id === a.id).length;
      const earnings = commissions.filter((c: any) => c.closer_id === a.id || c.setter_id === a.id)
        .reduce((s: number, c: any) => s + Number(c.closer_payout || 0) + Number(c.setter_payout || 0), 0);
      // Weighted score: revenue 50%, deals 25%, calls 25%
      const score = (revenue / 1000) * 0.5 + dealCount * 25 * 0.25 + calls * 5 * 0.25;
      return { ...a, revenue, dealCount, calls, earnings, score };
    })
    .sort((a, b) => b.score - a.score);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-400" /> Sales Domination Leaderboard</h3>

      {/* Top 3 podium */}
      {ranked.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {ranked.slice(0, 3).map((a, i) => (
            <Card key={a.id} className={`bg-card border-border ${i === 0 ? 'ring-2 ring-yellow-500/50' : i === 1 ? 'ring-1 ring-gray-400/30' : 'ring-1 ring-orange-500/30'}`}>
              <CardContent className="p-4 text-center">
                <span className="text-3xl">{medals[i]}</span>
                <p className="font-bold text-foreground mt-2">{a.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{a.role} · {a.category?.replace('_', ' ')}</p>
                <p className="text-lg font-bold text-green-400 mt-2">${a.revenue.toLocaleString()}</p>
                <div className="flex justify-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{a.dealCount} deals</span>
                  <span>{a.calls} calls</span>
                </div>
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
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{a.role} · {a.category?.replace('_', ' ')} · {a.experience_level || 'junior'}</p>
              </div>
              <div className="flex gap-4 text-right text-sm">
                <div><p className="text-green-400 font-bold">${a.revenue.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Revenue</p></div>
                <div><p className="text-foreground font-bold">{a.dealCount}</p><p className="text-[10px] text-muted-foreground">Deals</p></div>
                <div><p className="text-cyan-400 font-bold">{a.calls}</p><p className="text-[10px] text-muted-foreground">Calls</p></div>
                <div><p className="text-yellow-400 font-bold">{Math.round(a.score)}</p><p className="text-[10px] text-muted-foreground">Score</p></div>
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
function AIRoutingTab({ leads, agents, certifications }: any) {
  const newLeads = leads.filter((l: any) => l.status === 'new');
  const topClosers = [...agents]
    .filter((a: any) => a.role === 'closer' && a.status === 'active')
    .sort((a: any, b: any) => Number(b.performance_score || 0) - Number(a.performance_score || 0))
    .slice(0, 5);

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
          <p className="text-sm text-muted-foreground mb-4">Routes unassigned leads to the highest-performing <strong>certified</strong> closer in matching category.</p>
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
                      // Prefer certified closer for the category
                      const certifiedInCat = topClosers.filter((c: any) => {
                        return certifications.some((cert: any) => cert.agent_id === c.id && cert.category === l.category);
                      });
                      const best = certifiedInCat[0] || topClosers.find((c: any) => c.category === l.category) || topClosers[0];
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
              {topClosers.map((a: any, i: number) => {
                const certs = certifications.filter((c: any) => c.agent_id === a.id);
                return (
                  <div key={a.id} className="flex items-center gap-3 p-2 border-b border-border">
                    <Award className={`h-4 w-4 ${i === 0 ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">Score: {Number(a.performance_score || 0).toFixed(0)} · {a.category?.replace('_', ' ')}</p>
                      {certs.length > 0 && (
                        <div className="flex gap-1 mt-1">{certs.map((c: any) => <Badge key={c.id} variant="outline" className="text-[9px] text-green-400 border-green-500/30">{c.category}</Badge>)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
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
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Records</p><p className="text-xl font-bold text-foreground">{commissions.length}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold text-yellow-400">${totalPending.toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-bold text-green-400">${totalPaid.toLocaleString()}</p></CardContent></Card>
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
              <TableCell>{c.status === 'approved' && <Button size="sm" variant="outline" onClick={() => markPaid.mutate(c.id)}>Mark Paid</Button>}</TableCell>
            </TableRow>
          ))}
          {commissions.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No commissions</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── MAIN ───
export default function DynastySalesNetwork() {
  const { agents, leads, deals, commissions, modules, progress, certifications, callLogs, isLoading, invalidateAll } = useDSDS();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" /> Dynasty Sales Domination System
        </h1>
        <p className="text-sm text-muted-foreground">Recruitment · Training · Calls · Deal Closing · Performance Tracking</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">📊 Overview</TabsTrigger>
          <TabsTrigger value="agents">👥 Agents</TabsTrigger>
          <TabsTrigger value="pipeline">🎯 Pipeline</TabsTrigger>
          <TabsTrigger value="training">🎓 Training</TabsTrigger>
          <TabsTrigger value="calls">📞 Call Center</TabsTrigger>
          <TabsTrigger value="performance">📈 Performance</TabsTrigger>
          <TabsTrigger value="leaderboard">🏆 Leaderboard</TabsTrigger>
          <TabsTrigger value="ai-routing">🧠 AI Routing</TabsTrigger>
          <TabsTrigger value="commissions">💵 Commissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab agents={agents} leads={leads} deals={deals} commissions={commissions} callLogs={callLogs} certifications={certifications} /></TabsContent>
        <TabsContent value="agents"><AgentsTab agents={agents} certifications={certifications} invalidateAll={invalidateAll} /></TabsContent>
        <TabsContent value="pipeline"><PipelineTab leads={leads} deals={deals} agents={agents} invalidateAll={invalidateAll} /></TabsContent>
        <TabsContent value="training"><TrainingTab agents={agents} modules={modules} progress={progress} certifications={certifications} invalidateAll={invalidateAll} /></TabsContent>
        <TabsContent value="calls"><CallCenterTab agents={agents} leads={leads} callLogs={callLogs} invalidateAll={invalidateAll} /></TabsContent>
        <TabsContent value="performance"><PerformanceTab agents={agents} deals={deals} callLogs={callLogs} commissions={commissions} /></TabsContent>
        <TabsContent value="leaderboard"><LeaderboardTab agents={agents} deals={deals} callLogs={callLogs} commissions={commissions} /></TabsContent>
        <TabsContent value="ai-routing"><AIRoutingTab leads={leads} agents={agents} certifications={certifications} /></TabsContent>
        <TabsContent value="commissions"><CommissionsTab commissions={commissions} invalidateAll={invalidateAll} /></TabsContent>
      </Tabs>
    </div>
  );
}
