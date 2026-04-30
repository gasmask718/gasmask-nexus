import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VAActiveCompany {
  membership_id: string;
  company_id: string;
  company_slug: string;
  company_name: string;
  brand_color: string | null;
  role: string;
}

/**
 * Returns the currently signed-in VA's primary company membership.
 * Falls back to null if the user has no membership yet.
 */
export function useVAActiveCompany() {
  return useQuery({
    queryKey: ['va-active-company'],
    queryFn: async (): Promise<VAActiveCompany | null> => {
      const { data: ures } = await supabase.auth.getUser();
      if (!ures?.user) return null;

      const { data, error } = await supabase
        .from('va_company_memberships')
        .select(`
          id, role, is_primary, is_active, company_id,
          va_companies:company_id ( id, slug, name, brand_color )
        `)
        .eq('user_id', ures.user.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data || !(data as any).va_companies) return null;

      const c = (data as any).va_companies;
      return {
        membership_id: (data as any).id,
        company_id: c.id,
        company_slug: c.slug,
        company_name: c.name,
        brand_color: c.brand_color,
        role: (data as any).role,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
