import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isContactable } from '@/lib/phoneStatus';

export interface StoreContactGlance {
  hasHomie: boolean;
  hasConfirmedOwner: boolean;
  hasContactableNumber: boolean;
  contactCount: number;
}

/**
 * Batch "at-a-glance" contact markers for a list of stores (store list cards).
 * Reads store_contacts — the single source of truth for contacts.
 */
export function useStoreContactGlance(storeIds: string[]) {
  const key = [...storeIds].sort().join(',');

  return useQuery({
    queryKey: ['store-contact-glance', key],
    enabled: storeIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Record<string, StoreContactGlance>> => {
      const CHUNK = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < storeIds.length; i += CHUNK) {
        chunks.push(storeIds.slice(i, i + CHUNK));
      }

      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('store_contacts')
            .select('store_id, phone, is_homie, owner_confirmed, responsiveness_status')
            .in('store_id', chunk)
        )
      );

      const failed = results.find((r) => r.error);
      // Surface the real error — never swallow it.
      if (failed?.error) throw failed.error;

      const map: Record<string, StoreContactGlance> = {};
      results
        .flatMap((r) => r.data || [])
        .forEach((c: any) => {
          const entry =
            map[c.store_id] ||
            (map[c.store_id] = {
              hasHomie: false,
              hasConfirmedOwner: false,
              hasContactableNumber: false,
              contactCount: 0,
            });
          entry.contactCount += 1;
          if (c.is_homie) entry.hasHomie = true;
          if (c.owner_confirmed) entry.hasConfirmedOwner = true;
          if (c.phone && isContactable(c.responsiveness_status)) {
            entry.hasContactableNumber = true;
          }
        });

      return map;
    },
  });
}
