/**
 * SHIPMENTS PANEL — the issuance ledger.
 *
 * HQ records what it ships to an office (materials, quantities, cost).
 * The office leader confirms receipt with actual quantities (variance).
 * The balance card shows issued − consumed = expected on hand.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useOfficeShipments,
  useCreateShipment,
  useConfirmShipmentReceipt,
  useOfficeMaterialBalance,
  OfficeShipment,
} from '@/hooks/useProductionPortal';
import { useProductionRBAC } from '@/hooks/useProductionRBAC';
import { Truck, Package, Plus, CheckCircle, AlertTriangle, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const MATERIAL_TYPES = [
  { value: 'tobacco', label: 'Tobacco' },
  { value: 'empty_tubes', label: 'Empty Tubes' },
  { value: 'stickers', label: 'Stickers' },
  { value: 'sleeves', label: 'Sleeves' },
  { value: 'empty_boxes', label: 'Empty Boxes' },
  { value: 'tools', label: 'Tools' },
  { value: 'other', label: 'Other' },
];

const BRANDS = ['gasmask', 'hotmama', 'hotscolati', 'grabba-rus'];

const MATERIAL_LABEL: Record<string, string> = {
  tobacco: 'Tobacco',
  empty_tubes: 'Tubes',
  stickers: 'Stickers',
  sleeves: 'Sleeves',
  empty_boxes: 'Boxes',
  tools: 'Tools',
  other: 'Other',
};

interface DraftItem {
  material_type: string;
  brand: string;
  quantity: string;
  unit: string;
  unit_cost: string;
}

const EMPTY_ITEM: DraftItem = { material_type: 'tobacco', brand: '', quantity: '', unit: 'lb', unit_cost: '' };

export function ShipmentsPanel({ officeId }: { officeId: string }) {
  const rbac = useProductionRBAC();
  const { data: shipments = [], isLoading } = useOfficeShipments(officeId);
  const { data: balance = [] } = useOfficeMaterialBalance(officeId);
  const createShipment = useCreateShipment();
  const confirmReceipt = useConfirmShipmentReceipt();

  const [showCreate, setShowCreate] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<OfficeShipment | null>(null);
  const [sentDate, setSentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({});
  const [receiptNotes, setReceiptNotes] = useState('');

  const canCreate = rbac.tier === 'admin';

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleCreate = async () => {
    const validItems = items
      .filter(i => parseFloat(i.quantity) > 0)
      .map(i => ({
        material_type: i.material_type as any,
        brand: i.brand || null,
        quantity: parseFloat(i.quantity),
        unit: i.unit as any,
        unit_cost: i.unit_cost ? parseFloat(i.unit_cost) : null,
        total_cost: i.unit_cost ? parseFloat(i.unit_cost) * parseFloat(i.quantity) : null,
        expected_yield_boxes: null,
      }));
    if (validItems.length === 0) return;
    await createShipment.mutateAsync({ officeId, sentDate, notes, items: validItems });
    setShowCreate(false);
    setItems([{ ...EMPTY_ITEM }]);
    setNotes('');
  };

  const handleConfirmReceipt = async (disputed: boolean) => {
    if (!receiptTarget) return;
    const qtys: Record<string, number> = {};
    for (const item of receiptTarget.items || []) {
      qtys[item.id] = parseFloat(receivedQtys[item.id] ?? String(item.quantity)) || 0;
    }
    await confirmReceipt.mutateAsync({
      shipmentId: receiptTarget.id,
      officeId,
      receivedQuantities: qtys,
      disputed,
      notes: receiptNotes || undefined,
    });
    setReceiptTarget(null);
    setReceivedQtys({});
    setReceiptNotes('');
  };

  const pendingCount = shipments.filter(s => s.status === 'sent').length;

  return (
    <div className="space-y-4">
      {/* Material Balance — issued minus consumed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Office Material Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balance.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No materials issued to this office yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">Consumed</TableHead>
                  <TableHead className="text-right">Expected On Hand</TableHead>
                  {rbac.canViewCosts && <TableHead className="text-right">Issued Cost</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.map((row, i) => (
                  <TableRow key={`${row.material_type}-${row.brand}-${i}`}>
                    <TableCell className="font-medium">
                      {MATERIAL_LABEL[row.material_type] || row.material_type}
                    </TableCell>
                    <TableCell className="capitalize">{row.brand || '—'}</TableCell>
                    <TableCell className="text-right">
                      {row.total_issued.toLocaleString()} {row.unit || ''}
                    </TableCell>
                    <TableCell className="text-right">{row.total_consumed.toLocaleString()}</TableCell>
                    <TableCell className={cn(
                      'text-right font-semibold',
                      row.expected_on_hand < 0 && 'text-destructive',
                      row.expected_on_hand === 0 && 'text-amber-600',
                    )}>
                      {row.expected_on_hand.toLocaleString()} {row.unit || ''}
                    </TableCell>
                    {rbac.canViewCosts && (
                      <TableCell className="text-right">${(row.total_issued_cost ?? 0).toFixed(2)}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Shipments list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Shipments to Office
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingCount} awaiting receipt</Badge>
            )}
          </CardTitle>
          {canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Record Shipment
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : shipments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No shipments recorded for this office.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shipments.map(shipment => {
                const hasVariance = (shipment.items || []).some(
                  i => i.received_quantity !== null && i.received_quantity !== i.quantity
                );
                return (
                  <div key={shipment.id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{format(new Date(shipment.sent_date), 'MMM d, yyyy')}</span>
                        <Badge className={cn('text-xs',
                          shipment.status === 'received' && 'bg-emerald-100 text-emerald-800',
                          shipment.status === 'sent' && 'bg-blue-100 text-blue-800',
                          shipment.status === 'disputed' && 'bg-red-100 text-red-800',
                        )}>
                          {shipment.status === 'received' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {shipment.status === 'disputed' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {shipment.status}
                        </Badge>
                        {hasVariance && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            variance
                          </Badge>
                        )}
                      </div>
                      {shipment.status === 'sent' && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setReceiptTarget(shipment);
                          const init: Record<string, string> = {};
                          (shipment.items || []).forEach(i => { init[i.id] = String(i.quantity); });
                          setReceivedQtys(init);
                        }}>
                          Confirm Receipt
                        </Button>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {(shipment.items || []).map(item => (
                        <div key={item.id} className="flex items-center gap-2">
                          <span>
                            {MATERIAL_LABEL[item.material_type] || item.material_type}
                            {item.brand && <span className="capitalize"> ({item.brand})</span>}: {item.quantity} {item.unit}
                          </span>
                          {item.received_quantity !== null && item.received_quantity !== item.quantity && (
                            <span className="text-amber-600">
                              → received {item.received_quantity} ({item.received_quantity - item.quantity > 0 ? '+' : ''}
                              {item.received_quantity - item.quantity})
                            </span>
                          )}
                        </div>
                      ))}
                      {shipment.notes && <p className="text-xs italic mt-1">{shipment.notes}</p>}
                      {shipment.received_at && (
                        <p className="text-xs">Received {format(new Date(shipment.received_at), 'MMM d, h:mm a')}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Shipment Dialog (HQ side) */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Shipment to Office</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date Sent</Label>
                <Input type="date" value={sentDate} onChange={e => setSentDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems(p => [...p, { ...EMPTY_ITEM }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-muted/30">
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Material</Label>
                    <Select value={item.material_type} onValueChange={v => updateItem(idx, { material_type: v, unit: v === 'tobacco' ? 'lb' : 'each' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MATERIAL_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Brand</Label>
                    <Select value={item.brand} onValueChange={v => updateItem(idx, { brand: v === '_none' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Any / N/A</SelectItem>
                        {BRANDS.map(b => <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min="0" step="any" value={item.quantity} onChange={e => updateItem(idx, { quantity: e.target.value })} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Select value={item.unit} onValueChange={v => updateItem(idx, { unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lb">lb</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="each">each</SelectItem>
                        <SelectItem value="roll">roll</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Unit Cost $</Label>
                    <Input type="number" min="0" step="any" value={item.unit_cost} onChange={e => updateItem(idx, { unit_cost: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Driver, tracking, special instructions..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createShipment.isPending}>
              {createShipment.isPending ? 'Recording...' : 'Record Shipment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Receipt Dialog (office leader side) */}
      <Dialog open={!!receiptTarget} onOpenChange={open => !open && setReceiptTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Receipt — {receiptTarget && format(new Date(receiptTarget.sent_date), 'MMM d, yyyy')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Enter the quantity you actually received for each item. If anything is missing or damaged, use Dispute.
            </p>
            {(receiptTarget?.items || []).map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="flex-1 text-sm">
                  {MATERIAL_LABEL[item.material_type] || item.material_type}
                  {item.brand && <span className="capitalize"> ({item.brand})</span>}
                  <span className="text-muted-foreground"> — sent {item.quantity} {item.unit}</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="w-28"
                  value={receivedQtys[item.id] ?? ''}
                  onChange={e => setReceivedQtys(p => ({ ...p, [item.id]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={receiptNotes} onChange={e => setReceiptNotes(e.target.value)} rows={2} placeholder="Missing items, damage, discrepancies..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReceiptTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleConfirmReceipt(true)} disabled={confirmReceipt.isPending}>
              Dispute
            </Button>
            <Button onClick={() => handleConfirmReceipt(false)} disabled={confirmReceipt.isPending}>
              {confirmReceipt.isPending ? 'Saving...' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
