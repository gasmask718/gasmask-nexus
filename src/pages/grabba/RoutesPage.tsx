// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES PAGE — Route Plans + Delivery Dispatch
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useRouteBuilder, RoutePlan, RouteStatus, StopStatus } from '@/hooks/useRouteBuilder';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useDeliveryTasksList,
  useDispatchableOrders,
  useActiveBikers,
  useCreateDeliveryTask,
} from '@/hooks/useDeliveryTasks';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { 
  Play, 
  CheckCircle2, 
  X, 
  MapPin, 
  Calendar,
  Clock,
  User,
  Loader2,
  RefreshCw,
  ChevronRight,
  Navigation,
  SkipForward,
  Plus,
  Truck,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

const routeStatusColors: Record<RouteStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-muted',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const stopStatusColors: Record<StopStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  visited: 'bg-emerald-500/20 text-emerald-400',
  skipped: 'bg-muted text-muted-foreground',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  picked_up: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  in_transit: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
  cancelled: 'bg-muted text-muted-foreground border-muted',
};

export default function RoutesPage() {
  // ── Route Plans state ──
  const { routes, loading, getRoutes, getRouteWithStops, updateRouteStatus, markStopCompleted } = useRouteBuilder();
  const { canUpdate } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<RoutePlan | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const isReadOnly = !canUpdate('deliveries');

  // ── Dispatch state ──
  const { data: tasks = [], isLoading: loadingTasks } = useDeliveryTasksList();
  const { data: orders = [], isLoading: loadingOrders } = useDispatchableOrders();
  const { data: bikers = [] } = useActiveBikers();
  const createTask = useCreateDeliveryTask();

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedBikerId, setSelectedBikerId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [dispatchTab, setDispatchTab] = useState<'orders' | 'tasks'>('orders');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => { getRoutes(); }, [getRoutes]);

  // ── Map init ──
  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.95, 40.75],
      zoom: 11,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Map markers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const addMarkers = () => {
      document.querySelectorAll('.delivery-marker').forEach(el => el.remove());
      tasks.forEach(task => {
        if (!task.delivery_lat || !task.delivery_lng) return;
        const el = document.createElement('div');
        el.className = 'delivery-marker';
        el.style.cssText = `width:24px;height:24px;border-radius:50%;background:${task.status === 'delivered' ? '#22c55e' : task.status === 'failed' ? '#ef4444' : '#3b82f6'};border:2px solid white;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);`;
        const storeName = task.store_order?.store?.store_name || 'Unknown';
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="font-family:sans-serif;padding:4px;"><strong>${storeName}</strong><br/><span style="font-size:12px;color:#666;">${task.delivery_address}</span><br/><span style="font-size:11px;">Status: <b>${task.status}</b></span></div>`
        );
        new mapboxgl.Marker(el).setLngLat([task.delivery_lng, task.delivery_lat]).setPopup(popup).addTo(map);
      });
      const withCoords = tasks.filter(t => t.delivery_lat && t.delivery_lng);
      if (withCoords.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        withCoords.forEach(t => bounds.extend([t.delivery_lng!, t.delivery_lat!]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      }
    };
    if (map.loaded()) addMarkers();
    else map.on('load', addMarkers);
  }, [tasks]);

  // ── Route handlers ──
  const filteredRoutes = routes.filter(r => statusFilter === 'all' || r.status === statusFilter);

  const handleViewRoute = async (routeId: string) => {
    setLoadingDetail(true);
    const detail = await getRouteWithStops(routeId);
    setSelectedRoute(detail);
    setLoadingDetail(false);
  };

  const handleStartRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'in_progress');
    if (selectedRoute?.id === routeId) setSelectedRoute({ ...selectedRoute, status: 'in_progress' });
  };

  const handleCompleteRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'completed');
    if (selectedRoute?.id === routeId) setSelectedRoute({ ...selectedRoute, status: 'completed' });
  };

  const handleCancelRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'cancelled');
    if (selectedRoute?.id === routeId) setSelectedRoute({ ...selectedRoute, status: 'cancelled' });
  };

  const handleStopAction = async (stopId: string, status: StopStatus) => {
    await markStopCompleted(stopId, status);
    if (selectedRoute) {
      const updatedStops = selectedRoute.stops?.map(s => s.id === stopId ? { ...s, status } : s);
      setSelectedRoute({ ...selectedRoute, stops: updatedStops });
    }
  };

  // ── Dispatch handlers ──
  const handleAssign = () => {
    if (!selectedOrderId || !selectedBikerId || !deliveryAddress) return;
    createTask.mutate({
      store_order_id: selectedOrderId,
      biker_id: selectedBikerId,
      delivery_address: deliveryAddress,
      delivery_lat: deliveryLat,
      delivery_lng: deliveryLng,
      delivery_notes: deliveryNotes || undefined,
    }, {
      onSuccess: () => { setShowAssignDialog(false); resetForm(); },
    });
  };

  const resetForm = () => {
    setSelectedOrderId('');
    setSelectedBikerId('');
    setDeliveryAddress('');
    setDeliveryLat(null);
    setDeliveryLng(null);
    setDeliveryNotes('');
  };

  const handleAddressSelect = (parsed: { street: string; city: string; state: string; zip: string; full_address: string }) => {
    setDeliveryAddress(parsed.full_address);
    if (MAPBOX_TOKEN) {
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(parsed.full_address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`)
        .then(r => r.json())
        .then(data => {
          if (data.features?.[0]) {
            const [lng, lat] = data.features[0].center;
            setDeliveryLat(lat);
            setDeliveryLng(lng);
          }
        })
        .catch(() => {});
    }
  };

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find((o: any) => o.id === orderId);
    if (order?.store?.address) {
      setDeliveryAddress(order.store.address);
      if (order.store.lat && order.store.lng) {
        setDeliveryLat(order.store.lat);
        setDeliveryLng(order.store.lng);
      }
    }
  };

  const activeTasks = tasks.filter(t => !['delivered', 'cancelled'].includes(t.status));
  const completedTasks = tasks.filter(t => t.status === 'delivered');

  return (
    <GrabbaLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Routes & Dispatch</h1>
            <p className="text-muted-foreground">Manage route plans and dispatch deliveries</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAssignDialog(true)} disabled={orders.length === 0}>
              <Plus className="h-4 w-4 mr-2" /> Assign Delivery
            </Button>
            <Button onClick={() => getRoutes()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Dispatch Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 text-center">
              <Package className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold">{orders.length}</div>
              <div className="text-xs text-muted-foreground">Pending Orders</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-blue-400 mb-1" />
              <div className="text-2xl font-bold">{activeTasks.length}</div>
              <div className="text-xs text-muted-foreground">Active Tasks</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-400 mb-1" />
              <div className="text-2xl font-bold">{completedTasks.length}</div>
              <div className="text-xs text-muted-foreground">Delivered</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 text-center">
              <User className="h-5 w-5 mx-auto text-purple-400 mb-1" />
              <div className="text-2xl font-bold">{bikers.length}</div>
              <div className="text-xs text-muted-foreground">Active Bikers</div>
            </CardContent>
          </Card>
        </div>

        {/* Delivery Map */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Delivery Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={mapContainerRef} className="w-full rounded-lg overflow-hidden" style={{ height: 320 }} />
          </CardContent>
        </Card>

        {/* Main Tabs: Dispatch / Route Plans */}
        <Tabs defaultValue="dispatch" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dispatch">
              <Truck className="h-4 w-4 mr-2" /> Dispatch ({orders.length + tasks.length})
            </TabsTrigger>
            <TabsTrigger value="routes">
              <Navigation className="h-4 w-4 mr-2" /> Route Plans ({routes.length})
            </TabsTrigger>
          </TabsList>

          {/* ═══ DISPATCH TAB ═══ */}
          <TabsContent value="dispatch" className="space-y-4 mt-4">
            {/* Sub-tabs: Orders / Tasks */}
            <div className="flex gap-2 border-b border-border/50">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  dispatchTab === 'orders' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setDispatchTab('orders')}
              >
                Pending Orders ({orders.length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  dispatchTab === 'tasks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setDispatchTab('tasks')}
              >
                Delivery Tasks ({tasks.length})
              </button>
            </div>

            {/* Orders Table */}
            {dispatchTab === 'orders' && (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingOrders ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading orders...</TableCell>
                        </TableRow>
                      ) : orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No pending orders to dispatch</TableCell>
                        </TableRow>
                      ) : (
                        orders.map((order: any) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">{order.order_number || order.id.slice(0, 8)}</TableCell>
                            <TableCell>{order.store?.store_name || '—'}</TableCell>
                            <TableCell>${order.total_amount?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell><Badge variant="outline">{order.status}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {order.created_at ? format(new Date(order.created_at), 'MMM d, h:mm a') : '—'}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => { handleOrderSelect(order.id); setShowAssignDialog(true); }}>
                                <Truck className="h-3 w-3 mr-1" /> Assign
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Tasks Table */}
            {dispatchTab === 'tasks' && (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Store</TableHead>
                        <TableHead>Biker</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingTasks ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading tasks...</TableCell>
                        </TableRow>
                      ) : tasks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No delivery tasks yet</TableCell>
                        </TableRow>
                      ) : (
                        tasks.map(task => (
                          <TableRow key={task.id}>
                            <TableCell className="font-medium">{task.store_order?.store?.store_name || '—'}</TableCell>
                            <TableCell>{task.biker?.full_name || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">{task.delivery_address}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={TASK_STATUS_COLORS[task.status] || ''}>{task.status.replace('_', ' ')}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{format(new Date(task.created_at), 'MMM d, h:mm a')}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ ROUTE PLANS TAB ═══ */}
          <TabsContent value="routes" className="space-y-4 mt-4">
            {/* Filter */}
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex gap-4 items-center">
                  <span className="text-sm text-muted-foreground">Filter by status:</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Routes Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRoutes.length === 0 ? (
              <Card className="bg-card/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No routes found</p>
                  <p className="text-sm">Create routes from the Results Panel or Command Console</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRoutes.map(route => (
                  <Card 
                    key={route.id} 
                    className="bg-card/50 hover:bg-card/80 transition-colors cursor-pointer"
                    onClick={() => handleViewRoute(route.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-foreground line-clamp-1">{route.name}</h3>
                        <Badge className={routeStatusColors[route.status]}>{route.status.replace('_', ' ')}</Badge>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(route.scheduled_date), 'MMM d, yyyy')}
                        </div>
                        {route.start_time && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {route.start_time}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {route.total_stops} stops
                        </div>
                        {route.driver && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {route.driver.name}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        {route.brand && <Badge variant="outline" className="text-xs">{route.brand}</Badge>}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Route Detail Sheet */}
        <Sheet open={!!selectedRoute} onOpenChange={() => setSelectedRoute(null)}>
          <SheetContent className="w-full sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>{selectedRoute?.name}</SheetTitle>
            </SheetHeader>
            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedRoute && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <Badge className={routeStatusColors[selectedRoute.status]}>{selectedRoute.status.replace('_', ' ')}</Badge>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Date</label>
                    <p className="text-sm">{format(new Date(selectedRoute.scheduled_date), 'PPP')}</p>
                  </div>
                  {selectedRoute.driver && (
                    <div>
                      <label className="text-xs text-muted-foreground">Driver</label>
                      <p className="text-sm">{selectedRoute.driver.name}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground">Stops</label>
                    <p className="text-sm">{selectedRoute.total_stops}</p>
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="flex gap-2">
                    {selectedRoute.status === 'scheduled' && (
                      <Button onClick={() => handleStartRoute(selectedRoute.id)} className="flex-1">
                        <Play className="h-4 w-4 mr-2" /> Start Route
                      </Button>
                    )}
                    {selectedRoute.status === 'in_progress' && (
                      <Button onClick={() => handleCompleteRoute(selectedRoute.id)} className="flex-1">
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Complete Route
                      </Button>
                    )}
                    {(selectedRoute.status === 'scheduled' || selectedRoute.status === 'draft') && (
                      <Button variant="destructive" onClick={() => handleCancelRoute(selectedRoute.id)}>
                        <X className="h-4 w-4 mr-2" /> Cancel
                      </Button>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium mb-3">Stops ({selectedRoute.stops?.length || 0})</h4>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {selectedRoute.stops?.map((stop, idx) => (
                        <Card key={stop.id} className="bg-card/50">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">{idx + 1}</div>
                                <div>
                                  <p className="font-medium text-sm">{stop.store?.name || 'Unknown Store'}</p>
                                  {stop.store?.address && <p className="text-xs text-muted-foreground">{stop.store.address}</p>}
                                </div>
                              </div>
                              <Badge className={stopStatusColors[stop.status]}>{stop.status}</Badge>
                            </div>
                            {!isReadOnly && stop.status === 'pending' && selectedRoute.status === 'in_progress' && (
                              <div className="mt-3 flex gap-2">
                                <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); handleStopAction(stop.id, 'visited'); }}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Visited
                                </Button>
                                <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); handleStopAction(stop.id, 'skipped'); }}>
                                  <SkipForward className="h-3 w-3 mr-1" /> Skip
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Assign Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Delivery</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Store Order</Label>
                <Select value={selectedOrderId} onValueChange={handleOrderSelect}>
                  <SelectTrigger><SelectValue placeholder="Select an order..." /></SelectTrigger>
                  <SelectContent>
                    {orders.map((order: any) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_number || order.id.slice(0, 8)} — {order.store?.store_name || 'Unknown'} (${order.total_amount?.toFixed(2) || '0'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign to Biker</Label>
                <Select value={selectedBikerId} onValueChange={setSelectedBikerId}>
                  <SelectTrigger><SelectValue placeholder="Select a biker..." /></SelectTrigger>
                  <SelectContent>
                    {bikers.map((biker: any) => (
                      <SelectItem key={biker.id} value={biker.id}>
                        {biker.full_name} {biker.territory ? `(${biker.territory})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Delivery Address</Label>
                <AddressAutocomplete
                  value={deliveryAddress}
                  onChange={setDeliveryAddress}
                  onSelect={handleAddressSelect}
                  placeholder="Type or search address..."
                />
                {deliveryLat && deliveryLng && (
                  <p className="text-xs text-muted-foreground">📍 {deliveryLat.toFixed(4)}, {deliveryLng.toFixed(4)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Delivery Notes (optional)</Label>
                <Textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="Special instructions..." rows={2} />
              </div>

              <Separator />

              <Button
                className="w-full"
                onClick={handleAssign}
                disabled={!selectedOrderId || !selectedBikerId || !deliveryAddress || createTask.isPending}
              >
                {createTask.isPending ? 'Assigning...' : 'Assign Delivery'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </GrabbaLayout>
  );
}
