import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface LiveCallSession {
  id: string;
  call_id: string | null;
  business_id: string | null;
  store_id: string | null;
  contact_id: string | null;
  flow_id: string | null;
  persona_id: string | null;
  current_node_id: string | null;
  status: "initiated" | "ringing" | "ai_active" | "human_active" | "on_hold" | "completed" | "failed";
  handoff_state: "none" | "pending_to_human" | "human_active" | "back_to_ai";
  assigned_agent_id: string | null;
  transcript: string | null;
  ai_notes: string | null;
  call_summary: string | null;
  sentiment_trend: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  store?: { id: string; store_name: string } | null;
  business?: { id: string; name: string } | null;
  persona?: { id: string; name: string; default_tone: string } | null;
}

export interface ToneEvent {
  id: string;
  session_id: string;
  old_tone: string | null;
  new_tone: string;
  reason: string | null;
  created_at: string;
}

export interface CallReason {
  id: string;
  call_id: string | null;
  session_id: string | null;
  business_id: string | null;
  store_id: string | null;
  reason: string;
  secondary_reasons: string[] | null;
  confidence: number | null;
  created_at: string;
}

export function useLiveCallSessions(businessId?: string) {
  const queryClient = useQueryClient();

  // Fetch active call sessions
  const { data: activeSessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ["live-call-sessions", businessId],
    queryFn: async () => {
      let query = supabase
        .from("ai_call_sessions")
        .select(`
          *,
          store:store_master(id, store_name),
          business:businesses(id, name),
          persona:voice_personas(id, name, default_tone)
        `)
        .in("status", ["initiated", "ringing", "ai_active", "human_active", "on_hold"])
        .order("created_at", { ascending: false });

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as LiveCallSession[];
    },
    refetchInterval: 5000, // Poll every 5 seconds for live updates
  });

  // Fetch recent completed sessions
  const { data: recentSessions = [], isLoading: recentLoading } = useQuery({
    queryKey: ["recent-call-sessions", businessId],
    queryFn: async () => {
      let query = supabase
        .from("ai_call_sessions")
        .select(`
          *,
          store:store_master(id, store_name),
          business:businesses(id, name)
        `)
        .in("status", ["completed", "failed"])
        .order("updated_at", { ascending: false })
        .limit(20);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as LiveCallSession[];
    },
  });

  // Fetch call reasons
  const { data: callReasons = [] } = useQuery({
    queryKey: ["call-reasons", businessId],
    queryFn: async () => {
      let query = supabase
        .from("call_reasons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CallReason[];
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("live-calls")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_call_sessions",
        },
        () => {
          refetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchSessions]);

  // Take over call (human handoff)
  const takeOverCallMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("ai_call_sessions")
        .update({
          status: "human_active",
          handoff_state: "human_active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      if (error) throw error;

      // Log tone event for handoff
      await supabase.from("ai_call_tone_events").insert({
        session_id: sessionId,
        old_tone: "ai_controlled",
        new_tone: "human_controlled",
        reason: "Manual operator takeover",
      });
    },
    onSuccess: () => {
      refetchSessions();
      toast.success("Call taken over - you are now live");
    },
    onError: (error: Error) => {
      toast.error(`Handoff failed: ${error.message}`);
    },
  });

  // Return control to AI
  const returnToAIMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("ai_call_sessions")
        .update({
          status: "ai_active",
          handoff_state: "back_to_ai",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      if (error) throw error;

      await supabase.from("ai_call_tone_events").insert({
        session_id: sessionId,
        old_tone: "human_controlled",
        new_tone: "ai_controlled",
        reason: "Control returned to AI",
      });
    },
    onSuccess: () => {
      refetchSessions();
      toast.success("Control returned to AI");
    },
    onError: (error: Error) => {
      toast.error(`Return failed: ${error.message}`);
    },
  });

  // End call
  const endCallMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("ai_call_sessions")
        .update({
          status: "completed",
          handoff_state: "none",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSessions();
      toast.success("Call ended");
    },
    onError: (error: Error) => {
      toast.error(`End call failed: ${error.message}`);
    },
  });

  // Log tone change
  const logToneChangeMutation = useMutation({
    mutationFn: async (data: { sessionId: string; oldTone: string; newTone: string; reason: string }) => {
      const { error } = await supabase.from("ai_call_tone_events").insert({
        session_id: data.sessionId,
        old_tone: data.oldTone,
        new_tone: data.newTone,
        reason: data.reason,
      });
      if (error) throw error;
    },
  });

  // Add call reason
  const addCallReasonMutation = useMutation({
    mutationFn: async (data: { sessionId: string; reason: string; confidence: number; secondaryReasons?: string[] }) => {
      const session = activeSessions.find(s => s.id === data.sessionId);
      const { error } = await supabase.from("call_reasons").insert({
        session_id: data.sessionId,
        business_id: session?.business_id,
        store_id: session?.store_id,
        reason: data.reason,
        secondary_reasons: data.secondaryReasons,
        confidence: data.confidence,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-reasons"] });
    },
  });

  // Stats
  const activeCount = activeSessions.filter(s => ["ai_active", "human_active"].includes(s.status)).length;
  const pendingHandoffs = activeSessions.filter(s => s.handoff_state === "pending_to_human").length;
  const humanActiveCount = activeSessions.filter(s => s.status === "human_active").length;

  return {
    activeSessions,
    recentSessions,
    callReasons,
    sessionsLoading,
    recentLoading,
    refetchSessions,
    takeOverCall: takeOverCallMutation.mutate,
    isTakingOver: takeOverCallMutation.isPending,
    returnToAI: returnToAIMutation.mutate,
    isReturning: returnToAIMutation.isPending,
    endCall: endCallMutation.mutate,
    isEnding: endCallMutation.isPending,
    logToneChange: logToneChangeMutation.mutate,
    addCallReason: addCallReasonMutation.mutate,
    stats: {
      activeCount,
      pendingHandoffs,
      humanActiveCount,
      totalActive: activeSessions.length,
    },
  };
}
