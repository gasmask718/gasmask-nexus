import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { Bot, User, MessageSquare, AlertTriangle, CheckCircle, Phone } from "lucide-react";

export default function ConversationsTab() {
  const { currentBusiness } = useBusiness();
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);

  // 1. Fetch recent messaging_messages grouped by campaign AND phone
  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ["messaging-threads", currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data, error } = await (supabase as any)
        .from("messaging_messages")
        .select(
          `
          id, campaign_id, direction, body, ai_generated, status, phone, created_at,
          messaging_campaigns(name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Group by campaign + phone to separate distinct conversations
      const grouped = new Map<string, any>();
      for (const msg of data || []) {
        const key = `${msg.campaign_id}_${msg.phone}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            phone: msg.phone,
            campaignId: msg.campaign_id,
            campaignName: msg.messaging_campaigns?.name || "Unknown Campaign",
            lastMessage: msg.body,
            lastMessageAt: msg.created_at,
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
    enabled: !!currentBusiness?.id,
  });

  // 2. Fetch full transcript for the selected thread
  const selectedThread = threads?.find((t) => t.key === selectedThreadKey);

  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: ["messaging-transcript", selectedThread?.phone, selectedThread?.campaignId],
    queryFn: async () => {
      if (!selectedThread) return [];

      const { data, error } = await (supabase as any)
        .from("messaging_messages")
        .select("*")
        .eq("phone", selectedThread.phone)
        .eq("campaign_id", selectedThread.campaignId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!selectedThreadKey && !!selectedThread,
  });

  const getStatusBadge = (conv: any) => {
    if (conv.hasInbound) {
      return (
        <Badge className="gap-1 bg-destructive/20 text-destructive border-destructive/30">
          <AlertTriangle className="h-3 w-3" /> Needs Review
        </Badge>
      );
    }
    if (conv.aiGenerated) {
      return (
        <Badge className="gap-1 bg-primary/20 text-primary border-primary/30">
          <Bot className="h-3 w-3" /> AI Handling
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <CheckCircle className="h-3 w-3" /> Sent
      </Badge>
    );
  };

  if (threadsLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading conversations...</div>;
  }

  if (!threads?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>No conversations yet. Launch a campaign to start tracking Twilio logs.</p>
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
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Bot className="h-4 w-4" /> AI Handling
            </div>
            <p className="text-2xl font-bold mt-1">{threads.filter((c) => c.aiGenerated && !c.hasInbound).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="h-4 w-4" /> Needs Review
            </div>
            <p className="text-2xl font-bold mt-1">{threads.filter((c) => c.hasInbound).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle className="h-4 w-4" /> Total Threads
            </div>
            <p className="text-2xl font-bold mt-1">{threads.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Split View: Threads & Transcript */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
        {/* Left Pane: Thread List */}
        <Card className="col-span-1 flex flex-col h-full overflow-hidden">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-lg">Inbox & Threads</CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {threads.map((thread) => (
                <div
                  key={thread.key}
                  onClick={() => setSelectedThreadKey(thread.key)}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedThreadKey === thread.key ? "bg-muted" : ""}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-semibold truncate">{thread.phone || "Unknown"}</p>
                    {getStatusBadge(thread)}
                  </div>
                  <p className="text-xs text-primary truncate mb-2">{thread.campaignName}</p>
                  <p className="text-sm text-muted-foreground truncate">{thread.lastMessage}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>{thread.messageCount} messages</span>
                    <span>{new Date(thread.lastMessageAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Right Pane: Full Transcript & Twilio Logs */}
        <Card className="col-span-1 md:col-span-2 flex flex-col h-full overflow-hidden bg-muted/10">
          {selectedThreadKey && selectedThread ? (
            <>
              <CardHeader className="py-4 border-b bg-background">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">{selectedThread.phone}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      Campaign: <span className="font-medium text-foreground">{selectedThread.campaignName}</span>
                      <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200 gap-1">
                        <Phone className="h-3 w-3" /> Twilio Log
                      </Badge>
                    </p>
                  </div>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 p-4">
                {transcriptLoading ? (
                  <div className="text-center text-muted-foreground py-10">Loading Twilio logs & transcript...</div>
                ) : (
                  <div className="space-y-6">
                    {transcript?.map((msg: any) => {
                      const isOutbound = msg.direction === "outbound";
                      return (
                        <div key={msg.id} className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(msg.created_at).toLocaleString()}
                            </span>
                            {isOutbound && msg.ai_generated && <Bot className="h-3 w-3 text-primary" />}
                            {!isOutbound && <User className="h-3 w-3 text-muted-foreground" />}
                          </div>

                          <div
                            className={`max-w-[80%] rounded-lg p-3 text-sm shadow-sm ${
                              isOutbound
                                ? "bg-blue-600 text-white rounded-tr-none"
                                : "bg-background border rounded-tl-none"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                            {isOutbound ? (
                              <>
                                Sent via Twilio • Status: <span className="capitalize">{msg.status || "sent"}</span>
                              </>
                            ) : (
                              <>Received via Twilio</>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
              <p>Select a conversation on the left to view</p>
              <p className="text-sm">the full transcript and Twilio delivery logs.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
