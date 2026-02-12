import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductOption {
  id: string;
  name: string;
  track_by: string | null;
  pack_size: number;
  packs_per_box: number | null;
  units_per_box: number | null;
  cost: number | null;
}

interface POLineItem {
  product_id: string;
  product: ProductOption;
  order_unit: 'unit' | 'pack' | 'box';
  quantity: number;
  unit_cost: number;
  computed_units: number;
}

function computeUnits(qty: number, unit: string, p: ProductOption): number {
  if (unit === 'unit') return qty;
  if (unit === 'pack') return qty * (p.pack_size || 1);
  if (unit === 'box') {
    if (p.packs_per_box) return qty * p.packs_per_box * (p.pack_size || 1);
    return qty * (p.units_per_box || 1);
  }
  return qty;
}

export function CreatePurchaseOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [items, setItems] = useState<POLineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const { data: products } = useQuery({
    queryKey: ['products-for-po'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, track_by, pack_size, packs_per_box, units_per_box, cost')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      return data as ProductOption[];
    },
    enabled: open,
  });

  const createPO = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create PO
      const totalCost = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
      const poNumber = 'PO-' + Date.now().toString(36).toUpperCase();
      
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_name: supplierName,
          status: 'draft',
          total_cost: totalCost,
          estimated_arrival: expectedAt || null,
          notes,
          created_by: user?.id,
          products: items.map(i => ({ product_id: i.product_id, name: i.product.name, qty: i.quantity, unit_cost: i.unit_cost })) as any,
        })
        .select()
        .single();
      if (poErr) throw poErr;

      // Create PO items with snapshots
      const poItems = items.map(i => ({
        purchase_order_id: po.id,
        product_id: i.product_id,
        product_name_snapshot: i.product.name,
        track_by_snapshot: i.product.track_by || 'none',
        pack_size_snapshot: i.product.pack_size || 1,
        packs_per_box_snapshot: i.product.packs_per_box,
        units_per_box_snapshot: i.product.units_per_box,
        order_unit: i.order_unit,
        quantity_ordered: i.quantity,
        unit_cost: i.unit_cost,
        computed_units_total: i.computed_units,
      }));

      const { error: itemsErr } = await supabase.from('purchase_order_items').insert(poItems);
      if (itemsErr) throw itemsErr;

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stats'] });
      toast.success('Purchase order created');
      resetAndClose();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const addItem = () => {
    const product = products?.find(p => p.id === selectedProductId);
    if (!product) return;
    if (items.some(i => i.product_id === product.id)) {
      toast.error('Product already added');
      return;
    }
    const defaultUnit = product.units_per_box || product.packs_per_box ? 'box' : 'unit';
    const qty = 1;
    setItems([...items, {
      product_id: product.id,
      product,
      order_unit: defaultUnit,
      quantity: qty,
      unit_cost: product.cost || 0,
      computed_units: computeUnits(qty, defaultUnit, product),
    }]);
    setSelectedProductId('');
  };

  const updateItem = (idx: number, updates: Partial<POLineItem>) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, ...updates };
      updated.computed_units = computeUnits(updated.quantity, updated.order_unit, updated.product);
      return updated;
    }));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const resetAndClose = () => {
    setSupplierName('');
    setNotes('');
    setExpectedAt('');
    setItems([]);
    setSelectedProductId('');
    onClose();
  };

  const trackByLabel = (tb: string | null) => tb === 'tubes' ? 'tubes' : tb === 'bags' ? 'bags' : 'units';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Supplier Name</Label>
              <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Supplier name" />
            </div>
            <div>
              <Label>Expected Arrival</Label>
              <Input type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>

          {/* Add Product */}
          <div className="border-t pt-4">
            <Label className="text-sm font-semibold">Line Items</Label>
            <div className="flex gap-2 mt-2">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent>
                  {products?.filter(p => !items.some(i => i.product_id === p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.track_by && <span className="text-muted-foreground ml-1">({p.track_by})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addItem} disabled={!selectedProductId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.product_id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{item.product.name}</span>
                      <Badge variant="outline" className="text-xs">{item.product.track_by || 'none'}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Order Unit</Label>
                      <Select value={item.order_unit} onValueChange={(v) => updateItem(idx, { order_unit: v as any })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unit">🧪 Unit</SelectItem>
                          {(item.product.pack_size || 1) > 1 && <SelectItem value="pack">🧩 Pack</SelectItem>}
                          {(item.product.packs_per_box || item.product.units_per_box) && <SelectItem value="box">📦 Box</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" min={1} className="h-8 text-xs" value={item.quantity}
                        onChange={e => updateItem(idx, { quantity: Number(e.target.value) || 1 })} />
                    </div>
                    <div>
                      <Label className="text-xs">Unit Cost ($)</Label>
                      <Input type="number" min={0} step={0.01} className="h-8 text-xs" value={item.unit_cost}
                        onChange={e => updateItem(idx, { unit_cost: Number(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    = <span className="font-mono font-semibold text-foreground">{item.computed_units}</span> {trackByLabel(item.product.track_by)} • Line total: ${(item.quantity * item.unit_cost).toFixed(2)}
                  </div>
                </div>
              ))}
              <div className="text-right text-sm font-semibold border-t pt-2">
                Total: ${items.reduce((s, i) => s + i.quantity * i.unit_cost, 0).toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
          <Button onClick={() => createPO.mutate()} disabled={!supplierName || items.length === 0 || createPO.isPending}>
            {createPO.isPending ? 'Creating...' : 'Create PO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
