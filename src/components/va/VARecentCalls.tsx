import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

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

  const dispositionColors: Record<string, string> = {
    closed: "bg-emerald-500/20 text-emerald-400",
    not_interested: "bg-red-500/20 text-red-400",
    callback: "bg-orange-500/20 text-orange-400",
    no_answer: "bg-slate-500/20 text-slate-400",
    voicemail: "bg-purple-500/20 text-purple-400",
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-slate-700/50" />
        ))}
      </div>
    );
  }

  if (recentCalls.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No calls yet today</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {recentCalls.map((call: any) => (
        <div key={call.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{call.lead_id ? "Lead Call" : "Manual Call"}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {call.called_at ? formatDistanceToNow(new Date(call.called_at), { addSuffix: true }) : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-slate-400">{formatDuration(call.duration_seconds)}</span>
            {call.disposition && (
              <Badge className={`text-[10px] h-5 px-1.5 ${dispositionColors[call.disposition] || "bg-slate-600 text-slate-300"}`}>
                {call.disposition}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
