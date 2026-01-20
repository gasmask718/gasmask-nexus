import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RequestOptions {
  actionType: string;
  portalType: 'driver' | 'biker';
  assignmentId?: string;
  shiftId?: string;
  payload?: Record<string, unknown>;
}

interface RequestValidationResult {
  valid: boolean;
  reason?: string;
  originalId?: string;
}

/**
 * Hook for validating portal requests with replay protection
 * Implements action integrity for Phase 2 security hardening
 */
export function usePortalRequest() {
  const { user } = useAuth();

  // Generate a unique request ID (nonce)
  const generateRequestId = useCallback(() => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }, []);

  // Hash payload for integrity check
  const hashPayload = useCallback(async (payload: unknown): Promise<string> => {
    const str = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }, []);

  // Validate and log a request
  const validateRequest = useCallback(async (
    options: RequestOptions
  ): Promise<RequestValidationResult> => {
    if (!user) {
      return { valid: false, reason: 'not_authenticated' };
    }

    const requestId = generateRequestId();
    const payloadHash = options.payload ? await hashPayload(options.payload) : null;

    try {
      const { data, error } = await supabase.rpc('validate_portal_request', {
        _request_id: requestId,
        _user_id: user.id,
        _portal_type: options.portalType,
        _action_type: options.actionType,
        _assignment_id: options.assignmentId || null,
        _shift_id: options.shiftId || null,
        _client_timestamp: new Date().toISOString(),
        _payload_hash: payloadHash,
      });

      if (error) {
        console.error('Request validation error:', error);
        return { valid: false, reason: 'validation_error' };
      }

      // Parse the JSONB response from the RPC function
      const result = data as unknown as RequestValidationResult;
      return result;
    } catch (err) {
      console.error('Request validation failed:', err);
      return { valid: false, reason: 'validation_failed' };
    }
  }, [user, generateRequestId, hashPayload]);

  // Execute a validated action
  const executeAction = useCallback(async <T>(
    options: RequestOptions,
    action: () => Promise<T>
  ): Promise<{ success: boolean; data?: T; error?: string }> => {
    // First validate the request
    const validation = await validateRequest(options);
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.reason || 'Request validation failed',
      };
    }

    // Execute the action
    try {
      const result = await action();
      return { success: true, data: result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Action failed',
      };
    }
  }, [validateRequest]);

  return {
    generateRequestId,
    validateRequest,
    executeAction,
  };
}
