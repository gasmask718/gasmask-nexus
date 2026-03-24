import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Target, TrendingUp, Brain, Clock, Activity, Zap, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
];

const outcomeStyle = (o: string) => {
  switch (o) {
    case 'booked': return 'bg-green-500/10 text-green-500 border-green-500';
    case 'interested': return 'bg-amber-500/10 text-amber-500 border-amber-500';
    case 'callback': return 'bg-blue-500/10 text-blue-500 border-blue-500';
    case 'not-interested': case 'wrong-number': return 'bg-red-500/10 text-red-500 border-red-500';
    default: return 'bg-muted text-muted-foreground';
  }
};

export default function DCCommandCenter() {
  const queryClient = useQueryClient();
  const [triggeringSelfLearn, setTriggeringSelfLearn] = useState(false);

  // Live calls count — realtime
  const { data: liveCallCount = 0 } = useQuery({
    queryKey: ['dc-live-count'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('live_calls')
        .select('id', { count: 'exact', head: true })
        .in('state', ['queued', 'dialing', 'ringing', 'answered', 'ai_active', 'human_connected']);
      return count || 0;
    },
    refetchInterval: 5000,
  });

  // Calls today
  const { data: todayCalls = 0 } = useQuery({
    queryKey: ['dc-today-calls'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('ai_call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today);
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Active campaigns
  const { data: activeCampaigns = 0 } = useQuery({
    queryKey: ['dc-active-campaigns'],
    queryFn: async () => {
      const { count } = await supabase
        .from('ai_call_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      return count || 0;
    },
  });

  // Total ai_call_logs count
  const { data: totalCallLogs = 0 } = useQuery({
    queryKey: ['dc-total-call-logs'],
    queryFn: async () => {
      const { count } = await supabase
        .from('ai_call_logs')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    },
  });

  // Conversion rate
  const { data: conversionRate = '0' } = useQuery({
    queryKey: ['dc-conversion-rate'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('outcome')
        .limit(500);
      if (!data || data.length === 0) return '0';
      const wins = data.filter((c: any) => ['booked', 'interested', 'callback'].includes(c.outcome)).length;
      return ((wins / data.length) * 100).toFixed(1);
    },
  });

  // Active agents (which agents have live calls)
  const { data: activeAgentCalls = [] } = useQuery({
    queryKey: ['dc-active-agent-calls'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('live_calls')
        .select('agent_type, entity_name, run_id')
        .in('state', ['answered', 'ai_active', 'human_connected']);
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Latest playbook insight
  const { data: latestPlaybook } = useQuery({
    queryKey: ['dc-latest-playbook'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('playbook_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Recent 10 calls
  const { data: recentCalls = [] } = useQuery({
    queryKey: ['dc-recent-calls'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('id, phone_number, outcome, duration_seconds, created_at, persona_id')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    const ch1 = supabase
      .channel('dc-live-calls-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_calls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dc-live-count'] });
        queryClient.invalidateQueries({ queryKey: ['dc-active-agent-calls'] });
      })
      .subscribe();

    const ch2 = supabase
      .channel('dc-call-logs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_call_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dc-recent-calls'] });
        queryClient.invalidateQueries({ queryKey: ['dc-today-calls'] });
        queryClient.invalidateQueries({ queryKey: ['dc-total-call-logs'] });
        queryClient.invalidateQueries({ queryKey: ['dc-conversion-rate'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [queryClient]);

  const triggerSelfLearn = async () => {
    setTriggeringSelfLearn(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-self-learn');
      if (error) throw error;
      toast.success(`Self-learn: ${data?.status || 'done'} — ${data?.calls_analyzed || 0} calls analyzed`);
      queryClient.invalidateQueries({ queryKey: ['dc-latest-playbook'] });
    } catch (e: any) {
      toast.error('Self-learn failed: ' + e.message);
    } finally {
      setTriggeringSelfLearn(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Phone className="h-8 w-8 text-primary" />
          Dynasty Connect — Command Center
        </h1>
        <p className="text-muted-foreground mt-1">AI-powered call center for all Dynasty businesses</p>
      </div>

      {/* StatGrid — 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{liveCallCount}</p>
                <p className="text-xs text-muted-foreground">Live Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayCalls}</p>
                <p className="text-xs text-muted-foreground">Calls Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
                <p className="text-xs text-muted-foreground">Active Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Agents + Daily Insight + Self-Learn Status */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Active Agents Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" /> Active Agents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {AGENTS.map((agent) => {
              const isOnCall = activeAgentCalls.some((c: any) =>
                c.entity_name?.includes(agent.name) || c.run_id?.includes(agent.id)
              );
              return (
                <div key={agent.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-xs font-medium truncate">{agent.name}</span>
                  {isOnCall ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500 text-[10px]">On Call</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Idle</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Daily Insight Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" /> Daily Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestPlaybook?.top_insight ? (
              <div className="space-y-2">
                <p className="text-sm leading-relaxed">{latestPlaybook.top_insight}</p>
                <p className="text-[10px] text-muted-foreground">
                  {latestPlaybook.run_date || new Date(latestPlaybook.created_at).toLocaleDateString()} · {latestPlaybook.calls_analyzed || 0} calls analyzed
                </p>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No insights yet — waiting for call data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Self-Learn Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Self-Learn Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Run</span>
                <span className="font-medium">
                  {latestPlaybook ? new Date(latestPlaybook.created_at).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Cron</span>
                <span className="font-medium">2:00 AM ET</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Logs</span>
                <span className="font-medium">{totalCallLogs}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={triggerSelfLearn}
              disabled={triggeringSelfLearn}
            >
              {triggeringSelfLearn ? 'Running…' : 'Trigger Self-Learn Now'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Calls Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Recent AI Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No AI calls logged yet.</p>
              <p className="text-xs">Launch a campaign to start generating call data.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentCalls.map((call: any) => (
                <div key={call.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{call.phone_number || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(call.created_at).toLocaleString()} · {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}
                    </p>
                  </div>
                  <Badge variant="outline" className={outcomeStyle(call.outcome || '')}>
                    {call.outcome || 'pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
