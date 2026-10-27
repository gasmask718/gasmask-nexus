import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface AreaProspect {
  prospect_key: string;
  store_name: string | null;
  address: string | null;
  state: string | null;
  neighborhood: string | null;
  phone: string | null;
  recheck_note: string | null;
  priority_score: number | null;
}
interface AreaProspectsPage {
  items: AreaProspect[];
  total: number;
  area_total: number;
  neighborhoods: string[];
}

export function useAmbassadorAreaProspects(search: string, neighborhood: string, page: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ambassador-area-prospects', user?.id, search, neighborhood, page],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<AreaProspectsPage> => {
      const { data, error } = await supabase.rpc('ambassador_area_prospects_page', {
        p_search: search.trim(), p_neighborhood: neighborhood, p_page: page,
      });
      if (error) throw error;
      return data as unknown as AreaProspectsPage;
    },
  });
}