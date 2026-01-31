import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ShoppingCart, Package, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceModeSelector, InvoiceMode } from '@/components/invoice/InvoiceModeSelector';

export interface OrderLineItem {
  id: string;
  product_id: string;
  product_name: string;
  brand_id: string | null;
  brand_name: string;
  quantity: number;
  unit_type: string;
  unit_price: number;
  total: number;
}

export interface FieldOrder {
  brand_id: string;
  brand_name: string;
  line_items: OrderLineItem[];
  subtotal: number;
  notes: string;
  is_historical: boolean;
}

interface CreateOrderSectionProps {
  orders: FieldOrder[];
  onOrdersChange: (orders: FieldOrder[]) => void;
  invoiceMode: InvoiceMode;
  onInvoiceModeChange: (mode: InvoiceMode) => void;
}

export function CreateOrderSection({ 
  orders, 
  onOrdersChange, 
  invoiceMode, 
  onInvoiceModeChange 
}: CreateOrderSectionProps) {
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  // Fetch brands
  const { data: brands = [] } = useQuery({
    queryKey: ['field-order-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch products for selected brand
  const { data: products = [] } = useQuery({
    queryKey: ['field-order-products', selectedBrand],
    queryFn: async () => {
      if (!selectedBrand) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, brand_id, store_price, unit_type')
        .eq('brand_id', selectedBrand)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBrand,
  });

  const selectedProductData = useMemo(() => {
    return products.find(p => p.id === selectedProduct);
  }, [products, selectedProduct]);

  const selectedBrandData = useMemo(() => {
    return brands.find(b => b.id === selectedBrand);
  }, [brands, selectedBrand]);

  const handleAddItem = () => {
    if (!selectedProduct || !selectedProductData || !selectedBrandData || quantity < 1) return;

    const unitPrice = selectedProductData.store_price || 0;
    const lineTotal = unitPrice * quantity;

    const newItem: OrderLineItem = {
      id: crypto.randomUUID(),
      product_id: selectedProductData.id,
      product_name: selectedProductData.name,
      brand_id: selectedBrand,
      brand_name: selectedBrandData.name,
      quantity,
      unit_type: selectedProductData.unit_type || 'TUBE',
      unit_price: unitPrice,
      total: lineTotal,
    };

    // Find or create order for this brand
    const existingOrderIndex = orders.findIndex(o => o.brand_id === selectedBrand);
    
    if (existingOrderIndex >= 0) {
      const updatedOrders = [...orders];
      const existingOrder = updatedOrders[existingOrderIndex];
      
      // Check if product already exists in order
      const existingItemIndex = existingOrder.line_items.findIndex(
        item => item.product_id === selectedProduct
      );
      
      if (existingItemIndex >= 0) {
        // Update quantity
        existingOrder.line_items[existingItemIndex].quantity += quantity;
        existingOrder.line_items[existingItemIndex].total = 
          existingOrder.line_items[existingItemIndex].quantity * 
          existingOrder.line_items[existingItemIndex].unit_price;
      } else {
        existingOrder.line_items.push(newItem);
      }
      
      existingOrder.subtotal = existingOrder.line_items.reduce((sum, item) => sum + item.total, 0);
      onOrdersChange(updatedOrders);
    } else {
      const newOrder: FieldOrder = {
        brand_id: selectedBrand,
        brand_name: selectedBrandData.name,
        line_items: [newItem],
        subtotal: lineTotal,
        notes: '',
        is_historical: invoiceMode === 'historical',
      };
      onOrdersChange([...orders, newOrder]);
    }

    // Reset selection
    setSelectedProduct('');
    setQuantity(1);
  };

  const handleRemoveItem = (brandId: string, itemId: string) => {
    const updatedOrders = orders.map(order => {
      if (order.brand_id !== brandId) return order;
      
      const updatedItems = order.line_items.filter(item => item.id !== itemId);
      return {
        ...order,
        line_items: updatedItems,
        subtotal: updatedItems.reduce((sum, item) => sum + item.total, 0),
      };
    }).filter(order => order.line_items.length > 0);
    
    onOrdersChange(updatedOrders);
  };

  const handleUpdateNotes = (brandId: string, newNotes: string) => {
    const updatedOrders = orders.map(order => {
      if (order.brand_id !== brandId) return order;
      return { ...order, notes: newNotes };
    });
    onOrdersChange(updatedOrders);
  };

  const totalOrderValue = orders.reduce((sum, order) => sum + order.subtotal, 0);

  return (
    <div className="space-y-4">
      {/* Invoice Mode Selector - CRITICAL for automation control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Invoice Mode
          </CardTitle>
          <CardDescription>
            Choose how this order should be processed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceModeSelector 
            mode={invoiceMode} 
            onModeChange={onInvoiceModeChange} 
          />
        </CardContent>
      </Card>

      {/* Add Products Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Create Field Order
          </CardTitle>
          <CardDescription>
            Add products to create an order based on inventory observations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select value={selectedBrand} onValueChange={(value) => {
                setSelectedBrand(value);
                setSelectedProduct('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <Select 
                value={selectedProduct} 
                onValueChange={setSelectedProduct}
                disabled={!selectedBrand}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedBrand ? "Select product" : "Select brand first"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - ${product.store_price?.toFixed(2) || '0.00'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={handleAddItem}
                disabled={!selectedProduct || quantity < 1}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>

          {selectedProductData && (
            <div className="text-sm text-muted-foreground">
              Unit: {selectedProductData.unit_type || 'TUBE'} • 
              Price: ${selectedProductData.store_price?.toFixed(2) || '0.00'} each • 
              Line Total: ${((selectedProductData.store_price || 0) * quantity).toFixed(2)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Summary by Brand */}
      {orders.length > 0 && (
        <div className="space-y-4">
          {orders.map(order => (
            <Card key={order.brand_id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {order.brand_name} Order
                  </CardTitle>
                  <Badge variant="outline">
                    ${order.subtotal.toFixed(2)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-center">Unit</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.line_items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">{item.unit_type}</TableCell>
                        <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${item.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(order.brand_id, item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="space-y-2">
                  <Label htmlFor={`notes-${order.brand_id}`}>Order Notes</Label>
                  <Textarea
                    id={`notes-${order.brand_id}`}
                    placeholder="Add notes for this order..."
                    value={order.notes}
                    onChange={(e) => handleUpdateNotes(order.brand_id, e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Total Summary */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total Order Value</span>
                <span>${totalOrderValue.toFixed(2)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {orders.length} brand order(s) • {orders.reduce((sum, o) => sum + o.line_items.length, 0)} line item(s)
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {orders.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No items added yet</p>
            <p className="text-sm">Select a brand and product above to create a field order</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
