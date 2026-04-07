import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock, PhoneOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export function VARecentCalls() {
  const { user } = useAuth();

  const { data: recentCalls = [], isLoading } = useQuery({
    queryKey: ["va-recent-calls", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("va_call_logs")
        .select("id, call_status, disposition, duration_seconds, called_at, excitement_level, lead_id, twilio_number")
        .eq("va_id", user!.id)
        .order("called_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const formatDuration = (s: number | null) => {
    if (!s) return "0:00";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const dispositionConfig: Record<string, { bg: string; text: string }> = {
    closed: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
    not_interested: { bg: "bg-destructive/15", text: "text-destructive" },
    callback: { bg: "bg-orange-500/15", text: "text-orange-400" },
    no_answer: { bg: "bg-muted/30", text: "text-muted-foreground" },
    voicemail: { bg: "bg-purple-500/15", text: "text-purple-400" },
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (recentCalls.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto">
          <PhoneOff className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">No calls yet today</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {recentCalls.map((call: any, idx: number) => {
        const config = dispositionConfig[call.disposition] || { bg: "bg-muted/20", text: "text-muted-foreground" };
        return (
          <motion.div
            key={call.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.3 }}
            className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-accent/50 transition-all duration-200 cursor-default group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {call.lead_id ? "Lead Call" : "Manual Call"}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {call.called_at
                    ? formatDistanceToNow(new Date(call.called_at), { addSuffix: true })
                    : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {formatDuration(call.duration_seconds)}
              </span>
              {call.disposition && (
                <Badge variant="outline" className={`text-[10px] h-5 px-2 border-transparent ${config.bg} ${config.text}`}>
                  {call.disposition.replace("_", " ")}
                </Badge>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
