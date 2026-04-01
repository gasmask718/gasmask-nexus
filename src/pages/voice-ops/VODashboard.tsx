import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Brain, AlertTriangle, PhoneOutgoing, Plus, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function VODashboard() {
  const navigate = useNavigate();

  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ['vo-phone-numbers'],
    queryFn: async () => {
      const { data } = await supabase.from('business_phone_numbers').select('*');
      return data || [];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['vo-agents'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('elevenlabs_agents').select('*');
      return data || [];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['vo-assignments'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('voice_ops_number_assignments').select('*');
      return data || [];
    },
  });

  const activeAgents = agents.filter((a: any) => a.is_active);
  const fallbackErrors = assignments.filter((a: any) => a.status === 'fallback');
  const unassigned = phoneNumbers.length - assignments.filter((a: any) => a.agent_id).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Voice Operations Dashboard</h1>
        <p className="text-sm text-muted-foreground">Dynasty Connect + GasMask AI Voice Control</p>
      </div>

      {unassigned > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive font-medium">
            {unassigned} phone number(s) have no assigned agent
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="h-4 w-4" /> Total Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{phoneNumbers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" /> Active Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeAgents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Fallback Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{fallbackErrors.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/voice-ops/numbers')}>
          <Plus className="h-4 w-4 mr-2" /> Import Number
        </Button>
        <Button variant="outline" onClick={() => navigate('/voice-ops/outbound')}>
          <PhoneOutgoing className="h-4 w-4 mr-2" /> Trigger Outbound Call
        </Button>
        <Button variant="outline" onClick={() => navigate('/voice-ops/agents')}>
          <Zap className="h-4 w-4 mr-2" /> Test Call
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Agent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {agents.slice(0, 5).map((agent: any) => {
              const assignment = assignments.find((a: any) => a.agent_id === agent.id);
              return (
                <div key={agent.id} className="flex items-center justify-between p-2 rounded border border-border">
                  <div>
                    <span className="font-medium text-sm">{agent.agent_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{agent.script_label}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      assignment?.status === 'connected'
                        ? 'bg-green-500/10 text-green-500 border-green-500'
                        : assignment?.status === 'fallback'
                        ? 'bg-red-500/10 text-red-500 border-red-500'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {assignment?.status || 'unassigned'}
                  </Badge>
                </div>
              );
            })}
            {agents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No agents configured yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
