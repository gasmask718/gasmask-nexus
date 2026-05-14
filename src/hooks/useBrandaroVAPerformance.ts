import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

// ── Scoring Model ──
const SCORE_MAP: Record<string, number> = {
  call_completed: 1,
  conversation: 3,
  interested: 8,
  callback_booked: 5,
  demo_request: 12,
  hot_lead: 20,
  closer_handoff: 25,
  payment_lead: 35,
  missed_callback: -5,
  overdue_task: -3,
  skipped_task: -2,
};

export function calculateScore(events: { event_type: string; points: number }[]) {
  return events.reduce((sum, e) => sum + e.points, 0);
}

// ── My Daily Performance ──
export function useMyDailyPerformance() {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["va-daily-perf", today],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Upsert today's record
      const { data: existing } = await supabase
        .from("brandaro_va_daily_performance" as any)
        .select("*")
        .eq("va_user_id", user.id)
        .eq("performance_date", today)
        .maybeSingle();

      if (!existing) {
        await supabase.from("brandaro_va_daily_performance" as any).insert({
          va_user_id: user.id,
          performance_date: today,
        });
      }

      const { data } = await supabase
        .from("brandaro_va_daily_performance" as any)
        .select("*")
        .eq("va_user_id", user.id)
        .eq("performance_date", today)
        .single();

      return data as any;
    },
  });
}

// ── All VAs Performance (Manager) ──
export function useAllVAPerformance() {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["va-all-perf", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_va_daily_performance" as any)
        .select("*")
        .eq("performance_date", today)
        .order("performance_score", { ascending: false });
      return (data || []) as any[];
    },
  });
}

// ── Leaderboard ──
export type LeaderboardPeriod = "today" | "week" | "month" | "last_month" | "all_time";

function periodRange(period: LeaderboardPeriod): { startISO: string; endISO?: string } {
  const now = new Date();
  if (period === "all_time") {
    return { startISO: new Date(2000, 0, 1).toISOString() };
  }
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { startISO: start.toISOString() };
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { startISO: d.toISOString() };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startISO: start.toISOString() };
  }
  // last_month
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export function useVALeaderboard(period: LeaderboardPeriod = "today") {
  return useQuery({
    queryKey: ["va-leaderboard", period],
    queryFn: async () => {
      const { startISO, endISO } = periodRange(period);

      let q = supabase
        .from("brandaro_va_score_events" as any)
        .select("va_user_id, points, event_type")
        .gte("created_at", startISO);
      if (endISO) q = q.lt("created_at", endISO);

      const { data, error } = await q;
      if (error) {
        console.error("Leaderboard fetch error:", error);
        return [];
      }

      // Aggregate by VA
      const scoreMap = new Map<string, number>();
      const callsMap = new Map<string, number>();
      const convMap = new Map<string, number>();
      const closeMap = new Map<string, number>();
      (data || []).forEach((e: any) => {
        scoreMap.set(e.va_user_id, (scoreMap.get(e.va_user_id) || 0) + (e.points || 0));
        if (e.event_type === "call_completed") {
          callsMap.set(e.va_user_id, (callsMap.get(e.va_user_id) || 0) + 1);
        }
        if (e.event_type === "conversation") {
          convMap.set(e.va_user_id, (convMap.get(e.va_user_id) || 0) + 1);
        }
        if (e.event_type === "closer_handoff" || e.event_type === "payment_lead") {
          closeMap.set(e.va_user_id, (closeMap.get(e.va_user_id) || 0) + 1);
        }
      });

      const vaIds = Array.from(scoreMap.keys());
      if (vaIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", vaIds);

      return vaIds
        .map(id => ({
          va_user_id: id,
          score: scoreMap.get(id) || 0,
          calls: callsMap.get(id) || 0,
          conversations: convMap.get(id) || 0,
          closes: closeMap.get(id) || 0,
          name: (profiles || []).find((p: any) => p.id === id)?.name || "VA",
          avatar: (profiles || []).find((p: any) => p.id === id)?.avatar_url,
        }))
        .sort((a, b) => b.score - a.score);
    },
    refetchInterval: 30000,
  });
}

// ── Task Queue ──
export function useVATaskQueue(vaId?: string) {
  return useQuery({
    queryKey: ["va-task-queue", vaId],
    queryFn: async () => {
      const userId = vaId || (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return [];

      const { data } = await supabase
        .from("brandaro_va_task_queue" as any)
        .select("*")
        .eq("va_user_id", userId)
        .in("status", ["pending", "active", "overdue"])
        .order("priority", { ascending: false })
        .order("due_at", { ascending: true })
        .limit(50);

      return (data || []) as any[];
    },
  });
}

// ── Complete Task ──
export function useCompleteVATask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes?: string }) => {
      const { error } = await supabase
        .from("brandaro_va_task_queue" as any)
        .update({ status: "completed", completed_at: new Date().toISOString(), notes })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["va-task-queue"] }),
  });
}

// ── Skip Task ──
export function useSkipVATask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("brandaro_va_task_queue" as any)
        .update({ status: "skipped", skipped_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["va-task-queue"] }),
  });
}

// ── Record Score Event ──
export function useRecordScoreEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: { event_type: string; reason?: string; related_lead_id?: string; related_task_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const points = SCORE_MAP[event.event_type] || 0;
      const { error } = await supabase
        .from("brandaro_va_score_events" as any)
        .insert({ va_user_id: user.id, event_type: event.event_type, points, ...event });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-leaderboard"] });
      qc.invalidateQueries({ queryKey: ["va-daily-perf"] });
    },
  });
}

// ── Badges ──
export function useVABadges(vaId?: string) {
  return useQuery({
    queryKey: ["va-badges", vaId],
    queryFn: async () => {
      const userId = vaId || (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return [];
      const { data } = await supabase
        .from("brandaro_va_badges" as any)
        .select("*")
        .eq("va_user_id", userId)
        .order("earned_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
  });
}

// ── Coaching ──
export function useVACoaching(vaId?: string) {
  return useQuery({
    queryKey: ["va-coaching", vaId],
    queryFn: async () => {
      const userId = vaId || (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return [];
      const { data } = await supabase
        .from("brandaro_va_coaching" as any)
        .select("*")
        .eq("va_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
  });
}

export function useAddCoachingNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: {
      va_user_id: string;
      notes: string;
      coaching_type?: string;
      quality_score?: number;
      strengths?: string[];
      weak_points?: string[];
      improvement_target?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("brandaro_va_coaching" as any)
        .insert({ ...note, manager_user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["va-coaching"] }),
  });
}

// ── VA Alerts (realtime) ──
export function useVAAlerts() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("va-alerts-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brandaro_va_alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["va-alerts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["va-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_va_alerts" as any)
        .select("*")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
  });
}

// ── Update Shift Status ──
export function useToggleShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (onShift: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const today = new Date().toISOString().split("T")[0];
      const update: any = { is_on_shift: onShift };
      if (onShift) update.shift_start = new Date().toISOString();
      else update.shift_end = new Date().toISOString();

      await supabase
        .from("brandaro_va_daily_performance" as any)
        .update(update)
        .eq("va_user_id", user.id)
        .eq("performance_date", today);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["va-daily-perf"] }),
  });
}

export { SCORE_MAP };
