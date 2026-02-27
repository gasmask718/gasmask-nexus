import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { useEffect, useMemo } from "react";

export interface LiveCall {
  id: string;
  call_sid: string | null;
  business_id: string | null;
  store_id: string | null;
  phone_number: string | null;
  agent_type: "ai" | "human" | "hybrid";
  voice_provider: string | null;
  state: "queued" | "dialing" | "ringing" | "answered" | "ai_active" | "human_connected" | "completed" | "failed";
  entity_name: string | null;
  run_id: string | null;
  source_reason: string | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface LiveTranscript {
  id: string;
  call_sid: string;
  live_call_id: string | null;
  speaker: "ai" | "human" | "caller" | "system";
  text: string;
  created_at: string;
}

export function useLiveCalls() {
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;
  const queryClient = useQueryClient();

  // Active calls (not completed/failed)
  const { data: activeCalls = [], isLoading } = useQuery({
    queryKey: ["live-calls-active", bizId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("live_calls")
        .select("*")
        .eq("business_id", bizId)
        .in("state", ["queued", "dialing", "ringing", "answered", "ai_active", "human_connected"])
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data as LiveCall[];
    },
    enabled: !!bizId,
    refetchInterval: 3000,
  });

  // Recent completed calls (last 20)
  const { data: recentCalls = [] } = useQuery({
    queryKey: ["live-calls-recent", bizId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("live_calls")
        .select("*")
        .eq("business_id", bizId)
        .in("state", ["completed", "failed"])
        .order("ended_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as LiveCall[];
    },
    enabled: !!bizId,
    refetchInterval: 10000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!bizId) return;

    const channel = supabase
      .channel("live-calls-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_calls" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-calls-active", bizId] });
          queryClient.invalidateQueries({ queryKey: ["live-calls-recent", bizId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bizId, queryClient]);

  // Stats
  const stats = useMemo(() => {
    const ringing = activeCalls.filter(c => c.state === "ringing").length;
    const answered = activeCalls.filter(c => c.state === "answered" || c.state === "ai_active" || c.state === "human_connected").length;
    const aiActive = activeCalls.filter(c => c.state === "ai_active" || (c.state === "answered" && c.agent_type === "ai")).length;
    const humanActive = activeCalls.filter(c => c.state === "human_connected" || (c.state === "answered" && c.agent_type === "human")).length;
    return { total: activeCalls.length, ringing, answered, aiActive, humanActive };
  }, [activeCalls]);

  return { activeCalls, recentCalls, isLoading, stats };
}

export function useLiveTranscripts(callSid: string | null) {
  const queryClient = useQueryClient();

  const { data: transcripts = [] } = useQuery({
    queryKey: ["live-transcripts", callSid],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("live_call_transcripts")
        .select("*")
        .eq("call_sid", callSid)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as LiveTranscript[];
    },
    enabled: !!callSid,
    refetchInterval: 2000,
  });

  // Realtime for transcripts
  useEffect(() => {
    if (!callSid) return;
    const channel = supabase
      .channel(`transcripts-${callSid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_call_transcripts", filter: `call_sid=eq.${callSid}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-transcripts", callSid] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callSid, queryClient]);

  return transcripts;
}
