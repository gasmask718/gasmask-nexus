import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  MapPin, 
  Truck, 
  Bike, 
  Navigation, 
  Radio, 
  AlertTriangle,
  Maximize2,
  Layers,
  RefreshCw,
  User
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Default to NYC for demo
const DEFAULT_CENTER: [number, number] = [-74.006, 40.7128];
const DEFAULT_ZOOM = 11;

export default function LiveMapPage() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  // Fetch active routes with stops
  const { data: activeRoutes = [], refetch } = useQuery({
    queryKey: ["live-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          assignee:profiles!routes_assigned_to_fkey(id, name, role),
          route_stops(
            id,
            planned_order,
            status,
            store:stores(id, name, lat, lng, address_city)
          )
        `)
        .in("status", ["active", "planned"])
        .order("date", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch stores for the heat map
  const { data: stores = [] } = useQuery({
    queryKey: ["stores-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, lat, lng, status, visit_risk_level")
        .eq("status", "active")
        .not("lat", "is", null)
        .not("lng", "is", null);
      
      if (error) throw error;
      return data;
    },
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Use a free tile provider for demo
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
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm-tiles",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    
    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add markers when map is loaded
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // Clear existing markers (simple approach)
    const markers = document.querySelectorAll(".mapboxgl-marker");
    markers.forEach((m) => m.remove());

    // Add store markers
    stores.forEach((store) => {
      if (!store.lat || !store.lng) return;

      const color = store.visit_risk_level === "critical" ? "#ef4444" 
        : store.visit_risk_level === "at_risk" ? "#f97316" 
        : "#22c55e";

      const el = document.createElement("div");
      el.className = "w-4 h-4 rounded-full border-2 border-white cursor-pointer";
      el.style.backgroundColor = color;

      new mapboxgl.Marker(el)
        .setLngLat([store.lng, store.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <p class="font-bold">${store.name}</p>
              <p class="text-sm">Risk: ${store.visit_risk_level || "normal"}</p>
            </div>`
          )
        )
        .addTo(map.current!);
    });

    // Add route markers (drivers/bikers)
    activeRoutes.forEach((route) => {
      if (!route.route_stops || route.route_stops.length === 0) return;

      // Get first stop with coordinates as approximate driver location
      const firstStop = route.route_stops.find((s: any) => s.store?.lat && s.store?.lng);
      if (!firstStop) return;

      const isDriver = route.type === "driver";
      const el = document.createElement("div");
      el.className = "flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white cursor-pointer";
      el.innerHTML = isDriver 
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17V5l7 3-7 4"/></svg>';

      new mapboxgl.Marker(el)
        .setLngLat([firstStop.store.lng, firstStop.store.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <p class="font-bold">${route.assignee?.name || "Unassigned"}</p>
              <p class="text-sm">${route.route_stops.length} stops • ${route.status}</p>
            </div>`
          )
        )
        .addTo(map.current!);
    });
  }, [mapLoaded, stores, activeRoutes]);

  const filteredRoutes = filterType === "all" 
    ? activeRoutes 
    : activeRoutes.filter((r) => r.type === filterType);

  // Stats
  const stats = {
    activeDrivers: activeRoutes.filter((r) => r.type === "driver" && r.status === "active").length,
    activeBikers: activeRoutes.filter((r) => r.type === "biker" && r.status === "active").length,
    totalStops: activeRoutes.reduce((sum, r) => sum + (r.route_stops?.length || 0), 0),
    criticalStores: stores.filter((s) => s.visit_risk_level === "critical").length,
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
            <p className="text-sm text-muted-foreground">Real-time delivery tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Radio className="h-4 w-4 text-green-500 animate-pulse" />
            <span>Live</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
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
              <SelectTrigger className="w-32">
                <Layers className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="driver">Drivers</SelectItem>
                <SelectItem value="biker">Bikers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur rounded-lg p-3 text-sm space-y-2">
            <p className="font-medium">Legend</p>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Normal Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>At Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Critical</span>
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
              <p className="text-xs text-muted-foreground">Active Drivers</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10">
              <div className="flex items-center gap-2">
                <Bike className="h-4 w-4 text-cyan-500" />
                <span className="text-lg font-bold">{stats.activeBikers}</span>
              </div>
              <p className="text-xs text-muted-foreground">Active Bikers</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-lg font-bold">{stats.totalStops}</span>
              </div>
              <p className="text-xs text-muted-foreground">Total Stops</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-lg font-bold">{stats.criticalStores}</span>
              </div>
              <p className="text-xs text-muted-foreground">Critical Stores</p>
            </div>
          </div>

          {/* Active Routes */}
          <div className="p-4">
            <h3 className="font-medium mb-3">Active Routes</h3>
            <div className="space-y-3">
              {filteredRoutes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active routes</p>
              ) : (
                filteredRoutes.map((route) => (
                  <div 
                    key={route.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedRoute === route.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setSelectedRoute(route.id);
                      // Center map on first stop
                      const firstStop = route.route_stops?.find((s: any) => s.store?.lat && s.store?.lng);
                      if (firstStop && map.current) {
                        map.current.flyTo({
                          center: [firstStop.store.lng, firstStop.store.lat],
                          zoom: 14,
                        });
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {route.type === "driver" ? (
                          <Truck className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Bike className="h-4 w-4 text-cyan-500" />
                        )}
                        <span className="font-medium text-sm">{route.assignee?.name || "Unassigned"}</span>
                      </div>
                      <Badge 
                        variant={route.status === "active" ? "default" : "outline"}
                        className={route.status === "active" ? "bg-green-500" : ""}
                      >
                        {route.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>{route.route_stops?.length || 0} stops</span>
                      <span className="mx-2">•</span>
                      <span>{route.territory || "Multi-Zone"}</span>
                    </div>
                    {route.route_stops && route.route_stops.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Stops:</p>
                        <div className="space-y-1">
                          {route.route_stops.slice(0, 3).map((stop: any, idx: number) => (
                            <div key={stop.id} className="flex items-center gap-2 text-xs">
                              <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="truncate">{stop.store?.name || "Unknown"}</span>
                              {stop.status === "completed" && (
                                <Badge variant="outline" className="text-green-600 text-[10px]">Done</Badge>
                              )}
                            </div>
                          ))}
                          {route.route_stops.length > 3 && (
                            <p className="text-xs text-muted-foreground pl-6">
                              +{route.route_stops.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
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
