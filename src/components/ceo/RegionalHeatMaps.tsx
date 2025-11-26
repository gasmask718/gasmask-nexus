import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Map, TrendingUp, Truck, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type MapMode = "orders" | "routes" | "stores";

export function RegionalHeatMaps() {
  const [mapMode, setMapMode] = useState<MapMode>("orders");

  const { data: stores } = useQuery({
    queryKey: ['stores-for-heatmap'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address_city, address_state, region_id, health_score')
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: routeData } = useQuery({
    queryKey: ['route-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: regions } = useQuery({
    queryKey: ['regions-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .order('state');
      
      if (error) throw error;
      return data;
    }
  });

  const getHeatLevel = (score: number) => {
    if (score >= 80) return { color: 'bg-green-500', label: 'Hot' };
    if (score >= 60) return { color: 'bg-yellow-500', label: 'Warm' };
    if (score >= 40) return { color: 'bg-orange-500', label: 'Cool' };
    return { color: 'bg-red-500', label: 'Cold' };
  };

  // Group stores by region
  const storesByRegion = stores?.reduce((acc: any, store) => {
    const regionId = store.region_id || 'unassigned';
    if (!acc[regionId]) {
      acc[regionId] = { stores: [], avgHealth: 0, count: 0 };
    }
    acc[regionId].stores.push(store);
    acc[regionId].count++;
    acc[regionId].avgHealth += store.health_score || 50;
    return acc;
  }, {});

  // Calculate averages
  Object.keys(storesByRegion || {}).forEach(regionId => {
    const data = storesByRegion[regionId];
    data.avgHealth = data.count > 0 ? Math.round(data.avgHealth / data.count) : 0;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            <CardTitle>Regional Heat Maps</CardTitle>
          </div>
          <Select value={mapMode} onValueChange={(v) => setMapMode(v as MapMode)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orders">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Order Density
                </div>
              </SelectItem>
              <SelectItem value="routes">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Delivery Routes
                </div>
              </SelectItem>
              <SelectItem value="stores">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Store Performance
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {mapMode === "orders" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Order volume by region</p>
            <div className="grid gap-3">
              {regions?.map((region: any) => {
                const regionStores = storesByRegion?.[region.id] || { count: 0, avgHealth: 50 };
                const heat = getHeatLevel(regionStores.avgHealth);
                return (
                  <div key={region.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${heat.color}`} />
                      <div>
                        <p className="font-medium">{region.name}</p>
                        <p className="text-sm text-muted-foreground">{regionStores.count} stores</p>
                      </div>
                    </div>
                    <Badge variant="outline">{heat.label}</Badge>
                  </div>
                );
              })}
              {(!regions || regions.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No regional data available
                </p>
              )}
            </div>
          </div>
        )}

        {mapMode === "routes" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Recent delivery performance</p>
            <div className="grid gap-3">
              {routeData?.map((route) => (
                <div key={route.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Truck className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Route {route.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(route.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge>{route.status}</Badge>
                </div>
              ))}
              {(!routeData || routeData.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No recent routes
                </p>
              )}
            </div>
          </div>
        )}

        {mapMode === "stores" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Store health & performance</p>
            <div className="grid gap-3">
              {stores?.slice(0, 10).map((store) => {
                const heat = getHeatLevel(store.health_score || 50);
                return (
                  <div key={store.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${heat.color}`} />
                      <div>
                        <p className="font-medium">{store.name}</p>
                        <p className="text-sm text-muted-foreground">{store.address_city}, {store.address_state}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{heat.label}</Badge>
                  </div>
                );
              })}
              {(!stores || stores.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No store data available
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
