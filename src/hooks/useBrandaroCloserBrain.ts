import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

// ── Call Sessions ──
export function useVACallSessions(limit = 20) {
  return useQuery({
    queryKey: ["va-call-sessions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("brandaro_va_call_sessions")
        .select("*")
        .eq("va_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateCallSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: {
      lead_id?: string;
      phone_number?: string;
      call_sid?: string;
      source?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .from("brandaro_va_call_sessions")
        .insert({
          va_user_id: user.id,
          ...session,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["va-call-sessions"] }),
  });
}

export function useEndCallSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, duration }: { sessionId: string; duration?: number }) => {
      const { error } = await (supabase as any)
        .from("brandaro_va_call_sessions")
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: duration || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["va-call-sessions"] }),
  });
}

// ── AI Analysis ──
export function useAnalyzeCallSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      call_session_id: string;
      transcript?: string;
      notes?: string;
      lead_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("brandaro-analyze-call", {
        body: { ...params, va_user_id: user.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-call-sessions"] });
      qc.invalidateQueries({ queryKey: ["va-lead-heat"] });
      qc.invalidateQueries({ queryKey: ["va-recommendations"] });
      qc.invalidateQueries({ queryKey: ["va-task-queue"] });
      qc.invalidateQueries({ queryKey: ["va-conversion-metrics"] });
      qc.invalidateQueries({ queryKey: ["va-closer-handoffs"] });
      toast.success("Call analyzed by AI");
    },
    onError: (err: any) => toast.error(`Analysis failed: ${err.message}`),
  });
}

// ── Lead Heat ──
export function useVALeadHeat(filter?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase.channel("lead-heat-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "brandaro_va_lead_heat" }, () => {
        qc.invalidateQueries({ queryKey: ["va-lead-heat"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["va-lead-heat", filter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("brandaro_va_lead_heat")
        .select("*")
        .order("heat_score", { ascending: false })
        .limit(50);
      if (filter === "hot") q = q.gte("heat_score", 70);
      if (filter === "closing") q = q.gte("heat_score", 90);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

// ── AI Recommendations ──
export function useVARecommendations() {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase.channel("recs-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brandaro_va_ai_recommendations" }, () => {
        qc.invalidateQueries({ queryKey: ["va-recommendations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["va-recommendations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("brandaro_va_ai_recommendations")
        .select("*")
        .eq("va_user_id", user.id)
        .eq("is_applied", false)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useApplyRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recId: string) => {
      const { error } = await (supabase as any)
        .from("brandaro_va_ai_recommendations")
        .update({ is_applied: true })
        .eq("id", recId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["va-recommendations"] }),
  });
}

// ── Closer Handoffs ──
export function useVACloserHandoffs(status?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase.channel("handoffs-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "brandaro_va_closer_handoffs" }, () => {
        qc.invalidateQueries({ queryKey: ["va-closer-handoffs"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["va-closer-handoffs", status],
    queryFn: async () => {
      let q = (supabase as any)
        .from("brandaro_va_closer_handoffs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAssignCloserHandoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ handoffId, closerId }: { handoffId: string; closerId: string }) => {
      const { error } = await (supabase as any)
        .from("brandaro_va_closer_handoffs")
        .update({ closer_user_id: closerId, status: "assigned", updated_at: new Date().toISOString() })
        .eq("id", handoffId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-closer-handoffs"] });
      toast.success("Closer assigned");
    },
  });
}

// ── Conversion Metrics ──
export function useVAConversionMetrics(period: "today" | "week" | "month" = "today") {
  return useQuery({
    queryKey: ["va-conversion-metrics", period],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const now = new Date();
      let startDate: string;
      if (period === "today") startDate = now.toISOString().split("T")[0];
      else if (period === "week") {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split("T")[0];
      } else {
        const d = new Date(now); d.setDate(d.getDate() - 30);
        startDate = d.toISOString().split("T")[0];
      }

      const { data, error } = await (supabase as any)
        .from("brandaro_va_conversion_metrics")
        .select("*")
        .eq("va_user_id", user.id)
        .gte("metric_date", startDate)
        .order("metric_date", { ascending: false });
      if (error) throw error;

      // Aggregate
      const rows = data || [];
      return rows.reduce((acc: any, r: any) => ({
        calls_completed: (acc.calls_completed || 0) + (r.calls_completed || 0),
        conversations: (acc.conversations || 0) + (r.conversations || 0),
        interested_leads: (acc.interested_leads || 0) + (r.interested_leads || 0),
        objections_handled: (acc.objections_handled || 0) + (r.objections_handled || 0),
        buying_signals_detected: (acc.buying_signals_detected || 0) + (r.buying_signals_detected || 0),
        demos_booked: (acc.demos_booked || 0) + (r.demos_booked || 0),
        closer_handoffs: (acc.closer_handoffs || 0) + (r.closer_handoffs || 0),
        payment_ready_leads: (acc.payment_ready_leads || 0) + (r.payment_ready_leads || 0),
        closes: (acc.closes || 0) + (r.closes || 0),
        revenue_generated: (acc.revenue_generated || 0) + (r.revenue_generated || 0),
        close_rate: r.close_rate || 0,
      }), {});
    },
  });
}

// ── All Handoffs (Manager) ──
export function useAllLeadHeat(minScore = 0) {
  return useQuery({
    queryKey: ["va-all-lead-heat", minScore],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_va_lead_heat")
        .select("*")
        .gte("heat_score", minScore)
        .order("heat_score", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });
}

// ── Objection Events (for coaching) ──
export function useVAObjectionEvents(sessionId?: string) {
  return useQuery({
    queryKey: ["va-objections", sessionId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("brandaro_va_objection_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (sessionId) q = q.eq("call_session_id", sessionId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !sessionId || !!sessionId,
  });
}

// ── All Conversion Metrics (Manager) ──
export function useAllConversionMetrics() {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["va-all-conversion-metrics", today],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_va_conversion_metrics")
        .select("*")
        .eq("metric_date", today);
      if (error) throw error;
      return data || [];
    },
  });
}
