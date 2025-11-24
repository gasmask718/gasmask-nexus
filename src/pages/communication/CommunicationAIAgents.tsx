import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Bot } from 'lucide-react';
import { departmentThemes } from '@/config/departmentThemes';
import { toast } from 'sonner';
import CommunicationLayout from './CommunicationLayout';

const CommunicationAIAgents = () => {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const theme = departmentThemes.communication;

  const { data: agents, isLoading } = useQuery({
    queryKey: ['communication-ai-agents', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data } = await supabase
        .from('call_center_ai_agents')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .order('name');

      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  const toggleAgentMutation = useMutation({
    mutationFn: async ({ agentId, isActive }: { agentId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('call_center_ai_agents')
        .update({ is_active: isActive })
        .eq('id', agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Agent status updated');
      queryClient.invalidateQueries({ queryKey: ['communication-ai-agents'] });
    },
    onError: () => {
      toast.error('Failed to update agent status');
    },
  });

  return (
    <CommunicationLayout
      title="AI Agents"
      subtitle="Configure and manage AI assistants for automated communication"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Active AI Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading agents...</p>
            ) : agents && agents.length > 0 ? (
              <div className="space-y-4">
                {agents.map((agent) => (
                  <div key={agent.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Bot className="h-5 w-5" style={{ color: theme.color }} />
                          <h3 className="font-semibold text-lg">{agent.name}</h3>
                          <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                            {agent.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {agent.personality && (
                          <p className="text-sm text-muted-foreground mb-2">
                            <span className="font-medium">Personality:</span> {agent.personality}
                          </p>
                        )}
                        {agent.greeting_message && (
                          <p className="text-sm text-muted-foreground mb-2">
                            <span className="font-medium">Greeting:</span> {agent.greeting_message}
                          </p>
                        )}
                        {agent.voice_selection && (
                          <Badge variant="outline" className="mr-2">Voice: {agent.voice_selection}</Badge>
                        )}
                        {agent.compliance_version && (
                          <Badge variant="outline">Compliance: {agent.compliance_version}</Badge>
                        )}
                      </div>
                      <Switch
                        checked={agent.is_active || false}
                        onCheckedChange={(checked) => 
                          toggleAgentMutation.mutate({ agentId: agent.id, isActive: checked })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No AI agents configured. Contact support to set up AI agents for your business.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationAIAgents;
