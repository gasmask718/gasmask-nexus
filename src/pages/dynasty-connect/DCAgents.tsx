import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Play, BookOpen, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach', desc: 'Cold outreach, new business acquisition' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up', desc: 'Re-engagement, callback scheduling' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation', desc: 'Win-back dormant accounts' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check', desc: 'Wholesale stock & reorder calls' },
];

export default function DCAgents() {
  const [triggering, setTriggering] = useState(false);

  const { data: playbookHistory = [] } = useQuery({
    queryKey: ['dc-playbook-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('playbook_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: agentMetrics = [] } = useQuery({
    queryKey: ['dc-agent-call-metrics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('persona_id, outcome, duration_seconds')
        .limit(500);
      return data || [];
    },
  });

  const triggerSelfLearn = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-self-learn');
      if (error) throw error;
      toast.success(`Self-learn: ${data?.status || 'done'} — ${data?.calls_analyzed || 0} calls analyzed`);
    } catch (e: any) {
      toast.error('Self-learn failed: ' + e.message);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
          const calls = agentMetrics.filter((m: any) => m.persona_id === agent.id);
          const avgDuration = calls.length > 0
            ? Math.round(calls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / calls.length)
            : 0;
          const wins = calls.filter((c: any) => ['booked', 'interested', 'callback'].includes(c.outcome)).length;

          return (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{agent.name}</span>
                  <Badge variant="outline" className="text-green-500 border-green-500">Live</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{agent.desc}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold">{calls.length}</p>
                    <p className="text-xs text-muted-foreground">Total Calls</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold">{wins}</p>
                    <p className="text-xs text-muted-foreground">Wins</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold">{avgDuration}s</p>
                    <p className="text-xs text-muted-foreground">Avg Duration</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 font-mono truncate">{agent.id}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Playbook History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Playbook History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {playbookHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No playbook updates yet.</p>
              <p className="text-xs">The self-learn loop will populate this after analyzing real calls.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {playbookHistory.map((entry: any) => (
                <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge>{entry.run_date || new Date(entry.created_at).toLocaleDateString()}</Badge>
                    <span className="text-xs text-muted-foreground">{entry.calls_analyzed || 0} calls</span>
                  </div>
                  {entry.top_insight && (
                    <p className="text-sm bg-muted/50 p-3 rounded">{entry.top_insight}</p>
                  )}
                  {entry.agents_updated && (
                    <div className="flex gap-1 flex-wrap">
                      {(Array.isArray(entry.agents_updated) ? entry.agents_updated : []).map((a: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{a.agent_name || a}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
