// Per-call timeline drawer — reads dialer_call_events for a given queue_item_id
// and renders a chronological feed with severity icons and payload preview.
//
// Used in the Campaigns dashboard "Call Logs" tab. Click a call row to open.

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";

interface DialerEvent {
  id: string;
  created_at: string;
  event_type: string;
  source: string;
  severity: string | null;
  call_sid: string | null;
  payload: Record<string, unknown> | null;
}

const sevIcon = (sev: string | null) => {
  switch (sev) {
    case "critical":
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "info":
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
};

interface Props {
  queueItemId: string | null;
  onClose: () => void;
}

export function CallTimelineDrawer({ queueItemId, onClose }: Props) {
  const open = !!queueItemId;
  const qc = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["dialer-call-timeline", queueItemId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_call_events" as any)
        .select("id, created_at, event_type, source, severity, call_sid, payload")
        .eq("queue_item_id", queueItemId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as DialerEvent[];
    },
  });

  // Realtime: refetch when new events land
  useEffect(() => {
    if (!queueItemId) return;
    const ch = supabase
      .channel(`call-timeline-${queueItemId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dialer_call_events",
          filter: `queue_item_id=eq.${queueItemId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["dialer-call-timeline", queueItemId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queueItemId, qc]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Call Timeline</SheetTitle>
          <SheetDescription>
            Every Twilio + Bland event for this call, in order.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4 pr-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          )}
          {!isLoading && events.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No events recorded yet.
            </div>
          )}
          <ol className="space-y-3">
            {events.map((e) => (
              <li
                key={e.id}
                className="border rounded-md p-3 bg-card text-card-foreground"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{sevIcon(e.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <code className="text-xs font-semibold">{e.event_type}</code>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {e.source}
                      </Badge>
                      {e.severity && e.severity !== "info" && (
                        <Badge
                          variant={e.severity === "warning" ? "secondary" : "destructive"}
                          className="text-[10px]"
                        >
                          {e.severity}
                        </Badge>
                      )}
                      {e.call_sid && (
                        <code className="text-[10px] text-muted-foreground truncate">
                          {e.call_sid.slice(0, 14)}…
                        </code>
                      )}
                    </div>
                    {e.payload && Object.keys(e.payload).length > 0 && (
                      <pre className="mt-2 text-[10px] bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
