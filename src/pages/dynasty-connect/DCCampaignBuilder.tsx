import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Zap, Upload, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
];

export default function DCCampaignBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    pipeline: '',
    agentId: '',
    maxConcurrent: '3',
    maxPerMinute: '5',
    useExistingLeads: true,
    schedule: 'now',
  });

  // Load business pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ['dc-builder-pipelines'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dc_business_pipelines')
        .select('*')
        .order('business_name');
      return data || [];
    },
  });

  // Count available leads for selected pipeline
  const { data: leadCount = 0 } = useQuery({
    queryKey: ['dc-lead-count', form.pipeline],
    enabled: !!form.pipeline,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('dc_leads')
        .select('*', { count: 'exact', head: true })
        .eq('business_name', form.pipeline)
        .eq('status', 'new');
      return count ?? 0;
    },
  });

  // Auto-suggest agent when pipeline is selected
  const handlePipelineChange = (val: string) => {
    setForm(f => ({ ...f, pipeline: val }));
    const pipe = pipelines.find((p: any) => p.business_name === val);
    if (pipe?.default_agent_id) {
      setForm(f => ({ ...f, agentId: pipe.default_agent_id }));
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form.pipeline) return;
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) { toast.error('CSV needs header + data'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const obj: any = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
        const phone = obj.phone || obj.phone_number || obj.mobile || '';
        if (phone) {
          rows.push({
            business_name: form.pipeline,
            first_name: obj.first_name || obj.firstname || obj.name?.split(' ')[0] || '',
            last_name: obj.last_name || obj.lastname || '',
            phone,
            email: obj.email || '',
            address: obj.address || '',
            city: obj.city || '',
            state: obj.state || '',
            zip: obj.zip || '',
            status: 'new',
            lead_source: 'csv_upload',
          });
        }
      }
      for (let i = 0; i < rows.length; i += 100) {
        await (supabase as any).from('dc_leads').insert(rows.slice(i, i + 100));
      }
      toast.success(`Uploaded ${rows.length} leads`);
      queryClient.invalidateQueries({ queryKey: ['dc-lead-count', form.pipeline] });
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const createCampaign = useMutation({
    mutationFn: async () => {
      // Create campaign
      const { data: campaign, error } = await supabase.from('ai_call_campaigns').insert({
        name: form.name || `${form.pipeline} — ${new Date().toLocaleDateString()}`,
        description: form.description,
        target_segment: form.pipeline,
        flow_id: form.agentId || null,
        max_concurrent_calls: parseInt(form.maxConcurrent) || 3,
        max_calls_per_minute: parseInt(form.maxPerMinute) || 5,
        status: form.schedule === 'now' ? 'active' : 'draft',
        total_targets: form.useExistingLeads ? leadCount : 0,
      }).select('id').single();
      if (error) throw error;

      // Queue existing leads
      if (form.useExistingLeads && leadCount > 0) {
        await (supabase as any)
          .from('dc_leads')
          .update({ campaign_id: campaign.id, status: 'queued', updated_at: new Date().toISOString() })
          .eq('business_name', form.pipeline)
          .eq('status', 'new');
      }
      return campaign.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dc-campaigns'] });
      toast.success('Campaign created');
      navigate('/dynasty-connect/campaigns');
    },
    onError: (e: any) => toast.error('Failed: ' + e.message),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6" /> Campaign Builder
        </h1>
        <p className="text-sm text-muted-foreground">Create a new outbound campaign with lead flow integration</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Business Pipeline Selection */}
          <div>
            <Label>Business Pipeline</Label>
            <Select value={form.pipeline} onValueChange={handlePipelineChange}>
              <SelectTrigger><SelectValue placeholder="Select business" /></SelectTrigger>
              <SelectContent>
                {pipelines.map((p: any) => (
                  <SelectItem key={p.id} value={p.business_name}>{p.business_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lead Source */}
          {form.pipeline && (
            <div className="p-3 rounded-lg bg-muted/30 border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#0F6E56]" />
                  <span className="text-sm font-medium">Available Leads</span>
                  <Badge variant="secondary">{leadCount} new</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Use existing</Label>
                  <Switch checked={form.useExistingLeads} onCheckedChange={v => setForm(f => ({ ...f, useExistingLeads: v }))} />
                </div>
              </div>
              {!form.useExistingLeads && (
                <div>
                  <input type="file" ref={fileRef} accept=".csv" className="hidden" onChange={handleCSVUpload} />
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                    Upload CSV Leads
                  </Button>
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Campaign Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={form.pipeline ? `${form.pipeline} — ${new Date().toLocaleDateString()}` : 'e.g. March Reactivation'} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Campaign objective and notes" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>AI Agent</Label>
              <Select value={form.agentId} onValueChange={v => setForm(f => ({ ...f, agentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {AGENTS.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Schedule</Label>
              <Select value={form.schedule} onValueChange={v => setForm(f => ({ ...f, schedule: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">Launch Now</SelectItem>
                  <SelectItem value="draft">Save as Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Max Concurrent Calls</Label>
              <Input type="number" value={form.maxConcurrent} onChange={e => setForm(f => ({ ...f, maxConcurrent: e.target.value }))} />
            </div>
            <div>
              <Label>Max Calls / Minute</Label>
              <Input type="number" value={form.maxPerMinute} onChange={e => setForm(f => ({ ...f, maxPerMinute: e.target.value }))} />
            </div>
          </div>
          <Button onClick={() => createCampaign.mutate()} disabled={!form.pipeline || createCampaign.isPending} className="w-full">
            {createCampaign.isPending ? 'Creating…' : `🚀 ${form.schedule === 'now' ? 'Launch Campaign' : 'Save Draft'}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
