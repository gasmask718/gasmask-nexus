import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Closer Sessions ──
export function useCloserSessions(filter?: string) {
  return useQuery({
    queryKey: ["brandaro-closer-sessions", filter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("brandaro_closer_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter === "open") q = q.eq("closed", false);
      if (filter === "closed") q = q.eq("closed", true);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });
}

// ── Human Handoff Queue ──
export function useHandoffQueue(status?: string) {
  return useQuery({
    queryKey: ["brandaro-handoff-queue", status],
    queryFn: async () => {
      let q = (supabase as any)
        .from("brandaro_human_handoff_queue")
        .select("*, brandaro_closer_sessions(*)")
        .order("handoff_score", { ascending: false })
        .limit(50);
      if (status) q = q.eq("status", status);
      else q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });
}

export function usePickHandoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ handoffId, closerId }: { handoffId: string; closerId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("brandaro_human_handoff_queue")
        .update({ status: "in_progress", assigned_closer: closerId || user?.id, picked_at: new Date().toISOString() })
        .eq("id", handoffId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-handoff-queue"] });
      toast.success("Handoff picked up");
    },
  });
}

export function useResolveHandoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ handoffId, outcome, notes }: { handoffId: string; outcome: string; notes?: string }) => {
      const { error } = await (supabase as any)
        .from("brandaro_human_handoff_queue")
        .update({ status: "resolved", outcome, closer_notes: notes, resolved_at: new Date().toISOString() })
        .eq("id", handoffId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-handoff-queue"] });
      toast.success("Handoff resolved");
    },
  });
}

// ── Rebuttals ──
export function useRebuttals() {
  return useQuery({
    queryKey: ["brandaro-closer-rebuttals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_closer_rebuttals")
        .select("*")
        .eq("is_current", true)
        .order("times_used", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Playbooks ──
export function usePlaybooks() {
  return useQuery({
    queryKey: ["brandaro-closer-playbooks"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_closer_playbooks")
        .select("*")
        .eq("is_active", true)
        .eq("is_current", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Win/Loss ──
export function useWinLossAnalysis() {
  return useQuery({
    queryKey: ["brandaro-win-loss"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_win_loss_analysis")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Close Reviews ──
export function useCloseReviews() {
  return useQuery({
    queryKey: ["brandaro-close-reviews"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_close_reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSubmitCloseReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (review: Record<string, any>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("brandaro_close_reviews")
        .insert({ ...review, reviewer_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brandaro-close-reviews"] });
      toast.success("Review submitted");
    },
  });
}

// ── Closer KPIs ──
export function useCloserKPIs() {
  return useQuery({
    queryKey: ["brandaro-closer-kpis"],
    queryFn: async () => {
      const { data: sessions } = await (supabase as any)
        .from("brandaro_closer_sessions")
        .select("closed, outcome, payment_link_sent, payment_link_clicked, session_type, priority_score, close_probability, created_at");
      const items = sessions || [];
      const total = items.length;
      const won = items.filter((s: any) => s.closed && s.outcome === "won").length;
      const lost = items.filter((s: any) => s.outcome === "lost").length;
      const linksSent = items.filter((s: any) => s.payment_link_sent).length;
      const linksClicked = items.filter((s: any) => s.payment_link_clicked).length;
      const aiOnly = items.filter((s: any) => s.closed && s.session_type !== "human").length;
      const humanAssisted = items.filter((s: any) => s.closed && s.session_type === "human").length;

      const { data: winLoss } = await (supabase as any)
        .from("brandaro_win_loss_analysis")
        .select("result, deal_value, touches_to_close");
      const wl = winLoss || [];
      const totalRevenue = wl.filter((w: any) => w.result === "won").reduce((s: number, w: any) => s + (w.deal_value || 0), 0);
      const avgTouches = wl.length > 0 ? Math.round(wl.reduce((s: number, w: any) => s + (w.touches_to_close || 0), 0) / wl.length) : 0;

      return {
        totalSessions: total,
        closeRate: total > 0 ? Math.round((won / total) * 100) : 0,
        won,
        lost,
        linksSent,
        linksClicked,
        linkConversion: linksSent > 0 ? Math.round((linksClicked / linksSent) * 100) : 0,
        aiOnlyWins: aiOnly,
        humanAssistedWins: humanAssisted,
        totalRevenue,
        avgTouchesToClose: avgTouches,
      };
    },
  });
}

// ── Payment Push ──
export function usePaymentPushQueue() {
  return useQuery({
    queryKey: ["brandaro-payment-push"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_closer_sessions")
        .select("*")
        .eq("payment_link_sent", true)
        .eq("closed", false)
        .order("payment_link_sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });
}
