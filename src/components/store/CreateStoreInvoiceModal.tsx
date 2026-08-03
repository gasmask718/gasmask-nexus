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
import { FileText, Plus, X, Package, Loader2, Calendar, User, Camera, Upload as UploadIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DatePicker } from '@/components/ui/datetime-picker';
import { dynastyDateWithWeekday, dynastyRelative } from '@/lib/dates';
import { PhotoUploadMultiple } from './PhotoUploadMultiple';
import { BulkStoreSelector } from './BulkStoreSelector';
import { GRABBA_COMPANY_IDS } from '@/hooks/useVisitProducts';
import { InvoiceModeSelector, InvoiceMode } from '@/components/invoice/InvoiceModeSelector';
import { InvoiceLineBuilder } from '@/components/invoice/InvoiceLineBuilder';
import {
  toLineItemRow,
  type BuilderLine,
  type DbSaleUnit,
  type SaleChannel,
} from '@/lib/invoice/lineMath';


export type InvoiceEntityType = 'store' | 'wholesaler' | 'company';

interface CreateStoreInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess?: (invoiceId: string) => void;
  /** Polymorphic entity type for unified invoice system */
  entityType?: InvoiceEntityType;
  /** Polymorphic entity ID — defaults to storeId if not provided */
  entityId?: string;
  /** Default pricing mode — 'retail' for stores, 'wholesale' for wholesalers */
  defaultPricingMode?: SaleChannel;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'cashapp', label: 'CashApp' },
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export type { SaleChannel, DiscountType } from '@/lib/invoice/lineMath';
export type SaleUnit = DbSaleUnit;

type LineItem = BuilderLine;

