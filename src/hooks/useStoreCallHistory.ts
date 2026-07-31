import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useStoreCallHistory — ONE unified call + text history for a store.
 *
 * Merges the three places a GasMask store conversation can land:
 *   1. communication_logs   → browser/operator calls + SMS (canonical)
 *   2. manual_call_logs     → manually dialled / logged calls
 *   3. dynasty_ai_calls     → AI-placed calls linked via source_table/source_id
 *
 * Deduped on twilio sid, newest first.
 */

export type StoreCallSource = "comm_log" | "manual" | "ai";

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

const ts = (...v: (string | null | undefined)[]) =>
  v.find((x) => !!x) || new Date(0).toISOString();

export function useStoreCallHistory(storeId?: string, limit = 100) {
  return useQuery({
    queryKey: ["store-call-history", storeId, limit],
    enabled: !!storeId,
    staleTime: 15_000,
    queryFn: async (): Promise<StoreCallEntry[]> => {
      const [logsRes, manualRes, aiRes] = await Promise.all([
        supabase
          .from("communication_logs")
          .select(
            "id, channel, direction, status, outcome, delivery_status, call_duration, duration_seconds, recipient_phone, sender_phone, summary, message_content, transcript, transcription, recording_url, performed_by, ai_assisted, bland_ai_handled, twilio_call_sid, twilio_sid, started_at, sent_at, created_at",
          )
          .eq("store_id", storeId!)
          .in("channel", ["call", "sms"])
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("manual_call_logs")
          .select(
            "id, direction, status, outcome, notes, duration_seconds, phone_number, to_number, from_number, started_at, created_at",
          )
          .eq("store_id", storeId!)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("dynasty_ai_calls")
          .select(
            "id, call_id, direction, outcome, next_action, duration_seconds, to_number, from_number, transcript, recording_url, agent_name, call_started_at, created_at",
          )
          .in("source_table", ["stores", "store_master"])
          .eq("source_id", storeId!)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      if (logsRes.error) throw logsRes.error;
      if (manualRes.error) throw manualRes.error;
      if (aiRes.error) throw aiRes.error;

      const entries: StoreCallEntry[] = [];

      for (const r of logsRes.data || []) {
        const row = r as Record<string, any>;
        entries.push({
          id: `log-${row.id}`,
          source: "comm_log",
          channel: row.channel === "sms" ? "sms" : "call",
          isAI: !!row.ai_assisted || !!row.bland_ai_handled,
          direction: row.direction,
          status: row.status || row.delivery_status,
          outcome: row.outcome,
          disposition: row.outcome || row.status || row.delivery_status,
          durationSeconds: row.duration_seconds ?? row.call_duration ?? null,
          phone:
            row.direction === "inbound"
              ? row.sender_phone || row.recipient_phone
              : row.recipient_phone || row.sender_phone,
          summary: row.summary || row.message_content,
          transcript: row.transcript || row.transcription,
          recordingUrl: row.recording_url,
          performedBy: row.performed_by,
          sid: row.twilio_call_sid || row.twilio_sid,
          occurredAt: ts(row.started_at, row.sent_at, row.created_at),
        });
      }

      for (const r of manualRes.data || []) {
        const row = r as Record<string, any>;
        entries.push({
          id: `manual-${row.id}`,
          source: "manual",
          channel: "call",
          isAI: false,
          direction: row.direction,
          status: row.status,
          outcome: row.outcome,
          disposition: row.outcome || row.status,
          durationSeconds: row.duration_seconds ?? null,
          phone: row.phone_number || row.to_number || row.from_number,
          summary: row.notes,
          transcript: null,
          recordingUrl: null,
          performedBy: null,
          sid: null,
          occurredAt: ts(row.started_at, row.created_at),
        });
      }

      for (const r of aiRes.data || []) {
        const row = r as Record<string, any>;
        entries.push({
          id: `ai-${row.id}`,
          source: "ai",
          channel: "call",
          isAI: true,
          direction: row.direction,
          status: row.outcome,
          outcome: row.outcome,
          disposition: row.next_action || row.outcome,
          durationSeconds: row.duration_seconds ?? null,
          phone: row.to_number || row.from_number,
          summary: row.agent_name ? `AI agent: ${row.agent_name}` : null,
          transcript: row.transcript,
          recordingUrl: row.recording_url,
          performedBy: row.agent_name,
          sid: row.call_id,
          occurredAt: ts(row.call_started_at, row.created_at),
        });
      }

      // Dedupe: the same Twilio call can be mirrored into more than one table.
      const seen = new Set<string>();
      return entries
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .filter((e) => {
          if (!e.sid) return true;
          if (seen.has(e.sid)) return false;
          seen.add(e.sid);
          return true;
        })
        .slice(0, limit);
    },
  });
}
