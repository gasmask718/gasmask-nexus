// ═══════════════════════════════════════════════════════════════════════════════
// PRIOR CUSTOMER SEGMENT MAP — Shared hook used across Follow-Up Manager,
// Auto Dialer, Campaign Dial, Manual Calls, and Messaging Hub.
// Reads from v_prior_customer_segments (45/120/270d buckets).
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FlowStatus = 'active_flow' | 'recently_quiet' | 'cold' | 'long_dormant';

export interface PriorCustomerSegment {
  store_id: string;
  store_name: string | null;
  flow_status: FlowStatus;
  lifetime_tubes: number | null;
  lifetime_revenue: number | null;
  invoice_count: number | null;
  last_order_date: string | null;
  days_since_last_order: number | null;
}

export const FLOW_STATUS_META: Record<FlowStatus, { label: string; color: string; emoji: string }> = {
  active_flow:    { label: 'Active Flow',    color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', emoji: '🟢' },
  recently_quiet: { label: 'Recently Quiet', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30',       emoji: '🟡' },
  cold:           { label: 'Cold',           color: 'bg-red-500/15 text-red-600 border-red-500/30',             emoji: '🔴' },
  long_dormant:   { label: 'Long Dormant',   color: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',          emoji: '⚫' },
};

export const FLOW_STATUS_ORDER: FlowStatus[] = ['active_flow', 'recently_quiet', 'cold', 'long_dormant'];

export function usePriorCustomerSegments() {
  return useQuery({
    queryKey: ['prior-customer-segments'],
    staleTime: 60_000,
    queryFn: async (): Promise<PriorCustomerSegment[]> => {
      const all: PriorCustomerSegment[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('v_prior_customer_segments' as any)
          .select('store_id, store_name, flow_status, lifetime_tubes, lifetime_revenue, invoice_count, last_order_date, days_since_last_order')
          .range(from, from + PAGE - 1);
        if (error) {
          console.error('PRIOR_CUSTOMER_SEGMENTS_FAILED', error);
          throw new Error(`PRIOR_CUSTOMER_SEGMENTS_FAILED: ${error.message}`);
        }
        const rows = (data || []) as unknown as PriorCustomerSegment[];
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });
}

export function usePriorCustomerSegmentMap() {
  const query = usePriorCustomerSegments();

  const map = useMemo(() => {
    const m = new Map<string, PriorCustomerSegment>();
    (query.data || []).forEach(seg => { if (seg.store_id) m.set(seg.store_id, seg); });
    return m;
  }, [query.data]);

  const counts = useMemo(() => {
    const c: Record<FlowStatus | 'total', number> = {
      active_flow: 0, recently_quiet: 0, cold: 0, long_dormant: 0, total: 0,
    };
    (query.data || []).forEach(seg => {
      if (seg.flow_status && c[seg.flow_status] !== undefined) c[seg.flow_status]++;
      c.total++;
    });
    return c;
  }, [query.data]);

  return { ...query, map, counts, segments: query.data || [] };
}
