// ═══════════════════════════════════════════════════════════════════════════════
// AI DISPATCH TELEMETRY HOOK — Phase 5A: Learning Analytics
// ═══════════════════════════════════════════════════════════════════════════════
// Read-only observation layer. Tracks suggestion events without influencing behavior.
// Failure to write telemetry must NOT block UI.

import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AIRecommendation } from '@/hooks/useAIDispatchSuggestions';

export interface TelemetryEvent {
  event_type: 'shown' | 'applied' | 'dismissed' | 'ignored';
  recommendation: AIRecommendation;
  decision_latency_seconds?: number;
}

export function useAIDispatchTelemetry() {
  const { user } = useAuth();
  const visibilityTimers = useRef<Map<string, number>>(new Map());

  /**
   * Record telemetry event to ai_dispatch_feedback table.
   * Failures are silent and do not block UI.
   */
  const recordEvent = useCallback(async (event: TelemetryEvent) => {
    if (!user?.id) return; // Only record if user is logged in

    try {
      const rec = event.recommendation;

      // Generate a deterministic hash for this recommendation
      // (would include all factors that affect the suggestion)
      const recommendationHash = btoa(
        JSON.stringify({
          store_id: rec.store_id,
          action: rec.recommended_action,
          confidence: rec.confidence,
          sla: rec.contributing_factors.sla_severity,
          urgency: rec.contributing_factors.urgency_score,
        })
      );

      const payload = {
        created_at: new Date().toISOString(),
        store_id: rec.store_id,
        store_name: rec.store_name,
        territory: rec.territory,
        recommendation_hash: recommendationHash,
        recommended_action: rec.recommended_action,
        confidence: Math.round(rec.confidence),
        risk_level: rec.risk_level,
        sla_severity: rec.contributing_factors.sla_severity,
        urgency_score: rec.contributing_factors.urgency_score,
        user_id: user.id,
        user_role: 'dispatcher', // Could be enriched from auth/profile
        event_type: event.event_type,
        decision_latency_seconds: event.decision_latency_seconds || null,
        contributing_factors: {
          sla_severity: rec.contributing_factors.sla_severity,
          urgency_score: rec.contributing_factors.urgency_score,
          last_visit_days: rec.contributing_factors.last_visit_days,
          opportunity_age_days: rec.contributing_factors.opportunity_age_days,
          follow_up_overdue_hours: rec.contributing_factors.follow_up_overdue_hours,
          worker_load_score: rec.contributing_factors.worker_load_score,
          distance_km: rec.contributing_factors.distance_km,
        },
      };

      // Best-effort write. If this fails, we log but don't throw.
      await supabase.from('ai_dispatch_feedback').insert([payload]);
    } catch (error) {
      // Silence errors. Telemetry failures must not affect UX.
      console.debug('[Telemetry] Failed to record event (non-blocking):', error);
    }
  }, [user?.id]);

  /**
   * Track suggestion visibility (for "shown" event).
   * Called when a recommendation card is first rendered.
   */
  const trackShown = useCallback((rec: AIRecommendation) => {
    recordEvent({
      event_type: 'shown',
      recommendation: rec,
    });
  }, [recordEvent]);

  /**
   * Track suggestion application (for "applied" event).
   * Called when user confirms "Apply to Route".
   */
  const trackApplied = useCallback((rec: AIRecommendation, latencySeconds: number) => {
    recordEvent({
      event_type: 'applied',
      recommendation: rec,
      decision_latency_seconds: latencySeconds,
    });
  }, [recordEvent]);

  /**
   * Track suggestion dismissal (for "dismissed" event).
   * Called when user clicks "Dismiss".
   */
  const trackDismissed = useCallback((rec: AIRecommendation, latencySeconds?: number) => {
    recordEvent({
      event_type: 'dismissed',
      recommendation: rec,
      decision_latency_seconds: latencySeconds,
    });
  }, [recordEvent]);

  /**
   * Start a visibility timer for a suggestion.
   * If not interacted within X minutes, mark as "ignored".
   * Returns a cleanup function to cancel the timer.
   */
  const startIgnoreTimer = useCallback((rec: AIRecommendation, timeoutMs: number = 10 * 60 * 1000) => {
    const timerId = window.setTimeout(() => {
      recordEvent({
        event_type: 'ignored',
        recommendation: rec,
        decision_latency_seconds: Math.round(timeoutMs / 1000),
      });
    }, timeoutMs);

    visibilityTimers.current.set(rec.store_id, timerId);

    // Return cleanup function
    return () => {
      if (visibilityTimers.current.has(rec.store_id)) {
        clearTimeout(visibilityTimers.current.get(rec.store_id));
        visibilityTimers.current.delete(rec.store_id);
      }
    };
  }, [recordEvent]);

  /**
   * Cancel ignore timer (called on apply or dismiss).
   */
  const cancelIgnoreTimer = useCallback((storeId: string) => {
    if (visibilityTimers.current.has(storeId)) {
      clearTimeout(visibilityTimers.current.get(storeId));
      visibilityTimers.current.delete(storeId);
    }
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      visibilityTimers.current.forEach(timerId => clearTimeout(timerId));
      visibilityTimers.current.clear();
    };
  }, []);

  return {
    trackShown,
    trackApplied,
    trackDismissed,
    startIgnoreTimer,
    cancelIgnoreTimer,
  };
}
