import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Package, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface POItem {
  id: string;
  product_id: string | null;
  product_name_snapshot: string | null;
  track_by_snapshot: string | null;
  pack_size_snapshot: number | null;
  packs_per_box_snapshot: number | null;
  units_per_box_snapshot: number | null;
  order_unit: string | null;
  quantity_ordered: number;
  quantity_received: number | null;
  computed_units_total: number | null;
}

interface ReceiveLine {
  po_item: POItem;
  receive_unit: 'unit' | 'pack' | 'box';
  quantity: number;
  computed_units: number;
}

function computeUnits(qty: number, unit: string, item: POItem): number {
  const ps = item.pack_size_snapshot || 1;
  const ppb = item.packs_per_box_snapshot;
  const upb = item.units_per_box_snapshot;
  if (unit === 'unit') return qty;
  if (unit === 'pack') return qty * ps;
  if (unit === 'box') return ppb ? qty * ppb * ps : qty * (upb || 1);
  return qty;
}

export function ReceiveStockModal({ open, onClose, poId, poNumber }: { open: boolean; onClose: () => void; poId: string; poNumber: string }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: poItems, isLoading } = useQuery({
    queryKey: ['po-items-receive', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', poId)
        .order('created_at');
      if (error) throw error;
      return data as POItem[];
    },
    enabled: open && !!poId,
  });

  // Initialize lines when items load
  if (poItems && !initialized) {
    setLines(poItems.map(item => {
      const remaining = item.quantity_ordered - (item.quantity_received || 0);
      const receiveUnit = (item.order_unit || 'unit') as 'unit' | 'pack' | 'box';
      return {
        po_item: item,
        receive_unit: receiveUnit,
        quantity: Math.max(0, remaining),
        computed_units: computeUnits(Math.max(0, remaining), receiveUnit, item),
      };
    }));
    setInitialized(true);
  }

  const updateLine = (idx: number, updates: Partial<ReceiveLine>) => {
    setLines(prev => prev.map((line, i) => {
      if (i !== idx) return line;
      const updated = { ...line, ...updates };
      updated.computed_units = computeUnits(updated.quantity, updated.receive_unit, updated.po_item);
      return updated;
    }));
  };

  const receive = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const validLines = lines.filter(l => l.quantity > 0);
      if (validLines.length === 0) throw new Error('No items to receive');

      const payload = validLines.map(l => ({
        po_item_id: l.po_item.id,
        product_id: l.po_item.product_id,
        product_name: l.po_item.product_name_snapshot,
        track_by: l.po_item.track_by_snapshot || 'none',
        receive_unit: l.receive_unit,
        quantity: l.quantity,
        pack_size: l.po_item.pack_size_snapshot || 1,
        packs_per_box: l.po_item.packs_per_box_snapshot,
        units_per_box: l.po_item.units_per_box_snapshot,
      }));

      const { data, error } = await supabase.rpc('receive_purchase_order', {
        p_po_id: poId,
        p_items: payload,
        p_notes: notes || null,
        p_user_id: user?.id || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-items-receive'] });
      queryClient.invalidateQueries({ queryKey: ['store-inventory-on-hand'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stats'] });
      toast.success(`Received ${data?.items_received || 0} items (${data?.total_canonical_units || 0} units)`);
      handleClose();
    },
    onError: (e) => toast.error(`Receive failed: ${e.message}`),
  });

  const handleClose = () => {
    setNotes('');
    setLines([]);
    setInitialized(false);
    onClose();
  };

  const trackByLabel = (tb: string | null) => tb === 'tubes' ? 'tubes' : tb === 'bags' ? 'bags' : 'units';
  const totalUnits = lines.reduce((s, l) => s + l.computed_units, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Receive Stock — {poNumber}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading PO items...</div>
        ) : (
          <div className="space-y-4">
            {lines.map((line, idx) => {
              const remaining = line.po_item.quantity_ordered - (line.po_item.quantity_received || 0);
              const fullyReceived = remaining <= 0;
              return (
                <div key={line.po_item.id} className={`border rounded-lg p-3 space-y-2 ${fullyReceived ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{line.po_item.product_name_snapshot}</span>
                      <Badge variant="outline" className="text-xs">{line.po_item.track_by_snapshot || 'none'}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Ordered: {line.po_item.quantity_ordered} • Received: {line.po_item.quantity_received || 0}
                    </span>
                  </div>
                  {!fullyReceived && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Receive Unit</Label>
                          <Select value={line.receive_unit} onValueChange={(v) => updateLine(idx, { receive_unit: v as any })}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unit">🧪 Unit</SelectItem>
                              {(line.po_item.pack_size_snapshot || 1) > 1 && <SelectItem value="pack">🧩 Pack</SelectItem>}
                              {(line.po_item.packs_per_box_snapshot || line.po_item.units_per_box_snapshot) && <SelectItem value="box">📦 Box</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Quantity</Label>
                          <Input type="number" min={0} className="h-8 text-xs" value={line.quantity}
                            onChange={e => updateLine(idx, { quantity: Number(e.target.value) || 0 })} />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        = <span className="font-mono font-semibold text-foreground">{line.computed_units}</span> {trackByLabel(line.po_item.track_by_snapshot)}
                      </div>
                    </>
                  )}
                  {fullyReceived && (
                    <div className="text-xs text-green-600 font-medium">✅ Fully received</div>
                  )}
                </div>
              );
            })}

            <div>
              <Label>Receipt Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional receiving notes..." rows={2} />
            </div>

            <div className="border-t pt-2 text-sm font-semibold text-right">
              Total inbound: <span className="font-mono">{totalUnits}</span> canonical units
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={() => receive.mutate()} disabled={receive.isPending || totalUnits === 0}>
            {receive.isPending ? 'Receiving...' : `Receive ${totalUnits} Units`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
