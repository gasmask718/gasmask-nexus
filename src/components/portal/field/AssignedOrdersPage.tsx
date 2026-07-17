import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Package, MapPin, Phone, User, Clock, Navigation, CheckCircle2, AlertTriangle, Truck } from 'lucide-react';
import { format } from 'date-fns';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useUpdateDeliveryTaskStatus } from '@/hooks/useDeliveryTasks';
import { StoreCallTextButtons } from '@/components/portal/field/StoreCallTextButtons';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

const STATUS_FLOW: Record<string, { next: string; label: string; variant: "default" | "destructive" }[]> = {
  pending_acceptance: [
    { next: "assigned", label: "✅ Accept", variant: "default" },
    { next: "declined", label: "✖ Decline", variant: "destructive" },
  ],
  assigned: [{ next: "picked_up", label: "Mark Picked Up", variant: "default" }],
  picked_up: [{ next: "in_transit", label: "In Transit", variant: "default" }],
  in_transit: [
    { next: "delivered", label: "Mark Delivered", variant: "default" },
    { next: "failed", label: "Report Issue", variant: "destructive" },
  ],
};

interface AssignedOrdersPageProps {
  portalType: 'biker' | 'driver';
}

export function AssignedOrdersPage({ portalType }: AssignedOrdersPageProps) {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [confirmTask, setConfirmTask] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ eta: string; distance: string } | null>(null);
  const updateStatus = useUpdateDeliveryTaskStatus();

  // Get current user
  const { data: session } = useQuery({
    queryKey: ['current-session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Get worker record (biker or driver) for current user
  const { data: workerRecord } = useQuery({
    queryKey: ['worker-record', portalType, session?.user?.id],
    queryFn: async () => {
      const table = portalType === 'biker' ? 'bikers' : 'drivers';
      const { data } = await supabase
        .from(table)
        .select('id')
        .eq('user_id', session!.user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!session?.user?.id,
  });

  // Fetch assigned delivery tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-assigned-tasks', portalType, workerRecord?.id],
    queryFn: async () => {
      const col = portalType === 'biker' ? 'biker_id' : 'driver_id';
      const { data: tasksRaw, error } = await supabase
        .from('delivery_tasks')
        .select(`
          *,
          store_order:store_orders(id, order_number, total_amount, status, notes, store_id)
        `)
        .eq(col, workerRecord!.id)
        .in('status', ['pending_acceptance', 'assigned', 'picked_up', 'in_transit'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Fetch stores separately
      const storeIds = [...new Set((tasksRaw || []).map((t: any) => t.store_order?.store_id).filter(Boolean))];
      let storesMap: Record<string, any> = {};
      if (storeIds.length > 0) {
        const { data: stores } = await supabase.from('store_master').select('id, store_name, address, phone').in('id', storeIds);
        storesMap = Object.fromEntries((stores || []).map(s => [s.id, s]));
      }
      
      return (tasksRaw || []).map((t: any) => ({
        ...t,
        store_order: t.store_order ? { ...t.store_order, store: storesMap[t.store_order.store_id] || null } : null,
      }));
    },
    enabled: !!workerRecord?.id,
    refetchInterval: 30000,
  });

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.longitude, pos.coords.latitude]),
        () => console.warn('Geolocation not available')
      );
    }
  }, []);

  // Initialize/update map when a task is selected
  useEffect(() => {
    if (!selectedTask || !mapContainerRef.current) return;

    const lat = selectedTask.delivery_lat;
    const lng = selectedTask.delivery_lng;
    if (!lat || !lng) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [Number(lng), Number(lat)],
      zoom: 13,
      accessToken: MAPBOX_TOKEN,
    });

    mapRef.current = map;

    new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat([Number(lng), Number(lat)])
      .setPopup(new mapboxgl.Popup().setHTML(`<strong>${selectedTask.recipient_name || 'Delivery'}</strong><br/>${selectedTask.delivery_address || ''}`))
      .addTo(map);

    if (userLocation) {
      new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat(userLocation)
        .setPopup(new mapboxgl.Popup().setHTML('<strong>Your Location</strong>'))
        .addTo(map);

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(userLocation);
      bounds.extend([Number(lng), Number(lat)]);
      map.fitBounds(bounds, { padding: 60 });

      // Immediately draw a dashed trajectory line (visible while route loads)
      const addTrajectoryLine = () => {
        if (map.getSource('trajectory')) return;
        map.addSource('trajectory', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [userLocation, [Number(lng), Number(lat)]],
            },
          },
        });
        map.addLayer({
          id: 'trajectory',
          type: 'line',
          source: 'trajectory',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 2.5,
            'line-opacity': 0.5,
            'line-dasharray': [4, 3],
          },
        });
      };

      if (map.isStyleLoaded()) {
        addTrajectoryLine();
      } else {
        map.on('load', addTrajectoryLine);
      }

      fetchRoute(userLocation, [Number(lng), Number(lat)], map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [selectedTask, userLocation]);

  const fetchRoute = async (origin: [number, number], dest: [number, number], map: mapboxgl.Map) => {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${dest[0]},${dest[1]}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.routes?.[0]) {
        const route = data.routes[0];
        const durationMin = Math.round(route.duration / 60);
        const distanceKm = (route.distance / 1000).toFixed(1);
        setRouteInfo({ eta: `${durationMin} min`, distance: `${distanceKm} km` });

        map.on('load', () => {
          if (map.getSource('route')) {
            (map.getSource('route') as mapboxgl.GeoJSONSource).setData(route.geometry);
          } else {
            map.addSource('route', { type: 'geojson', data: route.geometry });
            map.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 0.8 },
            });
          }
        });

        if (map.loaded()) {
          if (!map.getSource('route')) {
            map.addSource('route', { type: 'geojson', data: route.geometry });
            map.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 0.8 },
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch route:', err);
    }
  };

  const handleStatusUpdate = async (taskId: string, newStatus: string, task?: any) => {
    // For decline, require a reason
    if (newStatus === 'declined' && !notes.trim()) {
      // handled by confirmation dialog
      return;
    }

    updateStatus.mutate(
      { taskId, status: newStatus, delivery_notes: notes || undefined },
      {
        onSuccess: async () => {
          // If declined, notify admin
          if (newStatus === 'declined' && task) {
            try {
              const workerName = workerRecord?.id || 'Worker';
              const orderNum = task.store_order?.order_number || `ORD-${task.store_order_id?.slice(0,8)}`;
              await supabase.from('internal_notifications').insert({
                title: 'Delivery Declined',
                message: `${portalType === 'biker' ? 'Biker' : 'Driver'} declined order ${orderNum}. Reason: ${notes}`,
                target_role: 'admin',
                entity_type: 'delivery_task',
                entity_id: taskId,
              });
            } catch (err) {
              console.error('Failed to send decline notification:', err);
            }
          }

          setConfirmTask(null);
          setNotes("");
          if (['delivered', 'failed', 'declined'].includes(newStatus)) {
            setSelectedTask(null);
          }
        },
      }
    );
  };

  const statusColors: Record<string, string> = {
    pending_acceptance: 'bg-orange-500/10 text-orange-600',
    assigned: 'bg-amber-500/10 text-amber-600',
    picked_up: 'bg-blue-500/10 text-blue-600',
    in_transit: 'bg-purple-500/10 text-purple-600',
    delivered: 'bg-green-500/10 text-green-600',
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading assigned orders...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Package className="h-6 w-6 text-primary" />
        My Assigned Orders
      </h1>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No assigned orders</p>
            <p className="text-sm">Orders assigned to you will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Task List */}
          <div className="space-y-3">
            {tasks.map((task: any) => {
              const actions = STATUS_FLOW[task.status] || [];
              return (
                <Card
                  key={task.id}
                  className={`cursor-pointer transition-colors ${selectedTask?.id === task.id ? 'border-primary ring-1 ring-primary/20' : 'hover:border-primary/30'}`}
                  onClick={() => { setSelectedTask(task); setRouteInfo(null); }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {task.store_order?.order_number || `ORD-${task.store_order_id?.slice(0,8)}`}
                        </div>
                        <div className="text-sm text-muted-foreground">{task.store_order?.store?.store_name || 'Unknown Store'}</div>
                        {task.recipient_name && (
                          <div className="text-sm flex items-center gap-1"><User className="h-3 w-3" /> {task.recipient_name}</div>
                        )}
                        {task.delivery_address && (
                          <div className="text-sm flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" /> {task.delivery_address}</div>
                        )}
                      </div>
                      <Badge variant="outline" className={statusColors[task.status] || ''}>{task.status.replace('_', ' ')}</Badge>
                    </div>

                    {/* Action Buttons */}
                    {actions.length > 0 && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        {actions.map((action) => (
                           <Button
                            key={action.next}
                            size="sm"
                            variant={action.variant}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (action.next === "delivered" || action.next === "failed" || action.next === "declined") {
                                setConfirmTask({ ...task, nextStatus: action.next });
                              } else {
                                handleStatusUpdate(task.id, action.next, task);
                              }
                            }}
                            disabled={updateStatus.isPending}
                          >
                            {action.next === "picked_up" && <Truck className="h-3 w-3 mr-1" />}
                            {action.next === "in_transit" && <Navigation className="h-3 w-3 mr-1" />}
                            {action.next === "delivered" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {action.next === "failed" && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Map + Details */}
          <div className="space-y-3">
            {selectedTask ? (
              <>
                {routeInfo && (
                  <div className="flex gap-3">
                    <Card className="flex-1">
                      <CardContent className="p-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-xs text-muted-foreground">ETA</div>
                          <div className="font-bold">{routeInfo.eta}</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="flex-1">
                      <CardContent className="p-3 flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-xs text-muted-foreground">Distance</div>
                          <div className="font-bold">{routeInfo.distance}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <Card>
                  <CardContent className="p-0">
                    <div ref={mapContainerRef} className="h-[350px] rounded-lg" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Delivery Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedTask.recipient_name && (
                      <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {selectedTask.recipient_name}</div>
                    )}
                    {selectedTask.recipient_phone && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {selectedTask.recipient_phone}</div>
                        <StoreCallTextButtons
                          phone={selectedTask.recipient_phone}
                          storeId={selectedTask.store_order?.store?.id || selectedTask.store_order?.store_id || ''}
                          storeName={selectedTask.recipient_name || selectedTask.store_order?.store?.store_name || 'Recipient'}
                          compact
                        />
                      </div>
                    )}
                    {selectedTask.store_order?.store?.phone && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" /> Store: {selectedTask.store_order.store.phone}
                        </div>
                        <StoreCallTextButtons
                          phone={selectedTask.store_order.store.phone}
                          storeId={selectedTask.store_order.store.id}
                          storeName={selectedTask.store_order.store.store_name || 'Store'}
                          compact
                        />
                      </div>
                    )}
                    {selectedTask.delivery_address && (
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {selectedTask.delivery_address}</div>
                    )}
                    {selectedTask.delivery_notes && (
                      <div className="text-muted-foreground mt-2 text-xs italic">{selectedTask.delivery_notes}</div>
                    )}
                    <Separator />
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-bold">${(selectedTask.store_order?.total_amount || 0).toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select an order to view the map and delivery route</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Delivered / Failed */}
      <Dialog open={!!confirmTask} onOpenChange={() => { setConfirmTask(null); setNotes(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmTask?.nextStatus === "delivered" ? "✅ Confirm Delivery" 
                : confirmTask?.nextStatus === "declined" ? "✖ Decline Assignment"
                : "⚠️ Report Issue"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {confirmTask?.nextStatus === "delivered"
                ? `Confirm that order ${confirmTask?.store_order?.order_number || ''} has been delivered successfully.`
                : confirmTask?.nextStatus === "declined"
                ? `Decline this delivery assignment? Please provide a reason — the admin will be notified.`
                : "Describe the issue with this delivery."}
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                confirmTask?.nextStatus === "delivered"
                  ? "Any notes about this delivery (optional)..."
                  : confirmTask?.nextStatus === "declined"
                  ? "Reason for declining (required)..."
                  : "What went wrong? (required)"
              }
              rows={3}
            />
            <Button
              className="w-full"
              variant={confirmTask?.nextStatus === "failed" || confirmTask?.nextStatus === "declined" ? "destructive" : "default"}
              onClick={() =>
                confirmTask && handleStatusUpdate(confirmTask.id, confirmTask.nextStatus, confirmTask)
              }
              disabled={updateStatus.isPending || ((confirmTask?.nextStatus === "failed" || confirmTask?.nextStatus === "declined") && !notes.trim())}
            >
              {updateStatus.isPending
                ? "Updating..."
                : confirmTask?.nextStatus === "delivered"
                ? "✅ Confirm Delivered"
                : confirmTask?.nextStatus === "declined"
                ? "✖ Confirm Decline"
                : "Submit Issue Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
