import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Package, DollarSign, RotateCcw, Zap, TrendingDown, 
  TrendingUp, AlertTriangle, ArrowRight
} from 'lucide-react';
import type { WholesalerProductPerformance } from '@/hooks/useWholesalerIntelligence';

interface ProductDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'units' | 'revenue' | 'returns' | 'product';
  products: WholesalerProductPerformance[];
  selectedProduct?: WholesalerProductPerformance | null;
  onAdjustPricing?: (productId: string) => void;
  onViewProduct?: (product: WholesalerProductPerformance) => void;
}

export function ProductDetailDrawer({
  open,
  onOpenChange,
  type,
  products,
  selectedProduct,
  onAdjustPricing,
  onViewProduct,
}: ProductDetailDrawerProps) {
  const totalUnits = products.reduce((sum, p) => sum + p.units_sold, 0);
  const totalRevenue = products.reduce((sum, p) => sum + Number(p.revenue), 0);
  const avgReturnRate = products.length > 0 
    ? products.reduce((sum, p) => sum + Number(p.return_rate), 0) / products.length 
    : 0;

  const getVelocityColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getTitle = () => {
    switch (type) {
      case 'units': return 'Units Sold';
      case 'revenue': return 'Product Revenue';
      case 'returns': return 'Return Analysis';
      case 'product': return selectedProduct?.product_name || selectedProduct?.sku || 'Product Details';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'units': return Package;
      case 'revenue': return DollarSign;
      case 'returns': return RotateCcw;
      case 'product': return Package;
    }
  };

  const Icon = getIcon();

  const problemProducts = products.filter(p => 
    Number(p.return_rate) > 10 || 
    Number(p.price_erosion_percent) > 5 ||
    Number(p.substitution_rate) > 20
  );

  const renderContent = () => {
    switch (type) {
      case 'units':
        const sortedByUnits = [...products].sort((a, b) => b.units_sold - a.units_sold);
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{totalUnits.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Units Sold</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Products by Volume
              </p>
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-2">
                  {sortedByUnits.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => onViewProduct?.(product)}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {product.product_name || product.sku || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress 
                            value={(product.units_sold / sortedByUnits[0].units_sold) * 100} 
                            className="h-1 w-24" 
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                          {product.units_sold.toLocaleString()}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        );

      case 'revenue':
        const sortedByRevenue = [...products].sort((a, b) => Number(b.revenue) - Number(a.revenue));
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">${totalRevenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Revenue</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <p className="text-xl font-bold">
                  ${(totalRevenue / products.length).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Avg per Product</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <p className="text-xl font-bold">
                  ${(totalRevenue / totalUnits).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Avg per Unit</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Top Revenue Generators
              </p>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {sortedByRevenue.slice(0, 10).map((product, i) => (
                    <div
                      key={product.id}
                      onClick={() => onViewProduct?.(product)}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {product.product_name || product.sku || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.units_sold.toLocaleString()} units
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-400">
                          ${Number(product.revenue).toLocaleString()}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        );

      case 'returns':
        const sortedByReturns = [...products].sort((a, b) => Number(b.return_rate) - Number(a.return_rate));
        const highReturnProducts = sortedByReturns.filter(p => Number(p.return_rate) > 10);
        
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{avgReturnRate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground mt-1">Average Return Rate</p>
                {avgReturnRate > 10 && (
                  <p className="text-xs text-amber-400 mt-2">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Above acceptable threshold
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-xl font-bold">
                  {products.filter(p => Number(p.return_rate) <= 5).length}
                </p>
                <p className="text-xs text-green-400">Low Return (&lt;5%)</p>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xl font-bold">{highReturnProducts.length}</p>
                <p className="text-xs text-red-400">High Return (&gt;10%)</p>
              </div>
            </div>

            {highReturnProducts.length > 0 && (
              <div className="mt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                  Products with High Returns
                </p>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {highReturnProducts.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => onViewProduct?.(product)}
                        className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 cursor-pointer transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {product.product_name || product.sku || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.units_sold.toLocaleString()} units sold
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-500/20 text-red-400">
                            {Number(product.return_rate).toFixed(1)}%
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </>
        );

      case 'product':
        if (!selectedProduct) return null;
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="text-center">
                <p className="text-xl font-bold">
                  {selectedProduct.product_name || selectedProduct.sku || 'Unknown'}
                </p>
                {selectedProduct.sku && selectedProduct.product_name && (
                  <p className="text-sm text-muted-foreground mt-1">SKU: {selectedProduct.sku}</p>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <Package className="h-5 w-5 mx-auto text-indigo-400 mb-2" />
                <p className="text-2xl font-bold">{selectedProduct.units_sold.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Units Sold</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <DollarSign className="h-5 w-5 mx-auto text-green-400 mb-2" />
                <p className="text-2xl font-bold">${Number(selectedProduct.revenue).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm">Velocity Score</span>
                <div className="flex items-center gap-2">
                  <Zap className={`h-4 w-4 ${getVelocityColor(selectedProduct.velocity_score)}`} />
                  <span className={`font-bold ${getVelocityColor(selectedProduct.velocity_score)}`}>
                    {selectedProduct.velocity_score}
                  </span>
                </div>
              </div>
              <Progress value={selectedProduct.velocity_score} className="h-2" />
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-amber-400" />
                  <span className="text-sm">Return Rate</span>
                </div>
                <Badge className={Number(selectedProduct.return_rate) > 10 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>
                  {Number(selectedProduct.return_rate).toFixed(1)}%
                </Badge>
              </div>
              {Number(selectedProduct.price_erosion_percent) > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-amber-400" />
                    <span className="text-sm">Price Erosion</span>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-400">
                    {Number(selectedProduct.price_erosion_percent).toFixed(1)}%
                  </Badge>
                </div>
              )}
              {Number(selectedProduct.substitution_rate) > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-400" />
                    <span className="text-sm">Substitution Rate</span>
                  </div>
                  <Badge className="bg-orange-500/20 text-orange-400">
                    {Number(selectedProduct.substitution_rate).toFixed(0)}%
                  </Badge>
                </div>
              )}
            </div>

            {onAdjustPricing && (
              <Button 
                className="w-full mt-6" 
                onClick={() => onAdjustPricing(selectedProduct.id)}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Adjust Pricing
              </Button>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-muted/50">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <SheetTitle className="text-xl">{getTitle()}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Product performance analysis
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
