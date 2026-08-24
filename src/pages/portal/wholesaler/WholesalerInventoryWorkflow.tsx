import { Link } from "react-router-dom";
import { useWholesalerProducts } from "@/services/wholesaler/useWholesalerProducts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HudCard } from "@/components/portal/HudCard";
import { HudMetric } from "@/components/portal/HudMetric";
import { ArrowLeft, Package, AlertTriangle, TrendingDown, Box, Plus } from "lucide-react";

export default function WholesalerInventoryWorkflow() {
  const { products, lowStockProducts, isLoading } = useWholesalerProducts();

  const totalUnits = products.reduce((sum, p) => sum + (p.inventory_qty || 0), 0);
  const outOfStock = products.filter((p) => (p.inventory_qty || 0) === 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/portal/wholesaler">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Inventory Workflow</h1>
          <p className="text-muted-foreground">{products.length} products tracked</p>
        </div>
        <Button asChild>
          <Link to="/portal/wholesaler/products/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Link>
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <HudCard variant="cyan">
          <HudMetric
            label="Total Products"
            value={products.length}
            icon={<Package className="h-4 w-4" />}
            variant="cyan"
          />
        </HudCard>
        <HudCard variant="green">
          <HudMetric
            label="Total Units"
            value={totalUnits.toLocaleString()}
            icon={<Box className="h-4 w-4" />}
            variant="green"
          />
        </HudCard>
        <HudCard variant="amber" glow={lowStockProducts.length > 0}>
          <HudMetric
            label="Low Stock"
            value={lowStockProducts.length}
            icon={<AlertTriangle className="h-4 w-4" />}
            variant="amber"
          />
        </HudCard>
        <HudCard variant="red" glow={outOfStock.length > 0}>
          <HudMetric
            label="Out of Stock"
            value={outOfStock.length}
            icon={<TrendingDown className="h-4 w-4" />}
            variant="red"
          />
        </HudCard>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-600 flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Restock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{product.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.unit_type || "unit"} · Qty: {product.inventory_qty ?? 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive" className="text-xs">
                      {product.inventory_qty} remaining
                    </Badge>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/portal/wholesaler/products/${product.id}/edit`}>
                        Restock
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Inventory Grid */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-4">Add products to start tracking inventory</p>
            <Button asChild>
              <Link to="/portal/wholesaler/products/new">Add Product</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium">Product</th>
                    <th className="text-left p-3 text-sm font-medium">Type</th>
                    <th className="text-right p-3 text-sm font-medium">Qty On Hand</th>
                    <th className="text-right p-3 text-sm font-medium">Price</th>
                    <th className="text-center p-3 text-sm font-medium">Status</th>
                    <th className="text-right p-3 text-sm font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const qty = product.inventory_qty || 0;
                    const isLow = qty > 0 && qty <= 10;
                    const isOut = qty === 0;

                    return (
                      <tr key={product.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <Link
                            to={`/portal/wholesaler/products/${product.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {product.product_name}
                          </Link>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground font-mono">
                          {product.unit_type || "—"}
                        </td>
                        <td className="p-3 text-sm text-right font-medium">
                          {qty.toLocaleString()}
                        </td>
                        <td className="p-3 text-sm text-right">
                          ${((product as any).supplier_cost || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          {isOut ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : isLow ? (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-500/30">
                              In Stock
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-sm text-right text-muted-foreground">
                          {product.created_at
                            ? new Date(product.created_at).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
