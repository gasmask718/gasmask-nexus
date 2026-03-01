import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Zap, Bot, Radio, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import ManualBulkTab from "./ManualBulkTab";
import AICampaignTab from "./AICampaignTab";
import ActiveCampaignsTab from "./ActiveCampaignsTab";
import ConversationsTab from "./ConversationsTab";

export default function MessagingHubPage() {
  const [activeTab, setActiveTab] = useState("manual");
  const { currentBusiness } = useBusiness();

  const { data: stats } = useQuery({
    queryKey: ["messaging-hub-stats", currentBusiness?.id],
    queryFn: async () => {
      const { data: campaigns } = await supabase
        .from("messaging_campaigns")
        .select("status, mode")
        .eq("business_id", currentBusiness?.id || "");
      
      const active = campaigns?.filter(c => c.status === "active").length || 0;
      const aiActive = campaigns?.filter(c => c.status === "active" && c.mode === "ai_campaign").length || 0;
      return { active, aiActive };
    },
    enabled: !!currentBusiness?.id,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Messaging Hub
          </h1>
          <p className="text-muted-foreground">
            Manual bulk messaging & AI auto text — unified engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Radio className="h-3 w-3 text-green-500 animate-pulse" />
            {stats?.active || 0} Active
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Bot className="h-3 w-3" />
            {stats?.aiActive || 0} AI Running
          </Badge>
        </div>
      </div>

      {/* 4-Tab Architecture */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="manual" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Manual Bulk
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            AI Campaign
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            Active
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Conversations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <ManualBulkTab />
        </TabsContent>
        <TabsContent value="ai">
          <AICampaignTab />
        </TabsContent>
        <TabsContent value="active">
          <ActiveCampaignsTab />
        </TabsContent>
        <TabsContent value="conversations">
          <ConversationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
