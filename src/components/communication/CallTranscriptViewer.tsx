import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  callId: string;
  className?: string;
  maxHeight?: string;
}

type TxRow = {
  id: string;
  call_id: string;
  speaker: string | null;
  text: string | null;
  timestamp: number | null;
  created_at: string;
};

function speakerStyle(s: string | null) {
  const v = (s || "").toLowerCase();
  if (v.includes("agent") || v.includes("ai") || v === "assistant")
    return { label: "Agent", icon: Bot, cls: "bg-purple-500/10 border-purple-500/30 text-purple-300" };
  if (v.includes("user") || v.includes("customer") || v.includes("lead"))
    return { label: "Lead", icon: User, cls: "bg-blue-500/10 border-blue-500/30 text-blue-300" };
  return { label: s || "—", icon: User, cls: "bg-muted/40 border-border text-muted-foreground" };
}

export function CallTranscriptViewer({ callId, className, maxHeight = "320px" }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["call-transcripts", callId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dynasty_call_transcripts")
        .select("id, call_id, speaker, text, timestamp, created_at")
        .eq("call_id", callId)
        .order("timestamp", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as TxRow[];
    },
    enabled: !!callId,
  });

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.length) {
    return (
      <p className={cn("text-xs text-muted-foreground italic py-2", className)}>
        No transcript captured for this call.
      </p>
    );
  }

  return (
    <div
      className={cn("space-y-1.5 overflow-y-auto pr-1", className)}
      style={{ maxHeight }}
    >
      {data.map((row) => {
        const sty = speakerStyle(row.speaker);
        const Icon = sty.icon;
        return (
          <div
            key={row.id}
            className={cn("rounded border px-2 py-1.5 flex gap-2 text-xs", sty.cls)}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider opacity-70">
                {sty.label}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                {row.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
