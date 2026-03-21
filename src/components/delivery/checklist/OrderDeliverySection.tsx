import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, User, Plus, Trash2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ChecklistSection } from './ChecklistSection';
import { getTasksByCategory } from '@/hooks/useDeliveryChecklist';
import { getBrandIdentity, normalizeBrandId } from '@/config/brands';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

interface TubeProduct {
  id: string;
  brand_name: string;
  brand_id: string;
  current_tubes_left: number | null;
  last_order_date: string | null;
  needs_order: boolean;
}

interface LineItem {
  productName: string;
  brand: string;
  currentTubes: number;
  lastOrderDate: string | null;
  qtyToDeliver: number;
  notes: string;
}

function formatLastOrder(date: string | null): string {
  if (!date) return 'Never ordered';
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return `${format(d, 'MMM d')} · ${days}d ago`;
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

  // Invoice form state
  const [storeName, setStoreName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { productName: '', brand: '', currentTubes: 0, lastOrderDate: null, qtyToDeliver: 1, notes: '' },
  ]);

  // Fetch products from store_tube_inventory_status (correct source)
  const { data: tubeProducts = [] } = useQuery({
    queryKey: ['delivery-tube-products', storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_tube_inventory_status')
        .select('id, brand_name, brand_id, current_tubes_left, last_order_date, needs_order')
        .eq('store_id', storeId)
        .eq('is_simulation', false)
        .order('brand_name');
      return (data || []) as TubeProduct[];
    },
    enabled: !!storeId,
  });

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

  const handleRecipientChange = (value: string) => {
    setRecipientName(value);
    onOrderUpdate({ ...orderData, recipientName: value });
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { productName: '', brand: '', currentTubes: 0, lastOrderDate: null, qtyToDeliver: 1, notes: '' }]);
  };

  const removeLineItem = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateLineProduct = (idx: number, productName: string) => {
    const product = tubeProducts.find(p => p.brand_name === productName);
    if (!product) return;
    const updated = [...lineItems];
    updated[idx] = {
      productName: product.brand_name,
      brand: product.brand_id,
      currentTubes: product.current_tubes_left || 0,
      lastOrderDate: product.last_order_date,
      qtyToDeliver: updated[idx].qtyToDeliver,
      notes: updated[idx].notes,
    };
    setLineItems(updated);
  };

  const updateLineField = (idx: number, field: 'qtyToDeliver', value: number) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setLineItems(updated);
  };

  const updateLineNotes = (idx: number, value: string) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], notes: value };
    setLineItems(updated);
  };

  const generateInvoiceNumber = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
    return `INV-CK-${dateStr}-${seq}`;
  };

  const saveOrder = async (status: 'draft' | 'sent') => {
    const validLines = lineItems.filter(li => li.productName && li.qtyToDeliver > 0);
    if (!validLines.length) {
      toast.error('Add at least one line item');
      return;
    }
    setSaving(true);
    try {
      const invoiceNumber = generateInvoiceNumber();
      const { data: order, error: orderErr } = await (supabase as any)
        .from('checklist_delivery_orders')
        .insert({
          store_id: storeId,
          person_type: personType,
          delivering_to_store: storeName,
          invoice_number: invoiceNumber,
          delivery_date: deliveryDate,
          payment_terms: paymentTerms,
          status,
          subtotal: 0,
          total: 0,
        })
        .select('id')
        .single();

      if (orderErr) throw orderErr;

      // Save line items
      const lines = validLines.map(li => ({
        order_id: order.id,
        product_name: li.productName,
        brand: li.brand,
        sku: '',
        qty: li.qtyToDeliver,
        unit_price: 0,
        line_total: 0,
      }));

      const { error: lineErr } = await (supabase as any)
        .from('checklist_delivery_order_lines')
        .insert(lines);
      if (lineErr) throw lineErr;

      // If status = 'sent', sync tube counts back to store_tube_inventory_status
      if (status === 'sent') {
        for (const li of validLines) {
          const product = tubeProducts.find(p => p.brand_name === li.productName);
          if (product) {
            const newCount = (product.current_tubes_left || 0) + li.qtyToDeliver;
            await supabase
              .from('store_tube_inventory_status')
              .update({
                current_tubes_left: newCount,
                last_order_date: new Date().toISOString().split('T')[0],
                last_updated_at: new Date().toISOString(),
              })
              .eq('id', product.id);
          }
        }
      }

      toast.success(status === 'sent'
        ? `Order ${invoiceNumber} generated & tube counts updated`
        : `Draft ${invoiceNumber} saved`
      );
      setShowInvoiceForm(false);
      setLineItems([{ productName: '', brand: '', currentTubes: 0, lastOrderDate: null, qtyToDeliver: 1, notes: '' }]);
      setStoreName('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
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
                    <p className="text-xs text-muted-foreground">
                      {brand?.displayName || order.brand}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  ${(order.total_amount ?? 0).toFixed(2)}
                </Badge>
              </div>
            );
          })}

          {orders.length === 0 && !showInvoiceForm && (
            <p className="text-sm text-muted-foreground italic">No pending orders for this store</p>
          )}

          {/* Recipient capture */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Received by (name & role)"
              value={recipientName}
              onChange={(e) => handleRecipientChange(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Toggle invoice form */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowInvoiceForm(!showInvoiceForm)}
          >
            <FileText className="h-3 w-3" />
            {showInvoiceForm ? 'Hide Delivery Form' : 'Create Delivery Order'}
          </Button>

          {/* Inline Delivery Form */}
          {showInvoiceForm && (
            <div className="p-3 rounded-lg border border-border space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">New Delivery Order</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Delivering To</Label>
                  <Input
                    placeholder="Store name"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Delivery Date</Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
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

              {/* Line Items */}
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase">Line Items</Label>
                {lineItems.map((li, idx) => (
                  <div key={idx} className="rounded-lg border border-border/50 p-2 space-y-1.5">
                    <div className="grid grid-cols-12 gap-1.5 items-end">
                      <div className="col-span-5">
                        {idx === 0 && <Label className="text-[9px] text-muted-foreground">Product</Label>}
                        <Select value={li.productName} onValueChange={(v) => updateLineProduct(idx, v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select product..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tubeProducts.map((p) => (
                              <SelectItem key={p.id} value={p.brand_name}>
                                {p.brand_name}
                                {p.needs_order && ' ⚠️'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-[9px] text-muted-foreground">Current</Label>}
                        <Input value={li.currentTubes} readOnly className="h-8 text-xs bg-muted/50 text-center" />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-[9px] text-muted-foreground">Qty</Label>}
                        <Input
                          type="number"
                          min={0}
                          value={li.qtyToDeliver}
                          onChange={(e) => updateLineField(idx, 'qtyToDeliver', parseInt(e.target.value) || 0)}
                          className="h-8 text-xs text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-[9px] text-muted-foreground">Last Order</Label>}
                        <div className="h-8 flex items-center text-[10px] text-muted-foreground truncate">
                          {formatLastOrder(li.lastOrderDate)}
                        </div>
                      </div>
                      <div className="col-span-1">
                        {idx === 0 && <Label className="text-[9px] invisible">X</Label>}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeLineItem(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {li.productName && (
                      <Input
                        value={li.notes}
                        onChange={(e) => updateLineNotes(idx, e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Notes for this item..."
                      />
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addLineItem}>
                  <Plus className="h-3 w-3" /> Add Line Item
                </Button>
              </div>

              {/* Actions */}
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
                  Generate & Deliver
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </ChecklistSection>
  );
}
