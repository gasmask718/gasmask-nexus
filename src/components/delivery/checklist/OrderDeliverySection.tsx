import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, User, Plus, Trash2, FileText, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ChecklistSection } from './ChecklistSection';
import { getTasksByCategory } from '@/hooks/useDeliveryChecklist';
import { getBrandIdentity, normalizeBrandId } from '@/config/brands';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Product price + brand maps (single source of truth) ──
const PRODUCT_PRICES: Record<string, number> = {
  'GasMask Bags': 12.99,
  'GasMask Tubes': 12.99,
  'HotMama': 9.99,
  'Grabba R Us': 8.49,
  'Hot Scolatti Light': 10.99,
  'Hot Scolatti Dark': 10.99,
  'HotScalati Bros': 1.00,
};

const PRODUCT_BRAND_MAP: Record<string, string> = {
  'GasMask Bags': 'GasMask',
  'GasMask Tubes': 'GasMask',
  'HotMama': 'Hot Mama',
  'Grabba R Us': 'Grabba R Us',
  'Hot Scolatti Light': 'HotScalati',
  'Hot Scolatti Dark': 'HotScalati',
  'HotScalati Bros': 'HotScalati',
};

interface OrderDeliverySectionProps {
  storeId: string;
  personType?: string;
  isTaskCompleted: (taskKey: string) => boolean;
  onToggleTask: (taskKey: string, completed: boolean) => void;
  progress: { done: number; total: number };
  orderData: Record<string, any>;
  onOrderUpdate: (data: Record<string, any>) => void;
}

interface PendingOrder {
  id: string;
  invoice_number: string;
  brand: string;
  total_amount: number;
  created_at: string;
}

interface LineItem {
  productName: string;
  brand: string;
  qty: number;
  unitPrice: number;
}

