/**
 * Deviation Gate Hook
 * 
 * Compares proposed batch lbs against demand-recommended lbs.
 * Returns deviation % and whether an override gate is required.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DeviationGateResult {
  deviationPct: number;
  recommended: number;
  requiresOverride: boolean;
  isHighOverride: boolean;
  isLoading: boolean;
}

export function useDeviationGate(brand: string, proposedLbs: number): DeviationGateResult {
  const { data, isLoading } = useQuery({
    queryKey: ['deviation-gate', brand],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_inventory_coverage_intelligence' as any)
        .select('recommended_lbs_to_produce')
        .eq('brand', brand)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.recommended_lbs_to_produce as number | null;
    },
    enabled: !!brand,
  });

  const recommended = data ?? 0;
  const deviationPct = recommended > 0
    ? Math.abs(proposedLbs - recommended) / recommended * 100
    : 0;

  return {
    deviationPct: Math.round(deviationPct * 10) / 10,
    recommended,
    requiresOverride: deviationPct > 20,
    isHighOverride: deviationPct > 35,
    isLoading,
  };
}
