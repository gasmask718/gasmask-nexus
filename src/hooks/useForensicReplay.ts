import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ForensicReplaySession {
  id: string;
  business_id: string | null;
  source_session_id: string | null;
  original_session_id: string | null;
  replayed_by: string | null;
  replayed_at: string;
  replay_purpose: string | null;
  total_frames: number | null;
  duration_ms: number | null;
  is_locked: boolean | null;
  lock_reason: string | null;
  notes: string | null;
  exported_at: string | null;
  export_format: string | null;
  export_url: string | null;
  row_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ForensicCallFrame {
  id: string;
  replay_session_id: string | null;
  original_session_id: string | null;
  frame_number: number;
  timestamp_ms: number;
  call_state: string;
  speaker_allowed: string | null;
  actual_speaker: string | null;
  confidence_level: number | null;
  trust_score: number | null;
  kill_switch_active: boolean;
  lock_applied: boolean;
  interruption_detected: boolean;
  transcript_fragment: string | null;
  state_metadata: any;
  created_at: string;
}

export function useForensicReplaySessions(businessId: string | null) {
  return useQuery({
    queryKey: ['forensic-replay-sessions', businessId],
    queryFn: async () => {
      let query = supabase
        .from('forensic_replay_sessions')
        .select('*')
        .order('replayed_at', { ascending: false });
      
      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ForensicReplaySession[];
    },
    enabled: true
  });
}

export function useForensicCallFrames(replaySessionId: string | null) {
  return useQuery({
    queryKey: ['forensic-call-frames', replaySessionId],
    queryFn: async () => {
      if (!replaySessionId) return [];
      
      const { data, error } = await supabase
        .from('forensic_call_frames')
        .select('*')
        .eq('replay_session_id', replaySessionId)
        .order('frame_number', { ascending: true });

      if (error) throw error;
      return data as ForensicCallFrame[];
    },
    enabled: !!replaySessionId
  });
}

export function useBuildForensicReplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      sessionId, 
      businessId, 
      replayPurpose 
    }: { 
      sessionId: string; 
      businessId: string;
      replayPurpose?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('forensic-replay-builder', {
        body: {
          session_id: sessionId,
          business_id: businessId,
          replay_purpose: replayPurpose
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['forensic-replay-sessions'] });
      toast.success(`Replay built with ${data.frame_count} frames`);
    },
    onError: (error) => {
      toast.error(`Failed to build replay: ${error.message}`);
    }
  });
}

export function useCallSessions(businessId: string | null) {
  return useQuery({
    queryKey: ['call-sessions-for-replay', businessId],
    queryFn: async () => {
      let query = supabase
        .from('ai_call_sessions')
        .select('id, status, created_at, call_summary, handoff_state')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: true
  });
}