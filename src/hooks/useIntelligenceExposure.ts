/**
 * useIntelligenceExposure — React hook for Phase V exposure tracking
 * 
 * Records when intelligence panels become visible to the user.
 * Uses a ref to ensure each mount logs exactly once (debounced by the service).
 * 
 * CONSTITUTIONAL RULES:
 * - Read-only measurement — no UI side effects
 * - Fire-and-forget — never blocks rendering
 * - No nudging or feedback to the user
 */

import { useEffect, useRef } from 'react';
import { recordExposure, type ExposureEvent } from '@/services/intelligenceAccountability/exposureTracker';

/**
 * Track that an intelligence component was rendered/viewed.
 * Fires once per mount, debounced by the tracker service.
 */
export function useIntelligenceExposure(
  event: ExposureEvent | null,
  enabled: boolean = true
) {
  const logged = useRef(false);

  useEffect(() => {
    if (!enabled || !event || logged.current) return;
    logged.current = true;
    recordExposure(event);
  }, [event, enabled]);

  // Reset on unmount so re-mounting logs again
  useEffect(() => {
    return () => { logged.current = false; };
  }, []);
}

/**
 * Track multiple exposure events at once.
 * Used when QuickStatsContactSnapshot renders all intelligence at once.
 */
export function useIntelligenceExposureBatch(
  events: ExposureEvent[],
  enabled: boolean = true
) {
  const logged = useRef(false);

  useEffect(() => {
    if (!enabled || events.length === 0 || logged.current) return;
    logged.current = true;
    for (const event of events) {
      recordExposure(event);
    }
  }, [events, enabled]);

  useEffect(() => {
    return () => { logged.current = false; };
  }, []);
}