export function CreateStoreInvoiceModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  onSuccess,
  entityType = 'store',
  entityId,
  defaultPricingMode,
}: CreateStoreInvoiceModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saleChannel, setSaleChannel] = useState<SaleChannel>(defaultPricingMode || 'retail');

  const [paymentMethod, setPaymentMethod] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [partialAmount, setPartialAmount] = useState('');
  const [receivedByName, setReceivedByName] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>('live');
  const [priceOverrideEnabled, setPriceOverrideEnabled] = useState(false);

  // Sync due date when invoice date changes (Net 30)
  const invoiceDateMs = invoiceDate?.getTime();
  const computedDueDate = invoiceDate
    ? new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const CANONICAL_BRAND_IDS = [
    'fb52b0e6-39b2-4e13-bea9-cd016f51efb0', // GasMask
    '4b1c1255-b7b1-43ea-9ad9-a257c6582094', // Grabba R Us
    'f3e8ba65-2b76-4f61-a157-0751acb3e7b2', // Hot Mama
    'c9d60b82-f0d3-44b4-9b33-1abe4adf1ebe', // Hotscolatti
  ];




  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}-${random}`;
  };



  // Get store contacts for interaction logging
  const { data: storeContacts } = useQuery({
    queryKey: ['store-contacts-for-invoice', storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_contacts')
        .select('id')
        .is('deleted_at', null)
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

      // Use invoice date for backdating, or current date if not specified
      const invoiceDateToUse = invoiceDate ? invoiceDate.toISOString() : new Date().toISOString();
      
      // Calculate payment amounts
      const partialAmountNum = partialAmount ? parseFloat(partialAmount) : 0;
      const paidAmount = paymentStatus === 'paid' ? total : (paymentStatus === 'partial' ? partialAmountNum : 0);

      // Determine which stores to create invoices for
      const storesToProcess = bulkMode && selectedStoreIds.length > 0 
        ? selectedStoreIds 
        : [storeId];

      // Create invoices for all selected stores
      const createdInvoices = [];
      for (const targetStoreId of storesToProcess) {
        // Create invoice
        const resolvedEntityId = entityId || targetStoreId;
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            store_id: entityType === 'store' ? targetStoreId : null,
            entity_type: entityType,
            entity_id: resolvedEntityId,
            pricing_mode: saleChannel,
            invoice_number: invoiceNumber,
            subtotal,
            tax,
            total,
            total_amount: total,
            payment_method: paymentMethod || null,
            payment_status: paymentStatus,
            due_date: dueDate
              ? dueDate.toISOString().split('T')[0]
              : computedDueDate.toISOString().split('T')[0],
            paid_at: paymentStatus === 'paid' || paymentStatus === 'partial' ? invoiceDateToUse : null,
            partial_amount: paymentStatus === 'partial' ? partialAmountNum : null,
            received_by: receivedByName || null,
            delivery_photos: photos.length > 0 ? photos : null,
            notes: notes || null,
            brand: brandSummary,
            created_by: user?.id || 'manual',
            created_at: invoiceDateToUse,
            is_historical: invoiceMode === 'historical',
            entry_mode: invoiceMode === 'historical' ? 'backfill' : 'live',
            status: 'draft',
          })
          .select('id')
          .single();

        if (invoiceError) throw invoiceError;
        if (invoice) createdInvoices.push(invoice);

        // Create invoice line items with Phase 1B discount/override fields
        if (invoice && lineItems.length > 0) {
        const lineItemsData = lineItems.map(item =>
          toLineItemRow(item, invoice.id, { pricingMode: saleChannel }),
        );


        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .insert(lineItemsData);
        
        if (lineItemsError) {
          console.error('Failed to create invoice line items:', lineItemsError);
          toast.error(`Line items failed: ${lineItemsError.message}`);
        }

        // Phase 1B: Invoice stays as DRAFT — finalize explicitly from Invoice Detail
        // No auto-finalize. Draft allows review, corrections, and manager approval.
        }

        // Create contact interaction for Recent Interactions
        if (storeContacts && user) {
        const { error: interactionError } = await supabase
          .from('contact_interactions')
          .insert({
            contact_id: storeContacts,
            store_id: targetStoreId,
            channel: 'OTHER',
            direction: 'OUTBOUND',
            subject: `Invoice Created: ${invoiceNumber}`,
            summary: `Invoice created. Total: $${total.toFixed(2)}. Products: ${brandSummary}`,
            outcome: 'SUCCESS',
            created_by_user_id: user.id,
          });
        
          // Don't fail invoice creation if interaction logging fails
          if (interactionError) {
            console.error('Failed to log interaction:', interactionError);
          }
        }

        // Create visit_log entry with visit_type='order' so it appears in Order History
        if (invoice && user) {
        try {
          // Prepare products_delivered JSON from line items
          const productsDeliveredJson = lineItems.map(item => ({
            brand_id: item.brand_id,
            brand_name: item.brand_name,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_type: 'standard',
          }));

          const { error: visitLogError } = await supabase
            .from('visit_logs')
            .insert({
              store_id: targetStoreId,
              user_id: user.id,
              visit_type: 'order',
              visit_datetime: invoiceDateToUse, // Use invoice date for backdating
              cash_collected: paidAmount > 0 ? paidAmount : null,
              payment_method: paymentMethod as any || null,
              customer_response: notes || `Invoice ${invoiceNumber}${receivedByName ? ` - Received by: ${receivedByName}` : ''}`,
              products_delivered: productsDeliveredJson as any,
              delivery_photos: photos.length > 0 ? photos as any : null,
            });

          if (visitLogError) {
            console.error('Failed to create order entry in visit_logs:', visitLogError);
            // Don't fail invoice creation if visit log creation fails
          }
        } catch (err) {
            console.error('Error creating order entry in visit_logs:', err);
            // Don't fail invoice creation if visit log creation fails
          }
        }

        // Send receipt text for LIVE invoices only (not historical)
        if (invoice && invoiceMode === 'live') {
          try {
            const { error: receiptError } = await supabase.functions.invoke('send-invoice-receipt', {
              body: {
                invoice_id: invoice.id,
                store_id: targetStoreId,
                invoice_number: invoiceNumber,
                total_amount: total,
                store_name: storeName,
                is_historical: false,
                recipient_phone: recipientPhone || undefined,
                custom_message: customMessage || undefined,
              },
            });
            
            if (receiptError) {
              console.error('Failed to send receipt:', receiptError);
              // Don't fail invoice creation if receipt fails
            }
          } catch (err) {
            console.error('Error sending receipt:', err);
          }
        }
      }

      return createdInvoices[0] || null;
    },
    onSuccess: (data) => {
      const count = bulkMode && selectedStoreIds.length > 0 ? selectedStoreIds.length : 1;
      toast.success(`${count} invoice${count > 1 ? 's' : ''} created successfully`);
      
      // Invalidate ALL invoice and order-related queries for full system coherence
      queryClient.invalidateQueries({ queryKey: ['store-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      // CRITICAL: Invalidate unified feed to sync Floor 5
      queryClient.invalidateQueries({ queryKey: ['unified-invoice-feed'] });
      queryClient.invalidateQueries({ queryKey: ['contact-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['store-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['store-orders-history'] });
      queryClient.invalidateQueries({ queryKey: ['visit-logs'] });
      
      // CRITICAL: Invalidate ambassador order queries so dashboards update
      queryClient.invalidateQueries({ queryKey: ['ambassador-store-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-store-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-quick-stats'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail'] });
      queryClient.invalidateQueries({ queryKey: ['tube-sale-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['store-tube-inventory'] });
      
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
    setSaleChannel(defaultPricingMode || 'retail');

    setPaymentMethod('');
    setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setInvoiceDate(new Date()); // Reset to today
    setNotes('');
    setPaymentStatus('unpaid');
    setPartialAmount('');
    setReceivedByName('');
    setPhotos([]);
    setBulkMode(false);
    setSelectedStoreIds([]);
    setInvoiceMode('live');
    setPriceOverrideEnabled(false);
    setRecipientPhone('');
    setCustomMessage('');
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.line_subtotal, 0);
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
          {/* Invoice Mode Selector - MUST BE FIRST */}
          <InvoiceModeSelector 
            mode={invoiceMode} 
            onModeChange={setInvoiceMode} 
          />

          {/* Canonical line builder — Full Box / Half Box / Pack / Loose Tube */}
          <InvoiceLineBuilder
            lines={lineItems}
            onLinesChange={setLineItems}
            saleChannel={saleChannel}
            onSaleChannelChange={setSaleChannel}
            brandFilterIds={CANONICAL_BRAND_IDS}
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
              {/* INVENTORY INTELLIGENCE */}
              {(() => {
                const totalTubes = lineItems.filter(i => i.track_by === 'tubes').reduce((sum, item) => sum + item.computed_tubes_total, 0);
                const totalBags = lineItems.filter(i => i.track_by === 'bags').reduce((sum, item) => sum + item.computed_tubes_total, 0);
                return (
                  <>
                    {totalTubes > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-primary/20">
                        <span className="text-sm font-medium text-muted-foreground">🧪 Total Tubes</span>
                        <span className="font-mono font-bold text-primary">{totalTubes}</span>
                      </div>
                    )}
                    {totalBags > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm font-medium text-muted-foreground">👜 Total Bags</span>
                        <span className="font-mono font-bold text-primary">{totalBags}</span>
                      </div>
                    )}
                  </>
                );
              })()}
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

          {/* Invoice Date (for backdating) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Invoice Date
            </Label>
            <DatePicker
              value={invoiceDate}
              onChange={setInvoiceDate}
              placeholder="Pick a date to backdate"
            />
            <p className="text-xs text-muted-foreground">
              {invoiceDate
                ? <>Invoice dated <span className="text-foreground font-medium">{dynastyDateWithWeekday(invoiceDate)}</span></>
                : 'Select a date to backdate this invoice when transferring old orders'}
            </p>
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
            <div className="flex flex-wrap items-center gap-2">
              {[7, 14, 30].map((days) => (
                <Button
                  key={days}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    const base = invoiceDate ? new Date(invoiceDate) : new Date();
                    base.setDate(base.getDate() + days);
                    setDueDate(base);
                  }}
                >
                  Net {days}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {dueDate
                ? <>Due <span className="text-foreground font-medium">{dynastyDateWithWeekday(dueDate)}</span> ({dynastyRelative(dueDate)})</>
                : 'No due date set'}
            </p>
          </div>

          {/* Recipient Contact (for SMS receipt) */}
          <div className="space-y-2 p-3 rounded-lg border border-dashed bg-muted/20">
            <Label className="flex items-center gap-2 text-sm font-medium">
              📱 Send Receipt To (SMS via Twilio)
            </Label>
            <Input
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="e.g., +1234567890 or 2125551234"
            />
            <p className="text-xs text-muted-foreground">
              Enter a phone number to send the invoice receipt via SMS. Leave blank to auto-resolve from store contacts.
            </p>
            <Label className="text-xs text-muted-foreground">Custom Message (optional)</Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a personal note to the invoice receipt..."
              rows={2}
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
            <p className="text-xs text-muted-foreground">
              Take photos of who received the delivery
            </p>
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
