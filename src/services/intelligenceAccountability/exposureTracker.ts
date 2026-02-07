/**
 * Intelligence Exposure Tracker — Phase V Accountability Layer
 * 
 * Records when intelligence was VIEWED by a user.
 * Immutable, append-only. No mutations, no triggers.
 * 
 * CONSTITUTIONAL RULES:
 * - Exposure ≠ action. We track views, not behavior.
 * - No nudging. No real-time feedback loops.
 * - Fire-and-forget: failures are silently logged, never block UI.
 */

import { supabase } from '@/integrations/supabase/client';

export type IntelExposureType =
  | 'best_contact'
  | 'predictive_panel'
  | 'confidence_badge'
  | 'time_of_day_hint'
  | 'route_annotation'
  | 'suggested_channel'
  | 'contact_sequence';

export interface ExposureEvent {
  store_id: string;
  exposure_type: IntelExposureType;
  confidence_level?: 'high' | 'medium' | 'low' | null;
  suggested_channel?: 'text' | 'call' | 'none' | null;
  suggested_contact_id?: string | null;
  route_context?: boolean;
  metadata?: Record<string, unknown>;
}

// Debounce map: prevents logging the same exposure for the same store within 5 minutes
const recentExposures = new Map<string, number>();
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

function getExposureKey(event: ExposureEvent): string {
  return `${event.store_id}:${event.exposure_type}`;
}

/**
 * Record that intelligence was exposed to the user.
 * Fire-and-forget — never blocks UI, never throws.
 * Debounced per store+type to avoid flooding on re-renders.
 */
export async function recordExposure(event: ExposureEvent): Promise<void> {
  try {
    // Debounce check
    const key = getExposureKey(event);
    const lastLogged = recentExposures.get(key);
    if (lastLogged && Date.now() - lastLogged < DEBOUNCE_MS) {
      return; // Already logged recently
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // No authenticated user — skip silently

    recentExposures.set(key, Date.now());

    // Clean up old entries to prevent memory leak
    if (recentExposures.size > 100) {
      const cutoff = Date.now() - DEBOUNCE_MS;
      for (const [k, v] of recentExposures) {
        if (v < cutoff) recentExposures.delete(k);
      }
    }

    await (supabase as any).from('intelligence_exposures').insert({
      user_id: user.id,
      store_id: event.store_id,
      exposure_type: event.exposure_type,
      confidence_level: event.confidence_level ?? null,
      suggested_channel: event.suggested_channel ?? null,
      suggested_contact_id: event.suggested_contact_id ?? null,
      route_context: event.route_context ?? false,
      metadata: event.metadata ?? {},
    });
  } catch (err) {
    // Fire-and-forget: never let tracking break the UI
    console.debug('[Intel Exposure] Failed to log:', err);
  }
}

/**
 * Record a batch of exposure events at once.
 * Used when multiple intelligence panels render simultaneously.
 */
export async function recordExposureBatch(events: ExposureEvent[]): Promise<void> {
  for (const event of events) {
    await recordExposure(event);
  }
}
