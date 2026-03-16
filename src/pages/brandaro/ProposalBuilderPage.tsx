import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Send, Eye, DollarSign, Loader2, Plus, Copy } from 'lucide-react';

interface Proposal {
  id: string;
  lead_id: string;
  demo_id: string | null;
  tracking_token: string;
  package_tier: string;
  base_price: number;
  addons: any[];
  total_price: number | null;
  status: string;
  view_count: number;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

const PACKAGES = [
  { tier: 'starter', name: 'Starter Website', price: 750, features: ['5-page website', 'Mobile responsive', 'Contact form', 'Basic SEO'] },
  { tier: 'professional', name: 'Professional Website', price: 1000, features: ['10-page website', 'Mobile responsive', 'Contact form', 'Advanced SEO', 'Google Analytics', 'Social integration'] },
  { tier: 'premium', name: 'Premium Website', price: 1500, features: ['Unlimited pages', 'Custom design', 'E-commerce ready', 'Full SEO suite', 'Blog system', 'Lead capture forms'] },
  { tier: 'elite', name: 'Elite Custom', price: 5000, features: ['Custom everything', 'Dedicated designer', 'Priority support', 'Advanced features', 'Training session', 'Quarterly strategy'] },
];

const ADDONS = [
  { id: 'maintenance', name: 'Website Maintenance', price: 150, unit: '/mo' },
  { id: 'seo', name: 'SEO Growth', price: 300, unit: '/mo' },
  { id: 'google_business', name: 'Google Business Optimization', price: 200, unit: 'setup' },
  { id: 'social_media', name: 'Social Media Setup', price: 250, unit: 'setup' },
  { id: 'lead_gen', name: 'Lead Generation Campaigns', price: 500, unit: '/mo' },
];

export default function ProposalBuilderPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState('starter');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [interestedLeads, setInterestedLeads] = useState<any[]>([]);

  const fetchProposals = async () => {
    setLoading(true);
    let query = (supabase as any).from('brandaro_proposals').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setProposals(data || []);
    setLoading(false);
  };

  const fetchInterestedLeads = async () => {
    const { data } = await (supabase as any)
      .from('brandaro_qualified_leads')
      .select('id, business_name, industry, city, state')
      .eq('lead_status', 'interested')
      .order('created_at', { ascending: false });
    setInterestedLeads(data || []);
  };

  useEffect(() => { fetchProposals(); }, [filter]);
  useEffect(() => { if (createOpen) fetchInterestedLeads(); }, [createOpen]);

  const createProposal = async () => {
    if (!selectedLeadId) { toast.error('Select a lead'); return; }
    const pkg = PACKAGES.find(p => p.tier === selectedTier)!;
    const addonItems = selectedAddons.map(id => ADDONS.find(a => a.id === id)!);
    const addonTotal = addonItems.reduce((sum, a) => sum + a.price, 0);

    // Find demo for this lead
    const { data: demo } = await (supabase as any)
      .from('brandaro_demo_sites')
      .select('id')
      .eq('lead_id', selectedLeadId)
      .eq('generation_status', 'ready')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { error } = await (supabase as any).from('brandaro_proposals').insert({
      lead_id: selectedLeadId,
      demo_id: demo?.id || null,
      package_tier: selectedTier,
      base_price: pkg.price,
      addons: addonItems.map(a => ({ id: a.id, name: a.name, price: a.price, unit: a.unit })),
      total_price: pkg.price + addonTotal,
      status: 'draft',
    });

    if (error) { toast.error(error.message); return; }
    toast.success('Proposal created');
    setCreateOpen(false);
    setSelectedAddons([]);
    fetchProposals();
  };

  const sendProposal = async (proposal: Proposal) => {
    await (supabase as any).from('brandaro_proposals')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', proposal.id);

    await (supabase as any).from('brandaro_qualified_leads')
      .update({ lead_status: 'proposal_sent' })
      .eq('id', proposal.lead_id);

    toast.success('Proposal sent');
    fetchProposals();
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/proposal/${token}`);
    toast.success('Proposal link copied');
  };

  const stats = {
    total: proposals.length,
    sent: proposals.filter(p => p.status === 'sent').length,
    viewed: proposals.filter(p => p.view_count > 0).length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    revenue: proposals.filter(p => p.status === 'accepted').reduce((s, p) => s + (p.total_price || 0), 0),
  };

  const tierColor = (t: string) => t === 'elite' ? 'destructive' : t === 'premium' ? 'default' : 'secondary';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proposal Builder</h1>
          <p className="text-muted-foreground">Create and track proposals with live tracking links</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Proposal</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Proposal</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>
                  {interestedLeads.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.business_name} — {l.city}, {l.state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                {PACKAGES.map(pkg => (
                  <Card
                    key={pkg.tier}
                    className={`cursor-pointer transition-all ${selectedTier === pkg.tier ? 'ring-2 ring-primary' : 'hover:bg-accent/50'}`}
                    onClick={() => setSelectedTier(pkg.tier)}
                  >
                    <CardContent className="p-3">
                      <p className="font-semibold text-sm">{pkg.name}</p>
                      <p className="text-lg font-bold text-primary">${pkg.price.toLocaleString()}</p>
                      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {pkg.features.slice(0, 3).map(f => <li key={f}>• {f}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Add-on Services</p>
                {ADDONS.map(addon => (
                  <div key={addon.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={selectedAddons.includes(addon.id)}
                      onCheckedChange={(c) => setSelectedAddons(prev =>
                        c ? [...prev, addon.id] : prev.filter(a => a !== addon.id)
                      )}
                    />
                    <span className="text-sm flex-1">{addon.name}</span>
                    <span className="text-sm text-muted-foreground">${addon.price}{addon.unit}</span>
                  </div>
                ))}
              </div>

              <Button onClick={createProposal} className="w-full">Create Proposal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: FileText },
          { label: 'Sent', value: stats.sent, icon: Send },
          { label: 'Viewed', value: stats.viewed, icon: Eye },
          { label: 'Accepted', value: stats.accepted, icon: DollarSign },
          { label: 'Revenue', value: `$${stats.revenue.toLocaleString()}`, icon: DollarSign },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Proposals</CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="viewed">Viewed</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No proposals yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Badge variant={tierColor(p.package_tier)}>{p.package_tier}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">${(p.total_price || p.base_price).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'accepted' ? 'default' : p.status === 'rejected' ? 'destructive' : 'outline'}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.view_count}</TableCell>
                    <TableCell>{p.sent_at ? new Date(p.sent_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => copyLink(p.tracking_token)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      {p.status === 'draft' && (
                        <Button size="sm" onClick={() => sendProposal(p)}>
                          <Send className="h-3 w-3 mr-1" /> Send
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
