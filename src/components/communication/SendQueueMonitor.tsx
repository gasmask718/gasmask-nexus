import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Radio, CheckCircle2, XCircle, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SendQueueMonitorProps {
  queueId: string | null;
}

export function SendQueueMonitor({ queueId }: SendQueueMonitorProps) {
  const [queue, setQueue] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!queueId) return;

    const fetchData = async () => {
      const [queueRes, itemsRes] = await Promise.all([
        supabase.from("message_send_queue" as any).select("*").eq("id", queueId).single(),
        supabase.from("message_send_queue_items" as any).select("*").eq("queue_id", queueId).order("created_at"),
      ]);
      if (queueRes.data) setQueue(queueRes.data);
      if (itemsRes.data) setItems(itemsRes.data as any[]);
    };

    fetchData();

    const channel = supabase
      .channel(`queue-${queueId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "message_send_queue",
        filter: `id=eq.${queueId}`,
      }, (payload: any) => setQueue(payload.new))
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "message_send_queue_items",
        filter: `queue_id=eq.${queueId}`,
      }, (payload: any) => {
        setItems(prev => prev.map(item =>
          item.id === payload.new.id ? payload.new : item
        ));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queueId]);

  if (!queueId || !queue) return null;

  const pct = queue.total_recipients > 0
    ? Math.round(((queue.sent_count + queue.failed_count) / queue.total_recipients) * 100)
    : 0;

  const statusIcons: Record<string, React.ReactNode> = {
    sent: <CheckCircle2 className="w-3 h-3 text-green-500" />,
    delivered: <CheckCircle2 className="w-3 h-3 text-green-500" />,
    failed: <XCircle className="w-3 h-3 text-destructive" />,
    pending: <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />,
    replied: <MessageSquare className="w-3 h-3 text-blue-500" />,
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Send Progress
          </CardTitle>
          <Badge variant={queue.status === "completed" ? "default" : "secondary"} className="text-xs">
            {queue.status === "sending" && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            {queue.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{queue.sent_count + queue.failed_count} of {queue.total_recipients} processed</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: queue.total_recipients, color: "text-foreground" },
            { label: "Sent", value: queue.sent_count, color: "text-green-500" },
            { label: "Failed", value: queue.failed_count, color: "text-destructive" },
            { label: "Replied", value: queue.replied_count || 0, color: "text-blue-500" },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Items list */}
        <ScrollArea className="h-40">
          <div className="space-y-1">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-xs py-1">
                {statusIcons[item.status] || statusIcons.pending}
                <span className="font-medium truncate flex-1">{item.store_name || item.contact_name}</span>
                <span className="text-muted-foreground">{item.phone}</span>
                <Badge variant="outline" className={`text-[9px] ${
                  item.status === "sent" ? "text-green-500 border-green-500/30" :
                  item.status === "failed" ? "text-destructive border-destructive/30" :
                  ""
                }`}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
