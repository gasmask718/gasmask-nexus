import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface BusinessMembership {
  business_id: string;
  role: string;
  slug?: string | null;
  name?: string | null;
}

/**
 * Returns the signed-in user's business_members rows (tenancy source of truth).
 * Mirrors has_business_role() server-side.
 */
export function useBusinessMemberships() {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ['business-memberships', user?.id],
    enabled: !authLoading && !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BusinessMembership[]> => {
      const { data, error } = await supabase
        .from('business_members')
        .select('business_id, role, businesses:business_id ( slug, name )')
        .eq('user_id', user!.id);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        business_id: row.business_id,
        role: (row.role as string)?.trim().toLowerCase(),
        slug: row.businesses?.slug ?? null,
        name: row.businesses?.name ?? null,
      }));
    },
  });
}

/**
 * Roles the user holds inside a specific business.
 */
export function useBusinessRoles(businessId: string | null | undefined) {
  const { data, isLoading } = useBusinessMemberships();
  const roles = (data || [])
    .filter((m) => businessId && m.business_id === businessId)
    .map((m) => m.role);
  return { roles, isLoading };
}
