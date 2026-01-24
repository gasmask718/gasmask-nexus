import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEvaluatePrediction } from "./useAICallAgent";

export interface AISuggestion {
  intent: string;
  confidence: number;
  suggested_response: string;
  suggested_next_question: string | null;
  recommended_route: string | null;
  risk_flags: string[];
  reasoning: string;
  prediction_id?: string;
  timestamp: number;
}

export interface SuggestionFeedback {
  predictionId: string;
  rating: 'accurate' | 'inaccurate' | 'misleading' | 'helpful_incomplete';
  humanOverrode: boolean;
  reason?: string;
}

export function useAssistedModeSuggestions(businessId: string | null) {
  const [currentSuggestion, setCurrentSuggestion] = useState<AISuggestion | null>(null);
  const [suggestionHistory, setSuggestionHistory] = useState<AISuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const evaluatePrediction = useEvaluatePrediction();

  const generateSuggestion = useCallback(async (
    sessionId: string,
    transcript: string,
    callerPhone?: string,
    storeContext?: {
      store_name?: string;
      recent_orders?: any[];
      contact_history?: any[];
    },
    personaContext?: {
      name?: string;
      tone?: string;
    }
  ) => {
    if (!businessId || !transcript) return;

    // Debounce - only generate if transcript has changed meaningfully
    const transcriptDelta = transcript.length - lastTranscriptRef.current.length;
    if (transcriptDelta < 50 && lastTranscriptRef.current.length > 0) {
      return; // Wait for more content
    }

    lastTranscriptRef.current = transcript;
    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('call-ai-assisted-suggest', {
        body: {
          session_id: sessionId,
          business_id: businessId,
          transcript,
          caller_phone: callerPhone,
          store_context: storeContext,
          persona_context: personaContext,
        },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        setError(data.error || 'Failed to generate suggestion');
        return;
      }

      const newSuggestion: AISuggestion = {
        ...data.suggestion,
        prediction_id: data.prediction_id,
        timestamp: Date.now(),
      };

      setCurrentSuggestion(newSuggestion);
      setSuggestionHistory(prev => [newSuggestion, ...prev].slice(0, 10)); // Keep last 10

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Suggestion generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [businessId]);

  // Debounced version for realtime transcript updates
  const debouncedGenerateSuggestion = useCallback((
    sessionId: string,
    transcript: string,
    callerPhone?: string,
    storeContext?: any,
    personaContext?: any
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      generateSuggestion(sessionId, transcript, callerPhone, storeContext, personaContext);
    }, 2000); // 2 second debounce
  }, [generateSuggestion]);

  const useSuggestion = useCallback((predictionId: string) => {
    if (!predictionId) return;

    // Mark that the suggestion was used (accurate)
    evaluatePrediction.mutate({
      predictionId,
      wasAccurate: true,
      humanOverrode: false,
    });

    toast({ title: "Suggestion marked as used" });
  }, [evaluatePrediction, toast]);

  const dismissSuggestion = useCallback((predictionId: string, reason?: string) => {
    if (!predictionId) return;

    // Mark that the suggestion was dismissed (overridden)
    evaluatePrediction.mutate({
      predictionId,
      wasAccurate: false,
      humanOverrode: true,
      overrideReason: reason || 'Dismissed by operator',
    });

    setCurrentSuggestion(null);
    toast({ title: "Suggestion dismissed" });
  }, [evaluatePrediction, toast]);

  const submitFeedback = useCallback((feedback: SuggestionFeedback) => {
    const wasAccurate = feedback.rating === 'accurate' || feedback.rating === 'helpful_incomplete';

    evaluatePrediction.mutate({
      predictionId: feedback.predictionId,
      wasAccurate,
      humanOverrode: feedback.humanOverrode,
      overrideReason: feedback.reason,
    });

    toast({ title: "Feedback submitted" });
  }, [evaluatePrediction, toast]);

  const clearSuggestion = useCallback(() => {
    setCurrentSuggestion(null);
  }, []);

  const clearHistory = useCallback(() => {
    setSuggestionHistory([]);
  }, []);

  return {
    currentSuggestion,
    suggestionHistory,
    isGenerating,
    error,
    generateSuggestion,
    debouncedGenerateSuggestion,
    useSuggestion,
    dismissSuggestion,
    submitFeedback,
    clearSuggestion,
    clearHistory,
    isEvaluating: evaluatePrediction.isPending,
  };
}
