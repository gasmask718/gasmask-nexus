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
import { MapPin, CheckCircle, Camera, Navigation, Clock, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MyRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkinStore, setCheckinStore] = useState<any>(null);
  const [notes, setNotes] = useState("");

  // Fetch today's route
  const { data: todaysRoute, refetch } = useQuery({
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

      // Sort stores by route order
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

      // Award XP for check-in
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

  const completedCount = routeStores?.filter((s) => isStoreCompleted(s.id)).length || 0;
  const totalStops = routeStores?.length || 0;

  if (!todaysRoute) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              No Route Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">You don't have an active route assigned for today.</p>
            <Button onClick={() => navigate("/routes")} className="w-full">
              View All Routes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Stats */}
      <div className="bg-card border-b p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">Today's Route</h1>
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
            <Card key={store.id} className={completed ? "border-green-500 bg-green-50/50" : ""}>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/stores/${store.id}`)}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                    {!completed && (
                      <Button
                        size="sm"
                        onClick={() => setCheckinStore(store)}
                      >
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

      {/* Check-in Modal */}
      <Dialog open={!!checkinStore} onOpenChange={(open) => !open && setCheckinStore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In: {checkinStore?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this visit..."
                rows={3}
              />
            </div>

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