export function OrderDeliverySection({
  storeId,
  personType = 'drivers',
  isTaskCompleted,
  onToggleTask,
  progress,
  orderData,
  onOrderUpdate,
}: OrderDeliverySectionProps) {
  const tasks = getTasksByCategory('orders');
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [recipientName, setRecipientName] = useState(orderData.recipientName || '');
  const [loading, setLoading] = useState(true);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Invoice header state
  const [storeName, setStoreName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { productName: '', brand: '', qty: 1, unitPrice: 0 },
  ]);

  // Pull products from store_tube_intelligence (correct source)
  const { data: tubeProducts = [] } = useQuery({
    queryKey: ['checklist-invoice-products', storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('store_tube_intelligence')
        .select('id, product_name, tube_count, status, last_order_date, last_order_qty')
        .eq('store_id', storeId)
        .order('id', { ascending: true });
      return data || [];
    },
    enabled: !!storeId,
  });

  // Generate invoice number on form open
  useEffect(() => {
    if (showInvoiceForm && !invoiceNumber) {
      generateInvoiceNum();
    }
  }, [showInvoiceForm]);

  const generateInvoiceNum = async () => {
    const { count } = await (supabase as any)
      .from('checklist_delivery_orders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId);
    const seq = String((count || 0) + 1).padStart(4, '0');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setInvoiceNumber(`INV-GM-${dateStr}-${seq}`);
  };

  useEffect(() => {
    async function fetchPendingOrders() {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, brand, total_amount, created_at')
        .eq('store_id', storeId)
        .in('payment_status', ['unpaid', 'partial'])
        .order('created_at', { ascending: false })
        .limit(10);
      setOrders(data || []);
      setLoading(false);
    }
    fetchPendingOrders();
  }, [storeId]);

  // ── Line item helpers ──
  const addLineItem = () => {
    setLineItems([...lineItems, { productName: '', brand: '', qty: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateLineProduct = (idx: number, productName: string) => {
    const updated = [...lineItems];
    updated[idx] = {
      productName,
      brand: PRODUCT_BRAND_MAP[productName] || '',
      qty: updated[idx].qty || 1,
      unitPrice: PRODUCT_PRICES[productName] ?? 0,
    };
    setLineItems(updated);
  };

  const updateLineQty = (idx: number, qty: number) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], qty: Math.max(1, qty) };
    setLineItems(updated);
  };

  const updateLinePrice = (idx: number, price: number) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], unitPrice: price };
    setLineItems(updated);
  };

  // ── Totals ──
  const subtotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + li.qty * li.unitPrice, 0),
    [lineItems]
  );

  // ── Save ──
  const saveOrder = async (status: 'draft' | 'sent') => {
    const validLines = lineItems.filter(li => li.productName && li.qty > 0);
    if (!validLines.length) {
      toast.error('Add at least one line item with a product');
      return;
    }
    setSaving(true);
    try {
      const { data: order, error: orderErr } = await (supabase as any)
        .from('checklist_delivery_orders')
        .insert({
          store_id: storeId,
          person_type: personType,
          delivering_to_store: storeName,
          invoice_number: invoiceNumber,
          delivery_date: invoiceDate,
          payment_terms: paymentTerms,
          status,
          subtotal: subtotal,
          total: subtotal,
        })
        .select('id')
        .single();
      if (orderErr) throw orderErr;

      const lines = validLines.map(li => ({
        order_id: order.id,
        product_name: li.productName,
        brand: li.brand,
        qty: li.qty,
        unit_price: li.unitPrice,
      }));
      const { error: lineErr } = await (supabase as any)
        .from('checklist_delivery_order_lines')
        .insert(lines);
      if (lineErr) throw lineErr;

      // If sent, sync tube counts back to store_tube_intelligence
      if (status === 'sent') {
        for (const li of validLines) {
          const product = tubeProducts.find((p: any) => p.product_name === li.productName);
          if (product) {
            await (supabase as any)
              .from('store_tube_intelligence')
              .update({
                tube_count: (product.tube_count || 0) + li.qty,
                last_order_date: new Date().toISOString().split('T')[0],
                last_order_qty: li.qty,
                updated_at: new Date().toISOString(),
              })
              .eq('id', product.id);
          }
        }
      }

      toast.success(status === 'sent'
        ? `Invoice ${invoiceNumber} generated`
        : `Draft ${invoiceNumber} saved`
      );
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowInvoiceForm(false);
    setLineItems([{ productName: '', brand: '', qty: 1, unitPrice: 0 }]);
    setStoreName('');
    setInvoiceNumber('');
  };

  const handleRecipientChange = (value: string) => {
    setRecipientName(value);
    onOrderUpdate({ ...orderData, recipientName: value });
  };

  return (
    <ChecklistSection
      title={`Orders to Deliver ${orders.length > 0 ? `(${orders.length})` : ''}`}
      icon={<Package className="h-5 w-5" />}
      category="orders"
      tasks={tasks}
      progress={progress}
      isTaskCompleted={isTaskCompleted}
      onToggleTask={onToggleTask}
      accentColor="text-blue-500"
    >
      {loading ? (
        <div className="animate-pulse h-12 bg-muted rounded" />
      ) : (
        <div className="space-y-3">
          {/* Existing pending orders */}
          {orders.length > 0 && orders.map((order) => {
            const brandId = normalizeBrandId(order.brand);
            const brand = brandId ? getBrandIdentity(brandId) : null;
            return (
              <div key={order.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  {brand && <span className="text-sm">{brand.icon}</span>}
                  <div>
                    <p className="text-sm font-medium">{order.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{brand?.displayName || order.brand}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">${(order.total_amount ?? 0).toFixed(2)}</Badge>
              </div>
            );
          })}

          {orders.length === 0 && !showInvoiceForm && (
            <p className="text-sm text-muted-foreground italic">No pending orders for this store</p>
          )}

          {/* Recipient */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Received by (name & role)"
              value={recipientName}
              onChange={(e) => handleRecipientChange(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Toggle */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowInvoiceForm(!showInvoiceForm)}
          >
            <FileText className="h-3 w-3" />
            {showInvoiceForm ? 'Hide Invoice Form' : 'Create Invoice'}
          </Button>

          {/* ═══ INVOICE FORM ═══ */}
          {showInvoiceForm && (
            <div className="p-4 rounded-lg border border-border space-y-4">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5" /> New Invoice
              </h4>

              {/* Header fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Store Name</Label>
                  <Input
                    placeholder="Delivering to store..."
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Invoice #</Label>
                  <Input value={invoiceNumber} readOnly className="h-8 text-sm bg-muted/50" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                      <SelectItem value="COD">COD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Line Items Table ── */}
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Line Items</Label>

                {/* Column headers */}
                <div className="grid grid-cols-12 gap-1.5 px-1">
                  <span className="col-span-4 text-[9px] text-muted-foreground font-medium">Product</span>
                  <span className="col-span-2 text-[9px] text-muted-foreground font-medium">Brand</span>
                  <span className="col-span-1 text-[9px] text-muted-foreground font-medium text-center">Qty</span>
                  <span className="col-span-2 text-[9px] text-muted-foreground font-medium text-right">Unit Price</span>
                  <span className="col-span-2 text-[9px] text-muted-foreground font-medium text-right">Total</span>
                  <span className="col-span-1" />
                </div>

                {lineItems.map((li, idx) => {
                  const lineTotal = li.qty * li.unitPrice;
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                      {/* Product */}
                      <div className="col-span-4">
                        <Select value={li.productName} onValueChange={(v) => updateLineProduct(idx, v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tubeProducts.map((p: any) => (
                              <SelectItem key={p.id} value={p.product_name}>
                                {p.product_name}
                                {p.product_name === 'HotScalati Bros' && ' ✨'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Brand (auto-filled, read-only) */}
                      <div className="col-span-2">
                        <Input value={li.brand} readOnly className="h-8 text-xs bg-muted/50" />
                      </div>
                      {/* Qty */}
                      <div className="col-span-1">
                        <Input
                          type="number"
                          min={1}
                          value={li.qty}
                          onChange={(e) => updateLineQty(idx, parseInt(e.target.value) || 1)}
                          className="h-8 text-xs text-center"
                        />
                      </div>
                      {/* Unit Price */}
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={li.unitPrice}
                          onChange={(e) => updateLinePrice(idx, parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs text-right"
                        />
                      </div>
                      {/* Line Total */}
                      <div className="col-span-2 text-right">
                        <span className="text-xs font-medium text-foreground">${lineTotal.toFixed(2)}</span>
                      </div>
                      {/* Remove */}
                      <div className="col-span-1 flex justify-center">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeLineItem(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addLineItem}>
                  <Plus className="h-3 w-3" /> Add Line Item
                </Button>
              </div>

              {/* ── Totals ── */}
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-foreground text-base">${subtotal.toFixed(2)}</span>
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => saveOrder('draft')}
                  disabled={saving}
                >
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => saveOrder('sent')}
                  disabled={saving}
                >
                  Generate Invoice
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </ChecklistSection>
  );
}
