import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
];

const PIPELINES = ['gasmask', 'brandaro', 'iclean', 'toptier', 'unforgettable', 'external'];

export default function DCCampaignBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    description: '',
    pipeline: '',
    agentId: '',
    maxConcurrent: '3',
    maxPerMinute: '5',
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
        <p className="text-sm text-muted-foreground">Create a new outbound campaign</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label>Campaign Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. March Reactivation — GasMask" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Campaign objective and notes" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Business Pipeline</Label>
              <Select value={form.pipeline} onValueChange={v => setForm(f => ({ ...f, pipeline: v }))}>
                <SelectTrigger><SelectValue placeholder="Select pipeline" /></SelectTrigger>
                <SelectContent>
                  {PIPELINES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>AI Agent</Label>
              <Select value={form.agentId} onValueChange={v => setForm(f => ({ ...f, agentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {AGENTS.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
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
          <Button onClick={() => createCampaign.mutate()} disabled={!form.name || createCampaign.isPending} className="w-full">
            {createCampaign.isPending ? 'Creating…' : 'Create Campaign'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
