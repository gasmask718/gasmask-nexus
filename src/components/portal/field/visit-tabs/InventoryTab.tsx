import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Package, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  brand_id: string;
  category: string;
}

interface Brand {
  id: string;
  name: string;
}

interface InventoryTabProps {
  storeId: string;
  products: Product[];
  brands: Brand[];
  inventory: Record<string, number>;
  onInventoryChange: (inventory: Record<string, number>) => void;
}

interface ApprovedInventory {
  product_id: string;
  quantity_on_hand: number;
  last_restock_date: string | null;
}

export function InventoryTab({ storeId, products, brands, inventory, onInventoryChange }: InventoryTabProps) {
  const [approvedInventory, setApprovedInventory] = useState<Record<string, ApprovedInventory>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApprovedInventory() {
      try {
        const { data } = await supabase
          .from('store_inventory')
          .select('product_id, quantity_on_hand, last_restock_date')
          .eq('store_id', storeId);

        if (data) {
          const invMap: Record<string, ApprovedInventory> = {};
          data.forEach(item => {
            invMap[item.product_id] = item;
          });
          setApprovedInventory(invMap);
        }
      } catch (error) {
        console.error('Error fetching inventory:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchApprovedInventory();
  }, [storeId]);

  const updateProductCount = (productId: string, count: number) => {
    onInventoryChange({
      ...inventory,
      [productId]: count,
    });
  };

  // Group products by brand
  const productsByBrand = brands.map(brand => ({
    brand,
    products: products.filter(p => p.brand_id === brand.id),
  })).filter(group => group.products.length > 0);

  const hasLargeChange = (productId: string, newCount: number) => {
    const approved = approvedInventory[productId]?.quantity_on_hand || 0;
    const diff = Math.abs(newCount - approved);
    return diff > 10 || (approved > 0 && diff / approved > 0.5);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Inventory Counts
        </CardTitle>
        <CardDescription>
          Count current inventory. Large changes will be flagged for review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <Accordion type="multiple" className="w-full" defaultValue={brands.map(b => b.id)}>
            {productsByBrand.map(({ brand, products: brandProducts }) => (
              <AccordionItem key={brand.id} value={brand.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="font-bold text-xs text-primary">
                        {brand.name.charAt(0)}
                      </span>
                    </div>
                    <span>{brand.name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {brandProducts.length} products
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <div className="space-y-4">
                    {brandProducts.map((product) => {
                      const approved = approvedInventory[product.id];
                      const currentCount = inventory[product.id] || 0;
                      const isLargeChange = hasLargeChange(product.id, currentCount);

                      const lastCount = approved?.quantity_on_hand;

                      return (
                        <div 
                          key={product.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isLargeChange ? 'border-amber-500/50 bg-amber-500/5' : ''
                          }`}
                        >
                          <div className="flex-1">
                            <Label className="font-medium">{product.name}</Label>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span>Category: {product.category || 'N/A'}</span>
                              {lastCount !== undefined && (
                                <>
                                  <span>•</span>
                                  <span>Last count: {lastCount}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isLargeChange && currentCount > 0 && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                            <Input
                              type="number"
                              min={0}
                              value={currentCount}
                              onChange={(e) => updateProductCount(product.id, parseInt(e.target.value) || 0)}
                              className="w-24 text-center"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
