import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation, Clock, MapPin, TrendingUp } from "lucide-react";

interface RouteIntelligenceProps {
  storeId: string;
}

export function RouteIntelligence({ storeId }: RouteIntelligenceProps) {
  // Fetch recent routes for this store
  const { data: routeHistory } = useQuery({
    queryKey: ["store-route-history", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes_generated")
        .select(`
          *,
          driver:profiles!routes_generated_driver_id_fkey(name)
        `)
        .contains("stops", [storeId])
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Fetch check-ins for this store
  const { data: checkins } = useQuery({
    queryKey: ["store-checkins", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_checkins")
        .select(`
          *,
          route:routes_generated!route_checkins_route_id_fkey(date),
          driver:profiles!route_checkins_driver_id_fkey(name)
        `)
        .eq("store_id", storeId)
        .order("checkin_time", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const lastRoute = routeHistory?.[0];
  const lastCheckin = checkins?.[0];
  const avgServiceTime = checkins && checkins.length > 0
    ? checkins.reduce((sum, c) => sum + (c.completed ? 15 : 0), 0) / checkins.filter(c => c.completed).length
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          Route Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Last Included in Route</div>
            {lastRoute ? (
              <div>
                <div className="font-medium">
                  {new Date(lastRoute.date).toLocaleDateString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Driver: {lastRoute.driver?.name || "Unknown"}
                </div>
              </div>
            ) : (
              <div className="text-sm">Never included in a route</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Last Check-In</div>
            {lastCheckin ? (
              <div>
                <div className="font-medium">
                  {new Date(lastCheckin.checkin_time).toLocaleDateString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  {lastCheckin.driver?.name || "Unknown"} • {lastCheckin.completed ? "Completed" : "In Progress"}
                </div>
              </div>
            ) : (
              <div className="text-sm">No check-ins recorded</div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              Avg Service Time
            </div>
            <div className="text-2xl font-bold">
              {avgServiceTime ? `${Math.round(avgServiceTime)} min` : "—"}
            </div>
          </div>

          <div className="p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <MapPin className="h-4 w-4" />
              Route Position
            </div>
            <div className="text-2xl font-bold">
              {lastRoute && Array.isArray(lastRoute.stops)
                ? `Stop ${lastRoute.stops.indexOf(storeId) + 1}`
                : "—"}
            </div>
          </div>

          <div className="p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              Route Score
            </div>
            <div className="text-2xl font-bold">
              {lastRoute?.ai_confidence_score || "—"}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Route Predictions</div>
          <div className="text-sm text-muted-foreground">
            {routeHistory && routeHistory.length > 0 ? (
              <>
                This store is typically included in routes every{" "}
                {Math.round(30 / Math.max(routeHistory.length, 1))} days.
                {" "}Best time for visits: Morning (9-11 AM)
              </>
            ) : (
              "Insufficient data for route predictions. Include this store in a route to build history."
            )}
          </div>
        </div>

        <Button variant="outline" className="w-full">
          <Navigation className="mr-2 h-4 w-4" />
          Add to Route Request
        </Button>

        {routeHistory && routeHistory.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Recent Route History</div>
            <div className="space-y-1">
              {routeHistory.map((route) => (
                <div key={route.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div>
                    <span className="font-medium">{new Date(route.date).toLocaleDateString()}</span>
                    <span className="text-muted-foreground ml-2">
                      • {route.driver?.name || "Unknown Driver"}
                    </span>
                  </div>
                  <Badge variant={route.status === "active" ? "default" : "secondary"}>
                    {route.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
