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
  sale_channel: SaleChannel;
  sale_unit: SaleUnit;
  cost_per_unit: number;
  profit: number;
  units_per_box: number;
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

  // Fetch products by brand with all pricing fields from products_all (has street_price)
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['invoice-products-all', selectedBrandId],
    queryFn: async () => {
      if (!selectedBrandId) return [];
      const { data, error } = await supabase
        .from('products_all')
        .select('id, product_name, store_price, wholesale_price, retail_price, street_price, unit_type')
        .eq('brand_id', selectedBrandId)
        .eq('status', 'active')
        .order('product_name');
      if (error) throw error;
      // Map to expected Product interface
      return (data || []).map(p => ({
        id: p.id,
        name: p.product_name,
        sku: null, // Not available in products_all
        store_price: p.store_price,
        wholesale_price: p.wholesale_price,
        suggested_retail_price: p.retail_price,
        street_price: p.street_price,
        cost: 0, // Will be looked up separately if needed
        units_per_box: 1, // Default
        unit_type: p.unit_type,
      })) as Product[];
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

    // Get price based on selected sale channel
    const unitPrice = getPriceForChannel(product, saleChannel);
    const costPerUnit = product.cost || 0;
    const unitsPerBox = product.units_per_box || 1;
    
    // Calculate profit (INTERNAL ONLY - never shown on invoice)
    const profitPerUnit = unitPrice - costPerUnit;
    const totalProfit = profitPerUnit * quantity;

    // Check if same product with same channel already added
    const existingIndex = lineItems.findIndex(
      item => item.product_id === selectedProductId && item.sale_channel === saleChannel
    );
    
    if (existingIndex >= 0) {
      // Update quantity and recalculate totals
      const updated = [...lineItems];
      updated[existingIndex].quantity += quantity;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      updated[existingIndex].profit = (updated[existingIndex].unit_price - updated[existingIndex].cost_per_unit) * updated[existingIndex].quantity;
      setLineItems(updated);
    } else {
      // Add new line item with channel and profit data
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
          sale_channel: saleChannel,
          sale_unit: saleUnit,
          cost_per_unit: costPerUnit,
          profit: totalProfit,
          units_per_box: unitsPerBox,
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
          ? { 
              ...item, 
              quantity: newQuantity, 
              total: newQuantity * item.unit_price,
              profit: (item.unit_price - item.cost_per_unit) * newQuantity,
            }
          : item
      )
    );
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    if (newPrice < 0) return;
    setLineItems(
      lineItems.map(item =>
        item.id === id
          ? { 
              ...item, 
              unit_price: newPrice, 
              total: item.quantity * newPrice,
              profit: (newPrice - item.cost_per_unit) * item.quantity,
            }
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
            is_historical: invoiceMode === 'historical', // Track invoice mode
          })
          .select('id')
          .single();

        if (invoiceError) throw invoiceError;
        if (invoice) createdInvoices.push(invoice);

        // Create invoice line items
        if (invoice && lineItems.length > 0) {
        const lineItemsData = lineItems.map(item => ({
          invoice_id: invoice.id,
          brand_id: item.brand_id,
          brand: item.brand_name,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          // NEW: Multi-channel pricing fields
          sale_channel: item.sale_channel,
          sale_unit: item.sale_unit,
          cost_per_unit_at_sale: item.cost_per_unit,
          profit_at_sale: item.profit,
          units_per_box_snapshot: item.units_per_box,
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
      queryClient.invalidateQueries({ queryKey: ['ambassador-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-quick-stats'] });
      
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
                    className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/30 border"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: brands.find(b => b.id === item.brand_id)?.color || '#6366F1' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{item.brand_name}</p>
                          <Badge 
                            variant={item.sale_channel === 'street' ? 'default' : 'outline'} 
                            className="text-[10px] px-1.5 py-0"
                          >
                            {item.sale_channel}
                          </Badge>
                        </div>
                      </div>
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
                      <span className="text-sm font-mono font-medium flex-1 text-right">
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
