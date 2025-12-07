import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, Phone, Bot, Bell, Zap, BarChart3, 
  Send, ArrowLeft, RefreshCw, Settings, User, GitBranch,
  AlertTriangle, Activity, Users, Sparkles, Headphones, Tag
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCommunicationCenter } from "@/hooks/useCommunicationCenter";
import { useCommunicationIntelligence } from "@/hooks/useCommunicationIntelligence";
import { useLiveCallSessions } from "@/hooks/useLiveCallSessions";
import { UnifiedInbox } from "@/components/communication/UnifiedInbox";
import { ManualCallingPanel } from "@/components/communication/ManualCallingPanel";
import { CommunicationAlerts } from "@/components/communication/CommunicationAlerts";
import VoicePersonaBuilder from "@/components/communication/VoicePersonaBuilder";
import CallFlowBuilder from "@/components/communication/CallFlowBuilder";
import CommunicationHeatmap from "@/components/communication/CommunicationHeatmap";
import AutoCampaigns from "@/components/communication/AutoCampaigns";
import CommSettingsPanel from "@/components/communication/CommSettingsPanel";
import EscalationsPanel from "@/components/communication/EscalationsPanel";
import EngagementScoresPanel from "@/components/communication/EngagementScoresPanel";
import DepartmentRoutingPanel from "@/components/communication/DepartmentRoutingPanel";
import ProactiveOutreachPanel from "@/components/communication/ProactiveOutreachPanel";
import { OperatorViewPanel } from "@/components/communication/OperatorViewPanel";
import { CallReasonsPanel } from "@/components/communication/CallReasonsPanel";
import { toast } from "sonner";

