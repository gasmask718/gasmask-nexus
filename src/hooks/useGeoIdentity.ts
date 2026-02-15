import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGeoIdentity(geoId: string | null | undefined) {
  return useQuery({
    queryKey: ['geo-identity', geoId],
    queryFn: async () => {
      if (!geoId) return null;
      const { data, error } = await supabase
        .from('geo_identities')
        .select('*')
        .eq('id', geoId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!geoId,
  });
}

export function useUnresolvedGeoEntities() {
  return useQuery({
    queryKey: ['unresolved-geo-entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_unresolved_geo_entities')
        .select('*');

      if (error) throw error;
      return data;
    },
  });
}
