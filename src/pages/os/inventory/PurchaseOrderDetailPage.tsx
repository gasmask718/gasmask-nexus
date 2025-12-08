// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER DETAIL PAGE — View & manage individual purchase order
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  ArrowLeft,
  Truck,
  Warehouse,
  Calendar,
  Loader2,
  Edit,
  Check,
  X,
  Package,
  DollarSign,
  Clock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  placed: { label: 'Placed', variant: 'outline' },
  paid: { label: 'Paid', variant: 'default' },
  shipped: { label: 'Shipped', variant: 'default' },
  in_transit: { label: 'In Transit', variant: 'default' },
  arrived: { label: 'Arrived', variant: 'default' },
  received: { label: 'Received', variant: 'default' },
  closed: { label: 'Closed', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

const statusFlow = ['draft', 'placed', 'paid', 'in_transit', 'arrived', 'received', 'closed'];

export default function PurchaseOrderDetailPage() {
  const { poId } = useParams();
  const queryClient = useQueryClient();
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveItemId, setReceiveItemId] = useState<string | null>(null);
  const [receiveQuantity, setReceiveQuantity] = useState('');

  // Fetch purchase order
  const { data: po, isLoading } = useQuery({
    queryKey: ['inventory-purchase-order', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(id, name, contact_name, contact_email, contact_phone)
        `)
        .eq('id', poId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!poId,
  });

  // Fetch PO items
  const { data: poItems } = useQuery({
    queryKey: ['purchase-order-items', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('purchase_order_id', poId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!poId,
  });

  // Fetch warehouse
  const { data: warehouse } = useQuery({
    queryKey: ['warehouse-for-po', po?.target_warehouse_id],
    queryFn: async () => {
      if (!po?.target_warehouse_id) return null;
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, code, city, state')
        .eq('id', po.target_warehouse_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!po?.target_warehouse_id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', poId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-purchase-order', poId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-purchase-orders'] });
      toast.success('Status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  // Receive items mutation
  const receiveItemMutation = useMutation({
    mutationFn: async ({ itemId, qty }: { itemId: string; qty: number }) => {
      const item = poItems?.find((i) => i.id === itemId);
      if (!item) throw new Error('Item not found');
      if (!item.product_id) throw new Error('Item has no product linked');

      const newReceivedQty = (item.quantity_received || 0) + qty;

      // Update PO item received quantity
      const { error } = await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: newReceivedQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      // Apply inventory movement - increment stock at warehouse
      const warehouseId = po?.target_warehouse_id;
      if (warehouseId && item.product_id) {
        const { applyInventoryMovement } = await import('@/lib/inventory/applyInventoryMovement');
        const result = await applyInventoryMovement({
          product_id: item.product_id,
          warehouse_id: warehouseId,
          quantity_change: qty,
          movement_type: 'PO_RECEIPT',
          reason: `Received from PO ${po?.id?.slice(0, 8).toUpperCase()}`,
          reference_type: 'purchase_order',
          reference_id: po?.id,
        });

        if (!result.success) {
          console.error('Failed to update inventory:', result.error);
          // Don't throw - PO item was updated, just log the inventory error
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order-items', poId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      setReceiveModalOpen(false);
      setReceiveItemId(null);
      setReceiveQuantity('');
      toast.success('Items received and stock updated');

      // Check if all items are fully received
      const allReceived = poItems?.every(
        (item) => (item.quantity_received || 0) >= item.quantity_ordered
      );
      if (allReceived) {
        updateStatusMutation.mutate('received');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to receive items: ${error.message}`);
    },
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPONumber = (id: string) => {
    return `PO-${id.slice(0, 8).toUpperCase()}`;
  };

  const getNextStatus = () => {
    if (!po?.status) return null;
    const currentIndex = statusFlow.indexOf(po.status);
    if (currentIndex === -1 || currentIndex >= statusFlow.length - 1) return null;
    return statusFlow[currentIndex + 1];
  };

  const openReceiveModal = (itemId: string) => {
    setReceiveItemId(itemId);
    setReceiveQuantity('');
    setReceiveModalOpen(true);
  };

  const handleReceive = () => {
    if (!receiveItemId || !receiveQuantity) return;
    const qty = parseInt(receiveQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    receiveItemMutation.mutate({ itemId: receiveItemId, qty });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Purchase Order Not Found</h2>
          <Button asChild variant="outline">
            <Link to="/os/inventory/purchase-orders">Back to Purchase Orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[po.status || 'draft'] || statusConfig.draft;
  const nextStatus = getNextStatus();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/os/inventory/purchase-orders">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground font-mono">
                  {formatPONumber(po.id)}
                </h1>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground mt-1">
                <div className="flex items-center gap-1">
                  <Truck className="h-4 w-4" />
                  {(po.supplier as any)?.name || 'Unknown Supplier'}
                </div>
                <div className="flex items-center gap-1">
                  <Warehouse className="h-4 w-4" />
                  {warehouse?.name || po.warehouse_location || 'No Warehouse'}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {po.status !== 'cancelled' && po.status !== 'closed' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => updateStatusMutation.mutate('cancelled')}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel PO
              </Button>
            )}
            {nextStatus && (
              <Button onClick={() => updateStatusMutation.mutate(nextStatus)}>
                <Check className="h-4 w-4 mr-2" />
                Mark as {statusConfig[nextStatus]?.label}
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-xl font-bold font-mono">{formatCurrency(po.total_cost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Package className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Line Items</p>
                  <p className="text-xl font-bold">{poItems?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ETA</p>
                  <p className="text-xl font-bold">
                    {po.estimated_arrival
                      ? new Date(po.estimated_arrival).toLocaleDateString()
                      : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-xl font-bold">
                    {new Date(po.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{(po.supplier as any)?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contact</p>
                <p className="font-medium">{(po.supplier as any)?.contact_name || '-'}</p>
                <p className="text-sm text-muted-foreground">
                  {(po.supplier as any)?.contact_email}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Warehouse Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                Warehouse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{warehouse?.name || po.warehouse_location || '-'}</p>
              </div>
              {warehouse && (
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">
                    {warehouse.city && warehouse.state
                      ? `${warehouse.city}, ${warehouse.state}`
                      : '-'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Totals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">
                  {formatCurrency((po.total_cost || 0) - (po.shipping_cost || 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-mono">{formatCurrency(po.shipping_cost)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(po.total_cost)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
            <CardDescription>Products in this purchase order</CardDescription>
          </CardHeader>
          <CardContent>
            {poItems?.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No items in this order.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poItems?.map((item) => {
                    const lineTotal = item.quantity_ordered * (item.unit_cost || 0);
                    const isFullyReceived =
                      (item.quantity_received || 0) >= item.quantity_ordered;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {(item.product as any)?.name || 'Unknown'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {(item.product as any)?.sku || '-'}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                        <TableCell className="text-right">{item.quantity_received || 0}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.unit_cost)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(lineTotal)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isFullyReceived ? 'default' : 'outline'}>
                            {isFullyReceived ? 'Received' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!isFullyReceived &&
                            ['arrived', 'in_transit', 'shipped'].includes(po.status || '') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReceiveModal(item.id)}
                              >
                                Receive
                              </Button>
                            )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {po.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{po.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Receive Modal */}
      <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantity Received</Label>
              <Input
                type="number"
                value={receiveQuantity}
                onChange={(e) => setReceiveQuantity(e.target.value)}
                placeholder="Enter quantity..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={receiveItemMutation.isPending}>
              {receiveItemMutation.isPending ? 'Receiving...' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
