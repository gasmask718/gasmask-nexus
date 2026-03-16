import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { useToast } from "@/hooks/use-toast";
import { Pause, Play, Square, Radio, Send, MessageSquare, UserX, Bot, Zap, Phone, Megaphone } from "lucide-react";

const STATUS_TABS = ["all", "active", "paused", "completed", "draft", "cancelled"] as const;

export default function ActiveCampaignsTab() {
  const { currentBusiness } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState<string>("all");

  // Fetch messaging campaigns (bulk SMS)
  const { data: messagingCampaigns, isLoading: msgLoading } = useQuery({
    queryKey: ["messaging-campaigns", currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data, error } = await (supabase as any)
        .from("messaging_campaigns")
        .select("*")
        .eq("business_id", currentBusiness.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Fetch dialer campaigns (AI voice campaigns)
  const { data: dialerCampaigns, isLoading: dialerLoading } = useQuery({
    queryKey: ["dialer-campaigns-active", currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data, error } = await supabase
        .from("dialer_campaigns")
        .select("*")
        .eq("business_id", currentBusiness.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Fetch AI call campaigns
  const { data: aiCallCampaigns, isLoading: aiLoading } = useQuery({
    queryKey: ["ai-call-campaigns-active", currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data, error } = await supabase
        .from("ai_call_campaigns")
        .select("*")
        .eq("business_id", currentBusiness.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Merge all campaigns into a unified list
  const allCampaigns = [
    ...(messagingCampaigns || []).map((c: any) => ({ ...c, _type: "messaging" as const })),
    ...(dialerCampaigns || []).map((c: any) => ({ ...c, _type: "dialer" as const })),
    ...(aiCallCampaigns || []).map((c: any) => ({ ...c, _type: "ai_call" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filtered = allCampaigns.filter((c: any) => statusTab === "all" || c.status === statusTab);

  const isLoading = msgLoading || dialerLoading || aiLoading;

  const updateMessagingStatus = useMutation({
    mutationFn: async ({ id, status, type }: { id: string; status: string; type: string }) => {
      const table = type === "messaging" ? "messaging_campaigns" : type === "dialer" ? "dialer_campaigns" : "ai_call_campaigns";
      const { error } = await (supabase as any).from(table).update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dialer-campaigns-active"] });
      queryClient.invalidateQueries({ queryKey: ["ai-call-campaigns-active"] });
      toast({ title: "Campaign updated" });
    },
  });

  const statusColor = (status: string) => {
    switch (status) { case "active": return "default"; case "paused": return "secondary"; case "completed": return "outline"; case "cancelled": return "destructive"; default: return "outline"; }
  };

  const getTypeIcon = (type: string) => {
    if (type === "dialer") return <Phone className="h-5 w-5 text-green-500" />;
    if (type === "ai_call") return <Bot className="h-5 w-5 text-purple-500" />;
    return <Zap className="h-5 w-5 text-blue-500" />;
  };

  const getTypeLabel = (type: string, mode?: string) => {
    if (type === "dialer") return mode === "manual" ? "Manual Cold Call" : "AI Dialer";
    if (type === "ai_call") return "AI Voice Campaign";
    return mode === "ai_campaign" ? "AI SMS Drip" : "Bulk SMS";
  };

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading campaigns...</div>;

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const count = tab === "all" ? allCampaigns.length : allCampaigns.filter((c: any) => c.status === tab).length;
          return (
            <Badge key={tab} variant={statusTab === tab ? "default" : "outline"} className="cursor-pointer capitalize px-3 py-1" onClick={() => setStatusTab(tab)}>
              {tab} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Megaphone className="h-4 w-4" /> All Campaigns</div><p className="text-2xl font-bold mt-1">{allCampaigns.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Radio className="h-4 w-4" /> Active</div><p className="text-2xl font-bold mt-1">{allCampaigns.filter((c: any) => c.status === "active").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Send className="h-4 w-4" /> SMS Campaigns</div><p className="text-2xl font-bold mt-1">{(messagingCampaigns || []).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Phone className="h-4 w-4" /> Dialer Campaigns</div><p className="text-2xl font-bold mt-1">{(dialerCampaigns || []).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Bot className="h-4 w-4" /> AI Call Campaigns</div><p className="text-2xl font-bold mt-1">{(aiCallCampaigns || []).length}</p></CardContent></Card>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Radio className="h-8 w-8 mx-auto mb-3 opacity-50" /><p>No campaigns match this filter.</p></CardContent></Card>
      ) : filtered.map((campaign: any) => {
        const progress = campaign.total_targets ? Math.round(((campaign.sent_count || campaign.completed_calls || 0) / campaign.total_targets) * 100) : 0;
        const sentCount = campaign.sent_count || campaign.completed_calls || campaign.answered_calls || 0;
        const totalTargets = campaign.total_targets || 0;
        return (
          <Card key={`${campaign._type}-${campaign.id}`} className={`border-l-4 ${campaign._type === "dialer" ? "border-l-green-500" : campaign._type === "ai_call" ? "border-l-purple-500" : "border-l-blue-500"}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getTypeIcon(campaign._type)}
                  <div>
                    <h3 className="font-semibold">{campaign.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {campaign._type === "messaging" ? <Zap className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                        {getTypeLabel(campaign._type, campaign.mode || campaign.dial_mode)}
                      </Badge>
                      <Badge variant={statusColor(campaign.status) as any} className="text-[10px] capitalize">{campaign.status}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {campaign.status === "active" && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => updateMessagingStatus.mutate({ id: campaign.id, status: "paused", type: campaign._type })}>
                      <Pause className="h-3 w-3" /> Pause
                    </Button>
                  )}
                  {campaign.status === "paused" && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => updateMessagingStatus.mutate({ id: campaign.id, status: "active", type: campaign._type })}>
                      <Play className="h-3 w-3" /> Resume
                    </Button>
                  )}
                  {(campaign.status === "active" || campaign.status === "paused") && (
                    <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateMessagingStatus.mutate({ id: campaign.id, status: "cancelled", type: campaign._type })}>
                      <Square className="h-3 w-3" /> Stop
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                <div><p className="text-muted-foreground text-xs">Sent/Completed</p><p className="font-medium">{sentCount.toLocaleString()}/{totalTargets.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Replies/Answered</p><p className="font-medium">{campaign.reply_count || campaign.answered_calls || 0}</p></div>
                <div><p className="text-muted-foreground text-xs">Failed</p><p className="font-medium">{campaign.failed_count || campaign.failed_calls || 0}</p></div>
                <div><p className="text-muted-foreground text-xs">Created</p><p className="font-medium text-xs">{new Date(campaign.created_at).toLocaleDateString()}</p></div>
              </div>
              {totalTargets > 0 && (
                <>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{progress}% complete</p>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
