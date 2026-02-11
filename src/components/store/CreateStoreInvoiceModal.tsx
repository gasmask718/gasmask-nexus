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
import { PhotoUploadMultiple } from './PhotoUploadMultiple';
import { BulkStoreSelector } from './BulkStoreSelector';
import { GRABBA_COMPANY_IDS } from '@/hooks/useVisitProducts';
import { InvoiceModeSelector, InvoiceMode } from '@/components/invoice/InvoiceModeSelector';

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

export type SaleChannel = 'retail' | 'wholesale' | 'street';
export type SaleUnit = 'box' | 'unit';

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
  suggested_retail_price: number | null;
  street_price: number | null;
  cost: number | null;
  units_per_box: number | null;
  unit_type: string | null;
  // Phase 1B fields
  track_by: string | null;
  sale_unit_default: string | null;
  price_per_box: number | null;
  price_per_unit: number | null;
}

export type DiscountType = 'none' | 'percent' | 'amount';

interface LineItem {
  id: string;
  brand_id: string;
  brand_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  sale_channel: SaleChannel;
  sale_unit: SaleUnit;
  cost_per_unit: number;
  profit: number;
  units_per_box: number;
  // Tube-native fields
  quantity_boxes: number | null;
  quantity_tubes: number | null;
  computed_tubes_total: number;
  // Phase 1B: Discount/Override pricing
  list_unit_price: number;
  unit_price_used: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_reason: string;
  price_override_reason: string;
  line_subtotal: number;
  track_by: string;
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
  const [saleChannel, setSaleChannel] = useState<SaleChannel>('retail');
  const [saleUnit, setSaleUnit] = useState<SaleUnit>('box');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [partialAmount, setPartialAmount] = useState('');
  const [receivedByName, setReceivedByName] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>('live');

