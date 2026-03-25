import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Phone, Mic, AlertTriangle, Brain, Zap, Sun, Volume2, User,
  PhoneCall, PhoneOff, BarChart3, Clock, Target, CheckCircle2, Loader2
} from 'lucide-react';

const AMBER = '#E8A317';

const OBJECTION_LIBRARY = [
  { keyword: 'too expensive', response: '"Actually, most homeowners go solar with $0 down. Your monthly payment is typically less than your current electric bill."' },
  { keyword: 'not interested', response: '"I hear you. Before you go — did you know homeowners in your area are saving $150-300/month? It literally costs nothing to find out your number."' },
  { keyword: 'need to think', response: '"Absolutely, take your time. Just so you know, the federal tax credit drops next quarter. Can I send you the details?"' },
  { keyword: 'renting', response: '"Got it — the program is only for homeowners. Do you own any other property?"' },
  { keyword: 'already have solar', response: '"Great! We help existing solar owners optimize and expand their systems for even more savings."' },
];

export default function SolarLiveCallAssist() {
  const queryClient = useQueryClient();
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);

  // Ready-to-call leads
  const { data: callQueue = [] } = useQuery({
    queryKey: ['solar-call-queue'],
    queryFn: async () => {
      const { data } = await supabase
        .from('solar_leads')
        .select('id, full_name, phone, city, state, monthly_bill_range, lead_score, status')
        .in('status', ['new', 'contacted'])
        .not('phone', 'is', null)
        .order('lead_score', { ascending: false })
        .limit(30);
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Active/recent calls from live_calls
  const { data: liveCalls = [] } = useQuery({
    queryKey: ['solar-live-calls-monitor'],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_calls' as any)
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Recent call results
  const { data: recentCalls = [] } = useQuery({
    queryKey: ['solar-recent-calls'],
    queryFn: async () => {
      const { data } = await supabase
        .from('solar_interactions')
        .select('*, solar_leads(full_name, phone, lead_score)')
        .in('interaction_type', ['call', 'call_result'])
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Call stats
  const { data: stats } = useQuery({
    queryKey: ['solar-call-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const [totalRes, answeredRes, interestedRes] = await Promise.all([
        supabase.from('solar_interactions').select('id', { count: 'exact', head: true })
          .eq('interaction_type', 'call').gte('created_at', today),
        supabase.from('solar_interactions').select('id', { count: 'exact', head: true })
          .eq('interaction_type', 'call_result').gte('created_at', today),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'qualified'),
      ]);
      return {
        callsToday: totalRes.count || 0,
        answered: answeredRes.count || 0,
        interested: interestedRes.count || 0,
      };
    },
    refetchInterval: 15000,
  });

  const activeCalls = liveCalls.filter((c: any) => c.status === 'active' || c.status === 'initiated' || c.status === 'ringing');

  // Initiate call mutation
  const initCall = useMutation({
    mutationFn: async (leadId: string) => {
      setCallingLeadId(leadId);
      const { data, error } = await supabase.functions.invoke('solar-call-initiate', {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Call failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`📞 Call initiated to ${data.lead_name}`, { description: `SID: ${data.call_sid?.slice(-8)}` });
      queryClient.invalidateQueries({ queryKey: ['solar-call-queue'] });
      queryClient.invalidateQueries({ queryKey: ['solar-live-calls-monitor'] });
      setCallingLeadId(null);
    },
    onError: (err: any) => {
      toast.error('Call failed', { description: err.message });
      setCallingLeadId(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" style={{ color: AMBER }} />
            Floor 5 — AI Call Center
          </h1>
          <p className="text-sm text-muted-foreground">Live AI calling engine — Twilio + ElevenLabs</p>
        </div>
        <Badge variant="outline" className="text-green-400 border-green-400 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block mr-1.5" />
          ENGINE LIVE
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Active Now', value: activeCalls.length, icon: PhoneCall, color: 'text-green-500', pulse: activeCalls.length > 0 },
          { label: 'Queue', value: callQueue.length, icon: Target, color: 'text-blue-500' },
          { label: 'Calls Today', value: stats?.callsToday || 0, icon: Phone, color: 'text-foreground' },
          { label: 'Answered', value: stats?.answered || 0, icon: CheckCircle2, color: 'text-amber-500' },
          { label: 'Interested', value: stats?.interested || 0, icon: Zap, color: 'text-green-500' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {s.pulse && <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="queue">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="queue">📋 Call Queue</TabsTrigger>
          <TabsTrigger value="active">🔴 Active</TabsTrigger>
          <TabsTrigger value="history">📜 History</TabsTrigger>
          <TabsTrigger value="objections">🧠 Objections</TabsTrigger>
        </TabsList>

        {/* Call Queue */}
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Leads Ready for AI Call</span>
                <Badge variant="secondary">{callQueue.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {callQueue.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No leads in queue</p>
                  ) : callQueue.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{lead.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.phone} · {lead.city}{lead.state ? `, ${lead.state}` : ''}
                          {lead.monthly_bill_range ? ` · $${lead.monthly_bill_range}/mo` : ''}
                        </p>
                      </div>
                      {lead.lead_score != null && (
                        <Badge variant="outline" className={`mr-2 text-xs ${
                          lead.lead_score >= 70 ? 'text-green-500 border-green-500/30' :
                          lead.lead_score >= 40 ? 'text-amber-500 border-amber-500/30' :
                          'text-muted-foreground'
                        }`}>
                          {lead.lead_score}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        className="gap-1.5"
                        style={{ backgroundColor: AMBER }}
                        disabled={callingLeadId === lead.id || initCall.isPending}
                        onClick={() => initCall.mutate(lead.id)}
                      >
                        {callingLeadId === lead.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Phone className="h-3 w-3" />
                        )}
                        Call
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Calls */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-green-500" />
                Active Calls ({activeCalls.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeCalls.length === 0 ? (
                <div className="py-12 text-center">
                  <Phone className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No active calls</p>
                  <p className="text-xs text-muted-foreground">Start a call from the queue tab</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCalls.map((call: any) => (
                    <div key={call.id} className="p-4 rounded-lg border-2 border-green-500/30 bg-green-500/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                          <span className="font-medium text-sm">LIVE — {call.to_number || 'Unknown'}</span>
                        </div>
                        <Badge className="bg-green-500/20 text-green-500 border-green-500">Active</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>From: {call.from_number}</span>
                        <span>SID: {(call.provider_call_sid || '').slice(-8)}</span>
                        <span>Started: {new Date(call.started_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Call Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {recentCalls.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No calls recorded yet</p>
                  ) : recentCalls.map((call: any) => (
                    <div key={call.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/30">
                      <Phone className="h-4 w-4 flex-shrink-0" style={{ color: AMBER }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{call.solar_leads?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">{call.summary || 'Call completed'}</p>
                      </div>
                      {call.metadata?.intent_score != null && (
                        <Badge variant="outline" className="text-xs">
                          Intent: {call.metadata.intent_score}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Objection Library */}
        <TabsContent value="objections">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" style={{ color: AMBER }} />
                AI Objection Handling Library
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {OBJECTION_LIBRARY.map((obj, i) => (
                <div key={i} className="p-3 rounded-lg border border-border/50">
                  <Badge variant="outline" className="text-red-400 border-red-400 text-xs mb-2">
                    "{obj.keyword}"
                  </Badge>
                  <p className="text-sm text-muted-foreground italic">{obj.response}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
