/**
 * Phase 5 Observer Hook
 * 
 * Automatically generates shadow recommendations when intents are resolved.
 * This hook should be used at the intent resolution point to trigger Phase 5 analysis.
 */

import { useCallback } from 'react';
import { usePhase5 } from '@/contexts/Phase5Context';
import {
  generateShadowRecommendation,
  recordHumanDecision,
  detectPattern,
  IntentAnalysis,
} from '@/lib/phase5Engine';

interface UsePhase5ObserverReturn {
  // Generate a recommendation for an intent (shadow mode only)
  observeIntent: (intentId: string, analysis: IntentAnalysis) => Promise<string | null>;
  
  // Record what the human actually decided
  recordDecision: (
    recommendationId: string,
    intentId: string,
    decision: string,
    reason?: string
  ) => Promise<boolean>;
  
  // Detect a pattern from intent flow
  logPattern: (
    type: 'conflict_pattern' | 'approval_pattern' | 'escalation_pattern' | 'drift_pattern',
    signature: Record<string, unknown>,
    notes?: string
  ) => Promise<boolean>;
  
  // Status
  isObserving: boolean;
}

export function usePhase5Observer(): UsePhase5ObserverReturn {
  const { isObserving, isShadowMode } = usePhase5();

  const observeIntent = useCallback(async (
    intentId: string,
    analysis: IntentAnalysis
  ): Promise<string | null> => {
    if (!isObserving) {
      return null;
    }

    const recommendation = await generateShadowRecommendation(intentId, analysis);
    return recommendation?.id || null;
  }, [isObserving]);

  const recordDecision = useCallback(async (
    recommendationId: string,
    intentId: string,
    decision: string,
    reason?: string
  ): Promise<boolean> => {
    if (!isShadowMode) {
      return false;
    }

    return await recordHumanDecision(recommendationId, intentId, decision, reason);
  }, [isShadowMode]);

  const logPattern = useCallback(async (
    type: 'conflict_pattern' | 'approval_pattern' | 'escalation_pattern' | 'drift_pattern',
    signature: Record<string, unknown>,
    notes?: string
  ): Promise<boolean> => {
    if (!isObserving) {
      return false;
    }

    return await detectPattern(type, signature, notes);
  }, [isObserving]);

  return {
    observeIntent,
    recordDecision,
    logPattern,
    isObserving,
  };
}
