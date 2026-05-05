import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION FLAGS — Read-only derived signals from existing data
// No writes, no enforcement, no AI decisions. Pure derivation.
// ═══════════════════════════════════════════════════════════════════════════════

export interface EscalationFlag {
  flag_type: string;
  label: string;
  severity: 'low' | 'medium' | 'high';
  occurrences: number;
}

// Tunable thresholds — adjust here, not in components
const THRESHOLDS = {
  PAYMENT_REFUSED_MIN: 2,
  NOT_AVAILABLE_MIN: 3,
  VISITS_WITHOUT_ORDER_MIN: 3,
  ISSUE_CONFLICT_MIN: 2,
  WINDOW_DAYS: 30,
} as const;

function deriveFlags(
  outcomes: { outcome_type: string }[]
): EscalationFlag[] {
  const flags: EscalationFlag[] = [];

  const countByType = (type: string) =>
    outcomes.filter((o) => o.outcome_type === type).length;

  const paymentRefused = countByType('payment_refused');
  if (paymentRefused >= THRESHOLDS.PAYMENT_REFUSED_MIN) {
    flags.push({
      flag_type: 'repeated_payment_refusal',
      label: `Repeated payment refusal (${paymentRefused}× last 30d)`,
      severity: 'high',
      occurrences: paymentRefused,
    });
  }

  const notAvailable = countByType('not_available');
  if (notAvailable >= THRESHOLDS.NOT_AVAILABLE_MIN) {
    flags.push({
      flag_type: 'unresponsive_store',
      label: `Unresponsive store (${notAvailable}× not available)`,
      severity: 'medium',
      occurrences: notAvailable,
    });
  }

  // High visits / low orders: total visits minus order_taken outcomes
  const orderTaken = countByType('order_taken');
  const totalVisits = outcomes.length;
  const visitsWithoutOrder = totalVisits - orderTaken;
  if (totalVisits >= THRESHOLDS.VISITS_WITHOUT_ORDER_MIN && orderTaken === 0) {
    flags.push({
      flag_type: 'high_visits_low_orders',
      label: `${visitsWithoutOrder} visits with no orders`,
      severity: 'medium',
      occurrences: visitsWithoutOrder,
    });
  }

  const issueConflict = countByType('issue_conflict');
  if (issueConflict >= THRESHOLDS.ISSUE_CONFLICT_MIN) {
    flags.push({
      flag_type: 'dispute_pattern',
      label: `Dispute pattern (${issueConflict}× issues)`,
      severity: 'high',
      occurrences: issueConflict,
    });
  }

  return flags;
}

async function fetchOutcomesForStore(storeId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - THRESHOLDS.WINDOW_DAYS);

  const { data } = await supabase
    .from('delivery_checklists')
    .select('outcome_summary')
    .eq('store_id', storeId)
    .gte('completed_at', cutoff.toISOString())
    .not('outcome_summary', 'is', null);

  return (data || [])
    .map((row) => {
      const summary = row.outcome_summary as Record<string, unknown> | null;
      return summary?.outcome_type as string | undefined;
    })
    .filter(Boolean)
    .map((outcome_type) => ({ outcome_type: outcome_type! }));
}

// ── Single-store hook ──────────────────────────────────────────────────────────

export function useEscalationFlags(storeId: string | undefined) {
  return useQuery({
    queryKey: ['escalation-flags', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const outcomes = await fetchOutcomesForStore(storeId);
      return deriveFlags(outcomes);
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });
}

// ── Batch hook for directory-level rendering ────────────────────────────────────

async function fetchOutcomesBatch(storeIds: string[]) {
  if (storeIds.length === 0) return new Map<string, EscalationFlag[]>();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - THRESHOLDS.WINDOW_DAYS);

  const CHUNK_SIZE = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < storeIds.length; i += CHUNK_SIZE) {
    chunks.push(storeIds.slice(i, i + CHUNK_SIZE));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from('delivery_checklists')
        .select('store_id, outcome_summary')
        .in('store_id', chunk)
        .gte('completed_at', cutoff.toISOString())
        .not('outcome_summary', 'is', null)
    )
  );
  const data = results.flatMap((r) => r.data || []);

  // Group by store
  const grouped = new Map<string, { outcome_type: string }[]>();
  for (const row of data || []) {
    const summary = row.outcome_summary as Record<string, unknown> | null;
    const outcome_type = summary?.outcome_type as string | undefined;
    if (!outcome_type || !row.store_id) continue;
    if (!grouped.has(row.store_id)) grouped.set(row.store_id, []);
    grouped.get(row.store_id)!.push({ outcome_type });
  }

  // Derive flags per store
  const result = new Map<string, EscalationFlag[]>();
  for (const sid of storeIds) {
    const outcomes = grouped.get(sid) || [];
    const flags = deriveFlags(outcomes);
    if (flags.length > 0) result.set(sid, flags);
  }
  return result;
}

export function useEscalationFlagsBatch(storeIds: string[]) {
  const key = useMemo(() => [...storeIds].sort().join(','), [storeIds]);

  return useQuery({
    queryKey: ['escalation-flags-batch', key],
    queryFn: () => fetchOutcomesBatch(storeIds),
    enabled: storeIds.length > 0,
    staleTime: 60_000,
  });
}
