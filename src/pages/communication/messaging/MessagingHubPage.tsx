import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Bot, Radio, Send, Phone, Loader2, CheckCircle2, XCircle, History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { useTwilioHealth } from "@/hooks/useTwilioHealth";
import ManualBulkTab from "./ManualBulkTab";
import AICampaignTab from "./AICampaignTab";
import ActiveCampaignsTab from "./ActiveCampaignsTab";
import ConversationsTab from "./ConversationsTab";
import { SendHistoryTab } from "@/components/communication/SendHistoryTab";

export default function MessagingHubPage() {
  const [activeTab, setActiveTab] = useState("manual");
  const { currentBusiness } = useBusiness();
  const { data: health, isLoading: healthLoading } = useTwilioHealth();

  const { data: stats } = useQuery({
    queryKey: ["messaging-hub-stats", currentBusiness?.id],
    queryFn: async () => {
      const { data: campaigns } = await supabase
        .from("messaging_campaigns")
        .select("status, mode")
        .eq("business_id", currentBusiness?.id || "");

      const active = campaigns?.filter((c) => c.status === "active").length || 0;
      const aiActive = campaigns?.filter((c) => c.status === "active" && c.mode === "ai_campaign").length || 0;
      return { active, aiActive };
    },
    enabled: !!currentBusiness?.id,
  });

  const isActive = health?.status === "active";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Messaging Hub
          </h1>
          <p className="text-muted-foreground">Manual bulk messaging & AI auto text — Powered by Twilio</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Twilio Health Badge */}
          {healthLoading ? (
            <Badge variant="outline" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking...
            </Badge>
          ) : (
            <Badge
              variant={isActive ? "default" : "destructive"}
              className={`gap-1 ${isActive ? "bg-green-600 hover:bg-green-700" : ""}`}
            >
              {isActive ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {isActive
                ? `Twilio Active · ${health.phone_number}`
                : health?.status === "not_configured"
                ? "Twilio Not Configured"
                : "Twilio Error"
              }
            </Badge>
          )}
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

      {/* Twilio config warning */}
      {!healthLoading && !isActive && health?.missing?.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          Missing credentials: {health.missing.join(", ")}. Configure them in your backend secrets.
        </div>
      )}

      {/* 5-Tab Architecture */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
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
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            History
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
        <TabsContent value="history">
          <SendHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
