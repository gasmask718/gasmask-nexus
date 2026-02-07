/**
 * Create Order for Ambassador Modal
 * Admin/VA wizard to create purchases on ambassador's behalf
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Minus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { useCreateAmbassadorPurchase } from '@/hooks/useAmbassadorPurchases';

interface CreateAmbassadorOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedAmbassadorUserId?: string;
  preselectedAmbassadorId?: string;
  preselectedAmbassadorName?: string;
  onSuccess?: () => void;
}

interface LineItem {
  product_id?: string;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
}

export function CreateAmbassadorOrderModal({
  open,
  onOpenChange,
  preselectedAmbassadorUserId,
  preselectedAmbassadorId,
  preselectedAmbassadorName,
  onSuccess,
}: CreateAmbassadorOrderModalProps) {
  const [step, setStep] = useState(1);
  const [selectedAmbassadorUserId, setSelectedAmbassadorUserId] = useState(preselectedAmbassadorUserId || '');
  const [selectedAmbassadorId, setSelectedAmbassadorId] = useState(preselectedAmbassadorId || '');
  const [selectedAmbassadorName, setSelectedAmbassadorName] = useState(preselectedAmbassadorName || '');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [orderStatus, setOrderStatus] = useState('draft');

  const createMutation = useCreateAmbassadorPurchase();

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedAmbassadorUserId(preselectedAmbassadorUserId || '');
      setSelectedAmbassadorId(preselectedAmbassadorId || '');
      setSelectedAmbassadorName(preselectedAmbassadorName || '');
      setLineItems([]);
      setNotes('');
      setDiscount(0);
      setOrderStatus('draft');
      setStep(preselectedAmbassadorUserId ? 2 : 1);
    }
  }, [open, preselectedAmbassadorUserId, preselectedAmbassadorId, preselectedAmbassadorName]);

  // Fetch ambassadors for step 1
  const { data: ambassadors = [] } = useQuery({
    queryKey: ['ambassador-list-for-order'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, user_id, name, tracking_code, profiles:user_id (name, email)')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !preselectedAmbassadorUserId,
  });

  // Fetch products for step 2
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-ambassador-order', productSearch],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, wholesale_price, suggested_retail_price, store_price, sku, category, unit_type')
        .eq('is_active', true)
        .order('name');

      if (productSearch) {
        query = query.ilike('name', `%${productSearch}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: open && step >= 2,
  });

  const addProduct = (product: any) => {
    const existingIdx = lineItems.findIndex(li => li.product_id === product.id);
    if (existingIdx >= 0) {
      const updated = [...lineItems];
      updated[existingIdx].quantity += 1;
      setLineItems(updated);
    } else {
      setLineItems([
        ...lineItems,
        {
          product_id: product.id,
          product_name_snapshot: product.name,
          unit_price_snapshot: Number(product.wholesale_price || product.store_price || 0),
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (idx: number, delta: number) => {
    const updated = [...lineItems];
    updated[idx].quantity = Math.max(1, updated[idx].quantity + delta);
    setLineItems(updated);
  };

  const removeItem = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const subtotal = lineItems.reduce((sum, li) => sum + li.unit_price_snapshot * li.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const handleSelectAmbassador = (amb: any) => {
    setSelectedAmbassadorUserId(amb.user_id);
    setSelectedAmbassadorId(amb.id);
    setSelectedAmbassadorName(amb.name || amb.profiles?.name || 'Ambassador');
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedAmbassadorUserId || lineItems.length === 0) return;

    await createMutation.mutateAsync({
      ambassador_user_id: selectedAmbassadorUserId,
      ambassador_id: selectedAmbassadorId || undefined,
      order_source: 'admin_backoffice',
      status: orderStatus,
      notes: notes || undefined,
      items: lineItems,
      discount_total: discount,
    });

    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Create Order for Ambassador
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Step 1: Select Ambassador'}
            {step === 2 && `Step 2: Add Products for ${selectedAmbassadorName}`}
            {step === 3 && 'Step 3: Review & Confirm'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {/* Step 1: Select Ambassador */}
          {step === 1 && (
            <div className="space-y-3">
              {ambassadors.map((amb: any) => (
                <div
                  key={amb.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleSelectAmbassador(amb)}
                >
                  <div>
                    <p className="font-medium">{amb.name || amb.profiles?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{amb.profiles?.email}</p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">{amb.tracking_code}</Badge>
                </div>
              ))}
              {ambassadors.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No active ambassadors found</p>
              )}
            </div>
          )}

          {/* Step 2: Add Products */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Product Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Product List */}
              <div className="grid gap-2 max-h-[200px] overflow-y-auto">
                {products.map((product: any) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 cursor-pointer"
                    onClick={() => addProduct(product)}
                  >
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku} · {product.category || product.unit_type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        ${Number(product.wholesale_price || product.store_price || 0).toFixed(2)}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Cart */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Order Items ({lineItems.length})</h4>
                {lineItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Click products above to add them
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.product_name_snapshot}</p>
                          <p className="text-xs text-muted-foreground">
                            ${item.unit_price_snapshot.toFixed(2)} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(idx, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-mono">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(idx, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <span className="w-20 text-right font-semibold text-sm">
                            ${(item.unit_price_snapshot * item.quantity).toFixed(2)}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-sm text-muted-foreground">Ambassador</p>
                <p className="font-semibold">{selectedAmbassadorName}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Items</h4>
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1 text-sm">
                    <span>{item.quantity}× {item.product_name_snapshot}</span>
                    <span className="font-semibold">${(item.unit_price_snapshot * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>Discount</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <Label>Discount Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Order Status</Label>
                  <Select value={orderStatus} onValueChange={setOrderStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="paid">Paid (mark paid now)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes about this order..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && !preselectedAmbassadorUserId && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step > 2 && preselectedAmbassadorUserId && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={lineItems.length === 0}>
                Review Order ({lineItems.length} items)
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                ) : (
                  `Create Order · $${total.toFixed(2)}`
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
