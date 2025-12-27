import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Plus, Trash2, X } from 'lucide-react';
import { GRABBA_COMPANIES, useProductsByBrand, type ProductOption } from '@/hooks/useVisitProducts';

export interface SelectedProduct {
  id: string;
  brand_id: string;
  brand_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_type: 'standard' | 'custom';
}

interface VisitProductSelectorProps {
  selectedProducts: SelectedProduct[];
  onChange: (products: SelectedProduct[]) => void;
}

const STANDARD_QUANTITIES = [
  { value: 10, label: '10 units' },
  { value: 25, label: '25 units' },
  { value: 50, label: '50 units (½ box)' },
  { value: 100, label: '100 units (1 box)' },
  { value: 200, label: '200 units (2 boxes)' },
];

export function VisitProductSelector({ selectedProducts, onChange }: VisitProductSelectorProps) {
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [quantityType, setQuantityType] = useState<'standard' | 'custom'>('standard');
  const [quantity, setQuantity] = useState<number>(100);

  const { data: products, isLoading: productsLoading } = useProductsByBrand(selectedBrand);

  const handleAddProduct = () => {
    if (!selectedBrand || !selectedProduct || quantity <= 0) return;

    const brand = GRABBA_COMPANIES.find(b => b.id === selectedBrand);
    const product = products?.find(p => p.id === selectedProduct);

    if (!brand || !product) return;

    // Check if product already added
    const existingIndex = selectedProducts.findIndex(p => p.product_id === selectedProduct);
    if (existingIndex >= 0) {
      // Update quantity instead
      const updated = [...selectedProducts];
      updated[existingIndex].quantity += quantity;
      onChange(updated);
    } else {
      onChange([
        ...selectedProducts,
        {
          id: crypto.randomUUID(),
          brand_id: selectedBrand,
          brand_name: brand.name,
          product_id: selectedProduct,
          product_name: product.name,
          quantity,
          unit_type: quantityType,
        },
      ]);
    }

    // Reset selection
    setSelectedProduct(null);
    setQuantity(100);
    setQuantityType('standard');
  };

  const handleRemoveProduct = (id: string) => {
    onChange(selectedProducts.filter(p => p.id !== id));
  };

  const handleUpdateQuantity = (id: string, newQuantity: number) => {
    onChange(
      selectedProducts.map(p =>
        p.id === id ? { ...p, quantity: newQuantity } : p
      )
    );
  };

  const getBrandColor = (brandId: string) => {
    return GRABBA_COMPANIES.find(b => b.id === brandId)?.color || '#6366F1';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Products Given</h3>
        <Badge variant="outline" className="ml-auto">
          {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Product Selection Form */}
      <Card className="border-dashed">
        <CardContent className="pt-4 space-y-4">
          {/* Company Selector */}
          <div className="space-y-2">
            <Label>Select Company</Label>
            <Select value={selectedBrand || ''} onValueChange={(v) => {
              setSelectedBrand(v);
              setSelectedProduct(null);
            }}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue placeholder="Choose a Grabba company" />
              </SelectTrigger>
              <SelectContent>
                {GRABBA_COMPANIES.map(brand => (
                  <SelectItem key={brand.id} value={brand.id}>
                    <div className="flex items-center gap-2">
                      <span>{brand.icon}</span>
                      <span>{brand.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Selector */}
          {selectedBrand && (
            <div className="space-y-2">
              <Label>Select Product</Label>
              <Select 
                value={selectedProduct || ''} 
                onValueChange={setSelectedProduct}
                disabled={productsLoading}
              >
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue placeholder={productsLoading ? "Loading products..." : "Choose a product"} />
                </SelectTrigger>
                <SelectContent>
                  {products?.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span>{product.name}</span>
                        {product.sku && (
                          <span className="text-xs text-muted-foreground">
                            SKU: {product.sku}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {products?.length === 0 && (
                    <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                      No products found for this company
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quantity Configuration */}
          {selectedProduct && (
            <div className="space-y-3">
              <Label>Quantity</Label>
              <div className="flex gap-2">
                <Select 
                  value={quantityType} 
                  onValueChange={(v) => setQuantityType(v as 'standard' | 'custom')}
                >
                  <SelectTrigger className="w-[140px] bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>

                {quantityType === 'standard' ? (
                  <Select 
                    value={quantity.toString()} 
                    onValueChange={(v) => setQuantity(parseInt(v))}
                  >
                    <SelectTrigger className="flex-1 bg-secondary/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_QUANTITIES.map(q => (
                        <SelectItem key={q.value} value={q.value.toString()}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    placeholder="Enter quantity"
                    className="flex-1 bg-secondary/50 border-border/50"
                  />
                )}
              </div>
            </div>
          )}

          {/* Add Button */}
          {selectedProduct && (
            <Button 
              type="button"
              onClick={handleAddProduct}
              className="w-full"
              disabled={!selectedProduct || quantity <= 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Selected Products List */}
      {selectedProducts.length > 0 && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Products to deliver</Label>
          {selectedProducts.map(product => (
            <div 
              key={product.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30"
            >
              <div 
                className="h-3 w-3 rounded-full shrink-0" 
                style={{ backgroundColor: getBrandColor(product.brand_id) }} 
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{product.product_name}</p>
                <p className="text-xs text-muted-foreground">{product.brand_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={product.quantity}
                  onChange={(e) => handleUpdateQuantity(product.id, parseInt(e.target.value) || 1)}
                  className="w-20 h-8 text-sm bg-background"
                />
                <span className="text-xs text-muted-foreground">units</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveProduct(product.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {/* Summary */}
          <div className="flex justify-between items-center pt-2 text-sm">
            <span className="text-muted-foreground">Total products:</span>
            <span className="font-medium">
              {selectedProducts.reduce((sum, p) => sum + p.quantity, 0)} units
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
