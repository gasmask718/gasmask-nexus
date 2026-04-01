import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';

const BIZ_OPTIONS = [
  { value: 'gasmask', label: 'GasMask' }, { value: 'unforgettable_times', label: 'Unforgettable Times' },
  { value: 'real_estate', label: 'Real Estate' }, { value: 'surplus_funds', label: 'Surplus Funds' },
  { value: 'top_tier', label: 'Top Tier' }, { value: 'brandaro', label: 'Brandaro' },
  { value: 'playboxxx', label: 'PlayBoxxx' }, { value: 'iclean', label: 'iClean' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DCCampaignManager() {
  const qc = useQueryClient();
  const [selectedBiz, setSelectedBiz] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [callsPerHour, setCallsPerHour] = useState(20);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('20:00');
  const [activeDays, setActiveDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  const { data: agents = [] } = useQuery({ queryKey: ['dc-agents-campaign'], queryFn: async () => { const { data } = await (supabase as any).from('dc_agents').select('*').eq('is_active', true); return data || []; } });
  const { data: campaigns = [] } = useQuery({ queryKey: ['dc-campaigns'], queryFn: async () => { const { data } = await (supabase as any).from('dc_campaigns').select('*').order('created_at', { ascending: false }); return data || []; } });
  const { data: recentCalls = [] } = useQuery({ queryKey: ['dc-recent-calls'], queryFn: async () => { const { data } = await (supabase as any).from('dc_call_logs').select('*').order('created_at', { ascending: false }).limit(20); return data || []; }, refetchInterval: 5000 });
  const { data: callStats = [] } = useQuery({ queryKey: ['dc-call-stats'], queryFn: async () => { const { data } = await (supabase as any).from('dc_call_logs').select('status, duration_seconds'); return data || []; } });

  const filteredAgents = selectedBiz ? agents.filter((a: any) => a.business === selectedBiz) : agents;
  const totalCalls = callStats.length;
  const connected = callStats.filter((c: any) => ['connected', 'completed'].includes(c.status)).length;
  const voicemails = callStats.filter((c: any) => c.status === 'voicemail').length;
  const successRate = totalCalls > 0 ? Math.round((connected / totalCalls) * 100) : 0;

  const createCampaign = useMutation({
    mutationFn: async () => {
      const agent = agents.find((a: any) => a.agent_id === selectedAgent);
      const { error } = await (supabase as any).from('dc_campaigns').insert({ name: campaignName, business: selectedBiz, agent_id: selectedAgent, agent_name: agent?.name || '', calls_per_hour: callsPerHour, max_attempts: maxAttempts, start_time: startTime, end_time: endTime, active_days: activeDays, status: 'draft' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dc-campaigns'] }); toast.success('Campaign created!'); setCampaignName(''); },
    onError: (e: any) => toast.error(e.message),
  });

  const getStatusIcon = (s: string) => s === 'connected' || s === 'completed' ? '🟢' : s === 'voicemail' ? '📱' : s === 'no-answer' ? '🔴' : '⏳';

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">📞 Outbound Call Campaigns</h1><p className="text-sm text-muted-foreground">Launch AI cold calling across all businesses</p></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{ l: 'Total Calls', v: totalCalls }, { l: 'Connected', v: connected }, { l: 'Voicemails', v: voicemails }, { l: 'Success Rate', v: `${successRate}%` }, { l: 'Campaigns', v: campaigns.length }].map((s) => (
          <Card key={s.l}><CardContent className="pt-3 pb-2 text-center"><div className="text-xl font-bold">{s.v}</div><p className="text-xs text-muted-foreground">{s.l}</p></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Create Campaign</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Campaign Name</Label><Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Q2 Outreach..." /></div>
            <div><Label>Business</Label><Select value={selectedBiz} onValueChange={setSelectedBiz}><SelectTrigger><SelectValue placeholder="Select business" /></SelectTrigger><SelectContent>{BIZ_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Agent</Label><Select value={selectedAgent} onValueChange={setSelectedAgent}><SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger><SelectContent>{filteredAgents.map((a: any) => <SelectItem key={a.agent_id} value={a.agent_id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Calls/Hour: {callsPerHour}</Label><input type="range" min={5} max={50} value={callsPerHour} onChange={(e) => setCallsPerHour(Number(e.target.value))} className="w-full" /></div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div><Label>Start</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-28" /></div>
            <div><Label>End</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-28" /></div>
            <div><Label>Max Attempts</Label><div className="flex gap-1">{[1, 2, 3].map((n) => <Button key={n} size="sm" variant={maxAttempts === n ? 'default' : 'outline'} onClick={() => setMaxAttempts(n)}>{n}</Button>)}</div></div>
          </div>
          <div><Label>Active Days</Label><div className="flex gap-1 mt-1">{DAYS.map((d) => <Button key={d} size="sm" variant={activeDays.includes(d) ? 'default' : 'outline'} onClick={() => setActiveDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])} className="text-xs">{d}</Button>)}</div></div>
          <Button onClick={() => createCampaign.mutate()} disabled={!campaignName || !selectedBiz || !selectedAgent}>🚀 Launch Campaign</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Active Campaigns</CardTitle></CardHeader>
        <CardContent>
          {campaigns.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No campaigns yet</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Name</th><th className="pb-2">Business</th><th className="pb-2">Agent</th><th className="pb-2">Leads</th><th className="pb-2">Called</th><th className="pb-2">Status</th></tr></thead><tbody>
              {campaigns.map((c: any) => <tr key={c.id} className="border-b border-border/50"><td className="py-2 font-medium">{c.name}</td><td className="py-2">{c.business}</td><td className="py-2 text-xs">{c.agent_name || '-'}</td><td className="py-2">{c.total_leads}</td><td className="py-2">{c.calls_made}</td><td className="py-2"><Badge variant="outline" className="text-xs capitalize">{c.status}</Badge></td></tr>)}
            </tbody></table></div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Live Call Feed</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentCalls.map((call: any) => (
              <div key={call.id} className="flex items-center justify-between p-2 rounded border border-border text-sm">
                <div className="flex items-center gap-2"><span>{getStatusIcon(call.status)}</span><span className="font-medium">{call.lead_name || call.to_number}</span><span className="text-muted-foreground text-xs">{call.business}</span></div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {call.duration_seconds > 0 && <span>{Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, '0')}</span>}
                  <Badge variant="outline" className="text-xs capitalize">{call.status}</Badge>
                </div>
              </div>
            ))}
            {recentCalls.length === 0 && <p className="text-center text-muted-foreground py-4">No calls yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
