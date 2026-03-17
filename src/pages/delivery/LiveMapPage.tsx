import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, MapPin, Truck, Bike, Navigation, Radio, AlertTriangle,
  Layers, RefreshCw, Package, User
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  useLiveWorkers,
  useLiveDeliveryTasks,
  useLiveRoutes,
  useLiveMapSubscription,
  type WorkerLocation,
  type LiveDeliveryTask,
} from "@/hooks/useLiveMapData";

const DEFAULT_CENTER: [number, number] = [-74.006, 40.7128];
const DEFAULT_ZOOM = 11;

// Status colors for delivery tasks
const taskStatusColor: Record<string, string> = {
  pending: "#f59e0b",
  assigned: "#3b82f6",
  in_transit: "#8b5cf6",
  delivered: "#22c55e",
  failed: "#ef4444",
};

export default function LiveMapPage() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  // Real data hooks
  const { data: workers = [], refetch: refetchWorkers } = useLiveWorkers();
  const { data: deliveryTasks = [], refetch: refetchTasks } = useLiveDeliveryTasks();
  const { data: routes = [], refetch: refetchRoutes } = useLiveRoutes();
  useLiveMapSubscription();

  // Build worker lookup by record ID (biker.id / driver.id) AND by user_id
  const workerLookup = useMemo(() => {
    const byRecordId = new Map<string, WorkerLocation>();
    const byUserId = new Map<string, WorkerLocation>();
    for (const w of workers) {
      byRecordId.set(w.id, w);
      byUserId.set(w.worker_id, w);
    }
    return { byRecordId, byUserId };
  }, [workers]);

  // Match each delivery task to its assigned worker's GPS position
  const taskWorkerPairs = useMemo(() => {
    return deliveryTasks
      .filter(t => t.status !== "delivered" && t.status !== "cancelled")
      .map(task => {
        // Try biker_id (record ID), then driver_id
        let worker: WorkerLocation | undefined;
        if (task.biker_id) worker = workerLookup.byRecordId.get(task.biker_id);
        if (!worker && task.driver_id) worker = workerLookup.byRecordId.get(task.driver_id);
        // Fallback: try user_id match
        if (!worker && task.biker_user_id) worker = workerLookup.byUserId.get(task.biker_user_id);
        if (!worker && task.driver_user_id) worker = workerLookup.byUserId.get(task.driver_user_id);
        return { task, worker: worker || null };
      });
  }, [deliveryTasks, workerLookup]);

  const filteredPairs = useMemo(() => {
    if (filterType === "all") return taskWorkerPairs;
    if (filterType === "biker") return taskWorkerPairs.filter(p => p.task.biker_id);
    if (filterType === "driver") return taskWorkerPairs.filter(p => p.task.driver_id);
    if (filterType === "unassigned") return taskWorkerPairs.filter(p => !p.worker);
    return taskWorkerPairs;
  }, [taskWorkerPairs, filterType]);

  // Stats
  const stats = useMemo(() => {
    const activeWorkers = workers.filter(w => w.status === "active");
    const activeDrivers = activeWorkers.filter(w => w.role === "driver").length;
    const activeBikers = activeWorkers.filter(w => w.role === "biker").length;
    const pendingTasks = deliveryTasks.filter(t => t.status === "pending" || t.status === "assigned").length;
    const inTransit = deliveryTasks.filter(t => t.status === "in_transit").length;
    return { activeDrivers, activeBikers, pendingTasks, inTransit };
  }, [workers, deliveryTasks]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm-tiles", type: "raster", source: "osm-tiles", minzoom: 0, maxzoom: 19 }],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.on("load", () => setMapLoaded(true));
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // Render markers + trajectory lines
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    const m = map.current;

    // Clear old markers
    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];

    // Remove old trajectory source/layer
    if (m.getLayer("trajectory-lines")) m.removeLayer("trajectory-lines");
    if (m.getSource("trajectories")) m.removeSource("trajectories");

    const trajectoryFeatures: GeoJSON.Feature[] = [];

    // 1) Render worker markers (all workers with valid GPS)
    for (const w of workers) {
      if (!w.lat || !w.lng || (w.lat === 0 && w.lng === 0)) continue;
      const isBiker = w.role === "biker";
      const el = document.createElement("div");
      el.className = "flex items-center justify-center rounded-full border-2 border-white shadow-lg cursor-pointer";
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.backgroundColor = w.status === "active" ? (isBiker ? "#06b6d4" : "#3b82f6") 
        : w.status === "stale" ? "#f59e0b" : "#6b7280";
      el.innerHTML = isBiker
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17V5l7 3-7 4"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 13.52 9H12"/><circle cx="7" cy="18" r="2"/><circle cx="20" cy="18" r="2"/></svg>';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([w.lng, w.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div class="p-2">
            <p class="font-bold text-sm">${w.name}</p>
            <p class="text-xs capitalize">${w.role} • ${w.status}</p>
            <p class="text-xs text-gray-500">${new Date(w.updated_at).toLocaleTimeString()}</p>
          </div>`
        ))
        .addTo(m);
      markersRef.current.push(marker);
    }

    // 2) Render delivery destination markers + trajectory lines
    for (const { task, worker } of taskWorkerPairs) {
      if (!task.delivery_lat || !task.delivery_lng || (task.delivery_lat === 0 && task.delivery_lng === 0)) continue;

      // Destination pin
      const el = document.createElement("div");
      el.className = "flex items-center justify-center rounded-lg border-2 border-white shadow-lg cursor-pointer";
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.backgroundColor = taskStatusColor[task.status] || "#6b7280";
      el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([task.delivery_lng, task.delivery_lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div class="p-2">
            <p class="font-bold text-sm">${task.recipient_name || "Delivery"}</p>
            <p class="text-xs">${task.delivery_address || ""}</p>
            ${task.order_number ? `<p class="text-xs font-medium">Order: ${task.order_number}</p>` : ""}
            <p class="text-xs capitalize mt-1">Status: ${task.status}</p>
            ${task.worker_name ? `<p class="text-xs">Assigned: ${task.worker_name}</p>` : '<p class="text-xs text-red-500">Unassigned</p>'}
          </div>`
        ))
        .addTo(m);
      markersRef.current.push(marker);

      // Trajectory line: worker position → delivery destination
      if (worker && worker.lat && worker.lng && worker.lat !== 0 && worker.lng !== 0) {
        trajectoryFeatures.push({
          type: "Feature",
          properties: { status: task.status, workerRole: worker.role },
          geometry: {
            type: "LineString",
            coordinates: [
              [worker.lng, worker.lat],
              [task.delivery_lng, task.delivery_lat],
            ],
          },
        });
      } else if (task.pickup_lat && task.pickup_lng) {
        // Fallback: store pickup → delivery destination
        trajectoryFeatures.push({
          type: "Feature",
          properties: { status: task.status, workerRole: "fallback" },
          geometry: {
            type: "LineString",
            coordinates: [
              [task.pickup_lng, task.pickup_lat],
              [task.delivery_lng, task.delivery_lat],
            ],
          },
        });
      }
    }

    // Add trajectory lines as GeoJSON source + layer
    if (trajectoryFeatures.length > 0) {
      m.addSource("trajectories", {
        type: "geojson",
        data: { type: "FeatureCollection", features: trajectoryFeatures },
      });
      m.addLayer({
        id: "trajectory-lines",
        type: "line",
        source: "trajectories",
        paint: {
          "line-color": ["match", ["get", "status"],
            "in_transit", "#8b5cf6",
            "assigned", "#3b82f6",
            "pending", "#f59e0b",
            "#6b7280"
          ],
          "line-width": 2.5,
          "line-dasharray": [3, 2],
          "line-opacity": 0.8,
        },
      });
    }
  }, [mapLoaded, workers, taskWorkerPairs]);

  const handleRefresh = () => {
    refetchWorkers();
    refetchTasks();
    refetchRoutes();
  };

  const flyToTask = (task: LiveDeliveryTask) => {
    if (!map.current || !task.delivery_lat || !task.delivery_lng) return;
    setSelectedTask(task.id);
    map.current.flyTo({ center: [task.delivery_lng, task.delivery_lat], zoom: 14 });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              Live Map
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time delivery tracking • {workers.filter(w => w.status === 'active').length} workers online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Radio className="h-4 w-4 text-green-500 animate-pulse" />
            <span>Live</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />
          
          {/* Map Controls */}
          <div className="absolute top-4 left-4 bg-background/90 backdrop-blur rounded-lg p-2 flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36">
                <Layers className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="driver">Drivers Only</SelectItem>
                <SelectItem value="biker">Bikers Only</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur rounded-lg p-3 text-sm space-y-1.5">
            <p className="font-medium mb-1">Legend</p>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
              <span>Driver (active)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#06b6d4" }} />
              <span>Biker (active)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-lg" style={{ backgroundColor: "#f59e0b" }} />
              <span>Pending Delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-lg" style={{ backgroundColor: "#8b5cf6" }} />
              <span>In Transit</span>
            </div>
            <div className="flex items-center gap-2 border-t pt-1.5 mt-1">
              <div className="w-6 border-t-2 border-dashed" style={{ borderColor: "#3b82f6" }} />
              <span>Trajectory Line</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l bg-background overflow-y-auto">
          {/* Stats */}
          <div className="p-4 border-b grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-500" />
                <span className="text-lg font-bold">{stats.activeDrivers}</span>
              </div>
              <p className="text-xs text-muted-foreground">Drivers Online</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10">
              <div className="flex items-center gap-2">
                <Bike className="h-4 w-4 text-cyan-500" />
                <span className="text-lg font-bold">{stats.activeBikers}</span>
              </div>
              <p className="text-xs text-muted-foreground">Bikers Online</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-500" />
                <span className="text-lg font-bold">{stats.pendingTasks}</span>
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="p-3 rounded-lg bg-violet-500/10">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-violet-500" />
                <span className="text-lg font-bold">{stats.inTransit}</span>
              </div>
              <p className="text-xs text-muted-foreground">In Transit</p>
            </div>
          </div>

          {/* Delivery Tasks */}
          <div className="p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Active Deliveries ({filteredPairs.length})
            </h3>
            <div className="space-y-2">
              {filteredPairs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active deliveries</p>
              ) : (
                filteredPairs.map(({ task, worker }) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTask === task.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => flyToTask(task)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">
                        {task.recipient_name || task.order_number || "Delivery"}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                        style={{ color: taskStatusColor[task.status], borderColor: taskStatusColor[task.status] }}
                      >
                        {task.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{task.delivery_address}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {worker ? (
                        <>
                          {task.biker_id ? (
                            <Bike className="h-3 w-3 text-cyan-500" />
                          ) : (
                            <Truck className="h-3 w-3 text-blue-500" />
                          )}
                          <span className="text-xs">{worker.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              worker.status === "active" ? "text-green-600 border-green-600"
                                : worker.status === "stale" ? "text-amber-600 border-amber-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {worker.status}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          No worker assigned / no GPS
                        </span>
                      )}
                    </div>
                    {task.order_number && (
                      <p className="text-[10px] text-muted-foreground mt-1">Order: {task.order_number}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
