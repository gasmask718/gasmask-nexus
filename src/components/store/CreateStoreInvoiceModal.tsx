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
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Plus, X } from 'lucide-react';

interface CreateStoreInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess?: (invoiceId: string) => void;
}

const BRANDS = ['grabba', 'gasmask', 'fronto'];
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'cashapp', label: 'CashApp' },
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

interface LineItem {
  brand: string;
  quantity: number;
  unitPrice: number;
}

export function CreateStoreInvoiceModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  onSuccess,
}: CreateStoreInvoiceModalProps) {
  const queryClient = useQueryClient();
  const [lineItems, setLineItems] = useState<LineItem[]>([{ brand: '', quantity: 0, unitPrice: 0 }]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [markAsPaid, setMarkAsPaid] = useState(false);

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}-${random}`;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const validItems = lineItems.filter(item => item.brand && item.quantity > 0);
      if (validItems.length === 0) {
        throw new Error('Add at least one line item');
      }

      const subtotal = validItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const tax = 0; // Can be calculated if needed
      const total = subtotal + tax;

      const invoiceNumber = generateInvoiceNumber();
      const brandSummary = validItems.map(i => i.brand).join(', ');

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          store_id: storeId,
          invoice_number: invoiceNumber,
          subtotal,
          tax,
          total,
          total_amount: total,
          payment_method: paymentMethod || null,
          payment_status: markAsPaid ? 'paid' : 'pending',
          due_date: dueDate || null,
          paid_at: markAsPaid ? new Date().toISOString() : null,
          notes: notes || null,
          brand: brandSummary,
          created_by: 'manual',
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Invoice created successfully');
      queryClient.invalidateQueries({ queryKey: ['store-invoices', storeId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      resetForm();
      onOpenChange(false);
      onSuccess?.(data.id);
    },
    onError: (error: any) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });

  const resetForm = () => {
    setLineItems([{ brand: '', quantity: 0, unitPrice: 0 }]);
    setPaymentMethod('');
    setDueDate('');
    setNotes('');
    setMarkAsPaid(false);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { brand: '', quantity: 0, unitPrice: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

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
          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Products</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30">
                <Select
                  value={item.brand}
                  onValueChange={(v) => updateLineItem(index, 'brand', v)}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANDS.map((b) => (
                      <SelectItem key={b} value={b} className="capitalize">
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  min="0"
                  placeholder="Qty"
                  className="w-20"
                  value={item.quantity || ''}
                  onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                />

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  className="w-24"
                  value={item.unitPrice || ''}
                  onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                />

                <div className="flex-1 text-right font-mono text-sm">
                  ${(item.quantity * item.unitPrice).toFixed(2)}
                </div>

                {lineItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeLineItem(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="font-medium">Total</span>
            <span className="text-xl font-bold">${subtotal.toFixed(2)}</span>
          </div>

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
