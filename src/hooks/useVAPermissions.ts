import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type VARole = 
  | 'grabba_cluster_va'
  | 'gasmask_va'
  | 'hotmama_va'
  | 'grabba_r_us_va'
  | 'hot_scalati_va'
  | 'toptier_va'
  | 'unforgettable_va'
  | 'iclean_va'
  | 'playboxxx_va'
  | 'funding_va'
  | 'grants_va'
  | 'credit_repair_va'
  | 'special_needs_va'
  | 'sports_betting_va'
  | 'admin'
  | 'owner';

export interface VAPermissions {
  id: string;
  user_id: string;
  va_role: VARole;
  allowed_brands: string[];
  can_access_upload_engine: boolean;
  can_access_delivery_routing: boolean;
  can_access_ai_engine: boolean;
  can_access_dashboard: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch and check VA permissions
 */
export function useVAPermissions() {
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['va-permissions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('va_permissions' as any)
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching VA permissions:', error);
        return null;
      }

      return data as unknown as VAPermissions;
    },
  });

  /**
   * Check if VA can access a specific brand
   */
  const canAccessBrand = (brand: string): boolean => {
    if (!permissions) return false;
    if (permissions.va_role === 'admin' || permissions.va_role === 'owner') return true;
    return permissions.allowed_brands.includes(brand);
  };

  /**
   * Get all allowed brands for this VA
   */
  const getAllowedBrands = (): string[] => {
    if (!permissions) return [];
    if (permissions.va_role === 'admin' || permissions.va_role === 'owner') {
      return [
        'GasMask',
        'HotMama',
        'GrabbaRUs',
        'HotScalati',
        'TopTier',
        'UnforgettableTimes',
        'iCleanWeClean',
        'Playboxxx',
        'Funding',
        'Grants',
        'CreditRepair',
        'SpecialNeeds',
        'SportsBetting',
        'Dynasty',
      ];
    }
    return permissions.allowed_brands;
  };

  /**
   * Check if VA is Grabba Cluster VA (access to all 4 Grabba brands)
   */
  const isGrabbaClusterVA = (): boolean => {
    return permissions?.va_role === 'grabba_cluster_va';
  };

  /**
   * Check if VA has specific permission
   */
  const hasPermission = (permission: keyof Omit<VAPermissions, 'id' | 'user_id' | 'va_role' | 'allowed_brands' | 'created_at' | 'updated_at'>): boolean => {
    if (!permissions) return false;
    if (permissions.va_role === 'admin' || permissions.va_role === 'owner') return true;
    return permissions[permission] === true;
  };

  /**
   * Check if user is admin or owner
   */
  const isAdmin = (): boolean => {
    return permissions?.va_role === 'admin' || permissions?.va_role === 'owner';
  };

  /**
   * Get brand-specific routes that VA can access
   */
  const getAllowedRoutes = (): string[] => {
    if (!permissions) return [];
    
    const routes: string[] = [];
    const brands = getAllowedBrands();

    // Common routes for all VAs
    brands.forEach(brand => {
      routes.push(`/brand/${brand.toLowerCase()}/crm`);
      routes.push(`/brand/${brand.toLowerCase()}/communications`);
    });

    // Grabba Cluster VA specific routes
    if (isGrabbaClusterVA()) {
      routes.push('/grabba/unified-upload');
      routes.push('/grabba/cluster-dashboard');
      routes.push('/grabba/delivery');
    }

    // Upload engine access
    if (hasPermission('can_access_upload_engine')) {
      routes.push('/unified-upload');
    }

    // Delivery routing access
    if (hasPermission('can_access_delivery_routing')) {
      routes.push('/delivery-routing');
      routes.push('/routes');
    }

    // Dashboard access
    if (hasPermission('can_access_dashboard')) {
      routes.push('/dashboard');
      routes.push('/');
    }

    // Admin routes
    if (isAdmin()) {
      routes.push('/admin');
      routes.push('/settings');
    }

    return routes;
  };

  /**
   * Filter navigation items based on permissions
   */
  const filterNavigationItems = (items: any[]): any[] => {
    if (isAdmin()) return items;

    const allowedRoutes = getAllowedRoutes();
    
    return items.filter(item => {
      // Check if main route is allowed
      if (item.path && !allowedRoutes.some(route => item.path.startsWith(route))) {
        return false;
      }

      // Filter sub-items if they exist
      if (item.items) {
        item.items = item.items.filter((subItem: any) => 
          allowedRoutes.some(route => subItem.path?.startsWith(route))
        );
        return item.items.length > 0;
      }

      return true;
    });
  };

  return {
    permissions,
    isLoading,
    canAccessBrand,
    getAllowedBrands,
    isGrabbaClusterVA,
    hasPermission,
    isAdmin,
    getAllowedRoutes,
    filterNavigationItems,
  };
}
