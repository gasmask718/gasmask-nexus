import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  MapPin, CheckCircle, Camera, Navigation, Clock, Package, 
  Home, History, Play, BookOpen, AlertTriangle, ArrowLeft,
  Truck, Phone
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Demo route data for new drivers
const DEMO_ROUTE = {
  id: "DEMO-001",
  stops: [
    {
      id: "demo-1",
      name: "Sample Store A - Quick Mart",
      address: "123 Demo Street",
      city: "Training City",
      state: "TX",
      zip: "75001",
      phone: "(555) 123-4567",
      status: "pending"
    },
    {
      id: "demo-2", 
      name: "Sample Store B - Corner Shop",
      address: "456 Example Avenue",
      city: "Training City",
      state: "TX",
      zip: "75002",
      phone: "(555) 234-5678",
      status: "pending"
    },
    {
      id: "demo-3",
      name: "Sample Store C - Downtown Goods",
      address: "789 Practice Boulevard",
      city: "Training City", 
      state: "TX",
      zip: "75003",
      phone: "(555) 345-6789",
      status: "pending"
    }
  ],
  distance_km: 12.5,
  estimated_minutes: 45,
  ai_confidence_score: 92
};

export default function MyRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkinStore, setCheckinStore] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [demoStarted, setDemoStarted] = useState(false);
  const [demoCheckins, setDemoCheckins] = useState<string[]>([]);

  // STATE A: Fetch today's active route
  const { data: todaysRoute, refetch, isLoading: loadingToday } = useQuery({
    queryKey: ["my-route", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("routes_generated")
        .select("*")
        .eq("driver_id", user?.id)
        .eq("date", today)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  // STATE B: Fetch last completed route (for fallback)
  const { data: lastCompletedRoute } = useQuery({
    queryKey: ["last-completed-route", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes_generated")
        .select("*")
        .eq("driver_id", user?.id)
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user && !todaysRoute,
  });

  // STATE B: Fetch next scheduled route
  const { data: nextScheduledRoute } = useQuery({
    queryKey: ["next-scheduled-route", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("routes_generated")
        .select("*")
        .eq("driver_id", user?.id)
        .eq("status", "scheduled")
        .gt("date", today)
        .order("date", { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user && !todaysRoute,
  });

  // Check if history exists
  const { data: hasHistory } = useQuery({
    queryKey: ["route-history-check", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("routes_generated")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", user?.id);

      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: !!user && !todaysRoute,
  });

  // Fetch store details for stops
  const { data: routeStores } = useQuery({
    queryKey: ["route-stores", todaysRoute?.stops],
    queryFn: async () => {
      if (!todaysRoute?.stops) return [];
      
      const stops = Array.isArray(todaysRoute.stops) ? todaysRoute.stops as string[] : [];
      if (stops.length === 0) return [];

      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .in("id", stops);

      if (error) throw error;

      return stops.map((id: string) => data.find((s) => s.id === id)).filter(Boolean);
    },
    enabled: !!todaysRoute?.stops,
  });

  // Fetch checkins
  const { data: checkins } = useQuery({
    queryKey: ["route-checkins", todaysRoute?.id],
    queryFn: async () => {
      if (!todaysRoute?.id) return [];

      const { data, error } = await supabase
        .from("route_checkins")
        .select("*")
        .eq("route_id", todaysRoute.id)
        .order("checkin_time", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!todaysRoute?.id,
  });

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async ({ storeId, completed }: { storeId: string; completed: boolean }) => {
      const { error } = await supabase.from("route_checkins").insert({
        route_id: todaysRoute!.id,
        store_id: storeId,
        driver_id: user!.id,
        notes: notes || null,
        completed,
      });

      if (error) throw error;

      if (completed) {
        const { awardXP, XP_RULES } = await import("@/utils/xpCalculator");
        await awardXP(user!.id, XP_RULES.STORE_VISIT, "visit");
      }
    },
    onSuccess: () => {
      toast.success("Check-in recorded!");
      setCheckinStore(null);
      setNotes("");
      refetch();
    },
    onError: (error: Error) => {
      toast.error("Failed to check in", { description: error.message });
    },
  });

  const isStoreCompleted = (storeId: string) => {
    return checkins?.some((c) => c.store_id === storeId && c.completed);
  };

  // Demo mode handlers
  const handleDemoCheckin = (stopId: string) => {
    setDemoCheckins(prev => [...prev, stopId]);
    toast.success("Demo check-in recorded!", { description: "This is a simulated action." });
    setCheckinStore(null);
    setNotes("");
  };

  const isDemoStopCompleted = (stopId: string) => demoCheckins.includes(stopId);

  // Determine current state
  const routeState = todaysRoute 
    ? "ACTIVE" 
    : (hasHistory || lastCompletedRoute || nextScheduledRoute) 
      ? "HISTORY_EXISTS" 
      : "DEMO";

  // ═══════════════════════════════════════════════════════════════════
  // STATE A: Active Route
  // ═══════════════════════════════════════════════════════════════════
  if (routeState === "ACTIVE" && todaysRoute) {
    const completedCount = routeStores?.filter((s) => isStoreCompleted(s.id)).length || 0;
    const totalStops = routeStores?.length || 0;

    return (
      <div className="min-h-screen bg-background pb-20">
        {/* Header Stats */}
        <div className="bg-card border-b p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/delivery/driver-home")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold">Today's Route</h1>
            </div>
            <Badge variant={completedCount === totalStops ? "default" : "secondary"}>
              {completedCount}/{totalStops} Complete
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-muted-foreground">Distance</div>
              <div className="font-bold">{todaysRoute.distance_km?.toFixed(1)} km</div>
            </div>
            <div>
              <div className="text-muted-foreground">Time</div>
              <div className="font-bold">{todaysRoute.estimated_minutes} min</div>
            </div>
            <div>
              <div className="text-muted-foreground">AI Score</div>
              <div className="font-bold">{todaysRoute.ai_confidence_score || 0}</div>
            </div>
          </div>
        </div>

        {/* Stop List */}
        <div className="p-4 space-y-3">
          {routeStores?.map((store, index) => {
            const completed = isStoreCompleted(store.id);
            const lastCheckin = checkins?.find((c) => c.store_id === store.id);

            return (
              <Card key={store.id} className={completed ? "border-green-500 bg-green-50/50 dark:bg-green-950/20" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">Stop {index + 1}</Badge>
                        {completed && <CheckCircle className="h-4 w-4 text-green-600" />}
                      </div>
                      <h3 className="font-bold text-lg">{store.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {store.address_street}
                        <br />
                        {store.address_city}, {store.address_state} {store.address_zip}
                      </p>
                      {store.phone && (
                        <p className="text-sm text-muted-foreground mt-1">📞 {store.phone}</p>
                      )}
                      {lastCheckin && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last check-in: {new Date(lastCheckin.checkin_time).toLocaleTimeString()}
                          {lastCheckin.notes && ` • ${lastCheckin.notes}`}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/stores/${store.id}`)}>
                        <MapPin className="h-4 w-4" />
                      </Button>
                      {!completed && (
                        <Button size="sm" onClick={() => setCheckinStore(store)}>
                          Check In
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/delivery/driver-home")}>
            <Home className="mr-2 h-4 w-4" />
            Driver Home
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate("/routes")}>
            <History className="mr-2 h-4 w-4" />
            Route History
          </Button>
        </div>

        {/* Check-in Modal */}
        <Dialog open={!!checkinStore} onOpenChange={(open) => !open && setCheckinStore(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Check In: {checkinStore?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this visit..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => checkinMutation.mutate({ storeId: checkinStore?.id, completed: false })}
                  disabled={checkinMutation.isPending}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Arrived
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => checkinMutation.mutate({ storeId: checkinStore?.id, completed: true })}
                  disabled={checkinMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Complete
                </Button>
              </div>
              <Button variant="outline" className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Upload Photos
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE B: No Active Route, But History Exists
  // ═══════════════════════════════════════════════════════════════════
  if (routeState === "HISTORY_EXISTS") {
    return (
      <div className="min-h-screen bg-background p-4 pb-20">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery/driver-home")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">My Route</h1>
        </div>

        {/* No Route Today Card */}
        <Card className="mb-6 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-6 text-center">
            <Navigation className="h-12 w-12 mx-auto mb-4 text-amber-600" />
            <h2 className="text-xl font-semibold mb-2">No Route Assigned for Today</h2>
            <p className="text-muted-foreground mb-4">
              Check back later or contact your dispatcher for route assignments.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate("/delivery/driver-home")}>
                <Home className="mr-2 h-4 w-4" />
                Driver Home
              </Button>
              <Button variant="outline">
                <Phone className="mr-2 h-4 w-4" />
                Contact Dispatcher
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Last Completed Route */}
        {lastCompletedRoute && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Last Completed Route
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{new Date(lastCompletedRoute.date).toLocaleDateString()}</p>
                  <p className="text-sm text-muted-foreground">
                    {lastCompletedRoute.distance_km?.toFixed(1)} km • {lastCompletedRoute.estimated_minutes} min
                  </p>
                </div>
                <Badge variant="secondary">
                  {Array.isArray(lastCompletedRoute.stops) ? lastCompletedRoute.stops.length : 0} stops
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Scheduled Route */}
        {nextScheduledRoute && (
          <Card className="mb-4 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Upcoming Route
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{new Date(nextScheduledRoute.date).toLocaleDateString()}</p>
                  <p className="text-sm text-muted-foreground">
                    {nextScheduledRoute.distance_km?.toFixed(1)} km • {nextScheduledRoute.estimated_minutes} min
                  </p>
                </div>
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  Scheduled
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/delivery/driver-home")}>
            <Home className="mr-2 h-4 w-4" />
            Driver Home
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate("/routes")}>
            <History className="mr-2 h-4 w-4" />
            Route History
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE C: Demo Mode (New Driver / No History)
  // ═══════════════════════════════════════════════════════════════════
  const demoCompletedCount = demoCheckins.length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Demo Banner */}
      <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-300 dark:border-amber-700 p-3">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-medium">
            This is a demo route for training purposes. Actions do not affect live data.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="bg-card border-b p-4 sticky top-[52px] z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/delivery/driver-home")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Demo Route</h1>
              <p className="text-xs text-muted-foreground">Route: {DEMO_ROUTE.id}</p>
            </div>
          </div>
          <Badge variant={demoCompletedCount === 3 ? "default" : "secondary"}>
            {demoCompletedCount}/3 Complete
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="text-muted-foreground">Distance</div>
            <div className="font-bold">{DEMO_ROUTE.distance_km} km</div>
          </div>
          <div>
            <div className="text-muted-foreground">Time</div>
            <div className="font-bold">{DEMO_ROUTE.estimated_minutes} min</div>
          </div>
          <div>
            <div className="text-muted-foreground">AI Score</div>
            <div className="font-bold">{DEMO_ROUTE.ai_confidence_score}</div>
          </div>
        </div>
      </div>

      {/* Demo Actions */}
      {!demoStarted && (
        <div className="p-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6 text-center">
              <Truck className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-semibold mb-2">Welcome to My Route</h2>
              <p className="text-muted-foreground mb-6">
                This is where you'll see your daily route with all assigned stops. 
                Try the demo below to learn how it works.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => setDemoStarted(true)} className="w-full">
                  <Play className="mr-2 h-4 w-4" />
                  Start Demo Route
                </Button>
                <Button variant="outline" className="w-full">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Learn How Routes Work
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Demo Stop List */}
      {demoStarted && (
        <div className="p-4 space-y-3">
          {DEMO_ROUTE.stops.map((stop, index) => {
            const completed = isDemoStopCompleted(stop.id);

            return (
              <Card key={stop.id} className={completed ? "border-green-500 bg-green-50/50 dark:bg-green-950/20" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">Stop {index + 1}</Badge>
                        {completed && <CheckCircle className="h-4 w-4 text-green-600" />}
                        <Badge variant="secondary" className="text-xs">Demo</Badge>
                      </div>
                      <h3 className="font-bold text-lg">{stop.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {stop.address}
                        <br />
                        {stop.city}, {stop.state} {stop.zip}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">📞 {stop.phone}</p>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Button size="sm" variant="outline" disabled>
                        <MapPin className="h-4 w-4" />
                      </Button>
                      {!completed && (
                        <Button size="sm" onClick={() => setCheckinStore(stop)}>
                          Check In
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {demoCompletedCount === 3 && (
            <Card className="bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                <h2 className="text-xl font-semibold mb-2">Demo Complete!</h2>
                <p className="text-muted-foreground mb-4">
                  You've learned how to check in at stops. When you have a real route, 
                  your actual stores will appear here.
                </p>
                <Button onClick={() => navigate("/delivery/driver-home")}>
                  <Home className="mr-2 h-4 w-4" />
                  Back to Driver Home
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => navigate("/delivery/driver-home")}>
          <Home className="mr-2 h-4 w-4" />
          Driver Home
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("/routes")}>
          <History className="mr-2 h-4 w-4" />
          Route History
        </Button>
      </div>

      {/* Demo Check-in Modal */}
      <Dialog open={!!checkinStore} onOpenChange={(open) => !open && setCheckinStore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Check In: {checkinStore?.name}
              <Badge variant="secondary" className="text-xs">Demo</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This is a simulated check-in. No data will be saved.
              </p>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Practice adding notes here..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleDemoCheckin(checkinStore?.id)}
              >
                <Clock className="mr-2 h-4 w-4" />
                Arrived
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleDemoCheckin(checkinStore?.id)}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete
              </Button>
            </div>
            <Button variant="outline" className="w-full" disabled>
              <Camera className="mr-2 h-4 w-4" />
              Upload Photos (Demo)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
