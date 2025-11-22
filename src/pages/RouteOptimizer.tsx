import { useState } from "react";
import Layout from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Loader2, Navigation, Users, Clock, TrendingUp } from "lucide-react";

export default function RouteOptimizer() {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [filterCity, setFilterCity] = useState<string>("all");

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ["stores-for-routing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, address_city, address_state, lat, lng, status")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch drivers
  const { data: drivers } = useQuery({
    queryKey: ["drivers-for-routing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, role")
        .in("role", ["driver", "biker"])
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent routes
  const { data: recentRoutes, refetch } = useQuery({
    queryKey: ["recent-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes_generated")
        .select(`
          *,
          driver:profiles!routes_generated_driver_id_fkey(name)
        `)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Generate route mutation
  const generateRoute = useMutation({
    mutationFn: async () => {
      if (!selectedDriver || selectedStores.length === 0) {
        throw new Error("Please select a driver and at least one store");
      }

      const { data, error } = await supabase.functions.invoke("route-ai", {
        body: {
          driverId: selectedDriver,
          storeIds: selectedStores,
          startingLocation: { lat: 40.7128, lng: -74.0060 }, // NYC default
          maxTimeMinutes: 480,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Route generated successfully!", {
        description: `${data.optimization.estimatedMinutes} min, ${data.optimization.totalDistanceKm.toFixed(1)} km`,
      });
      setSelectedStores([]);
      setSelectedDriver("");
      refetch();
    },
    onError: (error: Error) => {
      toast.error("Failed to generate route", {
        description: error.message,
      });
    },
  });

  const cities = Array.from(new Set(stores?.map((s) => s.address_city).filter(Boolean))) as string[];
  const filteredStores = filterCity === "all" ? stores : stores?.filter((s) => s.address_city === filterCity);

  const toggleStore = (storeId: string) => {
    setSelectedStores((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Navigation className="h-8 w-8 text-primary" />
            Route Optimizer
          </h1>
          <p className="text-muted-foreground">AI-powered route generation for optimal delivery efficiency</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stores</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stores?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{drivers?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Selected Stops</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedStores.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Routes Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {recentRoutes?.filter((r) => r.date === new Date().toISOString().split("T")[0]).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Route Generation Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Optimal Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Driver</label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose driver..." />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers?.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} ({driver.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by City</label>
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Select Stores ({selectedStores.length} selected)</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStores(filteredStores?.map((s) => s.id) || [])}
                >
                  Select All
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-lg p-4 space-y-2">
                {filteredStores?.map((store) => (
                  <div key={store.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={store.id}
                      checked={selectedStores.includes(store.id)}
                      onCheckedChange={() => toggleStore(store.id)}
                    />
                    <label htmlFor={store.id} className="text-sm flex-1 cursor-pointer">
                      {store.name} - {store.address_city}, {store.address_state}
                    </label>
                    <Badge variant={store.status === "active" ? "default" : "secondary"}>{store.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={() => generateRoute.mutate()}
              disabled={generateRoute.isPending || !selectedDriver || selectedStores.length === 0}
              className="w-full"
              size="lg"
            >
              {generateRoute.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Route...
                </>
              ) : (
                <>
                  <Navigation className="mr-2 h-4 w-4" />
                  Generate AI Route
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Routes */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRoutes?.map((route) => (
                <div key={route.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{route.driver?.name || "Unknown Driver"}</span>
                      <Badge variant="outline">{new Date(route.date).toLocaleDateString()}</Badge>
                      <Badge variant={route.status === "active" ? "default" : "secondary"}>{route.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {Array.isArray(route.stops) ? route.stops.length : 0} stops • {route.estimated_minutes} min • {route.distance_km?.toFixed(1)}{" "}
                      km • AI Score: {route.ai_confidence_score || 0}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
