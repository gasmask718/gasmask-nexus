import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  Bot, UserCheck, MessageSquare, ArrowUpRight, AlertTriangle, CheckCircle,
} from "lucide-react";

export default function ConversationsTab() {
  const { currentBusiness } = useBusiness();

  // Fetch recent messaging_messages grouped by store
  const { data: conversations, isLoading } = useQuery({
    queryKey: ["messaging-conversations", currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messaging_messages")
        .select(`
          id, campaign_id, store_id, direction, body, ai_generated, status, phone, created_at,
          messaging_campaigns(name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      // Group by store_id
      const grouped = new Map<string, any>();
      for (const msg of (data || [])) {
        const key = msg.store_id || msg.phone || msg.id;
        if (!grouped.has(key)) {
          grouped.set(key, {
            storeId: msg.store_id,
            phone: msg.phone,
            lastMessage: msg.body,
            lastMessageAt: msg.created_at,
            direction: msg.direction,
            campaignName: (msg.messaging_campaigns as any)?.name || "Unknown",
            aiGenerated: msg.ai_generated,
            messageCount: 0,
            hasInbound: false,
          });
        }
        const entry = grouped.get(key)!;
        entry.messageCount++;
        if (msg.direction === "inbound") entry.hasInbound = true;
      }

      return Array.from(grouped.values());
    },
  });

  const getStatusBadge = (conv: any) => {
    if (conv.hasInbound) {
      return <Badge className="gap-1 bg-destructive/20 text-destructive border-destructive/30"><AlertTriangle className="h-3 w-3" /> Needs Review</Badge>;
    }
    if (conv.aiGenerated) {
      return <Badge className="gap-1 bg-primary/20 text-primary border-primary/30"><Bot className="h-3 w-3" /> AI Handling</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3" /> Sent</Badge>;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading conversations...</div>;
  }

  if (!conversations?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>No conversations yet. Launch a campaign to start.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Bot className="h-4 w-4" /> AI Handling</div>
            <p className="text-2xl font-bold mt-1">{conversations.filter(c => c.aiGenerated && !c.hasInbound).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertTriangle className="h-4 w-4" /> Needs Review</div>
            <p className="text-2xl font-bold mt-1">{conversations.filter(c => c.hasInbound).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><CheckCircle className="h-4 w-4" /> Total Threads</div>
            <p className="text-2xl font-bold mt-1">{conversations.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Thread List */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Conversations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y">
              {conversations.map((conv, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{conv.phone || "Unknown"}</p>
                      {getStatusBadge(conv)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{conv.campaignName}</span>
                      <span className="text-xs text-muted-foreground">{conv.messageCount} messages</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conv.lastMessageAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {conv.hasInbound && (
                      <Button size="sm" variant="outline" className="gap-1">
                        <UserCheck className="h-3 w-3" /> Take Over
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="gap-1">
                      <ArrowUpRight className="h-3 w-3" /> View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
