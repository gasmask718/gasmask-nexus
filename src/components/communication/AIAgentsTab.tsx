import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Activity, BarChart3 } from "lucide-react";
import { AIAgentsPanel } from "./AIAgentsPanel";
import { AgentActivityMonitor } from "./AgentActivityMonitor";
import { AgentInsightsPanel } from "./AgentInsightsPanel";

export function AIAgentsTab() {
  return (
    <Tabs defaultValue="team" className="space-y-6">
      <TabsList>
        <TabsTrigger value="team" className="gap-2">
          <Bot className="h-4 w-4" />
          Agent Team
        </TabsTrigger>
        <TabsTrigger value="activity" className="gap-2">
          <Activity className="h-4 w-4" />
          Activity Monitor
        </TabsTrigger>
        <TabsTrigger value="insights" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Insights
        </TabsTrigger>
      </TabsList>

      <TabsContent value="team">
        <AIAgentsPanel />
      </TabsContent>

      <TabsContent value="activity">
        <AgentActivityMonitor />
      </TabsContent>

      <TabsContent value="insights">
        <AgentInsightsPanel />
      </TabsContent>
    </Tabs>
  );
}
