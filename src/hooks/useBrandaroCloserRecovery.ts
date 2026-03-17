import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Payment Recovery Queue ──
export function usePaymentRecoveryQueue() {
  return useQuery({
    queryKey: ["brandaro-payment-recovery"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_payment_recovery")
        .select("*")
        .order("scheduled_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });
}

// ── Trigger Payment Recovery Sequence ──
export function useTriggerPaymentRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, leadId }: { sessionId: string; leadId: string }) => {
      const messages = [
        { step: 1, minutes: 10, msg: "Hey — I saw you checked it out, want me to lock this in for you today? 🔥" },
        { step: 2, minutes: 120, msg: "We still have your spot open — once we secure it we can launch within 48 hours ⚡" },
        { step: 3, minutes: 1440, msg: "Last call before we release your spot — should I secure it for you? This is your final chance at this price." },
      ];

      for (const m of messages) {
        const scheduledAt = new Date(Date.now() + m.minutes * 60000).toISOString();
        await (supabase as any).from("brandaro_payment_recovery").insert({
          session_id: sessionId,
          lead_id: leadId,
          step: m.step,
          message_content: m.msg,
          scheduled_at: scheduledAt,
          status: "pending",
          channel: "sms",
        });
      }

      // Update session recovery tracking
      await (supabase as any)
        .from("brandaro_closer_sessions")
        .update({ recovery_attempts: 1, last_recovery_at: new Date().toISOString() })
        .eq("id", sessionId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-payment-recovery"] });
      qc.invalidateQueries({ queryKey: ["brandaro-payment-push"] });
      toast.success("Payment recovery sequence triggered — 3 follow-ups queued");
    },
  });
}

// ── Recovery KPIs ──
export function useRecoveryKPIs() {
  return useQuery({
    queryKey: ["brandaro-recovery-kpis"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_payment_recovery")
        .select("status, recovered, recovered_amount");
      const items = data || [];
      const total = items.length;
      const sent = items.filter((i: any) => i.status === "sent").length;
      const recovered = items.filter((i: any) => i.recovered).length;
      const revenue = items.reduce((s: number, i: any) => s + (i.recovered_amount || 0), 0);
      return {
        totalMessages: total,
        sent,
        recovered,
        recoveryRate: sent > 0 ? Math.round((recovered / sent) * 100) : 0,
        recoveredRevenue: revenue,
      };
    },
  });
}

// ── Closer Alerts (Real-time) ──
export function useCloserAlerts() {
  return useQuery({
    queryKey: ["brandaro-closer-alerts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_closer_alerts")
        .select("*")
        .eq("seen", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      await (supabase as any)
        .from("brandaro_closer_alerts")
        .update({ seen: true })
        .eq("id", alertId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-closer-alerts"] });
    },
  });
}

// ── Auto-Handoff Trigger ──
export function useAutoHandoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: any) => {
      // Check if already in handoff queue
      const { data: existing } = await (supabase as any)
        .from("brandaro_human_handoff_queue")
        .select("id")
        .eq("session_id", session.id)
        .eq("status", "pending")
        .limit(1);

      if (existing && existing.length > 0) return;

      // Determine reason
      const reasons: string[] = [];
      if (session.close_probability >= 70) reasons.push("Close probability ≥ 70%");
      if (session.payment_link_clicked) reasons.push("Payment link clicked");
      if (["premium", "elite"].includes(session.package_interest)) reasons.push(`${session.package_interest} package`);
      if (session.objection_detected) reasons.push(`Objection: ${session.objection_detected}`);

      // Calculate boosted priority
      let priority = session.priority_score || 0;
      if (session.package_interest === "elite") priority += 40;
      else if (session.package_interest === "premium") priority += 30;
      if (session.payment_link_clicked) priority += 25;
      if (session.session_type === "inbound") priority += 20;

      await (supabase as any).from("brandaro_human_handoff_queue").insert({
        session_id: session.id,
        lead_id: session.lead_id,
        handoff_score: session.handoff_score || priority,
        reason: reasons.join(" · ") || "Auto-handoff triggered",
        package_tier: session.package_interest,
        deal_value: session.package_interest === "elite" ? 5000 : session.package_interest === "premium" ? 3000 : 1500,
        status: "pending",
      });

      // Create alert
      await (supabase as any).from("brandaro_closer_alerts").insert({
        alert_type: "hot_handoff",
        lead_id: session.lead_id,
        session_id: session.id,
        title: `🔥 Hot Lead Auto-Handoff`,
        detail: reasons.join(" · "),
        priority,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-handoff-queue"] });
      qc.invalidateQueries({ queryKey: ["brandaro-closer-alerts"] });
      toast.success("Lead auto-escalated to human closer");
    },
  });
}

// ── Enhanced Priority Score Calculator ──
export function calculateBoostedPriority(session: any): number {
  let score = 0;

  // Base scores
  score += (session.handoff_score || 0) * 0.25;
  score += (session.close_probability || 0) * 0.25;
  score += (session.urgency_score || 0) * 0.10;

  // Payment intent
  if (session.payment_link_clicked) score += 25;
  else if (session.payment_link_sent) score += 10;

  // Package value boost
  if (session.package_interest === "elite") score += 40;
  else if (session.package_interest === "premium") score += 30;
  else if (session.package_interest === "growth") score += 15;

  // Inbound boost
  if (session.session_type === "inbound") score += 20;

  // Returning lead
  if (session.recovery_attempts > 0) score += 15;

  return Math.round(score);
}
