import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Settings, Edit, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CallCenterLayout from "./CallCenterLayout";

export default function AIAgents() {
  const { data: aiAgents, isLoading } = useQuery({
    queryKey: ['call-center-ai-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_center_ai_agents')
        .select('*')
        .order('business_name');
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <CallCenterLayout title="AI Agents">
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Agents</h1>
        <p className="text-muted-foreground">Manage AI agents for each business line</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Loading AI agents...</p>
            </CardContent>
          </Card>
        ) : aiAgents && aiAgents.length > 0 ? (
          aiAgents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription>{agent.business_name}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                    {agent.is_active ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {agent.personality && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Personality</p>
                    <p className="text-sm">{agent.personality}</p>
                  </div>
                )}
                
                {agent.greeting_message && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Greeting</p>
                    <p className="text-sm italic">"{agent.greeting_message}"</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Badge variant="outline">{agent.voice_selection}</Badge>
                  {agent.compliance_version && (
                    <Badge variant="outline">v{agent.compliance_version}</Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="h-3 w-3 mr-2" />
                    Configure
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-3 w-3 mr-2" />
                    Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">No AI agents configured</p>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </CallCenterLayout>
  );
}