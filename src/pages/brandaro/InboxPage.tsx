import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConversationThread } from "@/components/brandaro/ConversationThread";
import { toast } from "sonner";

interface InboxMessage {
  id: string;
  lead_id: string | null;
  direction: string;
  message_body: string | null;
  message_text: string | null;
  from_number: string | null;
  created_at: string;
  // joined
  brandaro_qualified_leads?: {
    id: string;
    business_name: string | null;
    phone_number: string | null;
    pipeline_stage: string;
    priority_score: number;
  } | null;
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const { data: conversations } = useQuery({
    queryKey: ["brandaro-inbox"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_conversations")
        .select(
          `*, brandaro_qualified_leads (id, business_name, phone_number, pipeline_stage, priority_score)`
        )
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as InboxMessage[];
    },
    refetchInterval: 10000,
  });

  // Realtime for new inbound messages
  useEffect(() => {
    const channel = supabase
      .channel("inbox-replies")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "brandaro_conversations",
          filter: "direction=eq.inbound",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["brandaro-inbox"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Replies Inbox</h1>
        <Badge variant="secondary">{conversations?.length || 0}</Badge>
      </div>

      <div className="space-y-2">
        {conversations?.map((conv) => {
          const lead = conv.brandaro_qualified_leads;
          const text = conv.message_body || conv.message_text || "";
          return (
            <Card key={conv.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {lead?.business_name || conv.from_number || "Unknown"}
                    </span>
                    {lead?.pipeline_stage && (
                      <Badge variant="outline" className="text-[10px]">
                        {lead.pipeline_stage}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{text}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(conv.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedLeadId(conv.lead_id)}
                  disabled={!conv.lead_id}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                  Reply
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {(!conversations || conversations.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No inbound replies yet</p>
          </div>
        )}
      </div>

      {/* Conversation dialog */}
      <Dialog open={!!selectedLeadId} onOpenChange={() => setSelectedLeadId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conversation</DialogTitle>
          </DialogHeader>
          {selectedLeadId && <ConversationThread leadId={selectedLeadId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
