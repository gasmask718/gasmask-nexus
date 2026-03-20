import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Bot, Play, Pause, Zap, AlertTriangle, TrendingUp, Clock, Activity, Brain, Eye, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const TIER_COLORS: Record<number, string> = {
  1: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  2: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  3: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  4: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  5: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const TIER_LABELS: Record<number, string> = {
  1: 'CEO Command', 2: 'Brand Ops', 3: 'Brand Specific', 4: 'Operations', 5: 'Intelligence',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  normal: 'bg-muted text-muted-foreground border-border',
  low: 'bg-muted text-muted-foreground border-border',
};

const INSIGHT_ICONS: Record<string, typeof AlertTriangle> = {
  alert: AlertTriangle, risk: AlertTriangle, opportunity: TrendingUp,
  recommendation: Brain, trend: TrendingUp, anomaly: Eye,
};

export default function AgentCenterPage() {
  const queryClient = useQueryClient();
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [insightFilter, setInsightFilter] = useState('all');

  // Fetch agents
  const { data: agents = [] } = useQuery({
    queryKey: ['dynasty-agents'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dynasty_agents').select('*').order('tier', { ascending: true });
      return data || [];
    },
  });

  // Fetch insights
  const { data: insights = [] } = useQuery({
    queryKey: ['dynasty-insights', insightFilter],
    queryFn: async () => {
      let q = (supabase as any).from('dynasty_agent_insights').select('*')
        .eq('dismissed', false).order('created_at', { ascending: false }).limit(50);
      if (insightFilter === 'critical') q = q.eq('priority', 'critical');
      else if (insightFilter === 'high') q = q.eq('priority', 'high');
      else if (['opportunity', 'risk', 'alert', 'recommendation', 'trend'].includes(insightFilter))
        q = q.eq('insight_type', insightFilter);
      else if (['GasMask', 'Hot Mama Grabba', 'Grabba R Us', 'Hot Scalatti'].includes(insightFilter))
        q = q.eq('brand', insightFilter);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch runs
  const { data: runs = [] } = useQuery({
    queryKey: ['dynasty-runs'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dynasty_agent_runs').select('*')
        .order('started_at', { ascending: false }).limit(30);
      return data || [];
    },
  });

  // Stats
  const activeAgents = agents.filter((a: any) => a.is_active).length;
  const todayActions = runs.filter((r: any) => r.started_at && new Date(r.started_at).toDateString() === new Date().toDateString())
    .reduce((s: number, r: any) => s + (r.actions_taken || 0), 0);
  const pendingInsights = insights.filter((i: any) => i.action_required && !i.action_taken).length;
  const criticalAlerts = insights.filter((i: any) => i.priority === 'critical' && !i.dismissed).length;

  // Run agent
  const runAgent = useMutation({
    mutationFn: async (agentName: string) => {
      setRunningAgent(agentName);
      const { data, error } = await supabase.functions.invoke('dynasty-agent-runner', {
        body: { agent_name: agentName },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.agent} completed`, { description: data.summary });
      queryClient.invalidateQueries({ queryKey: ['dynasty-agents'] });
      queryClient.invalidateQueries({ queryKey: ['dynasty-insights'] });
      queryClient.invalidateQueries({ queryKey: ['dynasty-runs'] });
      setRunningAgent(null);
    },
    onError: (err: any) => {
      toast.error('Agent failed', { description: err.message });
      setRunningAgent(null);
    },
  });

  // Toggle agent
  const toggleAgent = async (agentName: string, isActive: boolean) => {
    await (supabase as any).from('dynasty_agents').update({ is_active: !isActive }).eq('agent_name', agentName);
    queryClient.invalidateQueries({ queryKey: ['dynasty-agents'] });
    toast.success(`${agentName} ${isActive ? 'paused' : 'activated'}`);
  };

  // Dismiss insight
  const dismissInsight = async (id: string) => {
    await (supabase as any).from('dynasty_agent_insights').update({ dismissed: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['dynasty-insights'] });
  };

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('agent-insights-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dynasty_agent_insights' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dynasty-insights'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dynasty_agent_runs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dynasty-runs'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  // Run all agents
  const runAll = async () => {
    const activeList = agents.filter((a: any) => a.is_active);
    for (const agent of activeList) {
      try {
        setRunningAgent(agent.agent_name);
        await supabase.functions.invoke('dynasty-agent-runner', { body: { agent_name: agent.agent_name } });
        toast.success(`${agent.agent_name} complete`);
      } catch {
        toast.error(`${agent.agent_name} failed`);
      }
    }
    setRunningAgent(null);
    queryClient.invalidateQueries({ queryKey: ['dynasty-agents'] });
    queryClient.invalidateQueries({ queryKey: ['dynasty-insights'] });
    queryClient.invalidateQueries({ queryKey: ['dynasty-runs'] });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-7 w-7 text-purple-400" />
          Dynasty AI Agent Network
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {agents.length} Claude agents running your business autonomously
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{activeAgents}</div>
            <div className="text-xs text-muted-foreground">Active Agents</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{todayActions}</div>
            <div className="text-xs text-muted-foreground">Actions Today</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{pendingInsights}</div>
            <div className="text-xs text-muted-foreground">Insights Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{criticalAlerts}</div>
            <div className="text-xs text-muted-foreground">Critical Alerts</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-3 flex items-center justify-center">
            <Button size="sm" onClick={runAll} disabled={!!runningAgent} className="w-full gap-1">
              {runningAgent ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Run All Agents
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="insights">Insights{pendingInsights > 0 ? ` (${pendingInsights})` : ''}</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
        </TabsList>

        {/* AGENTS TAB */}
        <TabsContent value="agents">
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map(tier => {
              const tierAgents = agents.filter((a: any) => a.tier === tier);
              if (!tierAgents.length) return null;
              return (
                <div key={tier}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Badge variant="outline" className={TIER_COLORS[tier]}>Tier {tier}</Badge>
                    {TIER_LABELS[tier]}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {tierAgents.map((agent: any) => (
                      <Card key={agent.id} className={`transition-all ${!agent.is_active ? 'opacity-50' : ''}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-sm">{agent.agent_name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{agent.agent_type}</div>
                            </div>
                            <Badge variant="outline" className={agent.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground'}>
                              {agent.is_active ? 'Active' : 'Paused'}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {(agent.brands || []).map((b: string) => (
                              <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{b}</span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {agent.last_run_at ? formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true }) : 'Never'}
                            </span>
                            <span>{agent.run_schedule}</span>
                          </div>

                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1"
                              disabled={runningAgent === agent.agent_name}
                              onClick={() => runAgent.mutate(agent.agent_name)}>
                              {runningAgent === agent.agent_name
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Play className="h-3 w-3" />}
                              Run
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => toggleAgent(agent.agent_name, agent.is_active)}>
                              {agent.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* INSIGHTS TAB */}
        <TabsContent value="insights">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {['all', 'critical', 'high', 'opportunity', 'risk', 'alert', 'recommendation',
                'GasMask', 'Hot Mama Grabba', 'Grabba R Us', 'Hot Scalatti'].map(f => (
                <Button key={f} size="sm" variant={insightFilter === f ? 'default' : 'outline'}
                  className="h-7 text-xs capitalize" onClick={() => setInsightFilter(f)}>
                  {f}
                </Button>
              ))}
            </div>

            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {insights.map((insight: any) => {
                  const Icon = INSIGHT_ICONS[insight.insight_type] || Brain;
                  return (
                    <Card key={insight.id} className={`${insight.priority === 'critical' ? 'border-l-2 border-l-red-500' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${insight.priority === 'critical' ? 'text-red-400' : 'text-muted-foreground'}`} />
                              <span className="font-medium text-sm truncate">{insight.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{insight.body}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{insight.agent_name}</span>
                              {insight.brand && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{insight.brand}</span>
                              )}
                              <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[insight.priority]}`}>
                                {insight.priority}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(insight.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6 text-xs flex-shrink-0" onClick={() => dismissInsight(insight.id)}>
                            Dismiss
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {insights.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">No insights yet. Run an agent to generate intelligence.</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* RUNS TAB */}
        <TabsContent value="runs">
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {runs.map((run: any) => (
                <Card key={run.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {run.status === 'completed' ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          : run.status === 'failed' ? <XCircle className="h-3.5 w-3.5 text-red-400" />
                          : <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
                        <span className="font-medium text-sm">{run.agent_name}</span>
                        <Badge variant="outline" className="text-[10px]">{run.status}</Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                      </span>
                    </div>
                    {run.summary && <p className="text-xs text-muted-foreground mt-1.5">{run.summary}</p>}
                    <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>⚡ {run.actions_taken || 0} actions</span>
                      <span>🎯 {run.insights_generated || 0} insights</span>
                      <span>🚚 {run.triggers_fired || 0} triggers</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {runs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">No runs yet.</div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* BRANDS TAB */}
        <TabsContent value="brands">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'GasMask', color: 'emerald', desc: 'Tobacco & grabba distribution' },
              { name: 'Hot Mama Grabba', color: 'red', desc: 'Premium female-targeted grabba' },
              { name: 'Grabba R Us', color: 'amber', desc: 'Wholesale grabba' },
              { name: 'Hot Scalatti', color: 'purple', desc: 'Premium brand (launch phase)' },
            ].map(brand => {
              const brandInsights = insights.filter((i: any) => i.brand === brand.name);
              const brandAgents = agents.filter((a: any) => (a.brands || []).includes(brand.name));
              const latestInsight = brandInsights[0];
              return (
                <Card key={brand.name} className={`border-t-2 border-t-${brand.color}-500`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {brand.name}
                      <Badge variant="outline">{brandAgents.length} agents</Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{brand.desc}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {brandInsights.length} insights • {brandInsights.filter((i: any) => i.priority === 'critical').length} critical
                    </div>
                    {latestInsight ? (
                      <div className="p-2 rounded bg-muted/50 text-xs">
                        <div className="font-medium">{latestInsight.title}</div>
                        <div className="text-muted-foreground mt-0.5 line-clamp-2">{latestInsight.body}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">No insights yet</div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
