import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Plus, X, Package, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CreateStoreInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess?: (invoiceId: string) => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'cashapp', label: 'CashApp' },
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

interface Brand {
  id: string;
  name: string;
  color: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  store_price: number | null;
  wholesale_price: number | null;
  units_per_box: number | null;
}

interface LineItem {
  id: string;
  brand_id: string;
  brand_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export function CreateStoreInvoiceModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  onSuccess,
}: CreateStoreInvoiceModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [markAsPaid, setMarkAsPaid] = useState(false);

  // Fetch all brands
  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['invoice-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, color')
        .order('name');
      if (error) throw error;
      return data as Brand[];
    },
  });

  // Fetch products by brand
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['invoice-products', selectedBrandId],
    queryFn: async () => {
      if (!selectedBrandId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, store_price, wholesale_price, units_per_box')
        .eq('brand_id', selectedBrandId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!selectedBrandId,
  });

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}-${random}`;
  };

  const handleAddProduct = () => {
    if (!selectedBrandId || !selectedProductId || quantity <= 0) {
      toast.error('Please select a brand, product, and quantity');
      return;
    }

    const brand = brands.find(b => b.id === selectedBrandId);
    const product = products.find(p => p.id === selectedProductId);

    if (!brand || !product) return;

    // Use store_price if available, otherwise wholesale_price, otherwise 0
    const unitPrice = product.store_price || product.wholesale_price || 0;

    // Check if product already added
    const existingIndex = lineItems.findIndex(item => item.product_id === selectedProductId);
    if (existingIndex >= 0) {
      // Update quantity and total
      const updated = [...lineItems];
      updated[existingIndex].quantity += quantity;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      setLineItems(updated);
    } else {
      // Add new line item
      setLineItems([
        ...lineItems,
        {
          id: crypto.randomUUID(),
          brand_id: selectedBrandId,
          brand_name: brand.name,
          product_id: selectedProductId,
          product_name: product.name,
          quantity,
          unit_price: unitPrice,
          total: quantity * unitPrice,
        },
      ]);
    }

    // Reset selection
    setSelectedProductId('');
    setQuantity(1);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) return;
    setLineItems(
      lineItems.map(item =>
        item.id === id
          ? { ...item, quantity: newQuantity, total: newQuantity * item.unit_price }
          : item
      )
    );
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    if (newPrice < 0) return;
    setLineItems(
      lineItems.map(item =>
        item.id === id
          ? { ...item, unit_price: newPrice, total: item.quantity * newPrice }
          : item
      )
    );
  };

  // Get store contacts for interaction logging
  const { data: storeContacts } = useQuery({
    queryKey: ['store-contacts-for-invoice', storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_contacts')
        .select('id')
        .eq('store_id', storeId)
        .limit(1);
      return data?.[0]?.id || null;
    },
    enabled: !!storeId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (lineItems.length === 0) {
        throw new Error('Add at least one product');
      }

      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const tax = 0; // Can be calculated if needed
      const total = subtotal + tax;

      const invoiceNumber = generateInvoiceNumber();
      const brandSummary = [...new Set(lineItems.map(i => i.brand_name))].join(', ');

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          store_id: storeId,
          invoice_number: invoiceNumber,
          subtotal,
          tax,
          total,
          total_amount: total,
          payment_method: paymentMethod || null,
          payment_status: markAsPaid ? 'paid' : 'unpaid',
          due_date: dueDate || null,
          paid_at: markAsPaid ? new Date().toISOString() : null,
          notes: notes || null,
          brand: brandSummary,
          created_by: user?.id || 'manual',
        })
        .select('id')
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice line items
      if (invoice && lineItems.length > 0) {
        const lineItemsData = lineItems.map(item => ({
          invoice_id: invoice.id,
          brand_id: item.brand_id,
          brand_name: item.brand_name,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        }));

        // Note: invoice_line_items table needs to be created via migration first
        // Type assertion needed until types are regenerated
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: lineItemsError } = await (supabase as any)
            .from('invoice_line_items')
            .insert(lineItemsData);
          
          if (lineItemsError) {
            console.error('Failed to create invoice line items:', lineItemsError);
            // Don't fail invoice creation if line items fail
          }
        } catch (err) {
          console.error('Error creating invoice line items:', err);
          // Don't fail invoice creation if line items fail
        }
      }

      // Create contact interaction for Recent Interactions
      if (storeContacts && user) {
        const { error: interactionError } = await supabase
          .from('contact_interactions')
          .insert({
            contact_id: storeContacts,
            store_id: storeId,
            channel: 'OTHER',
            direction: 'OUTBOUND',
            subject: `Invoice Created: ${invoiceNumber}`,
            summary: `Invoice created for ${storeName}. Total: $${total.toFixed(2)}. Products: ${brandSummary}`,
            outcome: 'SUCCESS',
            created_by_user_id: user.id,
          });
        
        // Don't fail invoice creation if interaction logging fails
        if (interactionError) {
          console.error('Failed to log interaction:', interactionError);
        }
      }

      return invoice;
    },
    onSuccess: (data) => {
      toast.success('Invoice created successfully');
      queryClient.invalidateQueries({ queryKey: ['store-invoices', storeId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['contact-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['store-interactions'] });
      resetForm();
      onOpenChange(false);
      onSuccess?.(data.id);
    },
    onError: (error: any) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });

  const resetForm = () => {
    setLineItems([]);
    setSelectedBrandId('');
    setSelectedProductId('');
    setQuantity(1);
    setPaymentMethod('');
    setDueDate('');
    setNotes('');
    setMarkAsPaid(false);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const tax = 0;
  const total = subtotal + tax;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Create Invoice
          </DialogTitle>
          <DialogDescription>
            Create invoice for {storeName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Selection */}
          <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-dashed">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <Label className="text-sm font-medium">Add Product</Label>
            </div>

            {/* Brand Selection */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Brand</Label>
              <Select
                value={selectedBrandId}
                onValueChange={(value) => {
                  setSelectedBrandId(value);
                  setSelectedProductId('');
                }}
                disabled={brandsLoading}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={brandsLoading ? "Loading brands..." : "Select brand"} />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: brand.color }}
                        />
                        <span>{brand.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Selection */}
            {selectedBrandId && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Product</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                  disabled={productsLoading}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={productsLoading ? "Loading products..." : "Select product"} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => {
                      const price = product.store_price || product.wholesale_price || 0;
                      return (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex items-center justify-between gap-4 w-full">
                            <span>{product.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ${price.toFixed(2)}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                    {products.length === 0 && !productsLoading && (
                      <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                        No products found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quantity */}
            {selectedProductId && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="bg-background"
                />
              </div>
            )}

            {/* Add Button */}
            {selectedProductId && (
              <Button
                type="button"
                onClick={handleAddProduct}
                className="w-full"
                disabled={!selectedProductId || quantity <= 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Invoice
              </Button>
            )}
          </div>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Invoice Items</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border"
                  >
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: brands.find(b => b.id === item.brand_id)?.color || '#6366F1' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.brand_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => handleUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                        className="w-20 h-8 text-sm font-mono"
                      />
                      <span className="text-sm font-mono font-medium w-20 text-right">
                        ${item.total.toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemoveLineItem(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          {lineItems.length > 0 && (
            <div className="space-y-2 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tax</span>
                <span className="font-mono">${tax.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-primary/20">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold font-mono">${total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          {/* Mark as Paid */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="markAsPaid"
              checked={markAsPaid}
              onCheckedChange={(checked) => setMarkAsPaid(checked === true)}
            />
            <label
              htmlFor="markAsPaid"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Mark as paid now
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
