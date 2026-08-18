import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Phone, Bot, Clock, FileText, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { RecordingPlayer } from "@/components/phone/RecordingPlayer";

interface BrandaroUnifiedCallHistoryProps {
  leadId: string;
  className?: string;
}

interface CallRecord {
  id: string;
  source: "va" | "dc";
  call_date: string;
  duration_seconds: number | null;
  outcome: string | null;
  status: string | null;
  transcript: string | null;
  recording_url: string | null;
  ai_summary: string | null;
  claude_analysis: string | null;
  sentiment: string | null;
}

export function BrandaroUnifiedCallHistory({ leadId, className }: BrandaroUnifiedCallHistoryProps) {
  const { data: calls, isLoading } = useQuery({
    queryKey: ["brandaro-unified-calls", leadId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-unified-call-history", {
          body: { lead_id: leadId },
        });
        if (error) throw error;
        return (data?.calls || []) as CallRecord[];
      } catch {
        // Fallback: fetch native calls only
        const { data } = await (supabase as any)
          .from("brandaro_calls")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false });
        return (data || []).map((c: any) => ({
          id: c.id,
          source: "va" as const,
          call_date: c.created_at,
          duration_seconds: c.duration_seconds,
          outcome: c.outcome,
          status: c.status,
          transcript: c.transcript,
          recording_url: c.recording_url,
          ai_summary: c.ai_summary,
          claude_analysis: null,
          sentiment: null,
        }));
      }
    },
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-6", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!calls?.length) {
    return (
      <div className={cn("text-center py-6 text-sm text-muted-foreground", className)}>
        No call history for this lead
      </div>
    );
  }

  const sentimentColor = (s: string | null) => {
    if (!s) return "text-muted-foreground";
    if (s === "positive") return "text-green-400";
    if (s === "negative") return "text-red-400";
    return "text-amber-400";
  };

  return (
    <ScrollArea className={cn("max-h-[400px]", className)}>
      <div className="space-y-3 pr-2">
        {calls.map((call) => (
          <div
            key={call.id}
            className="rounded-lg border border-border bg-card p-3 space-y-2"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {call.source === "dc" ? (
                  <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-[10px]">
                    <Bot className="h-3 w-3 mr-1" /> Dynasty Connect
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
                    <Phone className="h-3 w-3 mr-1" /> VA Call
                  </Badge>
                )}
                {call.outcome && (
                  <Badge variant="outline" className="text-[10px]">
                    {call.outcome}
                  </Badge>
                )}
                {call.sentiment && (
                  <span className={cn("text-[10px] font-medium", sentimentColor(call.sentiment))}>
                    {call.sentiment}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(call.call_date), "MMM d, yyyy, h:mm a")}
                {call.duration_seconds && (
                  <span>({Math.round(call.duration_seconds)}s)</span>
                )}
              </div>
            </div>

            {/* AI Summary */}
            {call.ai_summary && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {call.ai_summary}
              </p>
            )}

            {/* Claude Analysis */}
            {call.claude_analysis && (
              <details className="group">
                <summary className="text-[10px] text-purple-400 cursor-pointer flex items-center gap-1 hover:text-purple-300">
                  <FileText className="h-3 w-3" /> Claude Analysis
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-1 text-[11px] text-muted-foreground bg-muted/50 rounded p-2 leading-relaxed">
                  {call.claude_analysis}
                </p>
              </details>
            )}

            {/* Recording */}
            {call.recording_url && (
              <RecordingPlayer recordingUrl={call.recording_url} compact />
            )}

            {/* Transcript */}
            {call.transcript && (
              <details className="group">
                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                  View Transcript
                  <ChevronDown className="h-3 w-3 inline ml-1 transition-transform group-open:rotate-180" />
                </summary>
                <pre className="mt-1 text-[10px] text-muted-foreground bg-muted rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {call.transcript}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
