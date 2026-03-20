import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";

interface IntentEntry {
  id: string;
  message_text: string | null;
  intent: string | null;
  intent_score: number | null;
  suggested_stage: string | null;
  reason: string | null;
  created_at: string;
}

const intentColors: Record<string, string> = {
  interested: "text-green-500",
  positive: "text-green-500",
  booking: "text-teal-500",
  question: "text-blue-500",
  objection: "text-amber-500",
  neutral: "text-muted-foreground",
  not_interested: "text-red-500",
  stop: "text-red-600 font-bold",
};

export function IntentLog({ leadId }: { leadId: string }) {
  const { data: intents } = useQuery({
    queryKey: ["intent-log", leadId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_intent_log")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as IntentEntry[];
    },
  });

  return (
    <div className="space-y-3 p-3">
      {intents?.map((item) => (
        <div key={item.id} className="border rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={intentColors[item.intent || "neutral"] || "text-muted-foreground"}>
              {item.intent}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Score: {item.intent_score}/10
            </span>
          </div>
          <p className="text-sm italic text-muted-foreground">"{item.message_text}"</p>
          {item.reason && <p className="text-xs text-muted-foreground">{item.reason}</p>}
          <p className="text-xs text-primary">→ Suggested: {item.suggested_stage}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(item.created_at).toLocaleString()}
          </p>
        </div>
      ))}
      {(!intents || intents.length === 0) && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
          <Brain className="h-8 w-8" />
          No intent data yet
        </div>
      )}
    </div>
  );
}
