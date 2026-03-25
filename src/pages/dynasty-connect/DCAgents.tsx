import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Brain, Play, BookOpen, Clock, Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function DCAgents() {
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState(false);
  const [playbookAgentId, setPlaybookAgentId] = useState<string | null>(null);

  // ── Load agents from DB ──
  const { data: agents = [] } = useQuery({
    queryKey: ['dc-elevenlabs-agents'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('elevenlabs_agents')
        .select('*')
        .order('sort_order');
      return data || [];
    },
  });

  // ── Call metrics for all agents (last 30 days) ──
  const { data: callMetrics = [] } = useQuery({
    queryKey: ['dc-agent-call-metrics'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase
        .from('ai_call_logs')
        .select('persona_id, outcome, created_at')
        .gte('created_at', thirtyDaysAgo);
      return data || [];
    },
  });

  // ── Latest playbook run ──
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

  // ── Playbook history for selected agent ──
  const { data: agentPlaybooks = [], isLoading: loadingPlaybooks } = useQuery({
    queryKey: ['dc-agent-playbooks', playbookAgentId],
    queryFn: async () => {
      if (!playbookAgentId) return [];
      const { data } = await (supabase as any)
        .from('playbook_history')
        .select('*')
        .eq('agent_id', playbookAgentId)
        .order('date', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!playbookAgentId,
  });

  const triggerSelfLearn = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-self-learn');
      if (error) throw error;
      toast.success(data?.top_insight || `Self-learn complete — ${data?.calls_analyzed || 0} calls analyzed`);
      queryClient.invalidateQueries({ queryKey: ['dc-latest-playbook'] });
      queryClient.invalidateQueries({ queryKey: ['dc-agent-call-metrics'] });
    } catch (e: any) {
      toast.error('Self-learn failed: ' + e.message);
    } finally {
      setTriggering(false);
    }
  };

  const toggleAgent = async (agentId: string, currentActive: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('elevenlabs_agents')
        .update({ is_active: !currentActive })
        .eq('agent_id', agentId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['dc-elevenlabs-agents'] });
      toast.success(`Agent ${!currentActive ? 'activated' : 'deactivated'}`);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    }
  };

  const getWeekCalls = (agentId: string) => {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    return callMetrics.filter((m: any) =>
      m.persona_id === agentId && new Date(m.created_at) >= weekAgo
    );
  };

  const getWinRate = (agentId: string) => {
    const calls = callMetrics.filter((m: any) => m.persona_id === agentId);
    if (calls.length === 0) return '0';
    const wins = calls.filter((c: any) =>
      ['booked', 'interested', 'reached', 'callback_requested'].includes(c.outcome)
    ).length;
    return ((wins / calls.length) * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* ── Self-Learn Intelligence Section ── */}
      <Card className="border-[#0F6E56]/30 bg-[#0F6E56]/[0.08]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#0F6E56]" /> Self-Learn Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This engine analyzes every call nightly and updates all agent prompts automatically
          </p>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Last run:{' '}
              <span className="text-foreground font-medium">
                {latestPlaybook
                  ? (latestPlaybook.date || new Date(latestPlaybook.created_at).toLocaleDateString())
                  : 'Never'}
              </span>
              <span className="ml-3">Next run: 2am ET</span>
            </div>
            <Button
              size="sm"
              className="bg-[#0F6E56] hover:bg-[#0F6E56]/80 text-white"
              onClick={triggerSelfLearn}
              disabled={triggering}
            >
              {triggering ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Running…</>
              ) : (
                <><Zap className="h-3 w-3 mr-1" /> Trigger Analysis Now</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-[#0F6E56]" /> AI Agent Center
        </h1>
        <p className="text-sm text-muted-foreground">4 ElevenLabs conversational agents — self-improving nightly</p>
      </div>

      {/* ── Agent Cards ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {agents.map((agent: any) => {
          const weekCalls = getWeekCalls(agent.agent_id || agent.elevenlabs_agent_id);
          const winRate = getWinRate(agent.agent_id || agent.elevenlabs_agent_id);
          const agentElevenId = agent.elevenlabs_agent_id || agent.agent_id || '';
          const shortId = agentElevenId.slice(-12);

          return (
            <Card key={agent.id || agentElevenId} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{agent.agent_name}</CardTitle>
                  <Switch
                    checked={agent.is_active !== false}
                    onCheckedChange={() => toggleAgent(agentElevenId, agent.is_active !== false)}
                  />
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'w-fit text-[10px]',
                    agent.is_active !== false ? 'text-green-500 border-green-500' : 'text-muted-foreground'
                  )}
                >
                  {agent.is_active !== false ? 'Active' : 'Inactive'}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agent ID</span>
                    <span className="font-mono text-muted-foreground">…{shortId}</span>
                  </div>
                  {agent.script_label && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Script</span>
                      <span className="font-medium">{agent.script_label}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold font-mono">{weekCalls.length}</p>
                    <p className="text-[10px] text-muted-foreground">Calls This Week</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold font-mono">{winRate}%</p>
                    <p className="text-[10px] text-muted-foreground">Win Rate</p>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setPlaybookAgentId(agentElevenId)}
                >
                  <BookOpen className="h-3 w-3 mr-1" /> View Playbook History
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* ── Playbook History Modal ── */}
      <Dialog open={!!playbookAgentId} onOpenChange={() => setPlaybookAgentId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Playbook History
            </DialogTitle>
          </DialogHeader>
          {loadingPlaybooks ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agentPlaybooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No playbook updates for this agent yet.</p>
              <p className="text-xs">Run self-learn after completing real calls.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agentPlaybooks.map((entry: any) => (
                <div key={entry.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {entry.date || new Date(entry.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{entry.calls_analyzed || 0} calls</Badge>
                      <Badge variant="outline" className="text-[10px] text-green-500 border-green-500">{entry.wins_analyzed || entry.wins || 0}W</Badge>
                      <Badge variant="outline" className="text-[10px] text-red-500 border-red-500">{entry.losses_analyzed || entry.losses || 0}L</Badge>
                    </div>
                  </div>
                  {entry.top_insight && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{entry.top_insight}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
