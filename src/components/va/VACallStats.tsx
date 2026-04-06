import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, PhoneForwarded, CheckCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function VACallStats() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["va-today-stats", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await (supabase as any)
        .from("va_leaderboard_stats")
        .select("*")
        .eq("va_id", user!.id)
        .eq("session_date", today)
        .maybeSingle();
      return data || { calls_dialed: 0, calls_answered: 0, calls_closed: 0, total_talk_time_seconds: 0 };
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const formatTalkTime = (s: number) => {
    if (!s) return "0m";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 bg-slate-700/50 rounded-xl" />
        ))}
      </div>
    );
  }

  const items = [
    { label: "Calls Dialed", value: stats?.calls_dialed || 0, icon: Phone, color: "text-cyan-400" },
    { label: "Answered", value: stats?.calls_answered || 0, icon: PhoneForwarded, color: "text-blue-400" },
    { label: "Closed", value: stats?.calls_closed || 0, icon: CheckCircle, color: "text-emerald-400" },
    { label: "Talk Time", value: formatTalkTime(stats?.total_talk_time_seconds || 0), icon: Clock, color: "text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label} className="bg-slate-800/60 border-slate-700/50">
          <CardContent className="p-3 flex items-center gap-3">
            <item.icon className={`h-5 w-5 ${item.color} shrink-0`} />
            <div>
              <p className="text-lg font-bold text-white">{item.value}</p>
              <p className="text-[11px] text-slate-400">{item.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
