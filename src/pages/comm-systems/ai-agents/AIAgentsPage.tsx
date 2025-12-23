import CommSystemsLayout from "../CommSystemsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Settings, Play, Pause, Edit, BarChart3, Phone, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";

export default function AIAgentsPage() {
  const { currentBusiness } = useBusiness();
  
  const { data: agents, isLoading } = useQuery({
    queryKey: ['comm-ai-agents', currentBusiness?.id],
    queryFn: async () => {
      const query = supabase.from('call_center_ai_agents').select('*').order('name');
      if (currentBusiness) query.eq('business_name', currentBusiness.name);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  return (
    <CommSystemsLayout title="AI Agents" subtitle="Manage voice AI workers for calls">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>
        ) : agents?.length ? agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  {agent.name}
                </CardTitle>
                <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                  {agent.is_active ? <><CheckCircle className="h-3 w-3 mr-1" />Active</> : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Voice:</span> {agent.voice_selection}</div>
                <div><span className="text-muted-foreground">Calls:</span> {agent.calls_handled || 0}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><Edit className="h-3 w-3 mr-1" />Configure</Button>
                <Button variant="outline" size="sm"><BarChart3 className="h-3 w-3 mr-1" />Stats</Button>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No AI agents configured</CardContent></Card>
        )}
      </div>
    </CommSystemsLayout>
  );
}
