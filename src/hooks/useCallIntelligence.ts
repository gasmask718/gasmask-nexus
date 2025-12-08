import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CallRecording {
  id: string;
  session_id: string | null;
  manual_call_id: string | null;
  business_id: string | null;
  store_id: string | null;
  vertical_id: string | null;
  provider: string | null;
  provider_call_sid: string | null;
  recording_url: string | null;
  recording_duration: number | null;
  channels: string | null;
  started_at: string | null;
  completed_at: string | null;
  has_transcript: boolean;
  transcript_path: string | null;
  language: string | null;
  created_at: string;
}

export interface CallAnalytics {
  id: string;
  recording_id: string | null;
  session_id: string | null;
  manual_call_id: string | null;
  business_id: string | null;
  store_id: string | null;
  vertical_id: string | null;
  transcript: string | null;
  summary: string | null;
  sentiment: "positive" | "neutral" | "negative" | "mixed" | null;
  sentiment_score: number | null;
  tags: string[];
  objections: string[];
  promises: string[];
  next_steps: string[];
  key_moments: any[];
  duration_seconds: number | null;
  ai_metadata: Record<string, any>;
  created_at: string;
}

export interface CallQualityScore {
  id: string;
  recording_id: string | null;
  analytics_id: string | null;
  session_id: string | null;
  manual_call_id: string | null;
  business_id: string | null;
  store_id: string | null;
  vertical_id: string | null;
  overall_score: number | null;
  greeting_score: number | null;
  clarity_score: number | null;
  empathy_score: number | null;
  compliance_score: number | null;
  offer_delivery_score: number | null;
  closing_score: number | null;
  issues: string[];
  strengths: string[];
  coaching_tips: string[];
  is_ai: boolean;
  created_at: string;
}

export interface CallIntelligence {
  recording: CallRecording | null;
  analytics: CallAnalytics | null;
  quality: CallQualityScore | null;
}

// Hook to get call intelligence by session ID (AI calls)
export function useCallIntelligenceBySession(sessionId: string | null) {
  return useQuery({
    queryKey: ["call-intelligence", "session", sessionId],
    queryFn: async (): Promise<CallIntelligence> => {
      if (!sessionId) {
        return { recording: null, analytics: null, quality: null };
      }

      const [recordingRes, analyticsRes, qualityRes] = await Promise.all([
        supabase
          .from("call_recordings")
          .select("*")
          .eq("session_id", sessionId)
          .maybeSingle(),
        supabase
          .from("call_analytics")
          .select("*")
          .eq("session_id", sessionId)
          .maybeSingle(),
        supabase
          .from("call_quality_scores")
          .select("*")
          .eq("session_id", sessionId)
          .maybeSingle(),
      ]);

      return {
        recording: recordingRes.data as CallRecording | null,
        analytics: analyticsRes.data as CallAnalytics | null,
        quality: qualityRes.data as CallQualityScore | null,
      };
    },
    enabled: !!sessionId,
  });
}

// Hook to get call intelligence by recording ID
export function useCallIntelligenceByRecording(recordingId: string | null) {
  return useQuery({
    queryKey: ["call-intelligence", "recording", recordingId],
    queryFn: async (): Promise<CallIntelligence> => {
      if (!recordingId) {
        return { recording: null, analytics: null, quality: null };
      }

      const [recordingRes, analyticsRes, qualityRes] = await Promise.all([
        supabase
          .from("call_recordings")
          .select("*")
          .eq("id", recordingId)
          .maybeSingle(),
        supabase
          .from("call_analytics")
          .select("*")
          .eq("recording_id", recordingId)
          .maybeSingle(),
        supabase
          .from("call_quality_scores")
          .select("*")
          .eq("recording_id", recordingId)
          .maybeSingle(),
      ]);

      return {
        recording: recordingRes.data as CallRecording | null,
        analytics: analyticsRes.data as CallAnalytics | null,
        quality: qualityRes.data as CallQualityScore | null,
      };
    },
    enabled: !!recordingId,
  });
}

// Hook to get call intelligence for a store
export function useStoreCallIntelligence(storeId: string | null) {
  return useQuery({
    queryKey: ["call-intelligence", "store", storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from("call_analytics")
        .select(`
          *,
          call_recordings(*),
          call_quality_scores(*)
        `)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });
}

// Hook to analyze a transcript
export function useAnalyzeTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transcript,
      recordingId,
      isAI,
    }: {
      transcript: string;
      recordingId?: string;
      isAI?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("call-intelligence", {
        body: {
          action: "analyze",
          transcript,
          recording_id: recordingId,
          is_ai: isAI,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success("Transcript analyzed successfully");
      if (variables.recordingId) {
        queryClient.invalidateQueries({
          queryKey: ["call-intelligence", "recording", variables.recordingId],
        });
      }
    },
    onError: (error) => {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze transcript");
    },
  });
}

// Hook to get quality score stats for a business
export function useQualityScoreStats(businessId: string | null) {
  return useQuery({
    queryKey: ["quality-scores", "stats", businessId],
    queryFn: async () => {
      const query = supabase
        .from("call_quality_scores")
        .select("overall_score, is_ai, created_at");

      if (businessId) {
        query.eq("business_id", businessId);
      }

      const { data, error } = await query
        .not("overall_score", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const scores = data || [];
      const aiScores = scores.filter((s) => s.is_ai);
      const humanScores = scores.filter((s) => !s.is_ai);

      const avgScore = (arr: typeof scores) =>
        arr.length > 0
          ? arr.reduce((sum, s) => sum + (s.overall_score || 0), 0) / arr.length
          : 0;

      return {
        totalCalls: scores.length,
        averageScore: avgScore(scores),
        aiAverageScore: avgScore(aiScores),
        humanAverageScore: avgScore(humanScores),
        aiCallCount: aiScores.length,
        humanCallCount: humanScores.length,
      };
    },
    enabled: true,
  });
}