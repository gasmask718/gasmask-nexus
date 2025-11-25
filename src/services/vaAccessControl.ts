/**
 * VA Access Control Service
 * Server-side validation for VA brand access
 */

import { supabase } from '@/integrations/supabase/client';

export async function validateVABrandAccess(userId: string, brand: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_access_brand' as any, {
      _user_id: userId,
      _brand: brand
    });

    if (error) {
      console.error('Error validating brand access:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in validateVABrandAccess:', error);
    return false;
  }
}

/**
 * Filter data by allowed brands for current user
 */
export async function filterByAllowedBrands<T extends { brand?: string }>(
  data: T[]
): Promise<T[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: permissions } = await supabase
    .from('va_permissions' as any)
    .select('allowed_brands, va_role')
    .eq('user_id', user.id)
    .single();

  if (!permissions) return [];

  const perms = permissions as any;

  // Admins and owners see all data
  if (perms.va_role === 'admin' || perms.va_role === 'owner') {
    return data;
  }

  // Filter by allowed brands
  return data.filter(item => 
    item.brand && perms.allowed_brands.includes(item.brand)
  );
}

/**
 * Server-side query filter for brand access
 */
export function buildBrandFilterQuery(baseQuery: any) {
  return baseQuery.rpc('filter_by_va_brands');
}
