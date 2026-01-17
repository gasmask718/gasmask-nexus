import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, Package, Search, Loader2, CheckCircle } from 'lucide-react';
import { GRABBA_COMPANIES, useProductsByBrand, type ProductOption } from '@/hooks/useVisitProducts';

export interface OrderLineItem {
  id: string;
  company_id: string;
  company_name: string;
  company_icon: string;
  product_id: string;
  sku: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
}

interface WholesalerProductOrderSelectorProps {
  orderItems: OrderLineItem[];
  onItemsChange: (items: OrderLineItem[]) => void;
}

export function WholesalerProductOrderSelector({
  orderItems,
  onItemsChange,
}: WholesalerProductOrderSelectorProps) {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: products = [], isLoading: productsLoading } = useProductsByBrand(selectedCompany);

  const selectedCompanyData = useMemo(
    () => GRABBA_COMPANIES.find(c => c.id === selectedCompany),
    [selectedCompany]
  );

  const selectedProductData = useMemo(
    () => products.find(p => p.id === selectedProduct),
    [products, selectedProduct]
  );

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const handleAddItem = () => {
    if (!selectedCompany || !selectedProduct || !selectedProductData) return;

    const newItem: OrderLineItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      company_id: selectedCompany,
      company_name: selectedCompanyData?.name || '',
      company_icon: selectedCompanyData?.icon || '',
      product_id: selectedProductData.id,
      sku: selectedProductData.sku || '',
      name: selectedProductData.name,
      qty: quantity,
      price: selectedProductData.wholesale_price || 0,
      subtotal: quantity * (selectedProductData.wholesale_price || 0),
    };

    onItemsChange([...orderItems, newItem]);
    setSelectedProduct(null);
    setQuantity(1);
    setSearchTerm('');
  };

  const handleRemoveItem = (id: string) => {
    onItemsChange(orderItems.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, newQty: number) => {
    onItemsChange(
      orderItems.map(item =>
        item.id === id
          ? { ...item, qty: newQty, subtotal: newQty * item.price }
          : item
      )
    );
  };

  const getCompanyBadgeStyle = (companyId: string) => {
    const company = GRABBA_COMPANIES.find(c => c.id === companyId);
    if (!company) return {};
    return {
      backgroundColor: `${company.color}20`,
      color: company.color,
      borderColor: `${company.color}40`,
    };
  };

  return (
    <div className="space-y-6">
      {/* Company Selector */}
      <div className="space-y-2">
        <Label>Select Company</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GRABBA_COMPANIES.map(company => (
            <button
              key={company.id}
              type="button"
              onClick={() => {
                setSelectedCompany(company.id);
                setSelectedProduct(null);
                setSearchTerm('');
              }}
              className={`
                flex items-center gap-2 p-3 rounded-lg border-2 transition-all
                ${selectedCompany === company.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 hover:border-border hover:bg-muted/50'
                }
              `}
            >
              <span className="text-xl">{company.icon}</span>
              <span className="text-sm font-medium">{company.name}</span>
              {selectedCompany === company.id && (
                <CheckCircle className="h-4 w-4 text-primary ml-auto" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Product Selector - Only shown when company selected */}
      {selectedCompany && (
        <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/20">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Products List */}
          {productsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProduct(product.id)}
                    className={`
                      w-full flex items-center justify-between p-3 rounded-lg transition-all text-left
                      ${selectedProduct === product.id
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-muted/50 border border-transparent'
                      }
                    `}
                  >
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {product.sku || 'N/A'} • {product.units_per_box || '-'} units/box
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">
                        ${(product.wholesale_price || 0).toFixed(2)}
                      </p>
                      {selectedProduct === product.id && (
                        <CheckCircle className="h-4 w-4 text-primary mt-1 ml-auto" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Add Item Controls */}
          {selectedProduct && selectedProductData && (
            <div className="flex items-end gap-3 pt-4 border-t border-border/50">
              <div className="flex-1">
                <Label className="text-xs">Selected</Label>
                <p className="text-sm font-medium truncate">{selectedProductData.name}</p>
              </div>
              <div className="w-24">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="w-28 text-right">
                <Label className="text-xs">Subtotal</Label>
                <p className="text-lg font-bold">
                  ${(quantity * (selectedProductData.wholesale_price || 0)).toFixed(2)}
                </p>
              </div>
              <Button onClick={handleAddItem} className="gap-1">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Current Order Items */}
      {orderItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Order Items ({orderItems.length})</Label>
            <span className="text-sm text-muted-foreground">
              Total: <span className="font-bold text-foreground">
                ${orderItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}
              </span>
            </span>
          </div>
          
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {orderItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30"
                >
                  <Badge
                    variant="outline"
                    className="shrink-0"
                    style={getCompanyBadgeStyle(item.company_id)}
                  >
                    {item.company_icon} {item.company_name}
                  </Badge>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {item.sku || 'N/A'} • ${item.price.toFixed(2)} each
                    </p>
                  </div>

                  <Input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => handleUpdateQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20"
                  />

                  <div className="w-20 text-right">
                    <p className="font-bold">${item.subtotal.toFixed(2)}</p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(item.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {orderItems.length === 0 && !selectedCompany && (
        <div className="text-center py-8 text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a company to start adding products</p>
        </div>
      )}
    </div>
  );
}
