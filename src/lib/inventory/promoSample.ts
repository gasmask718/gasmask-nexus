// One promotional sample per parent brand.
//
// The authoritative flag lives on products.is_promo_sample. Anything that
// offers a "Bring Samples" action must gate on this — the DB enforces the
// same rule with a trigger on store_tube_inventory_status.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveProductIdForBrand } from '@/lib/inventory/skuDisplay';

export function usePromoSampleProductIds() {
  return useQuery({
    queryKey: ['promo-sample-product-ids'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .eq('is_promo_sample', true)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.id as string);
    },
  });
}

/** True when this inventory brand key maps to the brand's promo sample SKU. */
export function isPromoSampleBrandKey(
  brandKey: string | null | undefined,
  promoProductIds: string[] | undefined,
): boolean {
  if (!brandKey || !promoProductIds?.length) return false;
  const pid = resolveProductIdForBrand(brandKey);
  return !!pid && promoProductIds.includes(pid);
}
