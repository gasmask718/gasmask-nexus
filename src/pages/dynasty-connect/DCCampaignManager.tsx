import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Phone, Target, Play, Pause, Rocket, Upload, Link2,
  Database, Clock, BarChart3, PhoneCall, PhoneOff, Calendar, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

const AGENT_TYPES = [
  { value: 'sales', label: '🎯 Sales Introduction', icon: Target },
  { value: 'followup', label: '🔄 Follow-up Call', icon: Phone },
  { value: 'reactivation', label: '♻️ Reactivation', icon: Zap },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const statusColor = (s: string) => {
  if (s === 'active') return 'bg-green-500/10 text-green-500 border-green-500';
  if (s === 'paused') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500';
  if (s === 'completed') return 'bg-blue-500/10 text-blue-500 border-blue-500';
  if (s === 'draft') return 'bg-muted text-muted-foreground';
  return '';
};

const outcomeColor = (o: string) => {
  if (o === 'appointment_set') return 'bg-green-500/10 text-green-500';
  if (o === 'interested') return 'bg-blue-500/10 text-blue-500';
  if (o === 'not_interested') return 'bg-red-500/10 text-red-500';
  if (o === 'voicemail_skipped') return 'bg-yellow-500/10 text-yellow-500';
  if (o === 'no_answer') return 'bg-muted text-muted-foreground';
  return 'bg-muted text-muted-foreground';
};

export default function DCCampaignManager() {
  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [form, setForm] = useState({
    name: '',
    agent_type: 'sales',
    calls_per_hour: 20,
    max_attempts: 2,
    start_time: '09:00',
    end_time: '20:00',
    active_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
  });

  // Fetch campaigns from dc_campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['dc-campaigns-local'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dc_campaigns' as any)
        .select('*')
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  // Fetch live call logs (real-time)
  const { data: recentCalls = [] } = useQuery({
    queryKey: ['dc-call-logs-live'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dc_call_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    refetchInterval: 5000,
  });

  // Fetch agents
  const { data: agents = [] } = useQuery({
    queryKey: ['dc-agents-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dc_agents' as any)
        .select('*')
        .eq('is_active', true);
      return (data || []) as any[];
    },
  });

  // Subscribe to realtime call logs
  useEffect(() => {
    const channel = supabase
      .channel('dc-call-logs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dc_call_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dc-call-logs-live'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Stats from call logs
  const totalCalls = recentCalls.length;
  const connected = recentCalls.filter((c: any) => c.answered_by === 'human').length;
  const voicemails = recentCalls.filter((c: any) => c.status === 'voicemail').length;
  const appointments = recentCalls.filter((c: any) => c.outcome === 'appointment_set').length;
  const avgDuration = recentCalls.filter((c: any) => c.duration_seconds).length > 0
    ? Math.round(recentCalls.filter((c: any) => c.duration_seconds).reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0) / recentCalls.filter((c: any) => c.duration_seconds).length)
    : 0;
  const successRate = totalCalls > 0 ? ((connected / totalCalls) * 100).toFixed(1) : '0';

  // Create campaign
  const createCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dc_campaigns' as any).insert({
        name: form.name,
        agent_type: form.agent_type,
        calls_per_hour: form.calls_per_hour,
        max_attempts: form.max_attempts,
        start_time: form.start_time,
        end_time: form.end_time,
        active_days: form.active_days,
        status: 'draft',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dc-campaigns-local'] });
      toast.success('Campaign created');
      setShowBuilder(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Update campaign status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('dc_campaigns' as any).update({ status } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dc-campaigns-local'] });
      toast.success('Campaign updated');
    },
  });

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      active_days: f.active_days.includes(day)
        ? f.active_days.filter(d => d !== day)
        : [...f.active_days, day],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" /> Outbound Call Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">AI-powered cold calling at scale</p>
        </div>
        <Button onClick={() => setShowBuilder(true)}>
          <Rocket className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Calls', value: totalCalls, icon: PhoneCall },
          { label: 'Connected', value: connected, icon: Phone },
          { label: 'VM Skipped', value: voicemails, icon: PhoneOff },
          { label: 'Appointments', value: appointments, icon: Calendar },
          { label: 'Avg Duration', value: `${avgDuration}s`, icon: Clock },
          { label: 'Success Rate', value: `${successRate}%`, icon: BarChart3 },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <stat.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No campaigns yet. Create one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2 font-medium">Campaign</th>
                    <th className="px-3 py-2 font-medium">Agent</th>
                    <th className="px-3 py-2 font-medium text-right">Leads</th>
                    <th className="px-3 py-2 font-medium text-right">Called</th>
                    <th className="px-3 py-2 font-medium text-right">Connected</th>
                    <th className="px-3 py-2 font-medium text-right">Rate</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c: any) => {
                    const rate = c.calls_made > 0 ? ((c.connected / c.calls_made) * 100).toFixed(1) : '—';
                    return (
                      <tr key={c.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="px-3 py-2 text-muted-foreground capitalize">{c.agent_type || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.total_leads || 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.calls_made || 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.connected || 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{rate}%</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Call Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live Call Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {recentCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No calls yet</p>
          ) : (
            recentCalls.map((call: any) => (
              <div key={call.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${
                    call.status === 'initiated' || call.status === 'ringing' ? 'bg-yellow-500 animate-pulse' :
                    call.status === 'answered' || call.status === 'in-progress' ? 'bg-green-500 animate-pulse' :
                    call.status === 'voicemail' ? 'bg-orange-500' :
                    'bg-muted-foreground'
                  }`} />
                  <div>
                    <p className="font-medium text-sm">
                      {call.lead_name || call.to_number || call.from_number || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {call.direction === 'inbound' ? '📥 Inbound' : '📤 Outbound'}
                      {call.agent_type ? ` · ${call.agent_type}` : ''}
                      {call.duration_seconds ? ` · ${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {call.outcome && (
                    <Badge variant="outline" className={outcomeColor(call.outcome)}>
                      {call.outcome.replace(/_/g, ' ')}
                    </Badge>
                  )}
                  <Badge variant="outline" className={
                    call.status === 'answered' ? 'bg-green-500/10 text-green-500' :
                    call.status === 'voicemail' ? 'bg-orange-500/10 text-orange-500' :
                    call.status === 'initiated' ? 'bg-yellow-500/10 text-yellow-500' :
                    ''
                  }>
                    {call.status === 'voicemail' ? '📱 VM' :
                     call.status === 'answered' ? '✅ Connected' :
                     call.status === 'initiated' ? '📞 Dialing' :
                     call.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Modal */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🚀 Launch New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. March Event Outreach"
              />
            </div>

            <div>
              <Label>Agent Type</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {AGENT_TYPES.map(at => (
                  <Button
                    key={at.value}
                    variant={form.agent_type === at.value ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => setForm(f => ({ ...f, agent_type: at.value }))}
                  >
                    {at.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Lead Source</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Button variant="outline" size="sm" className="text-xs">
                  <Upload className="h-3 w-3 mr-1" /> Upload CSV
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  <Link2 className="h-3 w-3 mr-1" /> Apollo.io
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  <Database className="h-3 w-3 mr-1" /> From CRM
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Active Days</Label>
              <div className="flex gap-1.5 mt-1">
                {DAYS.map(day => (
                  <Button
                    key={day}
                    variant={form.active_days.includes(day) ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-2.5"
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Calls Per Hour: {form.calls_per_hour}</Label>
              <Slider
                value={[form.calls_per_hour]}
                onValueChange={v => setForm(f => ({ ...f, calls_per_hour: v[0] }))}
                min={10}
                max={50}
                step={5}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>10</span><span>50</span>
              </div>
            </div>

            <div>
              <Label>Max Attempts Per Lead: {form.max_attempts}</Label>
              <Slider
                value={[form.max_attempts]}
                onValueChange={v => setForm(f => ({ ...f, max_attempts: v[0] }))}
                min={1}
                max={3}
                step={1}
                className="mt-2"
              />
            </div>

            <Button
              onClick={() => createCampaign.mutate()}
              disabled={!form.name || createCampaign.isPending}
              className="w-full"
            >
              <Rocket className="h-4 w-4 mr-2" />
              {createCampaign.isPending ? 'Creating…' : '🚀 Launch Campaign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
