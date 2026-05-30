import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Plus,
  Truck,
  Package,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import {
  useDeliveryTasksList,
  useDispatchableOrders,
  useActiveBikers,
  useCreateDeliveryTask,
} from "@/hooks/useDeliveryTasks";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

const STATUS_COLORS: Record<string, string> = {
  assigned: "bg-blue-500/10 text-blue-700 border-blue-300",
  picked_up: "bg-yellow-500/10 text-yellow-700 border-yellow-300",
  in_transit: "bg-purple-500/10 text-purple-700 border-purple-300",
  delivered: "bg-green-500/10 text-green-700 border-green-300",
  failed: "bg-red-500/10 text-red-700 border-red-300",
  cancelled: "bg-muted text-muted-foreground border-muted",
};

export default function DeliveryDispatchPage() {
  const { data: tasks = [], isLoading: loadingTasks } = useDeliveryTasksList();
  const { data: orders = [], isLoading: loadingOrders } = useDispatchableOrders();
  const { data: bikers = [] } = useActiveBikers();
  const createTask = useCreateDeliveryTask();

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedBikerId, setSelectedBikerId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"orders" | "tasks">("orders");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-73.95, 40.75], // NYC default
      zoom: 11,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map markers when tasks change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Wait for map to load
    const addMarkers = () => {
      // Remove existing markers
      document.querySelectorAll(".delivery-marker").forEach((el) => el.remove());

      tasks.forEach((task) => {
        if (!task.delivery_lat || !task.delivery_lng) return;

        const el = document.createElement("div");
        el.className = "delivery-marker";
        el.style.cssText = `
          width: 24px; height: 24px; border-radius: 50%;
          background: ${task.status === "delivered" ? "#22c55e" : task.status === "failed" ? "#ef4444" : "#3b82f6"};
          border: 2px solid white; cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        `;

        const storeName = task.store_order?.store?.store_name || "Unknown";
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="font-family: sans-serif; padding: 4px;">
            <strong>${storeName}</strong><br/>
            <span style="font-size: 12px; color: #666;">${task.delivery_address}</span><br/>
            <span style="font-size: 11px;">Status: <b>${task.status}</b></span>
          </div>
        `);

        new mapboxgl.Marker(el)
          .setLngLat([task.delivery_lng, task.delivery_lat])
          .setPopup(popup)
          .addTo(map);
      });

      // Fit bounds if there are markers
      const withCoords = tasks.filter((t) => t.delivery_lat && t.delivery_lng);
      if (withCoords.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        withCoords.forEach((t) => bounds.extend([t.delivery_lng!, t.delivery_lat!]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      }
    };

    if (map.loaded()) addMarkers();
    else map.on("load", addMarkers);
  }, [tasks]);

  const handleAssign = () => {
    if (!selectedOrderId || !selectedBikerId || !deliveryAddress) return;

    createTask.mutate(
      {
        store_order_id: selectedOrderId,
        biker_id: selectedBikerId,
        delivery_address: deliveryAddress,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        delivery_notes: deliveryNotes || undefined,
      },
      {
        onSuccess: () => {
          setShowAssignDialog(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setSelectedOrderId("");
    setSelectedBikerId("");
    setDeliveryAddress("");
    setDeliveryLat(null);
    setDeliveryLng(null);
    setDeliveryNotes("");
  };

  const handleAddressSelect = (parsed: {
    street: string;
    city: string;
    state: string;
    zip: string;
    full_address: string;
  }) => {
    setDeliveryAddress(parsed.full_address);
    // Geocode to get lat/lng from the full address
    if (MAPBOX_TOKEN) {
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          parsed.full_address
        )}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.features?.[0]) {
            const [lng, lat] = data.features[0].center;
            setDeliveryLat(lat);
            setDeliveryLng(lng);
          }
        })
        .catch(() => {});
    }
  };

  // Pre-fill address when order is selected
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

  const activeTasks = tasks.filter((t) => !["delivered", "cancelled"].includes(t.status));
  const completedTasks = tasks.filter((t) => t.status === "delivered");

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6" /> Delivery Dispatch
            </h1>
            <p className="text-sm text-muted-foreground">
              Assign store orders to bikers for delivery
            </p>
          </div>
          <Button onClick={() => setShowAssignDialog(true)} disabled={orders.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Assign Delivery
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <Package className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold">{orders.length}</div>
              <div className="text-xs text-muted-foreground">Pending Orders</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <div className="text-2xl font-bold">{activeTasks.length}</div>
              <div className="text-xs text-muted-foreground">Active Tasks</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <div className="text-2xl font-bold">{completedTasks.length}</div>
              <div className="text-xs text-muted-foreground">Delivered</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <User className="h-5 w-5 mx-auto text-purple-500 mb-1" />
              <div className="text-2xl font-bold">{bikers.length}</div>
              <div className="text-xs text-muted-foreground">Active Bikers</div>
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Delivery Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={mapContainerRef}
              className="w-full rounded-lg overflow-hidden"
              style={{ height: 360 }}
            />
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "orders"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("orders")}
          >
            Pending Orders ({orders.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "tasks"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("tasks")}
          >
            Delivery Tasks ({tasks.length})
          </button>
        </div>

        {/* Orders Table */}
        {activeTab === "orders" && (
          <Card>
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
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Loading orders...
                      </TableCell>
                    </TableRow>
                  ) : orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No pending orders to dispatch
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">
                          {order.order_number || order.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>{order.store?.store_name || "—"}</TableCell>
                        <TableCell>${order.total_amount?.toFixed(2) || "0.00"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.created_at
                            ? format(new Date(order.created_at), "MMM d, yyyy, h:mm a")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleOrderSelect(order.id);
                              setShowAssignDialog(true);
                            }}
                          >
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
        {activeTab === "tasks" && (
          <Card>
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
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Loading tasks...
                      </TableCell>
                    </TableRow>
                  ) : tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No delivery tasks yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          {task.store_order?.store?.store_name || "—"}
                        </TableCell>
                        <TableCell>
                          {task.biker?.full_name || (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {task.delivery_address}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_COLORS[task.status] || ""}
                          >
                            {task.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(task.created_at), "MMM d, yyyy, h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Assign Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Delivery</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Order */}
              <div className="space-y-2">
                <Label>Store Order</Label>
                <Select value={selectedOrderId} onValueChange={handleOrderSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an order..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((order: any) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_number || order.id.slice(0, 8)} —{" "}
                        {order.store?.store_name || "Unknown"} ($
                        {order.total_amount?.toFixed(2) || "0"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Biker */}
              <div className="space-y-2">
                <Label>Assign to Biker</Label>
                <Select value={selectedBikerId} onValueChange={setSelectedBikerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a biker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bikers.map((biker: any) => (
                      <SelectItem key={biker.id} value={biker.id}>
                        {biker.full_name} {biker.territory ? `(${biker.territory})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label>Delivery Address</Label>
                <AddressAutocomplete
                  value={deliveryAddress}
                  onChange={setDeliveryAddress}
                  onSelect={handleAddressSelect}
                  placeholder="Type or search address..."
                />
                {deliveryLat && deliveryLng && (
                  <p className="text-xs text-muted-foreground">
                    📍 {deliveryLat.toFixed(4)}, {deliveryLng.toFixed(4)}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Delivery Notes (optional)</Label>
                <Textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Special instructions..."
                  rows={2}
                />
              </div>

              <Separator />

              <Button
                className="w-full"
                onClick={handleAssign}
                disabled={
                  !selectedOrderId ||
                  !selectedBikerId ||
                  !deliveryAddress ||
                  createTask.isPending
                }
              >
                {createTask.isPending ? "Assigning..." : "Assign Delivery"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
