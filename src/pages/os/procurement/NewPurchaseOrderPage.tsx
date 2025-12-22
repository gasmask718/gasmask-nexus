// ═══════════════════════════════════════════════════════════════════════════════
// NEW PURCHASE ORDER PAGE
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Brain, Send } from 'lucide-react';
import {
  useSuppliers,
  useProducts,
  useCreatePurchaseOrder,
  POProduct,
} from '@/services/procurement';

export default function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const { data: suppliers } = useSuppliers();
  const createPO = useCreatePurchaseOrder();

  const [supplierId, setSupplierId] = useState<string>('');
  const [products, setProducts] = useState<POProduct[]>([]);
  const [shippingCost, setShippingCost] = useState(0);
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [notes, setNotes] = useState('');

  const { data: availableProducts } = useProducts();

  const totalCost = products.reduce((sum, p) => sum + p.qty * p.unit_cost, 0);
  const grandTotal = totalCost + shippingCost;

  const addProduct = () => {
    setProducts([...products, { product_id: '', name: '', qty: 1, unit_cost: 0 }]);
  };

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, updates: Partial<POProduct>) => {
    const updated = [...products];
    updated[index] = { ...updated[index], ...updates };
    setProducts(updated);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = availableProducts?.find(p => p.id === productId);
    if (product) {
      updateProduct(index, {
        product_id: productId,
        name: product.name,
        unit_cost: product.cost || product.wholesale_price || 0,
      });
    }
  };

  const handleSubmit = async (status: 'draft' | 'placed') => {
    try {
      await createPO.mutateAsync({
        supplier_id: supplierId,
        products: products as any,
        total_cost: totalCost,
        shipping_cost: shippingCost,
        status,
        estimated_arrival: estimatedArrival || null,
        warehouse_location: warehouseLocation || null,
        notes: notes || null,
      });
      navigate('/os/procurement/purchase-orders');
    } catch (error) {
      // Error handled by hook
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/os/procurement/purchase-orders">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Purchase Order</h1>
          <p className="text-muted-foreground">Create a new order from a supplier</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Supplier</CardTitle>
              <CardDescription>Select the supplier for this order</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.country || 'Unknown'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Products</CardTitle>
                <CardDescription>Add products to this order</CardDescription>
              </div>
              <Button onClick={addProduct} disabled={!supplierId}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {supplierId
                    ? 'Click "Add Product" to start building your order'
                    : 'Select a supplier first'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={product.product_id}
                            onValueChange={(v) => handleProductSelect(index, v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableProducts?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} {p.sku ? `(${p.sku})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={product.qty || ''}
                            onChange={(e) =>
                              updateProduct(index, { qty: parseInt(e.target.value) || 0 })
                            }
                            onBlur={(e) => {
                              if (!e.target.value || parseInt(e.target.value) < 1) {
                                updateProduct(index, { qty: 1 });
                              }
                            }}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={product.unit_cost || ''}
                            onChange={(e) =>
                              updateProduct(index, { unit_cost: parseFloat(e.target.value) || 0 })
                            }
                            onBlur={(e) => {
                              if (!e.target.value) {
                                updateProduct(index, { unit_cost: 0 });
                              }
                            }}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(product.qty * product.unit_cost)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProduct(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Shipping Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={shippingCost || ''}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    onBlur={(e) => {
                      if (!e.target.value) {
                        setShippingCost(0);
                      }
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Arrival</Label>
                  <Input
                    type="date"
                    value={estimatedArrival}
                    onChange={(e) => setEstimatedArrival(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Warehouse Location</Label>
                <Input
                  value={warehouseLocation}
                  onChange={(e) => setWarehouseLocation(e.target.value)}
                  placeholder="Main warehouse, Aisle 5"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions, packaging requirements, etc."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Products ({products.length})</span>
                  <span>{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatCurrency(shippingCost)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSubmit('draft')}
                  disabled={!supplierId || products.length === 0 || createPO.isPending}
                >
                  Save as Draft
                </Button>
                <Button
                  className="w-full"
                  onClick={() => handleSubmit('placed')}
                  disabled={!supplierId || products.length === 0 || createPO.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {createPO.isPending ? 'Creating...' : 'Submit PO'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Assist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm">
                Optimize quantities
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                Negotiate pricing
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                Compare suppliers
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
