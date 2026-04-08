import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, DollarSign, Users, TrendingUp, Plus, Search, Star, Shield,
  CheckCircle, Clock, XCircle, Crown, Sparkles, Bell, Award, Target, Eye,
  ArrowUpRight, Zap, BarChart3
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const TIERS = ['starter', 'growth', 'enterprise'] as const;
const TIER_COLORS: Record<string, string> = { free: 'bg-muted text-muted-foreground', starter: 'bg-blue-500/20 text-blue-400', growth: 'bg-amber-500/20 text-amber-400', enterprise: 'bg-purple-500/20 text-purple-400' };
const CREATOR_TIER_COLORS: Record<string, string> = { starter: 'bg-muted text-muted-foreground', pro: 'bg-blue-500/20 text-blue-400', elite: 'bg-amber-500/20 text-amber-400' };
const STATUS_ICONS: Record<string, any> = { active: CheckCircle, pending: Clock, suspended: XCircle, applied: Clock, reviewing: Eye, approved: CheckCircle, rejected: XCircle };
const CHART_COLORS = ['hsl(var(--primary))', '#f59e0b', '#10b981', '#6366f1', '#ec4899'];

// ══════════════════════════════════════════════════════════════
// DATA HOOKS
// ══════════════════════════════════════════════════════════════

