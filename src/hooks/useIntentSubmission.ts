/**
 * Hook for intent submission in operational portals
 * Phase 4: Controlled Autonomy & Intent Resolution
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  IntentEnvelope,
  IntentResolution,
  AutonomyEnvelope,
  fetchAutonomyEnvelopes,
  checkLocalAutonomy,
  submitIntent,
  clearAutonomyCache,
} from '@/lib/intentEngine';

interface UseIntentSubmissionOptions {
  portalType: 'driver' | 'biker';
  deviceId: string;
  assignmentId?: string;
  shiftId?: string;
}

interface IntentSubmissionState {
  isSubmitting: boolean;
  lastResult?: IntentResolution;
  autonomyEnvelopes: AutonomyEnvelope[];
  isAutonomyLoaded: boolean;
}

export function useIntentSubmission({
  portalType,
  deviceId,
  assignmentId,
  shiftId,
}: UseIntentSubmissionOptions) {
  const { user } = useAuth();
  const [state, setState] = useState<IntentSubmissionState>({
    isSubmitting: false,
    autonomyEnvelopes: [],
    isAutonomyLoaded: false,
  });

  // Load autonomy envelopes on mount
  useEffect(() => {
    if (!deviceId) return;

    const loadAutonomy = async () => {
      const envelopes = await fetchAutonomyEnvelopes(deviceId, portalType);
      setState(prev => ({
        ...prev,
        autonomyEnvelopes: envelopes,
        isAutonomyLoaded: true,
      }));
    };

    loadAutonomy();

    // Cleanup on unmount
    return () => {
      clearAutonomyCache();
    };
  }, [deviceId, portalType]);

  // Check if an intent type is allowed locally
  const canSubmitIntent = useCallback((
    intentType: string,
    proposedEffect: Record<string, unknown> = {}
  ): { allowed: boolean; reason?: string } => {
    return checkLocalAutonomy(intentType, proposedEffect);
  }, []);

  // Submit an intent
  const submit = useCallback(async (
    intentType: string,
    proposedEffect: Record<string, unknown>,
    options: {
      originActionIds?: string[];
      confidenceLevel?: number;
      constraintsSeen?: string[];
      supportingEvidence?: Record<string, unknown>;
      expiresAt?: string;
    } = {}
  ): Promise<IntentResolution> => {
    if (!user) {
      return {
        success: false,
        intent_id: '',
        outcome: 'rejected',
        reason_codes: ['not_authenticated'],
        explanation: 'User not authenticated',
      };
    }

    // Local autonomy check first
    const localCheck = canSubmitIntent(intentType, proposedEffect);
    if (!localCheck.allowed) {
      return {
        success: false,
        intent_id: '',
        outcome: 'rejected',
        reason_codes: [localCheck.reason || 'autonomy_denied'],
        explanation: `Local autonomy check failed: ${localCheck.reason}`,
      };
    }

    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const intent: IntentEnvelope = {
        origin_action_ids: options.originActionIds || [],
        portal_type: portalType,
        user_id: user.id,
        device_id: deviceId,
        assignment_id: assignmentId,
        shift_id: shiftId,
        intent_type: intentType,
        confidence_level: options.confidenceLevel ?? 0.9,
        constraints_seen: options.constraintsSeen || [],
        proposed_effect: proposedEffect,
        supporting_evidence: options.supportingEvidence || {},
        client_timestamp: new Date().toISOString(),
        expires_at: options.expiresAt,
      };

      const result = await submitIntent(intent);

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        lastResult: result,
      }));

      return result;
    } catch (error) {
      const errorResult: IntentResolution = {
        success: false,
        intent_id: '',
        outcome: 'rejected',
        reason_codes: ['submission_error'],
        explanation: error instanceof Error ? error.message : 'Unknown error',
      };

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        lastResult: errorResult,
      }));

      return errorResult;
    }
  }, [user, portalType, deviceId, assignmentId, shiftId, canSubmitIntent]);

  return {
    ...state,
    submit,
    canSubmitIntent,
    refreshAutonomy: () => fetchAutonomyEnvelopes(deviceId, portalType),
  };
}
