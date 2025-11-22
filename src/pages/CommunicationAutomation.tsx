import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Play } from "lucide-react";

const CommunicationAutomation = () => {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['automation-communication-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_communication_settings')
        .select('*')
        .order('automation_type');

      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('automation_communication_settings')
        .update({ is_enabled: enabled })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-communication-settings'] });
      toast.success('Automation setting updated');
    },
    onError: () => {
      toast.error('Failed to update setting');
    },
  });

  const runAutomationMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('auto-text-ai');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Created ${data.events_created} automated communications`);
    },
    onError: () => {
      toast.error('Failed to run automation');
    },
  });

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Communication Automation</h1>
            <p className="text-muted-foreground">
              Manage automated messaging to stores
            </p>
          </div>
          <Button 
            onClick={() => runAutomationMutation.mutate()}
            disabled={runAutomationMutation.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            Run Now
          </Button>
        </div>

        <div className="space-y-4">
          {settings?.map(setting => (
            <Card key={setting.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold capitalize">
                      {setting.automation_type.replace(/_/g, ' ')}
                    </h3>
                    <Badge variant={setting.is_enabled ? 'default' : 'secondary'}>
                      {setting.is_enabled ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    {setting.trigger_days && (
                      <div className="text-muted-foreground">
                        Triggers after {setting.trigger_days} days
                      </div>
                    )}
                    <div className="text-muted-foreground">
                      Frequency: {setting.frequency_limit}
                    </div>
                    <div className="p-3 bg-secondary rounded-lg mt-3">
                      <div className="font-medium mb-1">Message Template:</div>
                      <div className="text-muted-foreground italic">
                        "{setting.message_template}"
                      </div>
                    </div>
                  </div>
                </div>

                <Switch
                  checked={setting.is_enabled}
                  onCheckedChange={(checked) => {
                    toggleMutation.mutate({ id: setting.id, enabled: checked });
                  }}
                />
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6 mt-6">
          <h3 className="font-semibold mb-2">About Automation</h3>
          <p className="text-sm text-muted-foreground">
            Automated messages are created in-app only and stored in communication events.
            They help maintain engagement with stores without manual intervention.
            All automations respect frequency limits to avoid spamming.
          </p>
        </Card>
      </div>
    </Layout>
  );
};

export default CommunicationAutomation;