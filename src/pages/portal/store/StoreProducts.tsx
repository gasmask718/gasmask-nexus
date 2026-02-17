import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/services/marketplace/useCart";
import { Search, ShoppingCart, Package, Filter, Eye, Box, Tag, Weight, Layers, Store, X } from "lucide-react";
import { Link } from "react-router-dom";

interface StoreProduct {
  id: string;
  name: string;
  type: string;
  unit_type: string;
  sku: string | null;
  category: string | null;
  wholesale_price: number;
  suggested_retail_price: number;
  store_price: number | null;
  street_price: number | null;
  image_url: string | null;
  description: string | null;
  short_description: string | null;
  variant: string | null;
  flavor_notes: string | null;
  strength_level: string | null;
  weight_per_unit: number | null;
  units_per_box: number | null;
  pack_size: number | null;
  packs_per_box: number | null;
  track_by: string | null;
  barcode: string | null;
  is_active: boolean;
  status: string | null;
  brand: { name: string; color: string | null } | null;
  assigned_stores?: { store_id: string; store_name: string }[];
}

function useStoreProducts(filters?: { search?: string; brandId?: string }) {
  return useQuery({
    queryKey: ['store-portal-products', filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id, name, type, unit_type, sku, category,
          wholesale_price, suggested_retail_price, store_price, street_price,
          image_url, description, short_description, variant,
          flavor_notes, strength_level, weight_per_unit,
          units_per_box, pack_size, packs_per_box, track_by, barcode,
          is_active, status,
          brand:brands(name, color)
        `)
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('name');

      if (filters?.brandId && filters.brandId !== 'all') {
        query = query.eq('brand_id', filters.brandId);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch store assignments for all products
      const productIds = (data || []).map(p => p.id);
      let storeMap: Record<string, { store_id: string; store_name: string }[]> = {};

      if (productIds.length > 0) {
        const { data: assignments } = await supabase
          .from('product_store_assignments' as any)
          .select('product_id, store_id')
          .in('product_id', productIds)
          .eq('is_active', true);

        if (assignments && assignments.length > 0) {
          const storeIds = [...new Set((assignments as any[]).map(a => a.store_id))];
          const { data: stores } = await supabase
            .from('store_master')
            .select('id, store_name')
            .in('id', storeIds);

          const storeNameMap: Record<string, string> = {};
          (stores || []).forEach(s => { storeNameMap[s.id] = s.store_name; });

          (assignments as any[]).forEach(a => {
            if (!storeMap[a.product_id]) storeMap[a.product_id] = [];
            storeMap[a.product_id].push({
              store_id: a.store_id,
              store_name: storeNameMap[a.store_id] || 'Unknown Store',
            });
          });
        }
      }

      return (data || []).map(p => ({
        ...p,
        assigned_stores: storeMap[p.id] || [],
      })) as StoreProduct[];
    },
  });
}

function useStoreBrands() {
  return useQuery({
    queryKey: ['store-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, color')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

const formatCurrency = (amount: number | null) => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

function ProductPreviewModal({ product, open, onClose }: { product: StoreProduct | null; open: boolean; onClose: () => void }) {
  const { addToCart, isAddingToCart } = useCart();
  const [qty, setQty] = useState(1);

  if (!product) return null;

  const handleAdd = async () => {
    await addToCart({ productId: product.id, qty, tier: 'store' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{product.name}</DialogTitle>
          <DialogDescription>
            {product.brand?.name && <span className="font-medium">{product.brand.name}</span>}
            {product.sku && <span className="ml-2 text-xs">SKU: {product.sku}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {/* Image / Placeholder */}
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="h-24 w-24 text-muted-foreground/20" />
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            {/* Brand badge */}
            {product.brand && (
              <Badge
                variant="secondary"
                className="text-sm"
                style={{ backgroundColor: product.brand.color || undefined }}
              >
                {product.brand.name}
              </Badge>
            )}

            {/* Description */}
            {(product.description || product.short_description) && (
              <p className="text-sm text-muted-foreground">
                {product.description || product.short_description}
              </p>
            )}

            {/* Pricing table */}
            <div className="space-y-1 bg-muted/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pricing</h4>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <span className="text-muted-foreground">Wholesale</span>
                <span className="font-semibold text-primary">{formatCurrency(product.wholesale_price)}</span>
                <span className="text-muted-foreground">Retail</span>
                <span>{formatCurrency(product.suggested_retail_price)}</span>
                {product.store_price != null && (
                  <>
                    <span className="text-muted-foreground">Store</span>
                    <span>{formatCurrency(product.store_price)}</span>
                  </>
                )}
                {product.street_price != null && (
                  <>
                    <span className="text-muted-foreground">Street</span>
                    <span>{formatCurrency(product.street_price)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Product specs */}
            <div className="space-y-2 text-sm">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Specs</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {product.category && (
                  <>
                    <span className="text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Category</span>
                    <span className="capitalize">{product.category}</span>
                  </>
                )}
                {product.unit_type && (
                  <>
                    <span className="text-muted-foreground flex items-center gap-1"><Box className="h-3 w-3" /> Unit</span>
                    <span className="capitalize">{product.unit_type}</span>
                  </>
                )}
                {product.units_per_box != null && (
                  <>
                    <span className="text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" /> Units/Box</span>
                    <span>{product.units_per_box}</span>
                  </>
                )}
                {product.pack_size != null && product.pack_size > 1 && (
                  <>
                    <span className="text-muted-foreground">Pack Size</span>
                    <span>{product.pack_size}</span>
                  </>
                )}
                {product.packs_per_box != null && (
                  <>
                    <span className="text-muted-foreground">Packs/Box</span>
                    <span>{product.packs_per_box}</span>
                  </>
                )}
                {product.weight_per_unit != null && (
                  <>
                    <span className="text-muted-foreground flex items-center gap-1"><Weight className="h-3 w-3" /> Weight</span>
                    <span>{product.weight_per_unit}oz</span>
                  </>
                )}
                {product.track_by && (
                  <>
                    <span className="text-muted-foreground">Track By</span>
                    <span className="capitalize">{product.track_by}</span>
                  </>
                )}
                {product.variant && (
                  <>
                    <span className="text-muted-foreground">Variant</span>
                    <span>{product.variant}</span>
                  </>
                )}
                {product.flavor_notes && (
                  <>
                    <span className="text-muted-foreground">Flavor</span>
                    <span>{product.flavor_notes}</span>
                  </>
                )}
                {product.strength_level && (
                  <>
                    <span className="text-muted-foreground">Strength</span>
                    <span className="capitalize">{product.strength_level}</span>
                  </>
                )}
                {product.barcode && (
                  <>
                    <span className="text-muted-foreground">Barcode</span>
                    <span className="font-mono text-xs">{product.barcode}</span>
                  </>
                )}
              </div>
            </div>

            {/* Assigned stores */}
            {product.assigned_stores && product.assigned_stores.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Store className="h-3 w-3" /> Available at Stores
                </h4>
                <div className="flex flex-wrap gap-1">
                  {product.assigned_stores.map(s => (
                    <Badge key={s.store_id} variant="outline" className="text-xs">
                      {s.store_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Add to cart */}
            <div className="flex gap-2 pt-2">
              <Input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <Button className="flex-1 gap-2" onClick={handleAdd} disabled={isAddingToCart}>
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function StoreProducts() {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [previewProduct, setPreviewProduct] = useState<StoreProduct | null>(null);

  const { data: products, isLoading } = useStoreProducts({
    search,
    brandId: brandFilter,
  });
  const { data: brands } = useStoreBrands();
  const { addToCart, isAddingToCart } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleAddToCart = async (productId: string) => {
    const qty = quantities[productId] || 1;
    try {
      await addToCart({ productId, qty, tier: 'store' });
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Product Catalog</h1>
            <p className="text-muted-foreground">
              Browse wholesale products · {products?.length ?? 0} products available
            </p>
          </div>
          <Link to="/portal/store/cart">
            <Button variant="outline" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              View Cart
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands?.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading products...</div>
        ) : products?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No products found. Try adjusting your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products?.map((product) => {
              const storePrice = product.wholesale_price || 0;
              const retailPrice = product.suggested_retail_price || 0;
              const savings = retailPrice > storePrice ? ((retailPrice - storePrice) / retailPrice * 100).toFixed(0) : 0;

              return (
                <Card
                  key={product.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => setPreviewProduct(product)}
                >
                  <div className="aspect-square bg-muted relative">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    {Number(savings) > 0 && (
                      <Badge className="absolute top-2 right-2 bg-green-500">
                        Save {savings}%
                      </Badge>
                    )}
                    {product.brand && (
                      <Badge
                        variant="secondary"
                        className="absolute top-2 left-2"
                        style={{ backgroundColor: product.brand.color || undefined }}
                      >
                        {product.brand.name}
                      </Badge>
                    )}
                    {/* Preview overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="bg-background/90 rounded-full p-2">
                        <Eye className="h-5 w-5 text-foreground" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold line-clamp-2">{product.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">
                        {product.brand?.name ? `${product.brand.name} · ` : ''}{product.category} · {product.unit_type}
                      </p>
                      {product.sku && (
                        <p className="text-[10px] text-muted-foreground/70 font-mono">SKU: {product.sku}</p>
                      )}
                    </div>

                    {/* Store badges */}
                    {product.assigned_stores && product.assigned_stores.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.assigned_stores.slice(0, 2).map(s => (
                          <Badge key={s.store_id} variant="outline" className="text-[10px] py-0 px-1.5">
                            <Store className="h-2.5 w-2.5 mr-0.5" />{s.store_name}
                          </Badge>
                        ))}
                        {product.assigned_stores.length > 2 && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            +{product.assigned_stores.length - 2} more
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(storePrice)}
                      </span>
                      {retailPrice > storePrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatCurrency(retailPrice)}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number"
                        min="1"
                        value={quantities[product.id] || 1}
                        onChange={(e) => setQuantities(prev => ({
                          ...prev,
                          [product.id]: parseInt(e.target.value) || 1
                        }))}
                        className="w-20"
                      />
                      <Button
                        className="flex-1 gap-2"
                        size="sm"
                        onClick={() => handleAddToCart(product.id)}
                        disabled={isAddingToCart}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Preview Modal */}
      <ProductPreviewModal
        product={previewProduct}
        open={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
      />
    </div>
  );
}
