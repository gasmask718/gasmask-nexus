import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Building2, DollarSign, Briefcase, CheckCircle, Eye, UserPlus, Send, Sparkles } from 'lucide-react';

type Brand = {
  id: string; company_name: string; contact_email: string | null; contact_name: string | null;
  budget: number; subscription_status: string; industry: string | null; status: string; created_at: string;
};
type Campaign = {
  id: string; brand_id: string; title: string; description: string | null; budget: number;
  payout_type: string; duration_days: number; min_audience: number; niche_tags: string[] | null;
  platform_fee_pct: number; status: string; start_date: string | null; end_date: string | null; created_at: string;
};
type Application = {
  id: string; campaign_id: string; talent_id: string; pitch: string | null;
  proposed_rate: number; status: string; created_at: string;
};
type Assignment = {
  id: string; campaign_id: string; talent_id: string; agreed_rate: number;
  platform_fee: number; net_payout: number; contract_start: string | null;
  contract_end: string | null; deliverables: string | null; status: string; created_at: string;
};
type TalentProfile = {
  id: string; name: string; email: string; niche: string | null;
  audience_size: number; engagement_rate: number; pricing: number;
};

export default function BrandDealExchangeTab() {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<'brands' | 'campaigns' | 'applications' | 'assignments'>('brands');

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ['dme-brands'],
    queryFn: async () => {
      const { data } = await supabase.from('dme_brands').select('*').order('created_at', { ascending: false });
      return (data || []) as Brand[];
    }
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['dme-campaigns'],
    queryFn: async () => {
      const { data } = await supabase.from('dme_brand_campaigns').select('*').order('created_at', { ascending: false });
      return (data || []) as Campaign[];
    }
  });
  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ['dme-applications'],
    queryFn: async () => {
      const { data } = await supabase.from('dme_campaign_applications').select('*').order('created_at', { ascending: false });
      return (data || []) as Application[];
    }
  });
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['dme-assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('dme_campaign_assignments').select('*').order('created_at', { ascending: false });
      return (data || []) as Assignment[];
    }
  });
  const { data: talent = [] } = useQuery<TalentProfile[]>({
    queryKey: ['dme-talent-light'],
    queryFn: async () => {
      const { data } = await supabase.from('dme_talent_profiles').select('id,name,email,niche,audience_size,engagement_rate,pricing');
      return (data || []) as TalentProfile[];
    }
  });

  const kpis = useMemo(() => ({
    totalBrands: brands.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    totalBudget: campaigns.reduce((s, c) => s + Number(c.budget), 0),
    pendingApps: applications.filter(a => a.status === 'applied').length,
    activeDeals: assignments.filter(a => a.status === 'active').length,
    platformRevenue: assignments.reduce((s, a) => s + Number(a.platform_fee), 0),
  }), [brands, campaigns, applications, assignments]);

  const pills = [
    { key: 'brands' as const, label: '🏢 Brands', count: brands.length },
    { key: 'campaigns' as const, label: '📢 Campaigns', count: campaigns.length },
    { key: 'applications' as const, label: '📋 Applications', count: applications.length },
    { key: 'assignments' as const, label: '🤝 Deals', count: assignments.length },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Brands', val: kpis.totalBrands, icon: Building2, color: 'text-blue-400' },
          { label: 'Active Campaigns', val: kpis.activeCampaigns, icon: Briefcase, color: 'text-emerald-400' },
          { label: 'Total Budget', val: `$${kpis.totalBudget.toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
          { label: 'Pending Apps', val: kpis.pendingApps, icon: Send, color: 'text-yellow-400' },
          { label: 'Active Deals', val: kpis.activeDeals, icon: CheckCircle, color: 'text-cyan-400' },
          { label: 'Platform Rev', val: `$${kpis.platformRevenue.toLocaleString()}`, icon: Sparkles, color: 'text-pink-400' },
        ].map(k => (
          <Card key={k.label} className="bg-card border-border">
            <CardContent className="p-3">
              <k.icon className={`h-4 w-4 ${k.color} mb-1`} />
              <p className={`text-xl font-bold ${k.color}`}>{k.val}</p>
              <p className="text-[10px] text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {pills.map(p => (
          <Button key={p.key} size="sm" variant={subTab === p.key ? 'default' : 'outline'} onClick={() => setSubTab(p.key)}>
            {p.label} <Badge variant="secondary" className="ml-1 text-xs">{p.count}</Badge>
          </Button>
        ))}
      </div>

      {subTab === 'brands' && <BrandsSection brands={brands} queryClient={queryClient} />}
      {subTab === 'campaigns' && <CampaignsSection campaigns={campaigns} brands={brands} queryClient={queryClient} />}
      {subTab === 'applications' && <ApplicationsSection applications={applications} campaigns={campaigns} talent={talent} queryClient={queryClient} />}
      {subTab === 'assignments' && <AssignmentsSection assignments={assignments} campaigns={campaigns} talent={talent} />}
    </div>
  );
}

function BrandsSection({ brands, queryClient }: { brands: Brand[]; queryClient: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ company_name: '', contact_email: '', contact_name: '', budget: '', industry: '' });

  const addBrand = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dme_brands').insert({
        company_name: form.company_name, contact_email: form.contact_email || null,
        contact_name: form.contact_name || null, budget: Number(form.budget) || 0,
        industry: form.industry || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dme-brands'] });
      setShowAdd(false);
      setForm({ company_name: '', contact_email: '', contact_name: '', budget: '', industry: '' });
      toast.success('Brand added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveBrand = async (id: string) => {
    await supabase.from('dme_brands').update({ status: 'approved' } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['dme-brands'] });
    toast.success('Brand approved');
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Brand</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register Brand</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Company Name *" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
              <Input placeholder="Contact Name" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
              <Input placeholder="Contact Email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
              <Input placeholder="Budget $" type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
              <Input placeholder="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
              <Button onClick={() => addBrand.mutate()} disabled={!form.company_name} className="w-full">Register</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {brands.map(b => (
          <Card key={b.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-foreground">{b.company_name}</h3>
                <Badge variant={b.status === 'approved' ? 'default' : b.status === 'pending' ? 'outline' : 'destructive'} className="text-xs">{b.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{b.contact_name} • {b.contact_email}</p>
              {b.industry && <Badge variant="outline" className="text-xs mt-1">{b.industry}</Badge>}
              <p className="text-lg font-bold text-primary mt-2">${Number(b.budget).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Budget • {b.subscription_status}</p>
              {b.status === 'pending' && (
                <Button size="sm" className="mt-2 w-full" onClick={() => approveBrand(b.id)}>Approve Brand</Button>
              )}
            </CardContent>
          </Card>
        ))}
        {brands.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No brands registered</p>}
      </div>
    </div>
  );
}

function CampaignsSection({ campaigns, brands, queryClient }: { campaigns: Campaign[]; brands: Brand[]; queryClient: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ brand_id: '', title: '', description: '', budget: '', payout_type: 'flat', duration_days: '30', min_audience: '0', niche_tags: '' });

  const addCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dme_brand_campaigns').insert({
        brand_id: form.brand_id, title: form.title, description: form.description || null,
        budget: Number(form.budget), payout_type: form.payout_type,
        duration_days: Number(form.duration_days), min_audience: Number(form.min_audience),
        niche_tags: form.niche_tags ? form.niche_tags.split(',').map(s => s.trim()) : [],
        status: 'active',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dme-campaigns'] });
      setShowAdd(false);
      toast.success('Campaign created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColor = (s: string) => s === 'active' ? 'default' : s === 'completed' ? 'secondary' : 'outline';

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Campaign</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.brand_id} onValueChange={v => setForm(f => ({ ...f, brand_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select Brand" /></SelectTrigger>
                <SelectContent>{brands.filter(b => b.status === 'approved').map(b => <SelectItem key={b.id} value={b.id}>{b.company_name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Campaign Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Budget $" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
                <Select value={form.payout_type} onValueChange={v => setForm(f => ({ ...f, payout_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat Rate</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Duration (days)" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))} />
                <Input type="number" placeholder="Min Audience" value={form.min_audience} onChange={e => setForm(f => ({ ...f, min_audience: e.target.value }))} />
              </div>
              <Input placeholder="Niche Tags (comma-separated)" value={form.niche_tags} onChange={e => setForm(f => ({ ...f, niche_tags: e.target.value }))} />
              <Button onClick={() => addCampaign.mutate()} disabled={!form.brand_id || !form.title || !form.budget} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-muted-foreground">
            <th className="text-left p-2">Campaign</th><th className="text-left p-2">Brand</th><th className="text-right p-2">Budget</th><th className="text-left p-2">Payout</th><th className="text-left p-2">Duration</th><th className="text-left p-2">Status</th>
          </tr></thead>
          <tbody>
            {campaigns.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="p-2">
                  <p className="font-medium text-foreground">{c.title}</p>
                  {c.niche_tags && c.niche_tags.length > 0 && <div className="flex gap-1 mt-1">{c.niche_tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>}
                </td>
                <td className="p-2 text-muted-foreground">{brands.find(b => b.id === c.brand_id)?.company_name || '—'}</td>
                <td className="p-2 text-right font-semibold text-foreground">${Number(c.budget).toLocaleString()}</td>
                <td className="p-2 text-muted-foreground">{c.payout_type}</td>
                <td className="p-2 text-muted-foreground">{c.duration_days}d</td>
                <td className="p-2"><Badge variant={statusColor(c.status)} className="text-xs">{c.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length === 0 && <p className="text-center text-muted-foreground py-8">No campaigns yet</p>}
      </div>
    </div>
  );
}

function ApplicationsSection({ applications, campaigns, talent, queryClient }: { applications: Application[]; campaigns: Campaign[]; talent: TalentProfile[]; queryClient: any }) {
  const accept = async (app: Application) => {
    await supabase.from('dme_campaign_applications').update({ status: 'accepted' } as any).eq('id', app.id);
    const campaign = campaigns.find(c => c.id === app.campaign_id);
    const feePct = campaign?.platform_fee_pct || 10;
    const fee = Number(app.proposed_rate) * (feePct / 100);
    await supabase.from('dme_campaign_assignments').insert({
      campaign_id: app.campaign_id, talent_id: app.talent_id,
      agreed_rate: app.proposed_rate, platform_fee: fee,
      net_payout: Number(app.proposed_rate) - fee,
    } as any);
    queryClient.invalidateQueries({ queryKey: ['dme-applications'] });
    queryClient.invalidateQueries({ queryKey: ['dme-assignments'] });
    toast.success('Talent accepted & deal created');
  };

  const reject = async (id: string) => {
    await supabase.from('dme_campaign_applications').update({ status: 'rejected' } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['dme-applications'] });
    toast.success('Application rejected');
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-muted-foreground">
            <th className="text-left p-2">Talent</th><th className="text-left p-2">Campaign</th><th className="text-left p-2">Pitch</th><th className="text-right p-2">Rate</th><th className="text-left p-2">Status</th><th className="text-right p-2">Actions</th>
          </tr></thead>
          <tbody>
            {applications.map(a => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="p-2 text-foreground">{talent.find(t => t.id === a.talent_id)?.name || '—'}</td>
                <td className="p-2 text-muted-foreground">{campaigns.find(c => c.id === a.campaign_id)?.title || '—'}</td>
                <td className="p-2 text-muted-foreground text-xs max-w-[200px] truncate">{a.pitch || '—'}</td>
                <td className="p-2 text-right text-foreground">${Number(a.proposed_rate).toLocaleString()}</td>
                <td className="p-2"><Badge variant={a.status === 'accepted' ? 'default' : a.status === 'rejected' ? 'destructive' : 'outline'} className="text-xs">{a.status}</Badge></td>
                <td className="p-2 text-right space-x-1">
                  {a.status === 'applied' && (
                    <>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => accept(a)}>Accept</Button>
                      <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => reject(a.id)}>Reject</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {applications.length === 0 && <p className="text-center text-muted-foreground py-8">No applications yet</p>}
      </div>
    </div>
  );
}

function AssignmentsSection({ assignments, campaigns, talent }: { assignments: Assignment[]; campaigns: Campaign[]; talent: TalentProfile[] }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-muted-foreground">
            <th className="text-left p-2">Talent</th><th className="text-left p-2">Campaign</th><th className="text-right p-2">Rate</th><th className="text-right p-2">Fee</th><th className="text-right p-2">Net</th><th className="text-left p-2">Status</th>
          </tr></thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="p-2 text-foreground">{talent.find(t => t.id === a.talent_id)?.name || '—'}</td>
                <td className="p-2 text-muted-foreground">{campaigns.find(c => c.id === a.campaign_id)?.title || '—'}</td>
                <td className="p-2 text-right text-foreground">${Number(a.agreed_rate).toLocaleString()}</td>
                <td className="p-2 text-right text-destructive">${Number(a.platform_fee).toLocaleString()}</td>
                <td className="p-2 text-right font-semibold text-primary">${Number(a.net_payout).toLocaleString()}</td>
                <td className="p-2"><Badge variant={a.status === 'active' ? 'default' : a.status === 'completed' ? 'secondary' : 'destructive'} className="text-xs">{a.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {assignments.length === 0 && <p className="text-center text-muted-foreground py-8">No active deals</p>}
      </div>
    </div>
  );
}
