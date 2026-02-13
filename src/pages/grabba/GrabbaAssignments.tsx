import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Package, Search, User, MapPin, Phone, Truck, Bike,
  Clock, CheckCircle, ArrowRight, Eye, ClipboardList
} from 'lucide-react';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { BrandFilterBar } from '@/components/grabba/BrandFilterBar';

type DeliveryStatus = 'pending' | 'delivering' | 'delivered';

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 4 — ORDER ASSIGNMENT PAGE
// Fetch all store_orders, view details, assign bikers/drivers via delivery_tasks
// ═══════════════════════════════════════════════════════════════════════════════

export default function GrabbaAssignments() {
  const { selectedBrand, setSelectedBrand } = useGrabbaBrand();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ── Fetch all orders with store info ───────────────────────────────────────
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['assignment-orders'],
    queryFn: async () => {
      const { data: ordersRaw, error } = await supabase
        .from('store_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Fetch related stores
      const storeIds = [...new Set((ordersRaw || []).map((o: any) => o.store_id).filter(Boolean))];
      let storesMap: Record<string, any> = {};
      if (storeIds.length > 0) {
        const { data: stores } = await supabase.from('store_master').select('id, store_name, address, phone').in('id', storeIds);
        storesMap = Object.fromEntries((stores || []).map(s => [s.id, s]));
      }
      
      return (ordersRaw || []).map((o: any) => ({ ...o, store: storesMap[o.store_id] || null }));
    },
  });

  // ── Fetch existing delivery tasks for orders ───────────────────────────────
  const { data: tasks = [] } = useQuery({
    queryKey: ['assignment-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select(`
          *,
          biker:bikers(id, full_name, phone),
          driver:drivers(id, full_name, phone)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // ── Fetch bikers & drivers ─────────────────────────────────────────────────
  const { data: bikers = [] } = useQuery({
    queryKey: ['all-bikers'],
    queryFn: async () => {
      const { data } = await supabase.from('bikers').select('id, full_name, phone, status').eq('status', 'active').order('full_name');
      return data || [];
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['all-drivers'],
    queryFn: async () => {
      const { data } = await supabase.from('drivers').select('id, full_name, phone, status').eq('status', 'active').order('full_name');
      return data || [];
    },
  });

  // ── Derive delivery status from tasks ──────────────────────────────────────
  const getDeliveryStatus = (orderId: string): DeliveryStatus => {
    const task = tasks.find((t: any) => t.store_order_id === orderId);
    if (!task) return 'pending';
    if (task.status === 'delivered' || task.delivered_at) return 'delivered';
    if (['picked_up', 'in_transit', 'assigned'].includes(task.status)) return 'delivering';
    return 'pending';
  };

  const getTaskForOrder = (orderId: string) => tasks.find((t: any) => t.store_order_id === orderId);

  // ── Filter orders ─────────────────────────────────────────────────────────
  const filteredOrders = orders.filter((o: any) => {
    const ds = getDeliveryStatus(o.id);
    if (statusFilter !== 'all' && ds !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.order_number?.toLowerCase().includes(q) ||
        o.recipient_name?.toLowerCase().includes(q) ||
        o.store?.store_name?.toLowerCase().includes(q) ||
        o.delivery_address?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total: orders.length,
    pending: orders.filter((o: any) => getDeliveryStatus(o.id) === 'pending').length,
    delivering: orders.filter((o: any) => getDeliveryStatus(o.id) === 'delivering').length,
    delivered: orders.filter((o: any) => getDeliveryStatus(o.id) === 'delivered').length,
  };

  const statusColor: Record<DeliveryStatus, string> = {
    pending: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    delivering: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    delivered: 'bg-green-500/10 text-green-600 border-green-500/30',
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-primary" />
              Order Assignments
            </h1>
            <p className="text-muted-foreground mt-1">
              Floor 4 — Assign orders to bikers & drivers for delivery
            </p>
          </div>
          <BrandFilterBar selectedBrand={selectedBrand} onBrandChange={setSelectedBrand} variant="default" />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><Package className="h-4 w-4" /><span className="text-xs">Total Orders</span></div>
              <div className="text-2xl font-bold mt-1">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-500"><Clock className="h-4 w-4" /><span className="text-xs">Pending</span></div>
              <div className="text-2xl font-bold mt-1">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-500"><Truck className="h-4 w-4" /><span className="text-xs">Delivering</span></div>
              <div className="text-2xl font-bold mt-1">{stats.delivering}</div>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-500"><CheckCircle className="h-4 w-4" /><span className="text-xs">Delivered</span></div>
              <div className="text-2xl font-bold mt-1">{stats.delivered}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search orders..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="delivering">Delivering</TabsTrigger>
              <TabsTrigger value="delivered">Delivered</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Order list */}
        {ordersLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">No orders found</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {filteredOrders.map((order: any) => {
              const ds = getDeliveryStatus(order.id);
              const task = getTaskForOrder(order.id);
              return (
                <Card key={order.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => { setSelectedOrder(order); setAssignDialogOpen(true); }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{order.order_number || `ORD-${order.id.slice(0,8)}`}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{order.store?.store_name || 'Unknown Store'}</span>
                            {order.recipient_name && <><span>•</span><span>{order.recipient_name}</span></>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {task && (
                          <div className="text-xs text-muted-foreground">
                            {task.biker?.full_name || task.driver?.full_name || 'Unassigned'}
                          </div>
                        )}
                        <Badge variant="outline" className={statusColor[ds]}>{ds}</Badge>
                        <div className="text-sm font-semibold">${(order.total_amount || 0).toFixed(2)}</div>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail + Assignment Dialog */}
      {selectedOrder && (
        <OrderAssignmentDialog
          order={selectedOrder}
          open={assignDialogOpen}
          onClose={() => { setAssignDialogOpen(false); setSelectedOrder(null); }}
          bikers={bikers}
          drivers={drivers}
          existingTask={getTaskForOrder(selectedOrder.id)}
          onAssigned={() => {
            queryClient.invalidateQueries({ queryKey: ['assignment-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['assignment-orders'] });
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER ASSIGNMENT DIALOG
// ═══════════════════════════════════════════════════════════════════════════════
interface OrderAssignmentDialogProps {
  order: any;
  open: boolean;
  onClose: () => void;
  bikers: any[];
  drivers: any[];
  existingTask: any;
  onAssigned: () => void;
}

function OrderAssignmentDialog({ order, open, onClose, bikers, drivers, existingTask, onAssigned }: OrderAssignmentDialogProps) {
  const [assigneeType, setAssigneeType] = useState<'biker' | 'driver'>(existingTask?.biker_id ? 'biker' : existingTask?.driver_id ? 'driver' : 'biker');
  const [assigneeId, setAssigneeId] = useState(existingTask?.biker_id || existingTask?.driver_id || '');
  const [deliveryAddress, setDeliveryAddress] = useState(
    existingTask?.delivery_address || order.delivery_address || order.store?.address || ''
  );
  const [deliveryNotes, setDeliveryNotes] = useState(existingTask?.delivery_notes || order.notes || '');
  const [recipientName, setRecipientName] = useState(existingTask?.recipient_name || order.recipient_name || '');
  const [recipientPhone, setRecipientPhone] = useState(existingTask?.recipient_phone || order.recipient_phone || '');
  const [submitting, setSubmitting] = useState(false);

  const assignees = assigneeType === 'biker' ? bikers : drivers;

  const handleAssign = async () => {
    if (!assigneeId) {
      toast.error('Please select a biker or driver');
      return;
    }
    setSubmitting(true);
    try {
      const taskData: any = {
        store_order_id: order.id,
        delivery_address: deliveryAddress || null,
        delivery_lat: order.delivery_lat || order.store?.lat || null,
        delivery_lng: order.delivery_lng || order.store?.lng || null,
        delivery_notes: deliveryNotes || null,
        recipient_name: recipientName || null,
        recipient_phone: recipientPhone || null,
        status: 'assigned',
        biker_id: assigneeType === 'biker' ? assigneeId : null,
        driver_id: assigneeType === 'driver' ? assigneeId : null,
      };

      if (existingTask) {
        const { error } = await supabase.from('delivery_tasks').update(taskData).eq('id', existingTask.id);
        if (error) throw error;
        toast.success('Assignment updated');
      } else {
        const { error } = await supabase.from('delivery_tasks').insert(taskData);
        if (error) throw error;
        toast.success('Order assigned successfully');
      }
      onAssigned();
      onClose();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order {order.order_number || `ORD-${order.id.slice(0,8)}`}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Order Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Order Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Store:</span> <span className="font-medium">{order.store?.store_name || '—'}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">${(order.total_amount || 0).toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{order.status || '—'}</span></div>
                <div><span className="text-muted-foreground">Payment:</span> <span className="font-medium">{order.payment_status || '—'}</span></div>
                <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy h:mm a') : '—'}</span></div>
                {order.estimated_delivery && (
                  <div><span className="text-muted-foreground">Est. Delivery:</span> <span className="font-medium">{format(new Date(order.estimated_delivery), 'MMM d, yyyy')}</span></div>
                )}
              </div>
              {order.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {order.notes}</div>}
            </div>

            <Separator />

            {/* Recipient Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><User className="h-4 w-4" /> Recipient Info</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Recipient Name</Label>
                  <Input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Recipient name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Recipient Phone</Label>
                  <Input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} placeholder="Phone number" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Delivery Address (auto-filled) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> Delivery Address</h3>
              <Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Delivery address" />
              {(order.delivery_address || order.store?.address) && deliveryAddress !== (order.delivery_address || order.store?.address) && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDeliveryAddress(order.delivery_address || order.store?.address || '')}>
                  Reset to original address
                </Button>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Delivery Notes</Label>
                <Textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="Special instructions..." rows={2} />
              </div>
            </div>

            <Separator />

            {/* Assignment */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Truck className="h-4 w-4" /> Assign Delivery
              </h3>
              <div className="flex gap-2">
                <Button variant={assigneeType === 'biker' ? 'default' : 'outline'} size="sm" onClick={() => { setAssigneeType('biker'); setAssigneeId(''); }}>
                  <Bike className="h-4 w-4 mr-1" /> Biker
                </Button>
                <Button variant={assigneeType === 'driver' ? 'default' : 'outline'} size="sm" onClick={() => { setAssigneeType('driver'); setAssigneeId(''); }}>
                  <Truck className="h-4 w-4 mr-1" /> Driver
                </Button>
              </div>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select a ${assigneeType}`} />
                </SelectTrigger>
                <SelectContent>
                  {assignees.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} {a.phone ? `(${a.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleAssign} disabled={submitting || !assigneeId}>
                {submitting ? 'Assigning...' : existingTask ? 'Update Assignment' : 'Assign Order'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
