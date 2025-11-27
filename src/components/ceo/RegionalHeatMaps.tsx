import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Map, TrendingUp, Truck, Store, Flower2, Zap, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

type MapMode = "orders" | "routes" | "stores" | "boro";

interface StoreData {
  id: string;
  name: string;
  address_city: string | null;
  address_state: string | null;
  neighborhood: string | null;
  boro: string | null;
  status: string | null;
  sells_flowers: boolean | null;
  prime_time_energy: boolean | null;
  rpa_status: string | null;
  health_score: number | null;
  region_id: string | null;
}

export function RegionalHeatMaps() {
  const [mapMode, setMapMode] = useState<MapMode>("orders");
  const [showFlowersOnly, setShowFlowersOnly] = useState(false);
  const [showRpaOnly, setShowRpaOnly] = useState(false);

  const { data: stores } = useQuery({
    queryKey: ['stores-for-heatmap'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address_city, address_state, neighborhood, boro, status, sells_flowers, prime_time_energy, rpa_status, health_score, region_id')
        .limit(200);
      
      if (error) throw error;
      return data as StoreData[];
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

  // Filter stores based on selections
  const filteredStores = stores?.filter(store => {
    if (showFlowersOnly && !store.sells_flowers) return false;
    if (showRpaOnly && store.rpa_status !== 'rpa') return false;
    return true;
  }) || [];

  // Group stores by region
  const storesByRegion = filteredStores.reduce((acc: Record<string, { stores: StoreData[], avgHealth: number, count: number }>, store) => {
    const regionId = store.region_id || 'unassigned';
    if (!acc[regionId]) {
      acc[regionId] = { stores: [], avgHealth: 0, count: 0 };
    }
    acc[regionId].stores.push(store);
    acc[regionId].count++;
    acc[regionId].avgHealth += store.health_score || 50;
    return acc;
  }, {});

  // Group stores by boro
  const storesByBoro = filteredStores.reduce((acc: Record<string, { stores: StoreData[], avgHealth: number, count: number }>, store) => {
    const boro = store.boro || 'Other';
    if (!acc[boro]) {
      acc[boro] = { stores: [], avgHealth: 0, count: 0 };
    }
    acc[boro].stores.push(store);
    acc[boro].count++;
    acc[boro].avgHealth += store.health_score || 50;
    return acc;
  }, {});

  // Calculate averages
  Object.keys(storesByRegion).forEach(regionId => {
    const data = storesByRegion[regionId];
    data.avgHealth = data.count > 0 ? Math.round(data.avgHealth / data.count) : 0;
  });

  Object.keys(storesByBoro).forEach(boro => {
    const data = storesByBoro[boro];
    data.avgHealth = data.count > 0 ? Math.round(data.avgHealth / data.count) : 0;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            <CardTitle>Regional Heat Maps</CardTitle>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="flowers" 
                checked={showFlowersOnly} 
                onCheckedChange={(checked) => setShowFlowersOnly(!!checked)} 
              />
              <label htmlFor="flowers" className="text-sm flex items-center gap-1 cursor-pointer">
                <Flower2 className="h-3 w-3" /> Flowers
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="rpa" 
                checked={showRpaOnly} 
                onCheckedChange={(checked) => setShowRpaOnly(!!checked)} 
              />
              <label htmlFor="rpa" className="text-sm flex items-center gap-1 cursor-pointer">
                <Filter className="h-3 w-3" /> RPA Only
              </label>
            </div>
            <Select value={mapMode} onValueChange={(v) => setMapMode(v as MapMode)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orders">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    By Region
                  </div>
                </SelectItem>
                <SelectItem value="boro">
                  <div className="flex items-center gap-2">
                    <Map className="h-4 w-4" />
                    By Boro
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
        </div>
      </CardHeader>
      <CardContent>
        {mapMode === "orders" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Store density by region ({filteredStores.length} stores)</p>
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
                        <p className="text-sm text-muted-foreground">{regionStores.count} stores • Avg Health: {regionStores.avgHealth}</p>
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

        {mapMode === "boro" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Store density by boro ({filteredStores.length} stores)</p>
            <div className="grid gap-3">
              {Object.entries(storesByBoro)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([boro, data]) => {
                  const heat = getHeatLevel(data.avgHealth);
                  return (
                    <div key={boro} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${heat.color}`} />
                        <div>
                          <p className="font-medium">{boro}</p>
                          <p className="text-sm text-muted-foreground">{data.count} stores • Avg Health: {data.avgHealth}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{heat.label}</Badge>
                    </div>
                  );
                })}
              {Object.keys(storesByBoro).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No boro data available
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
            <p className="text-sm text-muted-foreground">Top performing stores ({filteredStores.length} total)</p>
            <div className="grid gap-3">
              {filteredStores
                .sort((a, b) => (b.health_score || 0) - (a.health_score || 0))
                .slice(0, 15)
                .map((store) => {
                  const heat = getHeatLevel(store.health_score || 50);
                  return (
                    <div key={store.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${heat.color}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{store.name}</p>
                            {store.sells_flowers && <Flower2 className="h-3 w-3 text-pink-500" />}
                            {store.prime_time_energy && <Zap className="h-3 w-3 text-yellow-500" />}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {store.neighborhood ? `${store.neighborhood}, ` : ''}
                            {store.boro ? `${store.boro}, ` : ''}
                            {store.address_city}, {store.address_state}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {store.rpa_status === 'rpa' && (
                          <Badge variant="secondary" className="text-xs">RPA</Badge>
                        )}
                        <Badge variant="outline">{store.health_score || 50}</Badge>
                      </div>
                    </div>
                  );
                })}
              {filteredStores.length === 0 && (
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
