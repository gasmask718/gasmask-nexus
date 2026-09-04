import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Communication awareness — read/unread messages and missed/unhandled calls.
 *
 * ONE canonical source: public.communication_logs. No second notification
 * system, no second message table. Read state lives on the same row as the
 * message (read_at / read_by); missed-call resolution lives on the same row
 * as the call (handled_at / handled_by).
 *
 * Nothing is ever marked read or handled implicitly — the caller must ask.
 */

export const CALL_CHANNELS = ["call", "voice", "phone"];

export const MISSED_STATUSES = [
  "no-answer",
  "no_answer",
  "missed",
  "busy",
  "failed",
  "canceled",
  "cancelled",
  "voicemail",
];

export function isMissedCall(row: any) {
  if (!CALL_CHANNELS.includes(row?.channel)) return false;
  const s = String(row?.status ?? row?.outcome ?? "").toLowerCase();
  if (MISSED_STATUSES.includes(s)) return true;
  // Answered calls have an answer timestamp or real duration.
  const answered = !!row?.answered_at || Number(row?.duration_seconds || row?.call_duration || 0) > 0;
  return !answered;
}

export function isUnreadMessage(row: any) {
  return row?.direction === "inbound" && !CALL_CHANNELS.includes(row?.channel) && !row?.read_at;
}

export function isUnresolvedCall(row: any) {
  return CALL_CHANNELS.includes(row?.channel) && isMissedCall(row) && !row?.handled_at;
}

/** Awareness counters for a scope (whole hub, or one store). */
export function useCommsAwareness(opts: { storeId?: string; days?: number } = {}) {
  const { storeId, days = 90 } = opts;

  return useQuery({
    queryKey: ["comms-awareness", storeId ?? "all", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      let q = (supabase as any)
        .from("communication_logs")
        .select(
          "id, channel, direction, status, outcome, answered_at, duration_seconds, call_duration, read_at, handled_at, created_at",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (storeId) q = q.eq("store_id", storeId);

      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];

      return {
        unreadMessages: rows.filter(isUnreadMessage).length,
        unresolvedCalls: rows.filter(isUnresolvedCall).length,
        inboundMessages: rows.filter(
          (r: any) => r.direction === "inbound" && !CALL_CHANNELS.includes(r.channel),
        ).length,
        answeredCalls: rows.filter(
          (r: any) => CALL_CHANNELS.includes(r.channel) && !isMissedCall(r),
        ).length,
        missedCalls: rows.filter((r: any) => CALL_CHANNELS.includes(r.channel) && isMissedCall(r))
          .length,
      };
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return 0;
      const { data, error } = await (supabase as any).rpc("mark_communication_read", { _ids: ids });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comms-awareness"] });
      qc.invalidateQueries({ queryKey: ["communication-canonical-logs"] });
      qc.invalidateQueries({ queryKey: ["phone-log"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not mark as read"),
  });
}

export function useMarkCallHandled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; note?: string }) => {
      const { error } = await (supabase as any).rpc("mark_call_handled", {
        _id: vars.id,
        _note: vars.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Call marked handled");
      qc.invalidateQueries({ queryKey: ["comms-awareness"] });
      qc.invalidateQueries({ queryKey: ["communication-canonical-logs"] });
      qc.invalidateQueries({ queryKey: ["phone-log"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not mark call handled"),
  });
}
