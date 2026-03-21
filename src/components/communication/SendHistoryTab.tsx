import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function SendHistoryTab() {
  const { data: history, isLoading } = useQuery({
    queryKey: ["message-send-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("message_send_queue" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))
      ) : !history?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Send className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No messages sent yet.</p>
        </div>
      ) : (
        history.map((campaign: any) => {
          const successRate = campaign.total_recipients > 0
            ? Math.round((campaign.sent_count / campaign.total_recipients) * 100)
            : 0;
          const replyRate = campaign.sent_count > 0
            ? Math.round(((campaign.replied_count || 0) / campaign.sent_count) * 100)
            : 0;

          return (
            <Card key={campaign.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{campaign.campaign_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {campaign.audience_type} · {new Date(campaign.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={campaign.status === "completed" ? "default" : "secondary"} className="text-xs">
                    {campaign.status}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground bg-muted rounded p-2 line-clamp-2">
                  {campaign.message_body}
                </p>

                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: "Sent to", value: campaign.total_recipients },
                    { label: "Delivered", value: campaign.sent_count, color: "text-green-500" },
                    { label: "Failed", value: campaign.failed_count, color: "text-destructive" },
                    { label: "Replied", value: campaign.replied_count || 0, color: "text-blue-500" },
                    { label: "Reply rate", value: `${replyRate}%`, color: replyRate > 0 ? "text-blue-500" : "text-muted-foreground" },
                  ].map(stat => (
                    <div key={stat.label}>
                      <p className={`text-sm font-bold ${stat.color || "text-foreground"}`}>{stat.value}</p>
                      <p className="text-[9px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
