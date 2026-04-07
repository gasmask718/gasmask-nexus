import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, PhoneForwarded, CheckCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const items = [
    { label: "Calls Dialed", value: stats?.calls_dialed || 0, icon: Phone, accent: "hsl(var(--hud-cyan))" },
    { label: "Answered", value: stats?.calls_answered || 0, icon: PhoneForwarded, accent: "hsl(var(--hud-blue))" },
    { label: "Closed", value: stats?.calls_closed || 0, icon: CheckCircle, accent: "hsl(var(--success))" },
    { label: "Talk Time", value: formatTalkTime(stats?.total_talk_time_seconds || 0), icon: Clock, accent: "hsl(var(--hud-amber))" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item, idx) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card className="glass-card hover-lift group relative overflow-hidden border-border/50">
            {/* Subtle accent glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ background: `radial-gradient(circle at 30% 50%, ${item.accent}10, transparent 70%)` }}
            />
            <CardContent className="p-4 flex items-center gap-4 relative z-10">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                style={{ background: `${item.accent}18`, border: `1px solid ${item.accent}30` }}
              >
                <item.icon className="h-5 w-5" style={{ color: item.accent }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tracking-tight">{item.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
