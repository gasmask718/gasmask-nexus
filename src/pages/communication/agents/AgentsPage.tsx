import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Shield, Mic } from 'lucide-react';
import { AIAgentsTab } from "@/components/communication/AIAgentsTab";
import AICallAgentDashboardPage from '@/pages/communication/call-intelligence/AICallAgentDashboardPage';
import { AgentVoiceSettingsTab } from '@/components/communication/AgentVoiceSettingsTab';

export default function AgentsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'agents';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="w-full min-h-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6" /> AI Agents
        </h2>
        <p className="text-muted-foreground">Manage AI agents and call agent configuration</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="agents" className="gap-1.5 text-xs">
            <Bot className="h-3.5 w-3.5" /> AI Agents
          </TabsTrigger>
          <TabsTrigger value="ai-call-agent" className="gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" /> AI Call Agent
          </TabsTrigger>
          <TabsTrigger value="voice-settings" className="gap-1.5 text-xs">
            <Mic className="h-3.5 w-3.5" /> Voice Engine
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          <AIAgentsTab />
        </TabsContent>
        <TabsContent value="ai-call-agent" className="mt-4">
          <AICallAgentDashboardPage />
        </TabsContent>
        <TabsContent value="voice-settings" className="mt-4">
          <AgentVoiceSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
