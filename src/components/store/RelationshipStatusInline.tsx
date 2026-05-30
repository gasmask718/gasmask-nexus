import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RelationshipStatusSelect } from './RelationshipStatusSelect';
import { DEFAULT_RELATIONSHIP_STATUS } from '@/config/storeRelationshipStatus';

/**
 * Header-friendly wrapper that loads the current relationship_status
 * from store_master and renders the 9-state selector inline on the
 * store profile. Same component, same governance routing.
 */
export function RelationshipStatusInline({ storeId, role }: { storeId: string; role?: string | null }) {
  const { data } = useQuery({
    queryKey: ['store-master', storeId, 'relationship_status'],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('relationship_status')
        .eq('id', storeId)
        .maybeSingle();
      if (error) throw error;
      return (data?.relationship_status as string | null) || DEFAULT_RELATIONSHIP_STATUS;
    },
    staleTime: 30_000,
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Relationship:</span>
      <RelationshipStatusSelect storeId={storeId} value={data} role={role} />
    </div>
  );
}
