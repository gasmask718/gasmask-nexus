import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo } from "react";

export interface ExecutionStats {
  total24h: number;
  callsInitiated: number;
  smsSent: number;
  paymentLinksSent: number;
  successCount: number;
  failCount: number;
  pendingFollowups: number;
  activeAutomations: number;
  triggerCounts: Record<string, number>;
  revenueGenerated: number;
}

export function useBrandaroAutomationStats() {
  const queryClient = useQueryClient();

  // Recent automation logs (last 24h)
  const { data: recentLogs = [], isLoading } = useQuery({
    queryKey: ["brandaro-automation-logs"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("brandaro_automation_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Execution log (last 24h)
  const { data: executionLogs = [] } = useQuery({
    queryKey: ["brandaro-execution-logs"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("brandaro_execution_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Pending follow-ups
  const { data: pendingFollowups = 0 } = useQuery({
    queryKey: ["brandaro-pending-followups"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("brandaro_followup_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Active automations count
  const { data: activeAutomations = 0 } = useQuery({
    queryKey: ["brandaro-active-automations"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("brandaro_automations")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count || 0;
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    const ch1 = supabase
      .channel("automation-log-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brandaro_automation_log" }, () => {
        queryClient.invalidateQueries({ queryKey: ["brandaro-automation-logs"] });
      })
      .subscribe();

    const ch2 = supabase
      .channel("execution-log-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brandaro_execution_log" }, () => {
        queryClient.invalidateQueries({ queryKey: ["brandaro-execution-logs"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [queryClient]);

  const stats: ExecutionStats = useMemo(() => {
    const triggerCounts: Record<string, number> = {};
    let successCount = 0;
    let failCount = 0;

    for (const log of recentLogs) {
      triggerCounts[log.trigger_type] = (triggerCounts[log.trigger_type] || 0) + 1;
      if (log.result === "success") successCount++;
      else if (log.result === "failed") failCount++;
    }

    const callsInitiated = executionLogs.filter((l: any) => l.action_type === "ai_call").length;
    const smsSent = executionLogs.filter((l: any) => l.action_type === "sms").length;
    const paymentLinksSent = executionLogs.filter((l: any) => l.action_type === "payment_link").length;
    const revenueGenerated = executionLogs.reduce((sum: number, l: any) => sum + (l.revenue_attributed || 0), 0);

    return {
      total24h: recentLogs.length,
      callsInitiated,
      smsSent,
      paymentLinksSent,
      successCount,
      failCount,
      triggerCounts,
      pendingFollowups,
      activeAutomations,
      revenueGenerated,
    };
  }, [recentLogs, executionLogs, pendingFollowups, activeAutomations]);

  return { stats, recentLogs, executionLogs, isLoading };
}
