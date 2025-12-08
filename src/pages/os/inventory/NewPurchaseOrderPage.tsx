// ═══════════════════════════════════════════════════════════════════════════════
// NEW PURCHASE ORDER PAGE — Create a new purchase order
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText,
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface LineItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export default function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState({
    supplier_id: '',
    target_warehouse_id: '',
    estimated_arrival: '',
    notes: '',
    shipping_cost: '',
  });
  
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
    product_id: '',
    quantity: '',
    unit_cost: '',
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-for-po-form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch warehouses
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-for-po-form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products-for-po-form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, cost')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
  const shippingCost = form.shipping_cost ? parseFloat(form.shipping_cost) : 0;
  const totalCost = subtotal + shippingCost;

  // Add line item
  const handleAddItem = () => {
    const product = products?.find((p) => p.id === itemForm.product_id);
    if (!product || !itemForm.quantity || !itemForm.unit_cost) {
      toast.error('Please fill all item fields');
      return;
    }

    const quantity = parseInt(itemForm.quantity);
    const unitCost = parseFloat(itemForm.unit_cost);

    setLineItems([
      ...lineItems,
      {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku || '',
        quantity,
        unit_cost: unitCost,
        line_total: quantity * unitCost,
      },
    ]);

    setItemForm({ product_id: '', quantity: '', unit_cost: '' });
    setAddItemModalOpen(false);
  };

  // Remove line item
  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Create PO mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();

      // Create products JSON for legacy field
      const productsJson = lineItems.map((item) => ({
        product_id: item.product_id,
        name: item.product_name,
        qty: item.quantity,
        unit_cost: item.unit_cost,
      }));

      // Create purchase order
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: form.supplier_id,
          target_warehouse_id: form.target_warehouse_id || null,
          warehouse_location: form.target_warehouse_id 
            ? warehouses?.find((w) => w.id === form.target_warehouse_id)?.name 
            : null,
          estimated_arrival: form.estimated_arrival || null,
          notes: form.notes || null,
          shipping_cost: shippingCost,
          total_cost: totalCost,
          products: productsJson as unknown as Json,
          status: 'draft',
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create PO items
      if (lineItems.length > 0) {
        const itemsToInsert = lineItems.map((item) => ({
          purchase_order_id: po.id,
          product_id: item.product_id,
          quantity_ordered: item.quantity,
          quantity_received: 0,
          unit_cost: item.unit_cost,
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return po;
    },
    onSuccess: (po) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order created');
      navigate(`/os/inventory/purchase-orders/${po.id}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create PO: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id) {
      toast.error('Please select a supplier');
      return;
    }
    if (lineItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }
    createMutation.mutate();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/os/inventory/purchase-orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              New Purchase Order
            </h1>
            <p className="text-muted-foreground mt-1">
              Create a new purchase order from a supplier.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PO Header */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
              <CardDescription>Basic information about this purchase order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <Select
                    value={form.supplier_id}
                    onValueChange={(v) => setForm({ ...form, supplier_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Warehouse</Label>
                  <Select
                    value={form.target_warehouse_id}
                    onValueChange={(v) => setForm({ ...form, target_warehouse_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expected Arrival Date</Label>
                  <Input
                    type="date"
                    value={form.estimated_arrival}
                    onChange={(e) => setForm({ ...form, estimated_arrival: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shipping Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.shipping_cost}
                    onChange={(e) => setForm({ ...form, shipping_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Line Items</CardTitle>
                <CardDescription>Products included in this order</CardDescription>
              </div>
              <Button type="button" size="sm" onClick={() => setAddItemModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No items added yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => setAddItemModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Item
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="font-mono text-sm">{item.sku || '-'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.unit_cost)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(item.line_total)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals */}
                  <div className="mt-6 space-y-2 border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-mono">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-mono">{formatCurrency(shippingCost)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold border-t pt-2">
                      <span>Total</span>
                      <span className="font-mono">{formatCurrency(totalCost)}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link to="/os/inventory/purchase-orders">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Purchase Order'
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Add Item Modal */}
      <Dialog open={addItemModalOpen} onOpenChange={setAddItemModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={itemForm.product_id}
                onValueChange={(v) => {
                  const product = products?.find((p) => p.id === v);
                  setItemForm({
                    ...itemForm,
                    product_id: v,
                    unit_cost: product?.cost?.toString() || '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemForm.unit_cost}
                  onChange={(e) => setItemForm({ ...itemForm, unit_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