const useBrands = () => useQuery({
  queryKey: ['dynasty-brands'],
  queryFn: async () => {
    const { data, error } = await supabase.from('dynasty_brands').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
});

const useApplications = () => useQuery({
  queryKey: ['dynasty-brand-applications'],
  queryFn: async () => {
    const { data, error } = await supabase.from('dynasty_brand_applications').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
});

const useSubscriptions = () => useQuery({
  queryKey: ['dynasty-subscriptions'],
  queryFn: async () => {
    const { data, error } = await supabase.from('dynasty_subscriptions').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
});

const useCampaigns = () => useQuery({
  queryKey: ['dynasty-brand-campaigns'],
  queryFn: async () => {
    const { data, error } = await supabase.from('dynasty_brand_campaigns').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
});

const useCreatorTiers = () => useQuery({
  queryKey: ['dynasty-creator-tiers'],
  queryFn: async () => {
    const { data, error } = await supabase.from('dynasty_creator_tiers').select('*').order('performance_score', { ascending: false });
    if (error) throw error;
    return data || [];
  }
});

const useNotifications = () => useQuery({
  queryKey: ['dynasty-brand-notifications'],
  queryFn: async () => {
    const { data, error } = await supabase.from('dynasty_brand_notifications').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return data || [];
  }
});

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function BrandAcquisitionSystem() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-7 w-7 text-primary" /> Dynasty Brand Acquisition & Pricing
          </h1>
          <p className="text-muted-foreground text-sm">Manage brand onboarding, pricing tiers, campaigns, and elite creator access</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
          <TabsTrigger value="brands">🏢 Brands</TabsTrigger>
          <TabsTrigger value="applications">📋 Applications</TabsTrigger>
          <TabsTrigger value="campaigns">🎯 Campaigns</TabsTrigger>
          <TabsTrigger value="creators">⭐ Creator Tiers</TabsTrigger>
          <TabsTrigger value="admin">🛡️ Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="brands"><BrandsTab /></TabsContent>
        <TabsContent value="applications"><ApplicationsTab /></TabsContent>
        <TabsContent value="campaigns"><CampaignsTab /></TabsContent>
        <TabsContent value="creators"><CreatorTiersTab /></TabsContent>
        <TabsContent value="admin"><AdminTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ══════════════════════════════════════════════════════════════

function DashboardTab() {
  const { data: brands = [] } = useBrands();
  const { data: apps = [] } = useApplications();
  const { data: campaigns = [] } = useCampaigns();
  const { data: creators = [] } = useCreatorTiers();
  const { data: subs = [] } = useSubscriptions();
  const { data: notifs = [] } = useNotifications();

  const activeBrands = brands.filter(b => b.status === 'active').length;
  const totalRevenue = subs.filter(s => s.is_active).reduce((s, x) => s + Number(x.monthly_fee || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalBudget = campaigns.reduce((s, c) => s + Number(c.budget || 0), 0);
  const eliteCreators = creators.filter(c => c.tier === 'elite' || c.is_flagged_elite).length;
  const pendingApps = apps.filter(a => a.status === 'applied' || a.status === 'reviewing').length;

  const tierDist = useMemo(() => {
    const counts: Record<string, number> = {};
    brands.forEach(b => { counts[b.subscription_tier] = (counts[b.subscription_tier] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [brands]);

  const campaignTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [campaigns]);

  const kpis = [
    { label: 'Active Brands', value: activeBrands, icon: Building2, color: 'text-blue-400' },
    { label: 'Monthly Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
    { label: 'Active Campaigns', value: activeCampaigns, icon: Target, color: 'text-amber-400' },
    { label: 'Campaign Budget', value: `$${totalBudget.toLocaleString()}`, icon: TrendingUp, color: 'text-purple-400' },
    { label: 'Elite Creators', value: eliteCreators, icon: Star, color: 'text-yellow-400' },
    { label: 'Pending Apps', value: pendingApps, icon: Clock, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2"><k.icon className={`h-4 w-4 ${k.color}`} /><span className="text-xs text-muted-foreground">{k.label}</span></div>
              <p className="text-xl font-bold text-foreground">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Brand Tier Distribution</CardTitle></CardHeader>
          <CardContent>
            {tierDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart><Pie data={tierDist} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {tierDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">No brand data yet</p>}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Campaign Types</CardTitle></CardHeader>
          <CardContent>
            {campaignTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={campaignTypes}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} /><YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[4,4,0,0]} /></BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">No campaign data yet</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> Recent Notifications</CardTitle></CardHeader>
        <CardContent>
          {notifs.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notifs.slice(0, 8).map(n => (
                <div key={n.id} className={`flex items-center gap-3 p-2 rounded-md border border-border ${n.is_read ? 'opacity-60' : ''}`}>
                  <Bell className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground truncate">{n.title}</p><p className="text-xs text-muted-foreground truncate">{n.message}</p></div>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground text-sm text-center py-4">No notifications</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// BRANDS TAB
// ══════════════════════════════════════════════════════════════

function BrandsTab() {
  const { data: brands = [], isLoading } = useBrands();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact_email: '', contact_name: '', industry: '', subscription_tier: 'free' });
  const qc = useQueryClient();

  const addBrand = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dynasty_brands').insert({ ...form, status: 'active' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-brands'] }); setShowAdd(false); setForm({ name: '', contact_email: '', contact_name: '', industry: '', subscription_tier: 'free' }); toast.success('Brand added'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('dynasty_brands').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-brands'] }); toast.success('Status updated'); },
  });

  const filtered = brands.filter(b => !search || b.name?.toLowerCase().includes(search.toLowerCase()) || b.industry?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search brands..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Brand</Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Brand</TableHead><TableHead>Industry</TableHead><TableHead>Tier</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
              filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No brands</TableCell></TableRow> :
              filtered.map(b => (
                <TableRow key={b.id}>
                  <TableCell><div><p className="font-medium text-foreground">{b.name}</p><p className="text-xs text-muted-foreground">{b.contact_email}</p></div></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.industry || '—'}</TableCell>
                  <TableCell><Badge className={TIER_COLORS[b.subscription_tier] || ''}>{b.subscription_tier}</Badge></TableCell>
                  <TableCell><Badge variant={b.status === 'active' ? 'default' : 'secondary'}>{b.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {b.status !== 'active' && <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: b.id, status: 'active' })} className="text-xs">Activate</Button>}
                      {b.status === 'active' && <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: b.id, status: 'suspended' })} className="text-xs text-destructive">Suspend</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent><DialogHeader><DialogTitle>Add Brand</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Brand Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Contact Email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
            <Input placeholder="Contact Name" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            <Input placeholder="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
            <Select value={form.subscription_tier} onValueChange={v => setForm(f => ({ ...f, subscription_tier: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="starter">Starter</SelectItem><SelectItem value="growth">Growth</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent></Select>
            <Button onClick={() => addBrand.mutate()} disabled={!form.name || addBrand.isPending} className="w-full">{addBrand.isPending ? 'Adding...' : 'Add Brand'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// APPLICATIONS TAB
// ══════════════════════════════════════════════════════════════

function ApplicationsTab() {
  const { data: apps = [], isLoading } = useApplications();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ brand_name: '', contact_email: '', contact_name: '', budget: '', goals: '', industry: '' });
  const qc = useQueryClient();

  const addApp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dynasty_brand_applications').insert({ ...form, budget: Number(form.budget) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-brand-applications'] }); setShowAdd(false); toast.success('Application submitted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateApp = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('dynasty_brand_applications').update({ status }).eq('id', id);
      if (error) throw error;
      if (status === 'approved') {
        const app = apps.find(a => a.id === id);
        if (app) {
          await supabase.from('dynasty_brands').insert({ name: app.brand_name, contact_email: app.contact_email, contact_name: app.contact_name, industry: app.industry, status: 'active' });
          await supabase.from('dynasty_brand_notifications').insert({ recipient_type: 'brand', recipient_id: id, title: 'Application Approved', message: `Welcome to Dynasty! ${app.brand_name} has been approved.` });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-brand-applications'] }); qc.invalidateQueries({ queryKey: ['dynasty-brands'] }); toast.success('Updated'); },
  });

  const columns = [
    { key: 'applied', label: 'Applied', color: 'border-muted' },
    { key: 'reviewing', label: 'Under Review', color: 'border-amber-500/50' },
    { key: 'approved', label: 'Approved', color: 'border-green-500/50' },
    { key: 'rejected', label: 'Rejected', color: 'border-red-500/50' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Brand Applications Pipeline</h3>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Application</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {columns.map(col => {
          const items = apps.filter(a => a.status === col.key);
          return (
            <div key={col.key} className={`border-t-2 ${col.color} rounded-lg bg-card border border-border p-3 space-y-2`}>
              <div className="flex items-center justify-between mb-2"><h4 className="text-sm font-semibold text-foreground">{col.label}</h4><Badge variant="secondary" className="text-xs">{items.length}</Badge></div>
              {items.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Empty</p> :
              items.map(app => (
                <Card key={app.id} className="bg-background border-border">
                  <CardContent className="p-3 space-y-2">
                    <p className="font-medium text-sm text-foreground">{app.brand_name}</p>
                    <p className="text-xs text-muted-foreground">{app.industry || 'No industry'} · ${Number(app.budget || 0).toLocaleString()}</p>
                    {app.goals && <p className="text-xs text-muted-foreground line-clamp-2">{app.goals}</p>}
                    <div className="flex gap-1 pt-1">
                      {col.key === 'applied' && <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => updateApp.mutate({ id: app.id, status: 'reviewing' })}>Review</Button>}
                      {col.key === 'reviewing' && <>
                        <Button size="sm" className="text-xs h-6" onClick={() => updateApp.mutate({ id: app.id, status: 'approved' })}>Approve</Button>
                        <Button size="sm" variant="destructive" className="text-xs h-6" onClick={() => updateApp.mutate({ id: app.id, status: 'rejected' })}>Reject</Button>
                      </>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent><DialogHeader><DialogTitle>New Brand Application</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Brand Name" value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} />
            <Input placeholder="Contact Email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
            <Input placeholder="Contact Name" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            <Input placeholder="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
            <Input placeholder="Monthly Budget ($)" type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
            <Input placeholder="Goals" value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))} />
            <Button onClick={() => addApp.mutate()} disabled={!form.brand_name || addApp.isPending} className="w-full">{addApp.isPending ? 'Submitting...' : 'Submit Application'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CAMPAIGNS TAB
// ══════════════════════════════════════════════════════════════

function CampaignsTab() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const { data: brands = [] } = useBrands();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ brand_id: '', title: '', description: '', budget: '', type: 'awareness', platform_fee_pct: '15', min_creator_tier: 'starter' });
  const qc = useQueryClient();

  const addCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dynasty_brand_campaigns').insert({ ...form, budget: Number(form.budget) || 0, platform_fee_pct: Number(form.platform_fee_pct) || 15 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-brand-campaigns'] }); setShowAdd(false); toast.success('Campaign created'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('dynasty_brand_campaigns').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-brand-campaigns'] }); toast.success('Updated'); },
  });

  const getBrandName = (id: string) => brands.find(b => b.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Brand Campaigns</h3>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Create Campaign</Button>
      </div>

      <Card className="bg-card border-border"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Brand</TableHead><TableHead>Type</TableHead><TableHead>Budget</TableHead><TableHead>Fee %</TableHead><TableHead>Min Tier</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            campaigns.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No campaigns</TableCell></TableRow> :
            campaigns.map(c => (
              <TableRow key={c.id}>
                <TableCell><p className="font-medium text-foreground">{c.title}</p></TableCell>
                <TableCell className="text-sm text-muted-foreground">{getBrandName(c.brand_id)}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{c.type}</Badge></TableCell>
                <TableCell className="text-sm font-medium">${Number(c.budget || 0).toLocaleString()}</TableCell>
                <TableCell className="text-sm">{c.platform_fee_pct}%</TableCell>
                <TableCell><Badge className={CREATOR_TIER_COLORS[c.min_creator_tier || 'starter'] || ''}>{c.min_creator_tier}</Badge></TableCell>
                <TableCell><Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {c.status === 'draft' && <Button size="sm" variant="ghost" className="text-xs" onClick={() => updateStatus.mutate({ id: c.id, status: 'active' })}>Launch</Button>}
                    {c.status === 'active' && <Button size="sm" variant="ghost" className="text-xs" onClick={() => updateStatus.mutate({ id: c.id, status: 'paused' })}>Pause</Button>}
                    {c.status === 'paused' && <Button size="sm" variant="ghost" className="text-xs" onClick={() => updateStatus.mutate({ id: c.id, status: 'active' })}>Resume</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent><DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={form.brand_id} onValueChange={v => setForm(f => ({ ...f, brand_id: v }))}><SelectTrigger><SelectValue placeholder="Select Brand" /></SelectTrigger><SelectContent>{brands.filter(b => b.status === 'active').map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Campaign Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <Input placeholder="Budget ($)" type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="awareness">Awareness</SelectItem><SelectItem value="conversion">Conversion</SelectItem><SelectItem value="content">Content</SelectItem><SelectItem value="ambassador">Ambassador</SelectItem></SelectContent></Select>
            <Input placeholder="Platform Fee %" type="number" value={form.platform_fee_pct} onChange={e => setForm(f => ({ ...f, platform_fee_pct: e.target.value }))} />
            <Select value={form.min_creator_tier} onValueChange={v => setForm(f => ({ ...f, min_creator_tier: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="elite">Elite Only</SelectItem></SelectContent></Select>
            <Button onClick={() => addCampaign.mutate()} disabled={!form.brand_id || !form.title || addCampaign.isPending} className="w-full">{addCampaign.isPending ? 'Creating...' : 'Create Campaign'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CREATOR TIERS TAB
// ══════════════════════════════════════════════════════════════

function CreatorTiersTab() {
  const { data: creators = [], isLoading } = useCreatorTiers();
  const { data: campaigns = [] } = useCampaigns();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', tier: 'starter', performance_score: '0' });
  const qc = useQueryClient();

  const addCreator = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dynasty_creator_tiers').insert({ ...form, user_id: crypto.randomUUID(), performance_score: Number(form.performance_score) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-creator-tiers'] }); setShowAdd(false); toast.success('Creator added'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTier = useMutation({
    mutationFn: async ({ id, tier, is_flagged_elite }: { id: string; tier?: string; is_flagged_elite?: boolean }) => {
      const update: any = {};
      if (tier) update.tier = tier;
      if (is_flagged_elite !== undefined) update.is_flagged_elite = is_flagged_elite;
      const { error } = await supabase.from('dynasty_creator_tiers').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-creator-tiers'] }); toast.success('Updated'); },
  });

  // AI Matching: suggest best creators for active campaigns needing their tier
  const aiMatches = useMemo(() => {
    const activeCamps = campaigns.filter(c => c.status === 'active');
    return creators.slice(0, 5).map(c => {
      const matching = activeCamps.filter(camp => {
        const tierOrder = ['starter', 'pro', 'elite'];
        return tierOrder.indexOf(c.tier) >= tierOrder.indexOf(camp.min_creator_tier || 'starter');
      });
      return { creator: c, matchCount: matching.length, topCampaign: matching[0]?.title };
    }).filter(m => m.matchCount > 0);
  }, [creators, campaigns]);

  const filtered = creators.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      {aiMatches.length > 0 && (
        <Card className="bg-card border-primary/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Creator-Brand Matching</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {aiMatches.slice(0, 3).map(m => (
                <div key={m.creator.id} className="p-3 rounded-lg bg-background border border-border">
                  <p className="font-medium text-sm text-foreground">{m.creator.name || 'Creator'}</p>
                  <p className="text-xs text-muted-foreground"><Badge className={CREATOR_TIER_COLORS[m.creator.tier]} variant="outline">{m.creator.tier}</Badge> · Score: {m.creator.performance_score}</p>
                  <p className="text-xs text-primary mt-1">→ {m.matchCount} eligible campaign{m.matchCount > 1 ? 's' : ''}: {m.topCampaign}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search creators..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Creator</Button>
      </div>

      <Card className="bg-card border-border"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Creator</TableHead><TableHead>Tier</TableHead><TableHead>Score</TableHead><TableHead>Earnings</TableHead><TableHead>Campaigns</TableHead><TableHead>Elite</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No creators</TableCell></TableRow> :
            filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell><div><p className="font-medium text-foreground">{c.name || 'Unnamed'}</p><p className="text-xs text-muted-foreground">{c.email}</p></div></TableCell>
                <TableCell><Badge className={CREATOR_TIER_COLORS[c.tier]}>{c.tier}</Badge></TableCell>
                <TableCell className="text-sm font-medium">{c.performance_score}</TableCell>
                <TableCell className="text-sm">${Number(c.total_earnings || 0).toLocaleString()}</TableCell>
                <TableCell className="text-sm">{c.campaigns_completed || 0}</TableCell>
                <TableCell>{c.is_flagged_elite ? <Star className="h-4 w-4 text-amber-400 fill-amber-400" /> : <Star className="h-4 w-4 text-muted-foreground" />}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Select defaultValue={c.tier} onValueChange={v => updateTier.mutate({ id: c.id, tier: v })}>
                      <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="elite">Elite</SelectItem></SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateTier.mutate({ id: c.id, is_flagged_elite: !c.is_flagged_elite })}>
                      {c.is_flagged_elite ? '⭐' : '☆'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent><DialogHeader><DialogTitle>Add Creator</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Select value={form.tier} onValueChange={v => setForm(f => ({ ...f, tier: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="elite">Elite</SelectItem></SelectContent></Select>
            <Input placeholder="Performance Score" type="number" value={form.performance_score} onChange={e => setForm(f => ({ ...f, performance_score: e.target.value }))} />
            <Button onClick={() => addCreator.mutate()} disabled={!form.name || addCreator.isPending} className="w-full">{addCreator.isPending ? 'Adding...' : 'Add Creator'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ADMIN TAB
// ══════════════════════════════════════════════════════════════

function AdminTab() {
  const { data: brands = [] } = useBrands();
  const { data: subs = [] } = useSubscriptions();
  const { data: campaigns = [] } = useCampaigns();
  const { data: creators = [] } = useCreatorTiers();
  const [showAddSub, setShowAddSub] = useState(false);
  const [subForm, setSubForm] = useState({ brand_id: '', plan: 'starter', monthly_fee: '' });
  const qc = useQueryClient();

  const addSub = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dynasty_subscriptions').insert({ ...subForm, monthly_fee: Number(subForm.monthly_fee) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-subscriptions'] }); setShowAddSub(false); toast.success('Subscription created'); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalFees = campaigns.reduce((s, c) => s + (Number(c.budget || 0) * Number(c.platform_fee_pct || 15) / 100), 0);
  const totalSubRevenue = subs.filter(s => s.is_active).reduce((s, x) => s + Number(x.monthly_fee || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Subscription MRR</p><p className="text-xl font-bold text-foreground">${totalSubRevenue.toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Platform Fees (Est.)</p><p className="text-xl font-bold text-foreground">${totalFees.toLocaleString()}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Subscriptions</p><p className="text-xl font-bold text-foreground">{subs.filter(s => s.is_active).length}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Creators</p><p className="text-xl font-bold text-foreground">{creators.length}</p></CardContent></Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Subscription Management</span>
          <Button size="sm" onClick={() => setShowAddSub(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Brand</TableHead><TableHead>Plan</TableHead><TableHead>Monthly Fee</TableHead><TableHead>Active</TableHead><TableHead>Started</TableHead></TableRow></TableHeader>
            <TableBody>
              {subs.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No subscriptions</TableCell></TableRow> :
              subs.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm font-medium">{brands.find(b => b.id === s.brand_id)?.name || '—'}</TableCell>
                  <TableCell><Badge className={TIER_COLORS[s.plan] || ''}>{s.plan}</Badge></TableCell>
                  <TableCell className="text-sm">${Number(s.monthly_fee).toLocaleString()}</TableCell>
                  <TableCell>{s.is_active ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-destructive" />}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(s.started_at || s.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pricing tiers reference */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Pricing Tiers</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { plan: 'Starter', fee: '$99/mo', features: ['5 Campaigns/mo', 'Starter creators only', '15% platform fee'] },
              { plan: 'Growth', fee: '$299/mo', features: ['20 Campaigns/mo', 'Pro + Starter creators', '12% platform fee'] },
              { plan: 'Enterprise', fee: '$799/mo', features: ['Unlimited Campaigns', 'All creator tiers', '8% platform fee', 'Priority matching'] },
            ].map(t => (
              <div key={t.plan} className="p-4 rounded-lg border border-border bg-background">
                <h4 className="font-semibold text-foreground">{t.plan}</h4>
                <p className="text-lg font-bold text-primary mb-2">{t.fee}</p>
                <ul className="space-y-1">{t.features.map(f => <li key={f} className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-400" />{f}</li>)}</ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
        <DialogContent><DialogHeader><DialogTitle>Add Subscription</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={subForm.brand_id} onValueChange={v => setSubForm(f => ({ ...f, brand_id: v }))}><SelectTrigger><SelectValue placeholder="Select Brand" /></SelectTrigger><SelectContent>{brands.filter(b => b.status === 'active').map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
            <Select value={subForm.plan} onValueChange={v => setSubForm(f => ({ ...f, plan: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="growth">Growth</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent></Select>
            <Input placeholder="Monthly Fee ($)" type="number" value={subForm.monthly_fee} onChange={e => setSubForm(f => ({ ...f, monthly_fee: e.target.value }))} />
            <Button onClick={() => addSub.mutate()} disabled={!subForm.brand_id || addSub.isPending} className="w-full">{addSub.isPending ? 'Creating...' : 'Create Subscription'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
