import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Users, Target, TrendingUp, Brain, Clock, Activity } from 'lucide-react';

export default function DCCommandCenter() {
  const { data: liveCalls = 0 } = useQuery({
    queryKey: ['dc-live-calls'],
    queryFn: async () => {
      const { count } = await supabase
        .from('live_calls')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      return count || 0;
    },
    refetchInterval: 5000,
  });

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

  const { data: totalCampaigns = 0 } = useQuery({
    queryKey: ['dc-total-campaigns'],
    queryFn: async () => {
      const { count } = await supabase
        .from('ai_call_campaigns')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: latestPlaybook } = useQuery({
    queryKey: ['dc-latest-playbook'],
    queryFn: async () => {
      const { data } = await supabase
        .from('playbook_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: recentCalls = [] } = useQuery({
    queryKey: ['dc-recent-calls'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const agents = [
    { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
    { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
    { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
    { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Phone className="h-8 w-8 text-primary" />
          Dynasty Connect — Command Center
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered call center for all Dynasty businesses
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{liveCalls}</p>
                <p className="text-xs text-muted-foreground">Live Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Phone className="h-8 w-8 text-blue-500" />
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
              <Target className="h-8 w-8 text-orange-500" />
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
              <Users className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{totalCampaigns}</p>
                <p className="text-xs text-muted-foreground">Total Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agents + Latest Playbook */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" /> AI Agents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{agent.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{agent.id.slice(0, 20)}…</p>
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500">Active</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Latest Self-Learn
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestPlaybook ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge>{(latestPlaybook as any).run_date || 'N/A'}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {(latestPlaybook as any).calls_analyzed || 0} calls analyzed
                  </span>
                </div>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {(latestPlaybook as any).top_insight || 'No insight yet — waiting for first real calls.'}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No self-learn runs yet.</p>
                <p className="text-xs">Make real AI calls to populate the loop.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Recent AI Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No AI calls logged yet.</p>
              <p className="text-xs">Launch a campaign to start generating call data.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentCalls.map((call: any) => (
                <div key={call.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{call.phone_number || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {call.duration_seconds ? `${Math.round(call.duration_seconds / 60)}min` : '—'} · {call.outcome || 'pending'}
                    </p>
                  </div>
                  <Badge variant={call.outcome === 'booked' ? 'default' : 'outline'}>
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
