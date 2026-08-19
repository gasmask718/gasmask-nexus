import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useStoreCallHistory — ONE unified call + text history for a store.
 *
 * The merge now lives in SQL: public.v_store_comms_detail unions
 * communication_logs, communication_messages, manual_call_logs,
 * messaging_messages, outbound_messages and dynasty_ai_calls (resolved to a
 * store through store_contacts by last-10 phone match) and applies RLS via
 * security_invoker. This hook only shapes the rows for the UI.
 */

export type StoreCallSource = "comm_log" | "manual" | "ai" | "message";

export interface StoreCallEntry {
  id: string;
  source: StoreCallSource;
  channel: "call" | "sms";
  isAI: boolean;
  direction: string | null;
  status: string | null;
  outcome: string | null;
  disposition: string | null;
  durationSeconds: number | null;
  phone: string | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  performedBy: string | null;
  sid: string | null;
  occurredAt: string;
}

const SOURCE_MAP: Record<string, StoreCallSource> = {
  communication_logs: "comm_log",
  communication_messages: "message",
  messaging_messages: "message",
  outbound_messages: "message",
  manual_call_logs: "manual",
  dynasty_ai_calls: "ai",
};

export function useStoreCallHistory(storeId?: string, limit = 100) {
  return useQuery({
    queryKey: ["store-call-history", storeId, limit],
    enabled: !!storeId,
    staleTime: 15_000,
    queryFn: async (): Promise<StoreCallEntry[]> => {
      const { data, error } = await (supabase as any)
        .from("v_store_comms_detail")
        .select("*")
        .eq("store_id", storeId!)
        .in("channel", ["call", "sms"])
        .order("occurred_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const entries: StoreCallEntry[] = (data || []).map((r: any) => ({
        id: `${r.source_table}-${r.source_id}`,
        source: SOURCE_MAP[r.source_table] || "comm_log",
        channel: r.channel === "sms" ? "sms" : "call",
        isAI: !!r.is_ai,
        direction: r.direction,
        status: r.status,
        outcome: r.outcome,
        disposition: r.outcome || r.status,
        durationSeconds: r.duration_seconds ?? null,
        phone: r.phone,
        summary: r.summary || r.body,
        transcript: r.transcript,
        recordingUrl: r.recording_url,
        performedBy: r.performed_by,
        sid: r.provider_sid,
        occurredAt: r.occurred_at || new Date(0).toISOString(),
      }));

      // The same Twilio/Bland call can be mirrored into more than one source.
      const seen = new Set<string>();
      return entries.filter((e) => {
        if (!e.sid) return true;
        if (seen.has(e.sid)) return false;
        seen.add(e.sid);
        return true;
      });
    },
  });
}
