import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { ExecutionTarget } from '@/components/communication/followups/FollowUpExecutionBar';

interface ExecutionReadinessParams {
  executionTargets: ExecutionTarget[];
  voiceEngine: string;
}

export type ExecutionHealthStatus = 'ok' | 'partial' | 'data_error' | 'loading';

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
  healthStatus: ExecutionHealthStatus;
  dataError: string | null;
}

/**
 * Single source of truth for execution readiness.
 * Resolves phone numbers from store_master when targets lack them,
 * and computes a unified readiness state for the call button.
 * 
 * DATA_ERROR state: if upstream queries fail, this hook surfaces the
 * failure explicitly instead of silently disabling execution.
 */
export function useExecutionReadiness({ executionTargets, voiceEngine }: ExecutionReadinessParams): ExecutionReadiness {
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;

  // Listen for global data errors from safeQuery
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setDataError(`${detail.source}: ${detail.error}`);
    };
    window.addEventListener('execution:data_error', handler);
    return () => window.removeEventListener('execution:data_error', handler);
  }, []);

  // Clear data error when targets change (user retried)
  useEffect(() => {
    if (executionTargets.length > 0) setDataError(null);
  }, [executionTargets]);

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

  const { data: resolvedPhones, isError: phonesError } = useQuery({
    queryKey: ['resolve-phones', storeIdsNeedingPhones],
    queryFn: async () => {
      if (storeIdsNeedingPhones.length === 0) return {};
      const phoneMap: Record<string, string | null> = {};
      for (let i = 0; i < storeIdsNeedingPhones.length; i += 50) {
        const chunk = storeIdsNeedingPhones.slice(i, i + 50);
        const { data, error } = await supabase
          .from('store_master')
          .select('id, phone')
          .in('id', chunk);
        if (error) {
          console.error('PHONE_RESOLVE_STORE_MASTER_FAILED', error);
          throw new Error(`PHONE_RESOLVE_FAILED: ${error.message}`);
        }
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
  const { data: contactPhones, isError: contactPhonesError } = useQuery({
    queryKey: ['resolve-contact-phones', storeIdsNeedingPhones],
    queryFn: async () => {
      if (storeIdsNeedingPhones.length === 0) return {};
      const phoneMap: Record<string, string | null> = {};
      for (let i = 0; i < storeIdsNeedingPhones.length; i += 50) {
        const chunk = storeIdsNeedingPhones.slice(i, i + 50);
        const { data, error } = await supabase
          .from('store_contacts')
          .select('store_id, phone')
          .is('deleted_at', null)
          .in('store_id', chunk)
          .not('phone', 'is', null)
          .limit(50);
        if (error) {
          console.error('PHONE_RESOLVE_CONTACTS_FAILED', error);
          throw new Error(`CONTACT_PHONE_RESOLVE_FAILED: ${error.message}`);
        }
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

  // Enrich targets with resolved phones + normalize
  const enrichedTargets = useMemo(() => {
    return uniqueTargets.map(t => {
      if (t.phone) return t;
      const storePhone = resolvedPhones?.[t.store_id];
      const contactPhone = contactPhones?.[t.store_id];
      const raw = storePhone || contactPhone || null;
      // Normalize: strip non-digits, add +1 for US 10-digit
      let normalized = raw ? raw.replace(/\D/g, '') : null;
      if (normalized && normalized.length === 10) normalized = `+1${normalized}`;
      else if (normalized && normalized.length === 11 && normalized.startsWith('1')) normalized = `+${normalized}`;
      else if (normalized && normalized.length > 0) normalized = `+${normalized}`;
      else normalized = null;
      return { ...t, phone: normalized };
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
  const callableTargets = enrichedTargets.filter(t => !!t.phone);
  const callableCount = callableTargets.length;
  const hasCallableNumbers = callableCount > 0;
  const agentReady = agentStatus ?? false;
  const voiceReady = !!voiceEngine || voiceEngine === 'auto';

  // Health status
  const healthStatus: ExecutionHealthStatus = (() => {
    if (dataError || phonesError || contactPhonesError) return 'data_error';
    if (!hasTargets) return 'ok';
    if (hasCallableNumbers && callableCount < uniqueTargets.length) return 'partial';
    return 'ok';
  })();

  // canExecute: blocked ONLY by data errors, never by agent availability
  const canExecute = hasTargets && healthStatus !== 'data_error';

  const reason = useMemo(() => {
    if (healthStatus === 'data_error') return `Data sync error: ${dataError || 'Query failed'}. Dialing disabled until resolved.`;
    if (!hasTargets) return 'No stores selected';
    if (!hasCallableNumbers) return `${uniqueTargets.length} stores selected but none have phone numbers`;
    if (!agentReady) return `${callableCount} callable — no agents online (calls will queue)`;
    if (!voiceReady) return 'Voice engine not configured';
    return null;
  }, [healthStatus, dataError, hasTargets, hasCallableNumbers, agentReady, voiceReady, callableCount, uniqueTargets.length]);

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
    healthStatus,
    dataError,
  };
}
