import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { useToast } from "@/hooks/use-toast";
import { Pause, Play, Square, Radio, Send, MessageSquare, UserX, Bot, Zap, Phone } from "lucide-react";

const STATUS_TABS = ["all", "active", "paused", "completed", "draft", "cancelled"] as const;

export default function ActiveCampaignsTab() {
  const { currentBusiness } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState<string>("all");

  const { data: campaigns, isLoading } = useQuery({
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

  const filtered = (campaigns || []).filter((c: any) => statusTab === "all" || c.status === statusTab);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("messaging_campaigns").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["messaging-campaigns"] }); toast({ title: "Campaign updated" }); },
  });

  const statusColor = (status: string) => {
    switch (status) { case "active": return "default"; case "paused": return "secondary"; case "completed": return "outline"; case "cancelled": return "destructive"; default: return "outline"; }
  };

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading campaigns...</div>;

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const count = tab === "all" ? (campaigns || []).length : (campaigns || []).filter((c: any) => c.status === tab).length;
          return (
            <Badge key={tab} variant={statusTab === tab ? "default" : "outline"} className="cursor-pointer capitalize px-3 py-1" onClick={() => setStatusTab(tab)}>
              {tab} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Radio className="h-4 w-4" /> Active</div><p className="text-2xl font-bold mt-1">{(campaigns || []).filter((c: any) => c.status === "active").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Send className="h-4 w-4" /> Total Sent</div><p className="text-2xl font-bold mt-1">{(campaigns || []).reduce((s: number, c: any) => s + (c.sent_count || 0), 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><MessageSquare className="h-4 w-4" /> Replies</div><p className="text-2xl font-bold mt-1">{(campaigns || []).reduce((s: number, c: any) => s + (c.reply_count || 0), 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><UserX className="h-4 w-4" /> Opt-Outs</div><p className="text-2xl font-bold mt-1">{(campaigns || []).reduce((s: number, c: any) => s + (c.opt_out_count || 0), 0)}</p></CardContent></Card>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Radio className="h-8 w-8 mx-auto mb-3 opacity-50" /><p>No campaigns match this filter.</p></CardContent></Card>
      ) : filtered.map((campaign: any) => {
        const progress = campaign.total_targets ? Math.round(((campaign.sent_count || 0) / campaign.total_targets) * 100) : 0;
        const responseRate = campaign.sent_count ? Math.round(((campaign.reply_count || 0) / campaign.sent_count) * 100) : 0;
        return (
          <Card key={campaign.id} className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {campaign.mode === "ai_campaign" ? <Bot className="h-5 w-5 text-primary" /> : <Zap className="h-5 w-5 text-blue-500" />}
                  <div>
                    <h3 className="font-semibold">{campaign.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] gap-1 bg-blue-50 text-blue-700 border-blue-200"><Phone className="h-3 w-3" /> Twilio</Badge>
                      <Badge variant={statusColor(campaign.status) as any} className="text-[10px] capitalize">{campaign.status}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{campaign.mode === "ai_campaign" ? "AI Drip" : "Manual Bulk"}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {campaign.status === "active" && <Button size="sm" variant="outline" className="gap-1" onClick={() => updateStatus.mutate({ id: campaign.id, status: "paused" })}><Pause className="h-3 w-3" /> Pause</Button>}
                  {campaign.status === "paused" && <Button size="sm" variant="outline" className="gap-1" onClick={() => updateStatus.mutate({ id: campaign.id, status: "active" })}><Play className="h-3 w-3" /> Resume</Button>}
                  {(campaign.status === "active" || campaign.status === "paused") && <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateStatus.mutate({ id: campaign.id, status: "cancelled" })}><Square className="h-3 w-3" /> Stop</Button>}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                <div><p className="text-muted-foreground text-xs">Sent</p><p className="font-medium">{(campaign.sent_count || 0).toLocaleString()}/{(campaign.total_targets || 0).toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Replies</p><p className="font-medium">{campaign.reply_count || 0}</p></div>
                <div><p className="text-muted-foreground text-xs">Response Rate</p><p className="font-medium">{responseRate}%</p></div>
                <div><p className="text-muted-foreground text-xs">Opt-Outs</p><p className="font-medium">{campaign.opt_out_count || 0}</p></div>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{progress}% complete • Twilio</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
