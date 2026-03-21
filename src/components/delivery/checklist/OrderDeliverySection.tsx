import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Package, User, Plus, Trash2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ChecklistSection } from './ChecklistSection';
import { getTasksByCategory } from '@/hooks/useDeliveryChecklist';
import { getBrandIdentity, normalizeBrandId } from '@/config/brands';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  productId: string;
  productName: string;
  brand: string;
  sku: string;
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

  // Invoice form state
  const [storeName, setStoreName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { productId: '', productName: '', brand: '', sku: '', qty: 1, unitPrice: 0 },
  ]);

  // Fetch products dynamically
  const { data: products = [] } = useQuery({
    queryKey: ['checklist-products'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, brand_id, sku, store_price')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('brand_id')
        .order('name');
      return data || [];
    },
  });

  // Fetch brands for display
  const { data: brands = [] } = useQuery({
    queryKey: ['checklist-brands'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name');
      return data || [];
    },
  });

  const brandMap = useMemo(() => {
    const m: Record<string, string> = {};
    brands.forEach((b: any) => { m[b.id] = b.name; });
    return m;
  }, [brands]);

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
    setLineItems([...lineItems, { productId: '', productName: '', brand: '', sku: '', qty: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateLineProduct = (idx: number, productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;
    const updated = [...lineItems];
    updated[idx] = {
      productId: product.id,
      productName: product.name,
      brand: brandMap[product.brand_id] || product.brand_id || '',
      sku: product.sku || '',
      qty: updated[idx].qty,
      unitPrice: product.store_price || 0,
    };
    setLineItems(updated);
  };

  const updateLineField = (idx: number, field: 'qty' | 'unitPrice', value: number) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);

  const generateInvoiceNumber = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
    return `INV-CK-${dateStr}-${seq}`;
  };

  const saveOrder = async (status: 'draft' | 'sent') => {
    const validLines = lineItems.filter(li => li.productId && li.qty > 0);
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
          subtotal,
          total: subtotal,
        })
        .select('id')
        .single();

      if (orderErr) throw orderErr;

      const lines = validLines.map(li => ({
        order_id: order.id,
        product_id: li.productId,
        product_name: li.productName,
        brand: li.brand,
        sku: li.sku,
        qty: li.qty,
        unit_price: li.unitPrice,
        line_total: li.qty * li.unitPrice,
      }));

      const { error: lineErr } = await (supabase as any)
        .from('checklist_delivery_order_lines')
        .insert(lines);
      if (lineErr) throw lineErr;

      toast.success(status === 'sent'
        ? `Invoice ${invoiceNumber} generated`
        : `Draft ${invoiceNumber} saved`
      );
      setShowInvoiceForm(false);
      setLineItems([{ productId: '', productName: '', brand: '', sku: '', qty: 1, unitPrice: 0 }]);
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
            {showInvoiceForm ? 'Hide Invoice Form' : 'Create Delivery Invoice'}
          </Button>

          {/* Inline Invoice Form */}
          {showInvoiceForm && (
            <div className="p-3 rounded-lg border border-border space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">New Delivery Invoice</h4>
              
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
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-end">
                    <div className="col-span-4">
                      {idx === 0 && <Label className="text-[9px] text-muted-foreground">Product</Label>}
                      <Select value={li.productId} onValueChange={(v) => updateLineProduct(idx, v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-[9px] text-muted-foreground">Brand</Label>}
                      <Input value={li.brand} readOnly className="h-8 text-xs bg-muted/50" />
                    </div>
                    <div className="col-span-1">
                      {idx === 0 && <Label className="text-[9px] text-muted-foreground">Qty</Label>}
                      <Input
                        type="number"
                        min={1}
                        value={li.qty}
                        onChange={(e) => updateLineField(idx, 'qty', parseInt(e.target.value) || 1)}
                        className="h-8 text-xs text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-[9px] text-muted-foreground">Price</Label>}
                      <Input
                        type="number"
                        step="0.01"
                        value={li.unitPrice}
                        onChange={(e) => updateLineField(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-[9px] text-muted-foreground">Total</Label>}
                      <Input
                        value={`$${(li.qty * li.unitPrice).toFixed(2)}`}
                        readOnly
                        className="h-8 text-xs bg-muted/50 font-medium"
                      />
                    </div>
                    <div className="col-span-1">
                      {idx === 0 && <Label className="text-[9px] invisible">X</Label>}
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeLineItem(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addLineItem}>
                  <Plus className="h-3 w-3" /> Add Line Item
                </Button>
              </div>

              {/* Totals */}
              <div className="flex justify-end pt-2 border-t border-border">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-sm font-bold text-foreground">${subtotal.toFixed(2)}</p>
                </div>
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
                  Generate Order
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </ChecklistSection>
  );
}