export default function CommunicationCenter() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("inbox");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestedReply, setSuggestedReply] = useState("");

  // Fetch businesses for filter
  const { data: businesses = [] } = useQuery({
    queryKey: ["businesses-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, primary_color")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  // Fetch stores for calling panel
  const { data: stores = [] } = useQuery({
    queryKey: ["stores-for-calling", selectedBusinessId],
    queryFn: async () => {
      let query = supabase
        .from("store_master")
        .select("id, store_name, owner_name, phone, address")
        .is("deleted_at", null)
        .order("store_name");

      if (selectedBusinessId !== "all") {
        query = query.or(`brand_id.eq.${selectedBusinessId},business_id.eq.${selectedBusinessId}`);
      }

      const { data } = await query.limit(100);
      return data || [];
    },
  });

  const businessIdFilter = selectedBusinessId === "all" ? undefined : selectedBusinessId;

  const {
    messages,
    messagesLoading,
    refetchMessages,
    alerts,
    alertsLoading,
    refetchAlerts,
    sequences,
    sendMessage,
    isSending,
    suggestReply,
    isSuggestingReply,
    rewriteBrandTone,
    isRewriting,
    resolveAlert,
    stats,
  } = useCommunicationCenter(businessIdFilter);

  const { escalations, engagementScores } = useCommunicationIntelligence(businessIdFilter);
  const { stats: liveCallStats } = useLiveCallSessions(businessIdFilter);

  const handleSuggestReply = async () => {
    if (!selectedMessage) return;
    
    const brand = businesses.find(b => b.id === selectedMessage.business_id);
    
    try {
      const result = await suggestReply({
        brandName: brand?.name || "Your Brand",
        storeName: selectedMessage.store?.store_name || "Store",
        previousMessage: selectedMessage.content || "",
        context: "General follow-up",
      });
      setSuggestedReply(result);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRewriteTone = async (content: string) => {
    const brand = businesses.find(b => b.id === selectedMessage?.business_id);
    
    try {
      const result = await rewriteBrandTone({
        brandName: brand?.name || "Your Brand",
        message: content,
      });
      setSuggestedReply(result);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSendReply = async (content: string) => {
    if (!selectedMessage) return;
    
    await sendMessage({
      business_id: selectedMessage.business_id,
      store_id: selectedMessage.store_id,
      contact_id: selectedMessage.contact_id,
      channel: "sms",
      content,
      phone_number: selectedMessage.phone_number,
    });
    
    setSuggestedReply("");
  };

  const handleCall = (storeId: string, phone: string) => {
    // In production, would integrate with telephony API
    toast.info(`Initiating call to ${phone}`);
  };

  const handleLogOutcome = (callId: string, outcome: string, notes: string) => {
    toast.success("Call logged successfully");
  };

  const handleScheduleFollowUp = (storeId: string, date: string) => {
    toast.success("Follow-up scheduled");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/crm")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Communication Center</h1>
                <p className="text-sm text-muted-foreground">
                  Unified messaging, calling, and AI automation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Business Filter */}
              <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Businesses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Businesses</SelectItem>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: b.primary_color || "#6366f1" }}
                        />
                        {b.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={() => refetchMessages()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b bg-muted/30">
        <div className="container py-3">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{stats.todayMessages} Today</span>
            </div>
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{stats.outboundCount} Sent</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              <span className="text-sm">{stats.inboundCount} Received</span>
            </div>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-500" />
              <span className="text-sm">{stats.aiGeneratedCount} AI Generated</span>
            </div>
            {liveCallStats.totalActive > 0 && (
              <Badge className="bg-green-500 text-white animate-pulse">
                <Headphones className="h-3 w-3 mr-1" />
                {liveCallStats.totalActive} Live Calls
              </Badge>
            )}
            {stats.unresolvedAlerts > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {stats.unresolvedAlerts} Alerts
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="inbox" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="calling" className="gap-2">
              <Phone className="h-4 w-4" />
              Dialer
            </TabsTrigger>
            <TabsTrigger value="live-calls" className="gap-2">
              <Headphones className="h-4 w-4" />
              Live Calls
              {liveCallStats.totalActive > 0 && (
                <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-green-500 text-white">
                  {liveCallStats.totalActive}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="escalations" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Escalations
              {escalations.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {escalations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="engagement" className="gap-2">
              <Activity className="h-4 w-4" />
              Engagement
            </TabsTrigger>
            <TabsTrigger value="routing" className="gap-2">
              <Users className="h-4 w-4" />
              Routing
            </TabsTrigger>
            <TabsTrigger value="outreach" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Outreach
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <Zap className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="personas" className="gap-2">
              <User className="h-4 w-4" />
              Personas
            </TabsTrigger>
            <TabsTrigger value="flows" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Call Flows
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Heatmap
            </TabsTrigger>
            <TabsTrigger value="call-reasons" className="gap-2">
              <Tag className="h-4 w-4" />
              Call Reasons
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox">
            <UnifiedInbox
              messages={messages}
              selectedMessage={selectedMessage}
              onSelectMessage={(msg) => {
                setSelectedMessage(msg);
                setSuggestedReply("");
              }}
              onSendReply={handleSendReply}
              onSuggestReply={handleSuggestReply}
              onRewriteTone={handleRewriteTone}
              isSending={isSending}
              isSuggesting={isSuggestingReply || isRewriting}
              suggestedReply={suggestedReply}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          </TabsContent>

          <TabsContent value="calling">
            <ManualCallingPanel
              stores={stores}
              recentCalls={[]}
              onCall={handleCall}
              onLogOutcome={handleLogOutcome}
              onScheduleFollowUp={handleScheduleFollowUp}
            />
          </TabsContent>

          <TabsContent value="live-calls">
            <OperatorViewPanel businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="escalations">
            <EscalationsPanel businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="engagement">
            <EngagementScoresPanel businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="routing">
            <DepartmentRoutingPanel businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="outreach">
            <ProactiveOutreachPanel businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="campaigns">
            <AutoCampaigns businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="personas">
            <VoicePersonaBuilder businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="flows">
            <CallFlowBuilder businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="analytics">
            <CommunicationHeatmap businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="call-reasons">
            <CallReasonsPanel businessId={businessIdFilter} />
          </TabsContent>

          <TabsContent value="settings">
            <CommSettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
