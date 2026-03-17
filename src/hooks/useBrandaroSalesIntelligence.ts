import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Emotion Detection ──

export interface EmotionState {
  detected_emotion: string;
  secondary_emotion?: string;
  confidence_score: number;
  micro_signals?: string[];
  recommended_strategy: string;
  tone_adjustment: string;
  personality_override: string;
  urgency: string;
  empathy_phrase?: string;
}

export interface PersonalitySelection {
  selected_personality_id: string;
  nickname: string;
  archetype: string;
  reason: string;
  confidence_score: number;
  switch_recommended: boolean;
  blend_with?: string;
  blend_ratio?: number;
}

export interface EmotionTimeline {
  emotion: string;
  confidence: number;
  timestamp: number;
}

export function useBrandaroSalesIntelligence() {
  const [currentEmotion, setCurrentEmotion] = useState<EmotionState | null>(null);
  const [currentPersonality, setCurrentPersonality] = useState<PersonalitySelection | null>(null);
  const [emotionTimeline, setEmotionTimeline] = useState<EmotionTimeline[]>([]);
  const [personalitySwitches, setPersonalitySwitches] = useState<PersonalitySelection[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const switchCount = useRef(0);
  const previousEmotions = useRef<string[]>([]);

  const detectEmotion = useCallback(async ({
    transcript_chunk,
    voice_metrics,
    current_personality,
    context_memory,
  }: {
    transcript_chunk: string;
    voice_metrics?: any;
    current_personality?: string;
    context_memory?: any;
  }): Promise<EmotionState | null> => {
    if (!transcript_chunk.trim()) return null;
    setIsDetecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("detect-emotion", {
        body: {
          transcript_chunk,
          voice_metrics,
          current_personality,
          context_memory,
          previous_emotions: previousEmotions.current.slice(-5),
        },
      });

      if (error) {
        console.error("Emotion detection error:", error);
        return null;
      }
      if (!data?.ok) return null;

      const state: EmotionState = {
        detected_emotion: data.detected_emotion,
        secondary_emotion: data.secondary_emotion,
        confidence_score: data.confidence_score,
        micro_signals: data.micro_signals,
        recommended_strategy: data.recommended_strategy,
        tone_adjustment: data.tone_adjustment,
        personality_override: data.personality_override,
        urgency: data.urgency,
        empathy_phrase: data.empathy_phrase,
      };

      setCurrentEmotion(state);
      previousEmotions.current.push(state.detected_emotion);
      if (previousEmotions.current.length > 20) {
        previousEmotions.current = previousEmotions.current.slice(-20);
      }

      setEmotionTimeline(prev => [...prev.slice(-29), {
        emotion: state.detected_emotion,
        confidence: state.confidence_score,
        timestamp: Date.now(),
      }]);

      return state;
    } catch (e) {
      console.error("Emotion detection failed:", e);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const selectPersonality = useCallback(async ({
    lead_id,
    lead_heat_score,
    lead_type,
    transcript_chunk,
    detected_objection,
    detected_signal,
    emotion_state,
  }: {
    lead_id?: string;
    lead_heat_score?: number;
    lead_type?: string;
    transcript_chunk?: string;
    detected_objection?: string;
    detected_signal?: string;
    emotion_state?: string;
  }): Promise<PersonalitySelection | null> => {
    setIsSelecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("select-personality", {
        body: {
          lead_id,
          lead_heat_score,
          lead_type,
          transcript_chunk,
          detected_objection,
          detected_signal,
          current_personality_id: currentPersonality?.selected_personality_id,
          emotion_state,
        },
      });

      if (error) {
        console.error("Personality selection error:", error);
        return null;
      }
      if (!data?.ok) return null;

      const selection: PersonalitySelection = {
        selected_personality_id: data.selected_personality_id,
        nickname: data.nickname,
        archetype: data.archetype,
        reason: data.reason,
        confidence_score: data.confidence_score,
        switch_recommended: data.switch_recommended,
        blend_with: data.blend_with,
        blend_ratio: data.blend_ratio,
      };

      if (selection.switch_recommended && currentPersonality) {
        switchCount.current += 1;
        if (switchCount.current <= 3) {
          setPersonalitySwitches(prev => [...prev, selection]);
          toast.info(`🎭 Switched to ${selection.nickname} — ${selection.reason}`);
        }
      }

      setCurrentPersonality(selection);
      return selection;
    } catch (e) {
      console.error("Personality selection failed:", e);
      return null;
    } finally {
      setIsSelecting(false);
    }
  }, [currentPersonality]);

  const resetIntelligence = useCallback(() => {
    setCurrentEmotion(null);
    setCurrentPersonality(null);
    setEmotionTimeline([]);
    setPersonalitySwitches([]);
    switchCount.current = 0;
    previousEmotions.current = [];
  }, []);

  return {
    // Emotion
    detectEmotion,
    currentEmotion,
    emotionTimeline,
    isDetecting,
    // Personality
    selectPersonality,
    currentPersonality,
    personalitySwitches,
    isSelecting,
    // Reset
    resetIntelligence,
    switchCount: switchCount.current,
  };
}
