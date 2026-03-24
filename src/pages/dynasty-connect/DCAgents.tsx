import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Brain, Play, BookOpen, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach', desc: 'Cold outreach, new business acquisition' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up', desc: 'Re-engagement, callback scheduling' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation', desc: 'Win-back dormant accounts' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check', desc: 'Wholesale stock & reorder calls' },
];

export default function DCAgents() {
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<any>(null);

  const { data: agentMetrics = [] } = useQuery({
    queryKey: ['dc-agent-call-metrics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('persona_id, outcome, duration_seconds, created_at')
        .limit(500);
      return data || [];
    },
  });

  const { data: playbookHistory = [] } = useQuery({
    queryKey: ['dc-playbook-history'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('playbook_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { data: dbAgents = [] } = useQuery({
    queryKey: ['dc-elevenlabs-agents'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('elevenlabs_agents')
        .select('agent_id, agent_name, is_active, script_template');
      return data || [];
    },
  });

  const triggerSelfLearn = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-self-learn');
      if (error) throw error;
      toast.success(`Self-learn: ${data?.status || 'done'} — ${data?.calls_analyzed || 0} calls analyzed`);
      queryClient.invalidateQueries({ queryKey: ['dc-playbook-history'] });
    } catch (e: any) {
      toast.error('Self-learn failed: ' + e.message);
    } finally {
      setTriggering(false);
    }
  };

  const getWeekCalls = (agentId: string) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return agentMetrics.filter((m: any) =>
      m.persona_id === agentId && new Date(m.created_at) >= weekAgo
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" /> AI Agent Center
          </h1>
          <p className="text-sm text-muted-foreground">4 ElevenLabs conversational agents — self-improving nightly</p>
        </div>
        <Button onClick={triggerSelfLearn} disabled={triggering}>
          <Play className="h-4 w-4 mr-2" />
          {triggering ? 'Running…' : 'Trigger Self-Learn'}
        </Button>
      </div>

      {/* Agent Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {AGENTS.map((agent) => {
          const allCalls = agentMetrics.filter((m: any) => m.persona_id === agent.id);
          const weekCalls = getWeekCalls(agent.id);
          const avgDuration = allCalls.length > 0
            ? Math.round(allCalls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / allCalls.length)
            : 0;
          const wins = allCalls.filter((c: any) => ['booked', 'interested', 'callback'].includes(c.outcome)).length;
          const convRate = allCalls.length > 0 ? ((wins / allCalls.length) * 100).toFixed(1) : '0';
          const dbAgent = dbAgents.find((a: any) => a.agent_id === agent.id);
          const isExpanded = expandedAgent === agent.id;

          return (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{agent.name}</span>
                  <Badge variant="outline" className={dbAgent?.is_active !== false ? 'text-green-500 border-green-500' : 'text-muted-foreground'}>
                    {dbAgent?.is_active !== false ? 'Live' : 'Inactive'}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{agent.desc}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold">{weekCalls.length}</p>
                    <p className="text-[10px] text-muted-foreground">This Week</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold">{allCalls.length}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold">{avgDuration}s</p>
                    <p className="text-[10px] text-muted-foreground">Avg Dur</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold">{convRate}%</p>
                    <p className="text-[10px] text-muted-foreground">Conv</p>
                  </div>
                </div>

                {/* Expandable playbook preview */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs justify-between"
                  onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                >
                  <span>Current Playbook</span>
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
                {isExpanded && (
                  <div className="bg-muted/30 p-3 rounded-lg text-xs max-h-40 overflow-auto font-mono whitespace-pre-wrap">
                    {dbAgent?.script_template || 'No playbook loaded yet. Run self-learn after completing real calls.'}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground font-mono truncate">{agent.id}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Playbook History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Playbook History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {playbookHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No playbook updates yet.</p>
              <p className="text-xs">The self-learn loop will populate this after analyzing real calls.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium text-right">Calls</th>
                    <th className="px-4 py-2 font-medium text-right hidden sm:table-cell">Wins</th>
                    <th className="px-4 py-2 font-medium text-right hidden sm:table-cell">Losses</th>
                    <th className="px-4 py-2 font-medium hidden md:table-cell">Top Insight</th>
                  </tr>
                </thead>
                <tbody>
                  {playbookHistory.map((entry: any) => (
                    <tr
                      key={entry.id}
                      className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedPlaybook(entry)}
                    >
                      <td className="px-4 py-2">{entry.run_date || new Date(entry.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{entry.calls_analyzed || 0}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-green-500 hidden sm:table-cell">{entry.wins || 0}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-500 hidden sm:table-cell">{entry.losses || 0}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[300px] hidden md:table-cell">
                        {entry.top_insight || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Playbook Detail Dialog */}
      <Dialog open={!!selectedPlaybook} onOpenChange={() => setSelectedPlaybook(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Playbook Update — {selectedPlaybook?.run_date || 'N/A'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <Badge>{selectedPlaybook?.calls_analyzed || 0} calls</Badge>
              <Badge variant="outline" className="text-green-500">{selectedPlaybook?.wins || 0} wins</Badge>
              <Badge variant="outline" className="text-red-500">{selectedPlaybook?.losses || 0} losses</Badge>
            </div>
            {selectedPlaybook?.top_insight && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Top Insight</p>
                <p className="text-sm">{selectedPlaybook.top_insight}</p>
              </div>
            )}
            {selectedPlaybook?.agents_updated && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Agents Updated</p>
                <div className="flex gap-1 flex-wrap">
                  {(Array.isArray(selectedPlaybook.agents_updated) ? selectedPlaybook.agents_updated : []).map((a: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">{a.agent_name || a}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
