import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * usePhoneLog — the unified per-number phone log.
 *
 * ONE canonical source: communication_logs (channel = call | sms). Rows are
 * grouped by the *counterparty* number (whoever isn't us), so a store's calls,
 * texts, voicemails and recordings all sit on one thread — exactly how it
 * looks on a phone.
 */

export type PhoneChannel = "call" | "sms";

export interface PhoneLogEntry {
  id: string;
  channel: PhoneChannel;
  direction: string | null;
  event_type: string | null;
  status: string | null;
  outcome: string | null;
  summary: string | null;
  message_content: string | null;
  transcript: string | null;
  recording_url: string | null;
  twilio_sid: string | null;
  twilio_call_sid: string | null;
  call_duration: number | null;
  sender_phone: string | null;
  recipient_phone: string | null;
  store_id: string | null;
  contact_id: string | null;
  performed_by: string | null;
  created_at: string;
  /** The number on the other end of the line. */
  counterparty: string;
}

export interface PhoneThread {
  number: string;
  entries: PhoneLogEntry[];
  lastAt: string;
  lastPreview: string;
  storeId: string | null;
  storeName: string | null;
  callCount: number;
  smsCount: number;
  recordingCount: number;
  voicemailCount: number;
  hasInboundLast: boolean;
}

export const last10 = (v?: string | null) => (v || "").replace(/\D/g, "").slice(-10);

export const prettyPhone = (v?: string | null) => {
  const d = last10(v);
  if (d.length !== 10) return v || "Unknown";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

const previewOf = (e: PhoneLogEntry) => {
  if (e.channel === "sms") return e.message_content || e.summary || "(no text)";
  if (e.outcome === "voicemail" || e.status === "voicemail") return `🎙️ Voicemail${e.transcript ? `: ${e.transcript}` : ""}`;
  return e.summary || `${e.direction === "inbound" ? "Incoming" : "Outgoing"} call${e.status ? ` — ${e.status}` : ""}`;
};

export function usePhoneLog(opts: { storeId?: string; number?: string; limit?: number } = {}) {
  const { storeId, number, limit = 500 } = opts;

  return useQuery({
    queryKey: ["phone-log", storeId ?? null, number ? last10(number) : null, limit],
    queryFn: async (): Promise<PhoneThread[]> => {
      const COLUMNS =
        "id, channel, direction, event_type, status, outcome, summary, message_content, transcript, recording_url, twilio_sid, twilio_call_sid, call_duration, sender_phone, recipient_phone, store_id, contact_id, performed_by, created_at";

      // Calls and texts are fetched separately: SMS volume is orders of
      // magnitude higher, so a single capped query would bury every call.
      const fetchChannel = async (channel: PhoneChannel, cap: number) => {
        let q = supabase
          .from("communication_logs")
          .select(COLUMNS)
          .eq("channel", channel)
          .order("created_at", { ascending: false })
          .limit(cap);
        if (storeId) q = q.eq("store_id", storeId);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      };

      const [calls, texts] = await Promise.all([
        fetchChannel("call", Math.max(200, Math.floor(limit / 2))),
        fetchChannel("sms", limit),
      ]);

      const rows = [...calls, ...texts]
        .map((r: Record<string, unknown>) => {
          const e = r as unknown as PhoneLogEntry;
          const counterparty =
            e.direction === "inbound" ? e.sender_phone || e.recipient_phone : e.recipient_phone || e.sender_phone;
          return { ...e, counterparty: last10(counterparty) || "unknown" };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));


      const filtered = number ? rows.filter((r) => r.counterparty === last10(number)) : rows;

      // Resolve store names in one shot.
      const storeIds = [...new Set(filtered.map((r) => r.store_id).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (storeIds.length) {
        const { data: stores } = await supabase.from("stores").select("id, name").in("id", storeIds);
        (stores || []).forEach((s: { id: string; name: string }) => names.set(s.id, s.name));
      }

      const threads = new Map<string, PhoneThread>();
      for (const r of filtered) {
        let t = threads.get(r.counterparty);
        if (!t) {
          t = {
            number: r.counterparty,
            entries: [],
            lastAt: r.created_at,
            lastPreview: previewOf(r),
            storeId: r.store_id,
            storeName: r.store_id ? names.get(r.store_id) || null : null,
            callCount: 0,
            smsCount: 0,
            recordingCount: 0,
            voicemailCount: 0,
            hasInboundLast: r.direction === "inbound",
          };
          threads.set(r.counterparty, t);
        }
        t.entries.push(r);
        if (r.channel === "call") t.callCount++;
        else t.smsCount++;
        if (r.recording_url) t.recordingCount++;
        if (r.outcome === "voicemail" || r.status === "voicemail") t.voicemailCount++;
        if (!t.storeId && r.store_id) {
          t.storeId = r.store_id;
          t.storeName = names.get(r.store_id) || null;
        }
      }

      return [...threads.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    },
    staleTime: 15_000,
  });
}
