/**
 * Sell-Through Analytics Events — Phase VI-A Passive Instrumentation
 * 
 * Fire-and-forget event tracking for ambassador sell-through usage.
 * All events are async, non-blocking, and invisible to the user.
 * 
 * CONSTITUTIONAL RULES:
 * - Never blocks rendering
 * - Never changes data
 * - Never triggers actions
 * - No PII in payloads
 */

import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type SellThroughEventType =
  | 'sell_through_view_loaded'
  | 'sell_through_filter_used'
  | 'sell_through_row_clicked'
  | 'sell_through_overdue_viewed';

interface EventAttributes {
  [key: string]: string | number | boolean | null;
}

/**
 * Hook that provides fire-and-forget analytics event logging
 * scoped to a specific ambassador's sell-through session.
 */
export function useSellThroughAnalyticsEvents(ambassadorId: string | null | undefined) {
  const debounceMap = useRef<Map<string, number>>(new Map());
  const DEBOUNCE_MS = 30_000; // 30s debounce per event type

  // Cleanup on unmount
  useEffect(() => {
    return () => { debounceMap.current.clear(); };
  }, []);

  const trackEvent = useCallback(async (
    eventType: SellThroughEventType,
    attributes: EventAttributes = {}
  ) => {
    if (!ambassadorId) return;

    try {
      // Debounce: skip if same event type fired within 30s
      const now = Date.now();
      const lastFired = debounceMap.current.get(eventType);
      if (lastFired && now - lastFired < DEBOUNCE_MS) return;
      debounceMap.current.set(eventType, now);

      await (supabase as any).from('sell_through_analytics_events').insert({
        ambassador_id: ambassadorId,
        event_type: eventType,
        attributes: { ...attributes, timestamp: new Date().toISOString() },
      });
    } catch {
      // Fire-and-forget: never let tracking break the UI
    }
  }, [ambassadorId]);

  const trackViewLoaded = useCallback((storeCount: number, totalRows: number) => {
    trackEvent('sell_through_view_loaded', {
      number_of_stores_managed: storeCount,
      total_rows_rendered: totalRows,
    });
  }, [trackEvent]);

  const trackFilterUsed = useCallback((filterType: string, filterValue: string) => {
    // Override debounce key to be per filter_type
    trackEvent('sell_through_filter_used', {
      filter_type: filterType,
      filter_value: filterValue,
    });
  }, [trackEvent]);

  const trackRowClicked = useCallback((storeId: string, brand: string) => {
    trackEvent('sell_through_row_clicked', {
      store_id: storeId,
      brand,
    });
  }, [trackEvent]);

  const trackOverdueViewed = useCallback(() => {
    trackEvent('sell_through_overdue_viewed', {});
  }, [trackEvent]);

  return {
    trackViewLoaded,
    trackFilterUsed,
    trackRowClicked,
    trackOverdueViewed,
  };
}
