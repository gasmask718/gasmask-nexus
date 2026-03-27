import { supabase } from "@/integrations/supabase/client";

/**
 * Enriches order items with product data from both products_all and products tables.
 * Needed because cart_items/marketplace_order_items no longer have FK to products_all.
 */
export async function enrichOrderItems(items: any[]): Promise<any[]> {
  if (!items || items.length === 0) return [];

  const productIds = items.map(i => i.product_id).filter(Boolean) as string[];
  if (productIds.length === 0) return items;

  // Try products_all first
  const { data: productsAll } = await supabase
    .from('products_all')
    .select('id, product_name, images')
    .in('id', productIds);

  // Also try products table
  const { data: productsLocal } = await supabase
    .from('products')
    .select('id, name, image_url')
    .in('id', productIds);

  const productMap: Record<string, { product_name: string; images: string[] }> = {};

  (productsAll || []).forEach(p => {
    productMap[p.id] = {
      product_name: p.product_name || '',
      images: Array.isArray(p.images) ? (p.images as string[]) : [],
    };
  });

  (productsLocal || []).forEach(p => {
    if (!productMap[p.id]) {
      productMap[p.id] = {
        product_name: p.name || '',
        images: p.image_url ? [p.image_url] : [],
      };
    }
  });

  return items.map(item => ({
    ...item,
    product: item.product_id ? productMap[item.product_id] || null : null,
  }));
}
