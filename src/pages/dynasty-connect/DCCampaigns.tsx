import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Play, Pause, Archive, Plus, Search, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
];

const agentName = (id: string) => AGENTS.find(a => a.id === id)?.name || id?.slice(0, 16) || '—';

const statusColor = (s: string) => {
  if (s === 'active') return 'bg-green-500/10 text-green-500 border-green-500';
  if (s === 'paused') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500';
  if (s === 'completed') return 'bg-blue-500/10 text-blue-500 border-blue-500';
  if (s === 'archived') return 'bg-muted text-muted-foreground';
  return '';
};

export default function DCCampaigns() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [businessFilter, setBusinessFilter] = useState('all');
  const [showBuilder, setShowBuilder] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', pipeline: '', agentId: '',
    maxConcurrent: '3', maxPerMinute: '5', dialMode: 'ai',
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['dc-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ['dc-pipelines-list'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dc_business_pipelines')
        .select('id, business_name, pipeline_type');
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return campaigns.filter((c: any) => {
      const matchesSearch = !search || (c.name || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesBusiness = businessFilter === 'all' || (c.target_segment || '').toLowerCase().includes(businessFilter.toLowerCase());
      return matchesSearch && matchesStatus && matchesBusiness;
    });
  }, [campaigns, search, statusFilter, businessFilter]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('ai_call_campaigns').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dc-campaigns'] });
      toast.success('Campaign updated');
    },
  });

  const duplicateCampaign = useMutation({
    mutationFn: async (campaign: any) => {
      const { error } = await supabase.from('ai_call_campaigns').insert({
        name: `${campaign.name} (Copy)`,
        description: campaign.description,
        target_segment: campaign.target_segment,
        flow_id: campaign.flow_id,
        max_concurrent_calls: campaign.max_concurrent_calls,
        max_calls_per_minute: campaign.max_calls_per_minute,
        status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dc-campaigns'] });
      toast.success('Campaign duplicated');
    },
  });
  const createCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ai_call_campaigns').insert({
        name: form.name,
        description: form.description,
        target_segment: form.pipeline,
        flow_id: form.agentId || null,
        max_concurrent_calls: parseInt(form.maxConcurrent) || 3,
        max_calls_per_minute: parseInt(form.maxPerMinute) || 5,
        status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dc-campaigns'] });
      toast.success('Campaign created');
      setShowBuilder(false);
      setForm({ name: '', description: '', pipeline: '', agentId: '', maxConcurrent: '3', maxPerMinute: '5', dialMode: 'ai' });
    },
    onError: (e: any) => toast.error('Failed: ' + e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" /> Campaign Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {campaigns.length} campaigns · {campaigns.filter((c: any) => c.status === 'active').length} active
          </p>
        </div>
        <Button onClick={() => setShowBuilder(true)}><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search campaigns…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={businessFilter} onValueChange={setBusinessFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Businesses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Businesses</SelectItem>
            {pipelines.map((p: any) => <SelectItem key={p.id} value={p.business_name}>{p.business_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Campaign table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading campaigns…</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Business</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Agent</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Leads</th>
                  <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Completed</th>
                  <th className="px-4 py-3 font-medium text-right hidden lg:table-cell">Conv %</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => {
                  const convPct = c.completed_calls > 0
                    ? ((c.conversion_count || 0) / c.completed_calls * 100).toFixed(1)
                    : '—';
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium truncate max-w-[200px]">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.target_segment || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs">{agentName(c.flow_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusColor(c.status || 'draft')}>
                          {c.status || 'draft'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{c.total_targets || 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">{c.completed_calls || 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">{convPct}%</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.status === 'active' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateStatus.mutate({ id: c.id, status: 'paused' })}>
                              <Pause className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(c.status === 'paused' || c.status === 'draft') && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateStatus.mutate({ id: c.id, status: 'active' })}>
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {c.status !== 'archived' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateStatus.mutate({ id: c.id, status: 'archived' })}>
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateCampaign.mutate(c)} title="Duplicate">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No campaigns found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Campaign Builder Modal */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. March Reactivation — GasMask" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Campaign objective" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Business Pipeline</Label>
                <Select value={form.pipeline} onValueChange={v => setForm(f => ({ ...f, pipeline: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {pipelines.length > 0
                      ? pipelines.map((p: any) => <SelectItem key={p.id} value={p.business_name}>{p.business_name}</SelectItem>)
                      : ['gasmask', 'brandaro', 'iclean', 'toptier', 'unforgettable', 'external'].map(p =>
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        )
                    }
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>AI Agent</Label>
                <Select value={form.agentId} onValueChange={v => setForm(f => ({ ...f, agentId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {AGENTS.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Dial Mode</Label>
                <Select value={form.dialMode} onValueChange={v => setForm(f => ({ ...f, dialMode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">AI Only</SelectItem>
                    <SelectItem value="human">Human</SelectItem>
                    <SelectItem value="blended">Blended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Concurrent</Label>
                <Input type="number" value={form.maxConcurrent} onChange={e => setForm(f => ({ ...f, maxConcurrent: e.target.value }))} />
              </div>
              <div>
                <Label>Calls/Min</Label>
                <Input type="number" value={form.maxPerMinute} onChange={e => setForm(f => ({ ...f, maxPerMinute: e.target.value }))} />
              </div>
            </div>
            <Button onClick={() => createCampaign.mutate()} disabled={!form.name || createCampaign.isPending} className="w-full">
              {createCampaign.isPending ? 'Creating…' : 'Create Campaign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
