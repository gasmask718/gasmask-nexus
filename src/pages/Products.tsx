import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, DollarSign, TrendingUp, RefreshCw, AlertCircle, Plus, Edit } from 'lucide-react';
import { ProductFormSheet } from '@/components/products/ProductFormSheet';

interface Product {
  id: string;
  name: string;
  type: string;
  unit_type: string;
  sku: string | null;
  category: string | null;
  wholesale_price: number;
  suggested_retail_price: number;
  is_active: boolean;
  status: string | null;
  brand: {
    name: string;
    color: string;
  } | null;
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useState(0);

  const fetchProducts = useCallback(async (isRetry = false) => {
    if (!isRetry) setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          type,
          unit_type,
          sku,
          category,
          wholesale_price,
          suggested_retail_price,
          is_active,
          status,
          brand:brands(name, color)
        `)
        .order('name');

      if (fetchError) {
        console.error('Error fetching products:', fetchError);
        setError(fetchError.message);
        if (retryCount < 1) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => fetchProducts(true), 1000);
          return;
        }
      } else {
        setProducts(data as any || []);
        setRetryCount(0);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreate = () => {
    setEditProductId(undefined);
    setSheetOpen(true);
  };

  const handleOpenEdit = (productId: string) => {
    setEditProductId(productId);
    setSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setSheetOpen(false);
    setEditProductId(undefined);
  };

  const handleSuccess = () => {
    fetchProducts();
  };

  const getStatusBadge = (product: Product) => {
    const status = product.status || (product.is_active ? 'active' : 'inactive');
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      paused: 'secondary',
      discontinued: 'destructive',
      inactive: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'secondary'} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            Manage your product catalog across all brands
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Product
        </Button>
      </div>

      {/* Error state with retry */}
      {error && !loading && (
        <Card className="glass-card border-destructive/50">
          <CardContent className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium mb-2">Failed to load products</p>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <Button onClick={() => fetchProducts()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground mt-4">Loading products...</p>
        </div>
      ) : !error && products.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <Card
              key={product.id}
              className="glass-card border-border/50 hover-lift hover-glow cursor-pointer group"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleOpenEdit(product.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    {product.brand && (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: product.brand.color || '#666' }}
                        />
                        <span className="text-sm font-medium text-muted-foreground">
                          {product.brand.name}
                        </span>
                      </div>
                    )}
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    {product.sku && (
                      <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(product)}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(product.id);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {product.type} • {product.unit_type}
                    {product.category && ` • ${product.category}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      <span>Wholesale</span>
                    </div>
                    <p className="text-lg font-bold">
                      ${product.wholesale_price?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span>Retail</span>
                    </div>
                    <p className="text-lg font-bold">
                      ${product.suggested_retail_price?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !error && (
        <Card className="glass-card border-border/50">
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No products found</p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Click "Create Product" to add your first product.
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Product
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Product Form Sheet */}
      <ProductFormSheet
        open={sheetOpen}
        onClose={handleCloseSheet}
        productId={editProductId}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default Products;