  // Only show the 4 canonical brands
  const CANONICAL_BRAND_IDS = [
    'fb52b0e6-39b2-4e13-bea9-cd016f51efb0', // GasMask
    '4b1c1255-b7b1-43ea-9ad9-a257c6582094', // Grabba R Us
    'f3e8ba65-2b76-4f61-a157-0751acb3e7b2', // Hot Mama
    'c9d60b82-f0d3-44b4-9b33-1abe4adf1ebe', // HotScalati
  ];

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['invoice-brands-grabba'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, color')
        .in('id', CANONICAL_BRAND_IDS)
        .order('name');
      if (error) throw error;
      return (data || []) as Brand[];
    },
  });

  // Fetch products by brand from canonical products table
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['invoice-products', selectedBrandId],
    queryFn: async () => {
      if (!selectedBrandId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, store_price, wholesale_price, suggested_retail_price, street_price, cost, units_per_box, unit_type, track_by, sale_unit_default, price_per_box, price_per_unit')
        .eq('brand_id', selectedBrandId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: !!selectedBrandId,
  });

  // Get price based on selected channel
  const getPriceForChannel = (product: Product, channel: SaleChannel): number => {
    switch (channel) {
      case 'street':
        return product.street_price || product.suggested_retail_price || 0;
      case 'wholesale':
        return product.wholesale_price || 0;
      case 'retail':
      default:
        return product.suggested_retail_price || product.store_price || 0;
    }
  };

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

    // Phase 1B: Determine list price based on sale unit
    const listUnitPrice = saleUnit === 'box'
      ? (product.price_per_box ?? getPriceForChannel(product, saleChannel))
      : (product.price_per_unit ?? getPriceForChannel(product, saleChannel));

    const unitPrice = listUnitPrice;
    const costPerUnit = product.cost || 0;
    const unitsPerBox = product.units_per_box || 1;
    const trackBy = product.track_by || 'tubes';
    
    // Calculate profit (INTERNAL ONLY - never shown on invoice)
    const profitPerUnit = unitPrice - costPerUnit;
    const totalProfit = profitPerUnit * quantity;

    // Unit computation: bags are always sold individually (no box math)
    let quantityBoxes: number | null = null;
    let quantityTubes: number | null = null;
    let computedTubesTotal: number;

    if (trackBy === 'bags') {
      // Bags: always per-bag, no boxes
      quantityBoxes = null;
      quantityTubes = quantity; // stored in quantity_tubes column
      computedTubesTotal = quantity;
    } else if (saleUnit === 'box') {
      quantityBoxes = quantity;
      quantityTubes = null;
      computedTubesTotal = quantity * unitsPerBox;
    } else {
      quantityBoxes = null;
      quantityTubes = quantity;
      computedTubesTotal = quantity;
    }

    const lineSubtotal = unitPrice * quantity;

    // Check if same product with same channel already added
    const existingIndex = lineItems.findIndex(
      item => item.product_id === selectedProductId && item.sale_channel === saleChannel && item.sale_unit === saleUnit
    );
    
    if (existingIndex >= 0) {
      const updated = [...lineItems];
      const existing = updated[existingIndex];
      existing.quantity += quantity;
      existing.total = existing.quantity * existing.unit_price_used;
      existing.line_subtotal = existing.total;
      existing.profit = (existing.unit_price_used - existing.cost_per_unit) * existing.quantity;
      if (existing.sale_unit === 'box') {
        existing.quantity_boxes = existing.quantity;
        existing.computed_tubes_total = existing.quantity * existing.units_per_box;
      } else {
        existing.quantity_tubes = existing.quantity;
        existing.computed_tubes_total = existing.quantity;
      }
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
          total: lineSubtotal,
          sale_channel: saleChannel,
          sale_unit: saleUnit,
          cost_per_unit: costPerUnit,
          profit: totalProfit,
          units_per_box: unitsPerBox,
          quantity_boxes: quantityBoxes,
          quantity_tubes: quantityTubes,
          computed_tubes_total: computedTubesTotal,
          // Phase 1B fields
          list_unit_price: listUnitPrice,
          unit_price_used: unitPrice,
          discount_type: 'none' as DiscountType,
          discount_value: 0,
          discount_reason: '',
          price_override_reason: '',
          line_subtotal: lineSubtotal,
          track_by: trackBy,
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
      lineItems.map(item => {
        if (item.id !== id) return item;
        const updatedItem = { 
          ...item, 
          quantity: newQuantity, 
          total: newQuantity * item.unit_price_used,
          line_subtotal: newQuantity * item.unit_price_used,
          profit: (item.unit_price_used - item.cost_per_unit) * newQuantity,
        };
        if (updatedItem.sale_unit === 'box') {
          updatedItem.quantity_boxes = newQuantity;
          updatedItem.computed_tubes_total = newQuantity * updatedItem.units_per_box;
        } else {
          updatedItem.quantity_tubes = newQuantity;
          updatedItem.computed_tubes_total = newQuantity;
        }
        return updatedItem;
      })
    );
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    if (newPrice < 0) return;
    setLineItems(
      lineItems.map(item => {
        if (item.id !== id) return item;
        const needsReason = newPrice !== item.list_unit_price;
        return { 
          ...item, 
          unit_price: newPrice, 
          unit_price_used: newPrice,
          total: item.quantity * newPrice,
          line_subtotal: item.quantity * newPrice,
          profit: (newPrice - item.cost_per_unit) * item.quantity,
          discount_type: needsReason && item.discount_type === 'none' ? 'none' as DiscountType : item.discount_type,
          price_override_reason: needsReason ? (item.price_override_reason || '') : '',
        };
      })
    );
  };

  const handleUpdateDiscount = (id: string, discountType: DiscountType, discountValue: number, reason: string) => {
    setLineItems(
      lineItems.map(item => {
        if (item.id !== id) return item;
        let finalPrice = item.list_unit_price;
        if (discountType === 'percent') {
          finalPrice = Math.round(item.list_unit_price * (1 - discountValue / 100) * 100) / 100;
        } else if (discountType === 'amount') {
          finalPrice = Math.max(item.list_unit_price - discountValue, 0);
        }
        return {
          ...item,
          discount_type: discountType,
          discount_value: discountValue,
          discount_reason: reason,
          unit_price_used: finalPrice,
          unit_price: finalPrice,
          total: item.quantity * finalPrice,
          line_subtotal: item.quantity * finalPrice,
          profit: (finalPrice - item.cost_per_unit) * item.quantity,
        };
      })
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
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            store_id: targetStoreId,
            invoice_number: invoiceNumber,
            subtotal,
            tax,
            total,
            total_amount: total,
            payment_method: paymentMethod || null,
            payment_status: paymentStatus,
            due_date: dueDate ? dueDate.toISOString().split('T')[0] : null,
            paid_at: paymentStatus === 'paid' || paymentStatus === 'partial' ? invoiceDateToUse : null,
            partial_amount: paymentStatus === 'partial' ? partialAmountNum : null,
            received_by: receivedByName || null,
            delivery_photos: photos.length > 0 ? photos : null,
            notes: notes || null,
            brand: brandSummary,
            created_by: user?.id || 'manual',
            created_at: invoiceDateToUse,
            is_historical: invoiceMode === 'historical',
            status: 'draft', // Phase 1B: Start as draft
          })
          .select('id')
          .single();

        if (invoiceError) throw invoiceError;
        if (invoice) createdInvoices.push(invoice);

        // Create invoice line items with Phase 1B discount/override fields
        if (invoice && lineItems.length > 0) {
        const lineItemsData = lineItems.map(item => ({
          invoice_id: invoice.id,
          brand_id: item.brand_id,
          brand: item.brand_name,
          product_id: item.product_id,
          product_name: item.product_name,
          product_name_snapshot: item.product_name,
          brand_name_snapshot: item.brand_name,
          quantity: item.quantity,
          unit_price: item.unit_price_used,
          total: item.line_subtotal,
          sale_channel: item.sale_channel,
          sale_unit: item.sale_unit,
          cost_per_unit_at_sale: item.cost_per_unit,
          profit_at_sale: item.profit,
          units_per_box_snapshot: item.units_per_box,
          // TUBE-NATIVE fields
          quantity_boxes: item.quantity_boxes,
          quantity_tubes: item.quantity_tubes,
          computed_tubes_total: item.computed_tubes_total,
          // Phase 1B: Discount/Override pricing
          list_unit_price: item.list_unit_price,
          unit_price_used: item.unit_price_used,
          discount_type: item.discount_type,
          discount_value: item.discount_value,
          discount_reason: item.discount_reason || null,
          price_override_reason: item.price_override_reason || null,
          line_subtotal: item.line_subtotal,
        }));

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
    setSelectedBrandId('');
    setSelectedProductId('');
    setQuantity(1);
    setSaleChannel('retail');
    setSaleUnit('box');
    setPaymentMethod('');
    setDueDate(undefined);
    setInvoiceDate(new Date()); // Reset to today
    setNotes('');
    setPaymentStatus('unpaid');
    setPartialAmount('');
    setReceivedByName('');
    setPhotos([]);
    setBulkMode(false);
    setSelectedStoreIds([]);
    setInvoiceMode('live'); // Reset to live mode
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

            {/* Sale Channel Selection */}
            {selectedProductId && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Sale Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={saleChannel === 'retail' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSaleChannel('retail')}
                    className="text-xs"
                  >
                    Retail
                  </Button>
                  <Button
                    type="button"
                    variant={saleChannel === 'wholesale' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSaleChannel('wholesale')}
                    className="text-xs"
                  >
                    Wholesale
                  </Button>
                  <Button
                    type="button"
                    variant={saleChannel === 'street' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSaleChannel('street')}
                    className="text-xs"
                  >
                    Street
                  </Button>
                </div>
                {/* Show selected channel price */}
                {(() => {
                  const product = products.find(p => p.id === selectedProductId);
                  if (!product) return null;
                  const price = getPriceForChannel(product, saleChannel);
                  return (
                    <p className="text-xs text-muted-foreground">
                      {saleChannel.charAt(0).toUpperCase() + saleChannel.slice(1)} price: <span className="font-mono font-medium text-foreground">${price.toFixed(2)}</span>
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Sale Unit (Box vs Tube) */}
            {selectedProductId && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Selling As</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={saleUnit === 'box' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSaleUnit('box')}
                    className="text-xs"
                  >
                    📦 Box
                  </Button>
                   <Button
                    type="button"
                    variant={saleUnit === 'unit' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSaleUnit('unit')}
                    className="text-xs"
                  >
                    {(() => {
                      const product = products.find(p => p.id === selectedProductId);
                      const trackBy = product?.track_by || 'tubes';
                      return trackBy === 'bags' ? '👜 Bags' : '🧪 Loose Tubes';
                    })()}
                  </Button>
                </div>
                {/* Show unit computation preview */}
                {(() => {
                   const product = products.find(p => p.id === selectedProductId);
                   const trackBy = product?.track_by || 'tubes';
                   const unitsPerBox = product?.units_per_box || 1;
                   const unitLabel = trackBy === 'bags' ? 'bags' : 'tubes';
                   if (trackBy === 'bags') {
                     // Bags are sold individually, no box math
                     return (
                       <p className="text-xs text-muted-foreground">
                         = <span className="font-mono font-semibold text-foreground">{quantity}</span> {unitLabel}
                       </p>
                     );
                   }
                   const tubesPreview = saleUnit === 'box' 
                     ? quantity * unitsPerBox 
                     : quantity;
                   return (
                     <p className="text-xs text-muted-foreground">
                       = <span className="font-mono font-semibold text-foreground">{tubesPreview}</span> {unitLabel}
                       {saleUnit === 'box' && ` (${quantity} × ${unitsPerBox} tubes/box)`}
                     </p>
                   );
                 })()}
              </div>
            )}

            {/* Quantity */}
            {selectedProductId && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Quantity ({(() => {
                    if (saleUnit === 'box') return 'Boxes';
                    const product = products.find(p => p.id === selectedProductId);
                    return (product?.track_by || 'tubes') === 'bags' ? 'Bags' : 'Tubes';
                  })()})
                </Label>
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
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/30 border"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: brands.find(b => b.id === item.brand_id)?.color || '#6366F1' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                         <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-muted-foreground">{item.brand_name}</p>
                          <Badge 
                            variant={item.sale_channel === 'street' ? 'default' : 'outline'} 
                            className="text-[10px] px-1.5 py-0"
                          >
                            {item.sale_channel}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.sale_unit === 'box' ? '📦 Box' : item.track_by === 'bags' ? '👜 Bag' : '🧪 Tube'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            {item.computed_tubes_total} {item.track_by === 'bags' ? 'bags' : 'tubes'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {/* Qty × Price row */}
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
                        value={item.unit_price_used}
                        onChange={(e) => handleUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                        className="w-20 h-8 text-sm font-mono"
                      />
                      <span className="text-sm font-mono font-medium flex-1 text-right">
                        ${item.line_subtotal.toFixed(2)}
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
                    {/* List price reference */}
                    {item.unit_price_used !== item.list_unit_price && (
                      <p className="text-xs text-muted-foreground">
                        List: <span className="line-through font-mono">${item.list_unit_price.toFixed(2)}</span>
                        {item.discount_type !== 'none' && (
                          <span className="ml-1 text-primary">
                            ({item.discount_type === 'percent' ? `${item.discount_value}% off` : `$${item.discount_value} off`})
                          </span>
                        )}
                      </p>
                    )}
                    {/* Discount controls */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                      <Select
                        value={item.discount_type}
                        onValueChange={(v) => handleUpdateDiscount(item.id, v as DiscountType, item.discount_value, item.discount_reason)}
                      >
                        <SelectTrigger className="w-24 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Disc.</SelectItem>
                          <SelectItem value="percent">% Off</SelectItem>
                          <SelectItem value="amount">$ Off</SelectItem>
                        </SelectContent>
                      </Select>
                      {item.discount_type !== 'none' && (
                        <>
                          <Input
                            type="number"
                            min="0"
                            step={item.discount_type === 'percent' ? '1' : '0.01'}
                            max={item.discount_type === 'percent' ? 100 : undefined}
                            value={item.discount_value}
                            onChange={(e) => handleUpdateDiscount(item.id, item.discount_type, parseFloat(e.target.value) || 0, item.discount_reason)}
                            className="w-16 h-7 text-xs font-mono"
                            placeholder={item.discount_type === 'percent' ? '%' : '$'}
                          />
                          <Input
                            value={item.discount_reason}
                            onChange={(e) => handleUpdateDiscount(item.id, item.discount_type, item.discount_value, e.target.value)}
                            className="flex-1 h-7 text-xs"
                            placeholder="Reason..."
                          />
                        </>
                      )}
                    </div>
                    {/* Override reason if price manually changed without discount */}
                    {item.discount_type === 'none' && item.unit_price_used !== item.list_unit_price && (
                      <Input
                        value={item.price_override_reason}
                        onChange={(e) => {
                          setLineItems(lineItems.map(li => 
                            li.id === item.id ? { ...li, price_override_reason: e.target.value } : li
                          ));
                        }}
                        className="h-7 text-xs"
                        placeholder="Override reason (required)..."
                      />
                    )}
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
              Select a date to backdate this invoice when transferring old orders
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
