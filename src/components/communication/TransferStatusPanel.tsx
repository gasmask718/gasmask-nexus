import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, UserCheck, Loader2, CheckCircle, Phone, ArrowRightLeft } from "lucide-react";

interface TransferStatusPanelProps {
  campaignId: string;
}

export function TransferStatusPanel({ campaignId }: TransferStatusPanelProps) {
  const { data: transfers = [] } = useQuery({
    queryKey: ["transferred-calls", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("outbound_call_queue")
        .select("id, contact_name, phone_number, status, twilio_call_sid, updated_at, notes")
        .eq("campaign_id", campaignId)
        .in("status", ["transferred", "completed"])
        .order("updated_at", { ascending: false })
        .limit(30);
      return (data || []).filter((t: any) => t.notes?.startsWith("[TRANSFER:"));
    },
    refetchInterval: 3000,
  });

  const activeTransfers = transfers.filter((t: any) => t.status === "transferred");
  const completedTransfers = transfers.filter((t: any) => t.status === "completed");

  return (
    <div className="border-l pl-4 w-[260px] shrink-0 space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        <ArrowRightLeft className="h-4 w-4" />
        Transferred Calls
      </h4>

      {activeTransfers.length === 0 && completedTransfers.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-6">
          No transfers yet. Transfer a call to see its status here.
        </p>
      )}

      <ScrollArea className="h-[350px]">
        <div className="space-y-2 pr-2">
          {activeTransfers.map((t: any) => {
            const isAI = t.notes?.includes("elevenlabs");
            return (
              <div key={t.id} className="border rounded-lg p-2.5 bg-amber-500/5 border-amber-500/20">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-semibold text-foreground truncate">
                    {t.contact_name || t.phone_number}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 ml-4">
                  {isAI ? (
                    <Bot className="h-3 w-3 text-primary" />
                  ) : (
                    <UserCheck className="h-3 w-3 text-primary" />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {isAI ? "AI Agent — On Call" : "Human Agent — On Call"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 ml-4">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {t.phone_number}
                  </span>
                </div>
              </div>
            );
          })}

          {completedTransfers.map((t: any) => {
            const isAI = t.notes?.includes("elevenlabs");
            return (
              <div key={t.id} className="border rounded-lg p-2.5 bg-green-500/5 border-green-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs font-semibold text-foreground truncate">
                    {t.contact_name || t.phone_number}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 ml-5">
                  {isAI ? <Bot className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                  <span className="text-[10px] text-muted-foreground">
                    {isAI ? "AI Agent" : "Human Agent"} — Completed
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {activeTransfers.length > 0 && (
        <div className="border-t pt-2">
          <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            {activeTransfers.length} active transfer{activeTransfers.length > 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
