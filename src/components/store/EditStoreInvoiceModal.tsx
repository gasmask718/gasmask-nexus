import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Plus, X, Package, Calendar, User, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DatePicker } from '@/components/ui/datetime-picker';
import { dynastyDateWithWeekday, dynastyRelative } from '@/lib/dates';
import { PhotoUploadMultiple } from './PhotoUploadMultiple';

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  subtotal: number;
  tax: number;
  payment_status: string;
  payment_method: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  brand: string | null;
  notes: string | null;
  partial_amount: number | null;
  received_by: string | null;
  delivery_photos: string[] | null;
}

interface EditStoreInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  storeId: string;
  storeName: string;
  onSuccess?: () => void;
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

export function EditStoreInvoiceModal({
  open,
  onOpenChange,
  invoice,
  storeId,
  storeName,
  onSuccess,
}: EditStoreInvoiceModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState(invoice.payment_method || '');
  const [dueDate, setDueDate] = useState<Date | undefined>(
    invoice.due_date ? new Date(invoice.due_date) : undefined
  );
  const [notes, setNotes] = useState(invoice.notes || '');
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>(
    invoice.payment_status as 'unpaid' | 'partial' | 'paid'
  );
  const [partialAmount, setPartialAmount] = useState(
    invoice.partial_amount?.toString() || ''
  );
  const [receivedByName, setReceivedByName] = useState(invoice.received_by || '');
  const [photos, setPhotos] = useState<string[]>(invoice.delivery_photos || []);

  // Fetch existing line items
  const { data: existingLineItems = [] } = useQuery({
    queryKey: ['invoice-line-items', invoice.id],
    queryFn: async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', invoice.id);
        if (error) throw error;
        return data || [];
      } catch {
        return [];
      }
    },
    enabled: open && !!invoice.id,
  });

  // Load line items when modal opens
  useEffect(() => {
    if (existingLineItems.length > 0) {
      setLineItems(
        existingLineItems.map((item: any) => ({
          id: item.id,
          brand_id: item.brand_id,
          brand_name: item.brand_name,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        }))
      );
    }
  }, [existingLineItems]);

  // Fetch brands
  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['invoice-brands-grabba'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, color')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as Brand[];
    },
  });

  // Fetch products by brand
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['invoice-products', selectedBrandId],
    queryFn: async () => {
      if (!selectedBrandId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, store_price, wholesale_price')
        .eq('brand_id', selectedBrandId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!selectedBrandId,
  });

  const handleAddProduct = () => {
    if (!selectedBrandId || !selectedProductId || quantity <= 0) {
      toast.error('Please select a brand, product, and quantity');
      return;
    }

    const brand = brands.find(b => b.id === selectedBrandId);
    const product = products.find(p => p.id === selectedProductId);

    if (!brand || !product) return;

    const unitPrice = product.store_price || product.wholesale_price || 0;

    const existingIndex = lineItems.findIndex(item => item.product_id === selectedProductId);
    if (existingIndex >= 0) {
      const updated = [...lineItems];
      updated[existingIndex].quantity += quantity;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      setLineItems(updated);
    } else {
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (lineItems.length === 0) {
        throw new Error('Add at least one product');
      }

      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const tax = 0;
      const total = subtotal + tax;

      const brandSummary = [...new Set(lineItems.map(i => i.brand_name))].join(', ');
      const partialAmountNum = partialAmount ? parseFloat(partialAmount) : null;

      // Update invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          subtotal,
          tax,
          total,
          total_amount: total,
          payment_method: paymentMethod || null,
          payment_status: paymentStatus,
          due_date: dueDate
            ? dueDate.toISOString().split('T')[0]
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          paid_at: paymentStatus === 'paid' || paymentStatus === 'partial' ? new Date().toISOString() : null,
          partial_amount: paymentStatus === 'partial' ? partialAmountNum : null,
          received_by: receivedByName || null,
          delivery_photos: photos.length > 0 ? photos : null,
          notes: notes || null,
          brand: brandSummary,
        })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      // Delete old line items and insert new ones
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('invoice_line_items')
          .delete()
          .eq('invoice_id', invoice.id);

        if (lineItems.length > 0) {
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

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('invoice_line_items')
            .insert(lineItemsData);
        }
      } catch (err) {
        console.error('Error updating line items:', err);
      }

      return invoice.id;
    },
    onSuccess: () => {
      toast.success('Invoice updated successfully');
      queryClient.invalidateQueries({ queryKey: ['store-invoices', storeId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      // CRITICAL: Invalidate unified feed to sync Floor 5
      queryClient.invalidateQueries({ queryKey: ['unified-invoice-feed'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-line-items', invoice.id] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(`Failed to update invoice: ${error.message}`);
    },
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const tax = 0;
  const total = subtotal + tax;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  // Don't allow editing paid invoices
  const isPaid = invoice.payment_status === 'paid';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Edit Invoice
          </DialogTitle>
          <DialogDescription>
            Edit invoice {invoice.invoice_number} for {storeName}
          </DialogDescription>
        </DialogHeader>

        {isPaid ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-center">
            <p className="text-destructive font-medium">This invoice is paid and cannot be edited.</p>
            <p className="text-sm text-muted-foreground mt-1">
              If you need to make changes, void this invoice and create a new one.
            </p>
          </div>
        ) : (
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
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Due Date
              </Label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Select due date"
              />
              <p className="text-xs text-muted-foreground">
                {dueDate
                  ? <>Due <span className="text-foreground font-medium">{dynastyDateWithWeekday(dueDate)}</span> ({dynastyRelative(dueDate)})</>
                  : 'No due date set'}
              </p>
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

            {/* Payment Status */}
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentStatus === 'unpaid' ? 'default' : 'outline'}
                  onClick={() => {
                    setPaymentStatus('unpaid');
                    setPartialAmount('');
                  }}
                  className="flex-1"
                >
                  Unpaid
                </Button>
                <Button
                  type="button"
                  variant={paymentStatus === 'partial' ? 'default' : 'outline'}
                  onClick={() => setPaymentStatus('partial')}
                  className="flex-1"
                >
                  Partial
                </Button>
                <Button
                  type="button"
                  variant={paymentStatus === 'paid' ? 'default' : 'outline'}
                  onClick={() => {
                    setPaymentStatus('paid');
                    setPartialAmount('');
                  }}
                  className="flex-1"
                >
                  Paid
                </Button>
              </div>
              {paymentStatus === 'partial' && (
                <div className="space-y-2 pt-2">
                  <Label>Partial Payment Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={total}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="Enter partial amount"
                  />
                  <p className="text-xs text-muted-foreground">
                    Remaining: ${(total - (parseFloat(partialAmount) || 0)).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* Received By */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Received By (Person Name)
              </Label>
              <Input
                value={receivedByName}
                onChange={(e) => setReceivedByName(e.target.value)}
                placeholder="Enter name of person who received the order"
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Delivery Photos
              </Label>
              <PhotoUploadMultiple
                photos={photos}
                onChange={setPhotos}
                maxPhotos={5}
                folder="invoice-delivery-photos"
              />
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
                disabled={updateMutation.isPending || lineItems.length === 0}
                className="flex-1"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
