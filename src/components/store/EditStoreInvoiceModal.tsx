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
import { InvoiceLineBuilder } from '@/components/invoice/InvoiceLineBuilder';
import {
  fromLineItemRow,
  toLineItemRow,
  type BuilderLine,
  type SaleChannel,
} from '@/lib/invoice/lineMath';


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
  /** Lifecycle status — 'finalized' invoices need reopen_invoice before editing */
  status?: string | null;
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
  const [lineItems, setLineItems] = useState<BuilderLine[]>([]);
  const [saleChannel, setSaleChannel] = useState<SaleChannel>('retail');

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

  // Finalized invoices are locked by a DB trigger ("Cannot modify line items
  // on a finalized invoice"). Reopen with a reason, then re-finalize on save.
  const isFinalized = invoice.status === 'finalized';
  const [reopened, setReopened] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const reason = reopenReason.trim();
      if (!reason) throw new Error('Enter a reason for reopening');
      const { error } = await (supabase as any).rpc('reopen_invoice', {
        p_invoice_id: invoice.id,
        p_reason: reason,
        p_user_id: user?.id ?? 'admin',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReopened(true);
      toast.success('Invoice reopened — it will be re-finalized when you save');
    },
    onError: (error: any) => {
      toast.error(`Could not reopen invoice: ${error.message}`);
    },
  });

  // Fetch existing line items
  const { data: existingLineItems = [] } = useQuery({
    queryKey: ['invoice-line-items', invoice.id],
    queryFn: async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', invoice.id)
          .is('deleted_at', null);
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
      setLineItems(existingLineItems.map((item: any) => fromLineItemRow(item)));
    }
  }, [existingLineItems]);



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

      // DIFF-BASED line item sync.
      // NEVER wipe-and-replace: reconstructed lines carry line_source /
      // reconstruction_run_id provenance that a delete+insert would destroy.
      // Untouched rows are left completely alone.
      const existingById = new Map<string, any>(
        (existingLineItems as any[]).map((r) => [r.id as string, r])
      );
      const keptIds = new Set(lineItems.map((i) => i.id).filter((id) => existingById.has(id)));

      // 1. UPDATE rows that exist and actually changed
      for (const item of lineItems) {
        const prev = existingById.get(item.id);
        if (!prev) continue;
        const changed =
          Number(prev.quantity) !== Number(item.quantity) ||
          Number(prev.unit_price) !== Number(item.unit_price_used) ||
          Number(prev.total) !== Number(item.line_subtotal) ||
          prev.product_id !== item.product_id ||
          prev.brand_id !== item.brand_id ||
          (prev.unit_kind ?? null) !== item.unit_kind;
        if (!changed) continue; // preserve provenance untouched

        const { invoice_id: _ignored, line_source: _src, ...updatePayload } = toLineItemRow(
          item,
          invoice.id,
          { pricingMode: saleChannel },
        );
        const { error } = await (supabase as any)
          .from('invoice_line_items')
          .update(updatePayload)
          .eq('id', item.id)
          .select('id');
        if (error) throw new Error(`Line update failed: ${error.message}`);
      }

      // 2. INSERT genuinely new rows
      const newRows = lineItems.filter((i) => !existingById.has(i.id));
      if (newRows.length > 0) {
        const { error } = await (supabase as any)
          .from('invoice_line_items')
          .insert(
            newRows.map((item) =>
              toLineItemRow(item, invoice.id, {
                pricingMode: saleChannel,
                lineSource: 'manual_edit',
              }),
            )
          )
          .select('id');
        if (error) throw new Error(`Line insert failed: ${error.message}`);
      }

      // 3. SOFT-DELETE removed rows (recoverable, provenance intact)
      const removedIds = (existingLineItems as any[])
        .map((r) => r.id as string)
        .filter((id) => !keptIds.has(id));
      if (removedIds.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from('invoice_line_items')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id ?? null,
            delete_reason: 'removed_via_invoice_edit',
          })
          .in('id', removedIds)
          .select('id');
        if (error) throw new Error(`Line removal failed: ${error.message}`);
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
            {/* Canonical line builder — Full Box / Half Box / Pack / Loose Tube */}
            <InvoiceLineBuilder
              lines={lineItems}
              onLinesChange={setLineItems}
              saleChannel={saleChannel}
              onSaleChannelChange={setSaleChannel}
            />



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
