import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface CallParticipant {
  id: string;
  session_id: string;
  participant_type: "ai_agent" | "human_agent" | "store_contact" | "driver" | "biker" | "other";
  agent_id: string | null;
  user_id: string | null;
  contact_id: string | null;
  role: "speaker" | "listener" | "whisper_only";
  joined_at: string;
  left_at: string | null;
  agent?: { id: string; name: string; role: string } | null;
}

export interface ActiveSpeakerEntry {
  id: string;
  session_id: string;
  agent_id: string | null;
  participant_id: string | null;
  participant_type: string;
  started_at: string;
  ended_at: string | null;
  agent?: { id: string; name: string } | null;
}

export interface WhisperEvent {
  id: string;
  session_id: string;
  agent_id: string;
  human_participant_id: string;
  suggestion: string;
  created_at: string;
  agent?: { id: string; name: string } | null;
}

export interface CallRoutingRule {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export function useVoiceOrchestration(businessId?: string) {
  const queryClient = useQueryClient();

  // Fetch active multi-party sessions
  const { data: multiPartySessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ["multi-party-sessions", businessId],
    queryFn: async () => {
      let query = supabase
        .from("ai_call_sessions")
        .select(`
          *,
          store:store_master(id, store_name),
          business:businesses(id, name),
          persona:voice_personas(id, name),
          primary_agent:ai_agents!ai_call_sessions_primary_agent_id_fkey(id, name, role),
          switchboard_agent:ai_agents!ai_call_sessions_switchboard_agent_id_fkey(id, name, role)
        `)
        .eq("is_multi_party", true)
        .in("status", ["ai_active", "human_active", "pending"])
        .order("created_at", { ascending: false });

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch participants for a session
  const fetchParticipants = async (sessionId: string): Promise<CallParticipant[]> => {
    const { data, error } = await supabase
      .from("call_participants")
      .select(`
        *,
        agent:ai_agents(id, name, role)
      `)
      .eq("session_id", sessionId)
      .is("left_at", null)
      .order("joined_at", { ascending: true });

    if (error) throw error;
    return data as CallParticipant[];
  };

  // Fetch speaker log for a session
  const fetchSpeakerLog = async (sessionId: string): Promise<ActiveSpeakerEntry[]> => {
    const { data, error } = await supabase
      .from("active_speaker_log")
      .select(`
        *,
        agent:ai_agents(id, name)
      `)
      .eq("session_id", sessionId)
      .order("started_at", { ascending: true });

    if (error) throw error;
    return data as ActiveSpeakerEntry[];
  };

  // Fetch whisper events for a session
  const fetchWhisperEvents = async (sessionId: string): Promise<WhisperEvent[]> => {
    const { data, error } = await supabase
      .from("whisper_coaching_events")
      .select(`
        *,
        agent:ai_agents(id, name)
      `)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data as WhisperEvent[];
  };

  // Fetch routing rules
  const { data: routingRules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["call-routing-rules", businessId],
    queryFn: async () => {
      let query = supabase
        .from("call_routing_rules")
        .select("*")
        .order("priority", { ascending: false });

      if (businessId) {
        query = query.or(`business_id.eq.${businessId},business_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CallRoutingRule[];
    },
  });

  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async (params: {
      sessionId: string;
      participantType: CallParticipant["participant_type"];
      agentId?: string;
      userId?: string;
      contactId?: string;
      role?: CallParticipant["role"];
    }) => {
      const { error } = await supabase.from("call_participants").insert({
        session_id: params.sessionId,
        participant_type: params.participantType,
        agent_id: params.agentId,
        user_id: params.userId,
        contact_id: params.contactId,
        role: params.role || "listener",
      });
      if (error) throw error;

      // Mark session as multi-party
      await supabase
        .from("ai_call_sessions")
        .update({ is_multi_party: true })
        .eq("id", params.sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-party-sessions"] });
      toast.success("Participant added to call");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remove participant mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase
        .from("call_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-party-sessions"] });
      toast.success("Participant removed from call");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Promote to speaker mutation
  const promoteToSpeakerMutation = useMutation({
    mutationFn: async (params: { participantId: string; sessionId: string }) => {
      // Demote current speakers to listeners
      await supabase
        .from("call_participants")
        .update({ role: "listener" })
        .eq("session_id", params.sessionId)
        .eq("role", "speaker");

      // Promote selected participant
      const { error } = await supabase
        .from("call_participants")
        .update({ role: "speaker" })
        .eq("id", params.participantId);
      if (error) throw error;

      // Log speaker change
      const { data: participant } = await supabase
        .from("call_participants")
        .select("participant_type, agent_id")
        .eq("id", params.participantId)
        .single();

      if (participant) {
        await supabase.from("active_speaker_log").insert({
          session_id: params.sessionId,
          participant_id: params.participantId,
          participant_type: participant.participant_type,
          agent_id: participant.agent_id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-party-sessions"] });
      toast.success("Participant promoted to speaker");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Demote to listener mutation
  const demoteToListenerMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase
        .from("call_participants")
        .update({ role: "listener" })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-party-sessions"] });
      toast.success("Participant demoted to listener");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Send whisper coaching
  const sendWhisperMutation = useMutation({
    mutationFn: async (params: {
      sessionId: string;
      agentId: string;
      humanParticipantId: string;
      suggestion: string;
    }) => {
      const { error } = await supabase.from("whisper_coaching_events").insert({
        session_id: params.sessionId,
        agent_id: params.agentId,
        human_participant_id: params.humanParticipantId,
        suggestion: params.suggestion,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Whisper coaching sent");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Create routing rule mutation
  const createRoutingRuleMutation = useMutation({
    mutationFn: async (rule: {
      business_id: string | null;
      name: string;
      description: string | null;
      condition: Record<string, unknown>;
      action: Record<string, unknown>;
      priority: number;
      is_active: boolean;
    }) => {
      const { error } = await supabase.from("call_routing_rules").insert([{
        business_id: rule.business_id,
        name: rule.name,
        description: rule.description,
        condition: rule.condition as unknown as Record<string, never>,
        action: rule.action as unknown as Record<string, never>,
        priority: rule.priority,
        is_active: rule.is_active,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-routing-rules"] });
      toast.success("Routing rule created");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Real-time subscription for participants
  useEffect(() => {
    const channel = supabase
      .channel("call-participants-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_participants" },
        () => {
          refetchSessions();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whisper_coaching_events" },
        () => {
          refetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchSessions]);

  return {
    multiPartySessions,
    sessionsLoading,
    refetchSessions,
    fetchParticipants,
    fetchSpeakerLog,
    fetchWhisperEvents,
    routingRules,
    rulesLoading,
    addParticipant: addParticipantMutation.mutateAsync,
    isAddingParticipant: addParticipantMutation.isPending,
    removeParticipant: removeParticipantMutation.mutateAsync,
    promoteToSpeaker: promoteToSpeakerMutation.mutateAsync,
    demoteToListener: demoteToListenerMutation.mutateAsync,
    sendWhisper: sendWhisperMutation.mutateAsync,
    createRoutingRule: createRoutingRuleMutation.mutateAsync,
  };
}
