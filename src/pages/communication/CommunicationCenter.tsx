import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, Phone, Bot, Bell, Zap, BarChart3, 
  Send, ArrowLeft, RefreshCw, Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCommunicationCenter } from "@/hooks/useCommunicationCenter";
import { UnifiedInbox } from "@/components/communication/UnifiedInbox";
import { ManualCallingPanel } from "@/components/communication/ManualCallingPanel";
import { CommunicationAlerts } from "@/components/communication/CommunicationAlerts";
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
          <TabsList className="mb-6">
            <TabsTrigger value="inbox" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="calling" className="gap-2">
              <Phone className="h-4 w-4" />
              Calling
            </TabsTrigger>
            <TabsTrigger value="ai-sequences" className="gap-2">
              <Zap className="h-4 w-4" />
              AI Sequences
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              Alerts
              {stats.unresolvedAlerts > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {stats.unresolvedAlerts}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Inbox Tab */}
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

          {/* Calling Tab */}
          <TabsContent value="calling">
            <ManualCallingPanel
              stores={stores}
              recentCalls={[]}
              onCall={handleCall}
              onLogOutcome={handleLogOutcome}
              onScheduleFollowUp={handleScheduleFollowUp}
            />
          </TabsContent>

          {/* AI Sequences Tab */}
          <TabsContent value="ai-sequences">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  AI Communication Sequences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">AI Sequence Builder</h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    Create automated multi-step communication campaigns with AI-generated 
                    messages tailored to your brand voice.
                  </p>
                  <Button>
                    <Zap className="h-4 w-4 mr-2" />
                    Create New Sequence
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts">
            <CommunicationAlerts
              alerts={alerts}
              onResolve={resolveAlert}
              onViewDetails={(alert) => {
                toast.info(`Viewing alert: ${alert.message}`);
              }}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Messages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{messages.length}</div>
                  <p className="text-sm text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    AI Engagement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {messages.length > 0 
                      ? Math.round((stats.aiGeneratedCount / messages.length) * 100) 
                      : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">AI-generated messages</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Sequences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {sequences.filter((s: any) => s.is_active).length}
                  </div>
                  <p className="text-sm text-muted-foreground">Running campaigns</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
