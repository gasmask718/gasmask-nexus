import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { ExecutionTarget } from '@/components/communication/followups/FollowUpExecutionBar';

interface ExecutionReadinessParams {
  executionTargets: ExecutionTarget[];
  voiceEngine: string;
}

interface ExecutionReadiness {
  canExecute: boolean;
  callableCount: number;
  totalCount: number;
  hasTargets: boolean;
  hasCallableNumbers: boolean;
  agentReady: boolean;
  voiceReady: boolean;
  reason: string | null;
  enrichedTargets: ExecutionTarget[];
}

/**
 * Single source of truth for execution readiness.
 * Resolves phone numbers from store_master when targets lack them,
 * and computes a unified readiness state for the call button.
 */
export function useExecutionReadiness({ executionTargets, voiceEngine }: ExecutionReadinessParams): ExecutionReadiness {
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;

  // Deduplicate by store_id
  const uniqueTargets = useMemo(() => {
    const map = new Map<string, ExecutionTarget>();
    executionTargets.forEach(t => {
      if (!map.has(t.store_id)) map.set(t.store_id, t);
    });
    return Array.from(map.values());
  }, [executionTargets]);

  // Batch-resolve phone numbers for targets missing them
  const storeIdsNeedingPhones = useMemo(
    () => uniqueTargets.filter(t => !t.phone).map(t => t.store_id),
    [uniqueTargets]
  );

  const { data: resolvedPhones } = useQuery({
    queryKey: ['resolve-phones', storeIdsNeedingPhones],
    queryFn: async () => {
      if (storeIdsNeedingPhones.length === 0) return {};
      // Batch in chunks of 50
      const phoneMap: Record<string, string | null> = {};
      for (let i = 0; i < storeIdsNeedingPhones.length; i += 50) {
        const chunk = storeIdsNeedingPhones.slice(i, i + 50);
        const { data } = await supabase
          .from('store_master')
          .select('id, phone')
          .in('id', chunk);
        (data || []).forEach((row: any) => {
          phoneMap[row.id] = row.phone;
        });
      }
      return phoneMap;
    },
    enabled: storeIdsNeedingPhones.length > 0,
    staleTime: 30000,
  });

  // Also try contacts table for phone resolution
  const { data: contactPhones } = useQuery({
    queryKey: ['resolve-contact-phones', storeIdsNeedingPhones],
    queryFn: async () => {
      if (storeIdsNeedingPhones.length === 0) return {};
      const phoneMap: Record<string, string | null> = {};
      for (let i = 0; i < storeIdsNeedingPhones.length; i += 50) {
        const chunk = storeIdsNeedingPhones.slice(i, i + 50);
        const { data } = await supabase
          .from('store_contacts')
          .select('store_id, phone')
          .in('store_id', chunk)
          .not('phone', 'is', null)
          .limit(50);
        (data || []).forEach((row: any) => {
          if (row.phone && !phoneMap[row.store_id]) {
            phoneMap[row.store_id] = row.phone;
          }
        });
      }
      return phoneMap;
    },
    enabled: storeIdsNeedingPhones.length > 0,
    staleTime: 30000,
  });

  // Enrich targets with resolved phones
  const enrichedTargets = useMemo(() => {
    return uniqueTargets.map(t => {
      if (t.phone) return t;
      const storePhone = resolvedPhones?.[t.store_id];
      const contactPhone = contactPhones?.[t.store_id];
      const resolvedPhone = storePhone || contactPhone || null;
      return { ...t, phone: resolvedPhone };
    });
  }, [uniqueTargets, resolvedPhones, contactPhones]);

  // Agent readiness check
  const { data: agentStatus } = useQuery({
    queryKey: ['agent-readiness', bizId],
    queryFn: async () => {
      const { count } = await supabase
        .from('dialer_agent_availability')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', bizId!)
        .eq('status', 'available');
      return (count || 0) > 0;
    },
    enabled: !!bizId,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const hasTargets = uniqueTargets.length > 0;
  const callableTargets = enrichedTargets.filter(t => !!t.phone?.replace(/\D/g, ''));
  const callableCount = callableTargets.length;
  const hasCallableNumbers = callableCount > 0;
  const agentReady = agentStatus ?? false;
  const voiceReady = !!voiceEngine || voiceEngine === 'auto';

  // canExecute = has targets (agent availability only changes label, never blocks)
  const canExecute = hasTargets;
  
  const reason = useMemo(() => {
    if (!hasTargets) return 'No stores selected';
    if (!hasCallableNumbers) return `${uniqueTargets.length} stores selected but none have phone numbers`;
    if (!agentReady) return `${callableCount} callable — no agents online (calls will queue)`;
    if (!voiceReady) return 'Voice engine not configured';
    return null;
  }, [hasTargets, hasCallableNumbers, agentReady, voiceReady, callableCount, uniqueTargets.length]);

  return {
    canExecute,
    callableCount,
    totalCount: uniqueTargets.length,
    hasTargets,
    hasCallableNumbers,
    agentReady,
    voiceReady,
    reason,
    enrichedTargets,
  };
}
