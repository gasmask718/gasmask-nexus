import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PricingTier = 'retail' | 'store' | 'wholesale';

interface TierPrice {
  tier: PricingTier;
  minQty: number;
  pricePerUnit: number;
}

export function usePricing() {
  const { user, userRole } = useAuth();

  const detectTierForUser = (): PricingTier => {
    if (!user) return 'retail';
    
    // Map user roles to pricing tiers
    switch (userRole) {
      case 'wholesaler':
        return 'wholesale';
      case 'store':
      case 'store_owner':
        return 'store';
      default:
        return 'retail';
    }
  };

  const getTierPrice = async (
    productId: string,
    quantity: number,
    tier: PricingTier
  ): Promise<number> => {
    // First try to get from pricing_tiers table
    const { data: tiers } = await supabase
      .from('pricing_tiers')
      .select('*')
      .eq('product_id', productId)
      .eq('tier', tier)
      .order('min_qty', { ascending: false });

    if (tiers && tiers.length > 0) {
      // Find the applicable tier based on quantity
      const applicableTier = tiers.find(t => quantity >= t.min_qty);
      if (applicableTier) {
        return Number(applicableTier.price_per_unit);
      }
    }

    // Fallback to product's direct pricing
    const { data: product } = await supabase
      .from('products_all')
      .select('retail_price, store_price, wholesale_price')
      .eq('id', productId)
      .single();

    if (!product) return 0;

    switch (tier) {
      case 'wholesale':
        return Number(product.wholesale_price) || 0;
      case 'store':
        return Number(product.store_price) || 0;
      default:
        return Number(product.retail_price) || 0;
    }
  };

  const getProductPriceForDisplay = (
    product: {
      retail_price?: number | null;
      store_price?: number | null;
      wholesale_price?: number | null;
    },
    tier?: PricingTier
  ): number => {
    const effectiveTier = tier || detectTierForUser();
    
    switch (effectiveTier) {
      case 'wholesale':
        return Number(product.wholesale_price) || Number(product.retail_price) || 0;
      case 'store':
        return Number(product.store_price) || Number(product.retail_price) || 0;
      default:
        return Number(product.retail_price) || 0;
    }
  };

  const calculateTierPricing = async (
    productId: string,
    quantity: number
  ): Promise<{ price: number; tier: PricingTier; savings: number }> => {
    const tier = detectTierForUser();
    const price = await getTierPrice(productId, quantity, tier);
    const retailPrice = await getTierPrice(productId, quantity, 'retail');
    const savings = (retailPrice - price) * quantity;

    return { price, tier, savings: Math.max(0, savings) };
  };

  return {
    detectTierForUser,
    getTierPrice,
    getProductPriceForDisplay,
    calculateTierPricing,
  };
}
