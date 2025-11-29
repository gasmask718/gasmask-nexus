// ═══════════════════════════════════════════════════════════════════════════════
// USE ACTIVITY FEED — Real-time activity hook
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ActivityEvent,
  ActivityEventType,
  createActivityEvent,
  getActivityEvents,
  getFloorActivityCount,
  seedDemoActivity,
} from '@/lib/activity/ActivityEngine';
import { GrabbaBrandId } from '@/config/grabbaSkyscraper';

interface UseActivityFeedOptions {
  floorId?: string;
  brand?: GrabbaBrandId;
  eventType?: ActivityEventType;
  limit?: number;
  autoRefresh?: boolean;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [floorCounts, setFloorCounts] = useState<Record<string, number>>({});
  const { user } = useAuth();

  // Load initial events
  useEffect(() => {
    const loadEvents = () => {
      const loaded = getActivityEvents({
        floorId: options.floorId,
        brand: options.brand,
        eventType: options.eventType,
        limit: options.limit || 50,
      });
      setEvents(loaded);
      setFloorCounts(getFloorActivityCount());
    };

    // Seed demo data on first load if empty
    const existingEvents = getActivityEvents({ limit: 1 });
    if (existingEvents.length === 0) {
      seedDemoActivity();
    }

    loadEvents();

    // Listen for new events
    const handleNewEvent = (e: CustomEvent<ActivityEvent>) => {
      const newEvent = e.detail;
      
      // Check if event matches filters
      const matchesFloor = !options.floorId || newEvent.floorId === options.floorId;
      const matchesBrand = !options.brand || options.brand === 'all' || newEvent.brand === options.brand;
      const matchesType = !options.eventType || newEvent.type === options.eventType;

      if (matchesFloor && matchesBrand && matchesType) {
        setEvents((prev) => [newEvent, ...prev].slice(0, options.limit || 50));
      }
      setFloorCounts(getFloorActivityCount());
    };

    window.addEventListener('grabba-activity', handleNewEvent as EventListener);

    // Auto-refresh interval
    let interval: NodeJS.Timeout | undefined;
    if (options.autoRefresh) {
      interval = setInterval(loadEvents, 30000);
    }

    return () => {
      window.removeEventListener('grabba-activity', handleNewEvent as EventListener);
      if (interval) clearInterval(interval);
    };
  }, [options.floorId, options.brand, options.eventType, options.limit, options.autoRefresh]);

  return { events, floorCounts };
}

// Activity logger hook
export function useActivityLogger() {
  const { user } = useAuth();

  const logActivity = useCallback(
    (
      type: ActivityEventType,
      options: {
        brand?: GrabbaBrandId;
        entityId?: string;
        entityType?: string;
        metadata?: Record<string, unknown>;
        customDescription?: string;
      } = {}
    ) => {
      return createActivityEvent(type, {
        ...options,
        userId: user?.id,
        userName: user?.email?.split('@')[0] || 'System',
      });
    },
    [user]
  );

  return { logActivity };
}
