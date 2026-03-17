import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LiveResponse {
  detected_objection: string;
  detected_signal: string;
  mood: string;
  response_text: string;
  strategy_used: string;
  confidence_score: number;
  should_close_now: boolean;
  close_type: string;
  escalation_needed: boolean;
  heat_delta: number;
}

export interface ContextMemory {
  objections_handled: string[];
  signals_detected: string[];
  strategies_used: string[];
  responses_given: string[];
  promises_made: string[];
}

export function useBrandaroLiveScript() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResponse, setLastResponse] = useState<LiveResponse | null>(null);
  const [responseHistory, setResponseHistory] = useState<LiveResponse[]>([]);
  const contextMemory = useRef<ContextMemory>({
    objections_handled: [],
    signals_detected: [],
    strategies_used: [],
    responses_given: [],
    promises_made: [],
  });

  const analyzeChunk = useCallback(async ({
    transcript_chunk,
    lead_id,
    call_session_id,
    lead_heat_score,
  }: {
    transcript_chunk: string;
    lead_id?: string;
    call_session_id?: string;
    lead_heat_score?: number;
  }): Promise<LiveResponse | null> => {
    if (!transcript_chunk.trim()) return null;
    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-live-response", {
        body: {
          transcript_chunk,
          lead_id,
          call_session_id,
          context_memory: contextMemory.current,
          lead_heat_score,
        },
      });

      if (error) {
        console.error("Live response error:", error);
        toast.error("Failed to get AI response");
        return null;
      }

      if (!data?.ok) {
        if (data?.error) toast.error(data.error);
        return null;
      }

      const response: LiveResponse = {
        detected_objection: data.detected_objection,
        detected_signal: data.detected_signal,
        mood: data.mood,
        response_text: data.response_text,
        strategy_used: data.strategy_used,
        confidence_score: data.confidence_score,
        should_close_now: data.should_close_now,
        close_type: data.close_type,
        escalation_needed: data.escalation_needed,
        heat_delta: data.heat_delta,
      };

      // Update context memory (prevent repeats)
      const mem = contextMemory.current;
      if (response.detected_objection !== "none" && !mem.objections_handled.includes(response.detected_objection)) {
        mem.objections_handled.push(response.detected_objection);
      }
      if (response.detected_signal !== "none" && !mem.signals_detected.includes(response.detected_signal)) {
        mem.signals_detected.push(response.detected_signal);
      }
      if (!mem.strategies_used.includes(response.strategy_used)) {
        mem.strategies_used.push(response.strategy_used);
      }
      mem.responses_given.push(response.response_text);
      // Keep last 10 responses to avoid bloat
      if (mem.responses_given.length > 10) {
        mem.responses_given = mem.responses_given.slice(-10);
      }

      setLastResponse(response);
      setResponseHistory(prev => [...prev.slice(-19), response]);
      return response;
    } catch (e) {
      console.error("Live script error:", e);
      toast.error("AI response failed");
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const resetSession = useCallback(() => {
    setLastResponse(null);
    setResponseHistory([]);
    contextMemory.current = {
      objections_handled: [],
      signals_detected: [],
      strategies_used: [],
      responses_given: [],
      promises_made: [],
    };
  }, []);

  return {
    analyzeChunk,
    resetSession,
    isAnalyzing,
    lastResponse,
    responseHistory,
    contextMemory: contextMemory.current,
  };
}
