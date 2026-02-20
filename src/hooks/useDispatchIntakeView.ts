// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCH INTAKE VIEW HOOK — Phase 3.2 Signal Normalization
// ═══════════════════════════════════════════════════════════════════════════════
// Read-only aggregation of Floor 1 signals into dispatch-ready format
// No mutations. No automation. Vision-only.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DispatchSignal {
  store_id: string;
  store_name: string;
  territory: string | null;
  last_visit_date: string | null;
  
  needs: {
    order: boolean;
    samples: boolean;
    starter_kit: boolean;
    switch: boolean;
    switch_quantity: number;
    opportunity: boolean;
    follow_up: boolean;
  };
  
  sources: {
    inventory_signal_ids: string[];
    opportunity_ids: string[];
    follow_up_ids: string[];
  };
  
  urgency_score: number;
  recommended_actions: string[];
}

export function useDispatchIntakeView(filters?: {
  needsOrder?: boolean;
  needsSamples?: boolean;
  needsStarterKit?: boolean;
  hasOpportunity?: boolean;
  hasFollowUp?: boolean;
}) {
  return useQuery({
    queryKey: ['dispatch-intake-view', filters],
    queryFn: async () => {
      try {
        // Fetch inventory signals (needs_order, bring_samples, starter_kit)
        const { data: inventorySignals, error: invErr } = await supabase
          .from('store_tube_inventory_status')
          .select(`
            id,
            store_id,
            needs_order,
            bring_samples,
            bring_starter_kit,
            needs_switch,
            switch_quantity,
            owner_interested,
            last_updated_at
          `)
          .or('needs_order.eq.true,bring_samples.eq.true,bring_starter_kit.eq.true,needs_switch.eq.true,owner_interested.eq.true');

        if (invErr) throw invErr;

        // Fetch store opportunities (commercial signals)
        const { data: opportunities, error: oppErr } = await supabase
          .from('store_opportunities')
          .select('id, store_id, opportunity_text, is_completed, created_at')
          .eq('is_completed', false);

        if (oppErr) throw oppErr;

        // Fetch follow-ups (scheduled/deferred actions)
        const { data: followUps, error: followErr } = await supabase
          .from('follow_up_queue')
          .select(`
            id,
            store_id,
            reason,
            recommended_action,
            priority,
            due_at,
            status
          `)
          .in('status', ['pending', 'overdue']);

        if (followErr) throw followErr;

        // Fetch store metadata (name, territory from routes)
        const storeIds = Array.from(
          new Set([
            ...(inventorySignals?.map(s => s.store_id) || []),
            ...(opportunities?.map(o => o.store_id) || []),
            ...(followUps?.map(f => f.store_id) || []),
          ])
        );

        const { data: stores, error: storeErr } = await supabase
          .from('store_master')
          .select('id, store_name')
          .in('id', storeIds);

        if (storeErr) throw storeErr;

        // Fetch routes for last visit date and territory
        const { data: routes, error: routeErr } = await supabase
          .from('routes')
          .select('id, assigned_to, date, territory')
          .in('id', storeIds)
          .order('date', { ascending: false });

        if (routeErr) throw routeErr;

        // Aggregate into dispatch signals
        const signalMap = new Map<string, DispatchSignal>();

        storeIds.forEach(storeId => {
          const storeData = stores?.find(s => s.id === storeId);
          const invSignals = inventorySignals?.filter(s => s.store_id === storeId) || [];
          const opps = opportunities?.filter(o => o.store_id === storeId) || [];
          const followUpsForStore = followUps?.filter(f => f.store_id === storeId) || [];
          const storeRoute = routes?.find(r => r.id === storeId);

          const hasNeed =
            invSignals.some(s => s.needs_order) ||
            invSignals.some(s => s.bring_samples) ||
            invSignals.some(s => s.bring_starter_kit) ||
            invSignals.some(s => (s as any).needs_switch) ||
            opps.length > 0 ||
            followUpsForStore.length > 0;

          if (!hasNeed) return;

          const actions: string[] = [];
          if (invSignals.some(s => s.needs_order)) actions.push('Process order');
          if (invSignals.some(s => s.bring_samples)) actions.push('Deliver samples');
          if (invSignals.some(s => s.bring_starter_kit)) actions.push('Deliver starter kit');
          if (invSignals.some(s => (s as any).needs_switch)) {
            const totalSwitchQty = invSignals.reduce((sum, s) => sum + ((s as any).switch_quantity || 0), 0);
            actions.push(totalSwitchQty > 0 ? `Bring replacement tubes (~${totalSwitchQty})` : 'Switch tubes required');
          }
          if (invSignals.some(s => s.owner_interested)) actions.push('Discuss opportunity');
          if (opps.length > 0) actions.push(`${opps.length} open opportunity(ies)`);
          if (followUpsForStore.length > 0) actions.push(`${followUpsForStore.length} follow-up(s) due`);

          // Calculate urgency as weighted score
          let urgency = 0;
          if (invSignals.some(s => s.needs_order)) urgency += 10;
          if (invSignals.some(s => s.bring_samples)) urgency += 5;
          if (invSignals.some(s => (s as any).needs_switch)) urgency += 8;
          if (opps.length > 0) urgency += 7;
          if (followUpsForStore.some(f => f.status === 'overdue')) urgency += 15;

          // Last visit date from routes
          const lastVisit = storeRoute?.date || null;

          signalMap.set(storeId, {
            store_id: storeId,
            store_name: storeData?.store_name || `Store ${storeId.slice(0, 8)}`,
            territory: storeRoute?.territory || null,
            last_visit_date: lastVisit ? lastVisit.toString() : null,
            needs: {
              order: invSignals.some(s => s.needs_order),
              samples: invSignals.some(s => s.bring_samples),
              starter_kit: invSignals.some(s => s.bring_starter_kit),
              switch: invSignals.some(s => (s as any).needs_switch),
              switch_quantity: invSignals.reduce((sum, s) => sum + ((s as any).switch_quantity || 0), 0),
              opportunity: opps.length > 0,
              follow_up: followUpsForStore.length > 0,
            },
            sources: {
              inventory_signal_ids: invSignals.map(s => s.id),
              opportunity_ids: opps.map(o => o.id),
              follow_up_ids: followUpsForStore.map(f => f.id),
            },
            urgency_score: urgency,
            recommended_actions: actions,
          });
        });

        // Apply filters
        let signals = Array.from(signalMap.values());
        
        if (filters?.needsOrder) {
          signals = signals.filter(s => s.needs.order);
        }
        if (filters?.needsSamples) {
          signals = signals.filter(s => s.needs.samples);
        }
        if (filters?.needsStarterKit) {
          signals = signals.filter(s => s.needs.starter_kit);
        }
        if (filters?.hasOpportunity) {
          signals = signals.filter(s => s.needs.opportunity);
        }
        if (filters?.hasFollowUp) {
          signals = signals.filter(s => s.needs.follow_up);
        }

        // Sort by urgency (descending)
        signals.sort((a, b) => b.urgency_score - a.urgency_score);

        return signals;
      } catch (error) {
        console.error('Dispatch intake view error:', error);
        throw error;
      }
    },
    staleTime: 60000, // 1 minute
  });
}
