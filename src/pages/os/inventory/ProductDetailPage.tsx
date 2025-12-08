// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT DETAIL PAGE — Full Product View with Tabs
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Package,
  Edit,
  DollarSign,
  Barcode,
  Star,
  TrendingDown,
  Warehouse,
  Truck,
  Activity,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useProduct } from '@/services/inventory';
import ProductFormModal from '@/components/inventory/ProductFormModal';

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const { data: product, isLoading, error } = useProduct(productId || '');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Product Not Found</h2>
          <p className="text-muted-foreground mb-4">The product you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/os/inventory/products">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/os/inventory/products">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <Package className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{product.name}</h1>
                {product.variant && (
                  <Badge variant="outline">{product.variant}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {product.brand && (
                  <Badge className="text-xs">{product.brand.name}</Badge>
                )}
                <span className="flex items-center gap-1">
                  <Barcode className="h-3 w-3" />
                  {product.sku || 'No SKU'}
                </span>
                <Badge variant={product.is_active ? 'default' : 'secondary'}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <Button onClick={() => setIsEditModalOpen(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Product
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Product Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">SKU</p>
                    <p className="font-mono font-medium">{product.sku || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Barcode</p>
                    <p className="font-mono font-medium">{product.barcode || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{product.type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{product.category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Unit Type</p>
                    <p className="font-medium capitalize">{product.unit_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Case Size</p>
                    <p className="font-medium">{product.case_size || 1} units</p>
                  </div>
                </div>
                {product.description && (
                  <div className="pt-4 border-t">
                    <p className="text-muted-foreground text-sm">Description</p>
                    <p className="text-sm mt-1">{product.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-mono font-semibold">{formatCurrency(product.cost)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Wholesale</span>
                    <span className="font-mono font-semibold text-primary">{formatCurrency(product.wholesale_price)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Retail</span>
                    <span className="font-mono font-semibold">{formatCurrency(product.suggested_retail_price)}</span>
                  </div>
                </div>
                {product.cost && product.wholesale_price && (
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Margin</span>
                      <span className="font-semibold text-green-500">
                        {(((product.wholesale_price - product.cost) / product.cost) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inventory Rules Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  Inventory Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Reorder Point</p>
                    <p className="font-semibold">{product.reorder_point || 0} units</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reorder Qty</p>
                    <p className="font-semibold">{product.reorder_qty || 0} units</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Safety Stock</p>
                    <p className="font-semibold">{product.safety_stock || 0} units</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">MOQ (Supplier)</p>
                    <p className="font-semibold">{product.moq || 1} units</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Scores Card */}
          {(product.hero_score || product.ghost_score) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Scores</CardTitle>
                <CardDescription>AI-generated product performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-8">
                  {product.hero_score && (
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-amber-500/10">
                        <Star className="h-6 w-6 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Hero Score</p>
                        <p className="text-2xl font-bold text-amber-500">
                          {product.hero_score.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  )}
                  {product.ghost_score && (
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-muted">
                        <TrendingDown className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Ghost Score</p>
                        <p className="text-2xl font-bold text-muted-foreground">
                          {product.ghost_score.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Inventory Tab (Placeholder) */}
        <TabsContent value="inventory" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                Warehouse Stock Levels
              </CardTitle>
              <CardDescription>
                View stock levels across all warehouses
              </CardDescription>
            </CardHeader>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Warehouse className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Coming in Inventory V2</p>
                <p className="text-sm">
                  Warehouse stock levels and bin locations will appear here once the Warehouse module is active.
                </p>
              </div>
            </CardContent>
          </Card>
          {/* TODO (Inventory V2):
            - fetchInventoryLevelsByProduct(productId)
            - show warehouse-level stock breakdown
            - show bin locations
            - show quantity on hand, reserved, in transit
          */}
        </TabsContent>

        {/* Suppliers Tab (Placeholder) */}
        <TabsContent value="suppliers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Linked Suppliers
              </CardTitle>
              <CardDescription>
                View which suppliers provide this product
              </CardDescription>
            </CardHeader>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Coming in Supplier V2</p>
                <p className="text-sm">
                  Linked suppliers and their pricing will appear here once the Suppliers module is active.
                </p>
              </div>
            </CardContent>
          </Card>
          {/* TODO (Suppliers V2):
            - fetchLinkedSuppliers(productId)
            - show supplier name, cost, lead time, MOQ
            - show PO history for this product
          */}
        </TabsContent>

        {/* Activity Tab (Placeholder) */}
        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Product Activity
              </CardTitle>
              <CardDescription>
                Recent transactions and changes for this product
              </CardDescription>
            </CardHeader>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Activity Tracking Coming Soon</p>
                <p className="text-sm">
                  Order history, stock movements, and audit logs will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <ProductFormModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        productId={productId}
      />
    </div>
  );
}
