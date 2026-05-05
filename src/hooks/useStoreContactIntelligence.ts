// ═══════════════════════════════════════════════════════════════
// STORE CONTACT INTELLIGENCE HOOK
// Fetches pickup probability + rates for Follow-Up Manager
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreIntelligence {
  store_id: string;
  answer_rate: number;
  voicemail_rate: number;
  busy_rate: number;
  pickup_probability: number;
  avg_call_duration: number;
  total_attempts: number;
  total_answers: number;
  best_hour: number | null;
  best_day_of_week: number | null;
}

export type ContactScoreTier = 'high' | 'medium' | 'low' | 'unknown';

export function getContactScoreTier(probability: number | null | undefined): ContactScoreTier {
  if (probability == null) return 'unknown';
  if (probability > 0.6) return 'high';
  if (probability > 0.3) return 'medium';
  return 'low';
}

export function useStoreContactIntelligence(storeIds: string[]) {
  return useQuery({
    queryKey: ['store-contact-intelligence', storeIds.sort().join(',')],
    queryFn: async () => {
      if (!storeIds.length) return new Map<string, StoreIntelligence>();

      const CHUNK_SIZE = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < storeIds.length; i += CHUNK_SIZE) {
        chunks.push(storeIds.slice(i, i + CHUNK_SIZE));
      }
      const results = await Promise.all(
        chunks.map((chunk) =>
          (supabase as any)
            .from('store_answer_profile')
            .select('store_id, answer_rate, voicemail_rate, busy_rate, pickup_probability, avg_call_duration, total_attempts, total_answers, best_hour, best_day_of_week')
            .in('store_id', chunk)
        )
      );
      const firstError = results.find((r: any) => r.error);
      if (firstError?.error) {
        console.error('STORE_INTELLIGENCE_FETCH_FAILED', firstError.error);
        return new Map<string, StoreIntelligence>();
      }
      const data = results.flatMap((r: any) => r.data || []);

      const map = new Map<string, StoreIntelligence>();
      (data || []).forEach((row: any) => {
        map.set(row.store_id, row as StoreIntelligence);
      });
      return map;
    },
    enabled: storeIds.length > 0,
    staleTime: 60_000,
  });
}
