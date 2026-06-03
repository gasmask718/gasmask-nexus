import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useCallHistoryForSource — pull every AI call linked to a hub record.
 *
 * Filters dynasty_ai_calls by (source_table, source_id). Returns the
 * unified call list any hub profile page can render via FinishedCallsBoard
 * or a custom timeline.
 */
export interface SourceCall {
  id: string;
  call_id: string | null;
  business_unit: string | null;
  agent_id: string | null;
  direction: string | null;
  from_number: string | null;
  to_number: string | null;
  contact_name: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  recording_url: string | null;
  transcript: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  created_at: string;
}

export function useCallHistoryForSource(
  sourceTable: string | null | undefined,
  sourceId: string | null | undefined,
  options: { limit?: number; enabled?: boolean } = {},
) {
  const { limit = 50, enabled = true } = options;

  return useQuery({
    queryKey: ["call-history-for-source", sourceTable, sourceId, limit],
    enabled: !!sourceTable && !!sourceId && enabled,
    queryFn: async (): Promise<SourceCall[]> => {
      const { data, error } = await supabase
        .from("dynasty_ai_calls")
        .select(
          "id, call_id, business_unit, agent_id, direction, from_number, to_number, contact_name, duration_seconds, outcome, recording_url, transcript, call_started_at, call_ended_at, created_at",
        )
        .eq("source_table", sourceTable!)
        .eq("source_id", sourceId!)
        .order("call_started_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as SourceCall[];
    },
    staleTime: 15_000,
  });
}
