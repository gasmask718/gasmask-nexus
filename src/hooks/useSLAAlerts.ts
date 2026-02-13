// ═══════════════════════════════════════════════════════════════════════════════
// SLA ALERTS HOOK — Phase 3.4 Visual-Only Lateness Awareness
// ═══════════════════════════════════════════════════════════════════════════════
// Read-only. No mutations. No enforcement. No background jobs.
// Computes overdue follow-ups, stale opportunities, missed revisit windows.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, differenceInHours } from 'date-fns';

export interface SLAAlert {
  store_id: string;
  store_name: string;

  alerts: {
    overdue_follow_up: boolean;
    stale_opportunity: boolean;
    missed_revisit: boolean;
  };

  severity: 'none' | 'amber' | 'red';

  reasons: string[];
  oldest_timestamp: string | null;

  // Detail counts for UI
  overdue_follow_up_count: number;
  stale_opportunity_count: number;
  days_since_last_stop: number | null;
}

export function useSLAAlerts(storeIds?: string[]) {
  return useQuery({
    queryKey: ['sla-alerts', storeIds],
    queryFn: async (): Promise<SLAAlert[]> => {
      const now = new Date();

      // 1. Overdue follow-ups
      let fuQuery = supabase
        .from('follow_up_queue')
        .select('id, store_id, due_at, status, reason')
        .in('status', ['pending', 'overdue']);
      
      if (storeIds?.length) {
        fuQuery = fuQuery.in('store_id', storeIds);
      }
      
      const { data: followUps } = await fuQuery;

      // 2. Stale opportunities (open > 14 days, not linked to any route_stop)
      let oppQuery = supabase
        .from('store_opportunities')
        .select('id, store_id, created_at, opportunity_text')
        .eq('is_completed', false);
      
      if (storeIds?.length) {
        oppQuery = oppQuery.in('store_id', storeIds);
      }
      
      const { data: opportunities } = await oppQuery;

      // 3. Last route_stop per store for revisit window detection
      const relevantStoreIds = new Set<string>();
      followUps?.forEach(f => relevantStoreIds.add(f.store_id));
      opportunities?.forEach(o => relevantStoreIds.add(o.store_id));
      if (storeIds) storeIds.forEach(id => relevantStoreIds.add(id));

      const allStoreIds = Array.from(relevantStoreIds);
      if (allStoreIds.length === 0) return [];

      // Get store names
      const { data: stores } = await supabase
        .from('store_master')
        .select('id, store_name')
        .in('id', allStoreIds);

      // Get latest route_stop per store for revisit window
      const { data: recentStops } = await supabase
        .from('route_stops')
        .select('store_id, actual_departure, updated_at')
        .in('store_id', allStoreIds)
        .eq('status', 'completed')
        .order('actual_departure', { ascending: false });

      // Build last-stop map (first occurrence per store = most recent)
      const lastStopMap = new Map<string, string>();
      recentStops?.forEach(s => {
        const completedDate = s.actual_departure || s.updated_at;
        if (completedDate && s.store_id && !lastStopMap.has(s.store_id)) {
          lastStopMap.set(s.store_id, completedDate);
        }
      });

      // Get active inventory signals for missed revisit detection
      const { data: inventorySignals } = await supabase
        .from('store_tube_inventory_status')
        .select('store_id, needs_order, bring_samples, bring_starter_kit')
        .in('store_id', allStoreIds)
        .or('needs_order.eq.true,bring_samples.eq.true,bring_starter_kit.eq.true');

      const storeNameMap = new Map(stores?.map(s => [s.id, s.store_name]) || []);

      // Aggregate per store
      const alertMap = new Map<string, SLAAlert>();

      const escalate = (current: string, next: string): 'none' | 'amber' | 'red' => {
        const order = { none: 0, amber: 1, red: 2 } as Record<string, number>;
        return (order[next] ?? 0) >= (order[current] ?? 0) ? next as any : current as any;
      };

      allStoreIds.forEach(storeId => {
        const storeName = storeNameMap.get(storeId) || `Store ${storeId.slice(0, 8)}`;
        const reasons: string[] = [];
        let severity: 'none' | 'amber' | 'red' = 'none';
        let oldestTimestamp: string | null = null;

        // --- Overdue Follow-Ups ---
        const storeFUs = followUps?.filter(f => f.store_id === storeId && f.due_at) || [];
        const overdueFUs = storeFUs.filter(f => new Date(f.due_at!) < now);
        const overdueFollowUp = overdueFUs.length > 0;
        
        if (overdueFollowUp) {
          const worstOverdue = overdueFUs.reduce((worst, f) => {
            return new Date(f.due_at!) < new Date(worst.due_at!) ? f : worst;
          }, overdueFUs[0]);

          const hoursOverdue = differenceInHours(now, new Date(worstOverdue.due_at!));
          
          if (hoursOverdue > 48) {
            severity = escalate(severity, 'red');
            reasons.push(`Follow-up overdue ${Math.round(hoursOverdue / 24)}d`);
          } else {
            severity = escalate(severity, 'amber');
            reasons.push(`Follow-up overdue ${hoursOverdue}h`);
          }
          
          if (!oldestTimestamp || worstOverdue.due_at! < oldestTimestamp) {
            oldestTimestamp = worstOverdue.due_at!;
          }
        }

        // --- Stale Opportunities ---
        const storeOpps = opportunities?.filter(o => o.store_id === storeId) || [];
        const staleOpps = storeOpps.filter(o => {
          const ageDays = differenceInDays(now, new Date(o.created_at));
          return ageDays >= 14;
        });
        const staleOpportunity = staleOpps.length > 0;
        
        if (staleOpportunity) {
          const oldestOpp = staleOpps.reduce((oldest, o) => {
            return new Date(o.created_at) < new Date(oldest.created_at) ? o : oldest;
          }, staleOpps[0]);

          const ageDays = differenceInDays(now, new Date(oldestOpp.created_at));
          
          if (ageDays >= 30) {
            severity = escalate(severity, 'red');
            reasons.push(`Opportunity stale ${ageDays}d`);
          } else {
            severity = escalate(severity, 'amber');
            reasons.push(`Opportunity aging ${ageDays}d`);
          }

          if (!oldestTimestamp || oldestOpp.created_at < oldestTimestamp) {
            oldestTimestamp = oldestOpp.created_at;
          }
        }

        // --- Missed Revisit Window ---
        const hasActiveSignals = 
          inventorySignals?.some(s => s.store_id === storeId) ||
          storeOpps.length > 0 ||
          storeFUs.length > 0;

        const lastStopDate = lastStopMap.get(storeId);
        let daysSinceLastStop: number | null = null;
        let missedRevisit = false;

        if (hasActiveSignals && lastStopDate) {
          daysSinceLastStop = differenceInDays(now, new Date(lastStopDate));
          
          // Determine threshold based on signal type
          const hasOrderSignal = inventorySignals?.some(s => s.store_id === storeId && s.needs_order);
          const threshold = hasOrderSignal ? 7 : 14;

          if (daysSinceLastStop >= threshold) {
            missedRevisit = true;
            if (daysSinceLastStop >= threshold * 2) {
              severity = escalate(severity, 'red');
              reasons.push(`No visit in ${daysSinceLastStop}d (2× window)`);
            } else {
              severity = escalate(severity, 'amber');
              reasons.push(`No visit in ${daysSinceLastStop}d`);
            }
          }
        } else if (hasActiveSignals && !lastStopDate) {
          // Never visited but has active signals
          missedRevisit = true;
          severity = escalate(severity, 'amber');
          reasons.push('Never visited (active signals)');
        }

        // Only include stores with at least one alert
        if (overdueFollowUp || staleOpportunity || missedRevisit) {
          alertMap.set(storeId, {
            store_id: storeId,
            store_name: storeName,
            alerts: {
              overdue_follow_up: overdueFollowUp,
              stale_opportunity: staleOpportunity,
              missed_revisit: missedRevisit,
            },
            severity,
            reasons,
            oldest_timestamp: oldestTimestamp,
            overdue_follow_up_count: overdueFUs.length,
            stale_opportunity_count: staleOpps.length,
            days_since_last_stop: daysSinceLastStop,
          });
        }
      });

      // Sort: red first, then amber
      return Array.from(alertMap.values()).sort((a, b) => {
        const severityOrder = { red: 0, amber: 1, none: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
    },
    staleTime: 60000,
  });
}

/** Get SLA alert for a single store (convenience wrapper) */
export function useSLAAlertForStore(storeId: string | undefined) {
  const { data: alerts, ...rest } = useSLAAlerts(storeId ? [storeId] : undefined);
  return {
    ...rest,
    data: alerts?.find(a => a.store_id === storeId) || null,
  };
}
