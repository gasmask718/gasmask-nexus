import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, TrendingUp, Clock, MapPin, Box } from "lucide-react";
import { format } from "date-fns";
import { GRABBA_BRANDS, getBrandConfig, formatTubesAsBoxes } from "@/config/grabbaBrands";

export default function GrabbaInventory() {
  const [brandFilter, setBrandFilter] = useState<string>("all");

  // Fetch live inventory
  const { data: liveInventory, isLoading: loadingInventory } = useQuery({
    queryKey: ["grabba-live-inventory", brandFilter],
    queryFn: async () => {
      let query = supabase
        .from("store_tube_inventory")
        .select(`
          *,
          store:stores(id, name, company_id, neighborhood)
        `)
        .order("last_updated", { ascending: false });

      if (brandFilter !== "all") {
        query = query.eq("brand", brandFilter);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Fetch orders for ETA calculation
  const { data: orderStats } = useQuery({
    queryKey: ["grabba-order-stats", brandFilter],
    queryFn: async () => {
      let query = supabase
        .from("wholesale_orders")
        .select("*")
        .in("brand", GRABBA_BRANDS)
        .order("created_at", { ascending: true });

      if (brandFilter !== "all") {
        query = query.eq("brand", brandFilter);
      }

      const { data: orders } = await query;
      
      if (!orders || orders.length === 0) return {
        totalTubes: 0,
        totalBoxes: 0,
        avgTubesPerWeek: 0,
        estimatedInventory: 0,
        etaDays: 0,
      };

      const totalTubes = orders.reduce((sum, o) => sum + (o.tubes_total || (o.boxes || 0) * 100), 0);
      const totalBoxes = orders.reduce((sum, o) => sum + (o.boxes || 0), 0);
      
      const firstOrder = new Date(orders[0].created_at);
      const lastOrder = new Date(orders[orders.length - 1].created_at);
      const weeksBetween = Math.max(1, Math.floor((lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24 * 7)));
      const avgTubesPerWeek = Math.round(totalTubes / weeksBetween);

      const lastOrderTubes = orders[orders.length - 1].tubes_total || (orders[orders.length - 1].boxes || 0) * 100;
      const daysSinceLast = Math.floor((Date.now() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedConsumption = Math.round((avgTubesPerWeek / 7) * daysSinceLast);
      const estimatedInventory = Math.max(0, lastOrderTubes - estimatedConsumption);
      const tubesPerDay = avgTubesPerWeek / 7;
      const etaDays = tubesPerDay > 0 ? Math.round(estimatedInventory / tubesPerDay) : 0;

      return { totalTubes, totalBoxes, avgTubesPerWeek, estimatedInventory, etaDays };
    },
  });

  // Fetch neighborhood stats
  const { data: neighborhoodStats } = useQuery({
    queryKey: ["grabba-neighborhood-stats"],
    queryFn: async () => {
      const { data: stores } = await supabase
        .from("stores")
        .select("neighborhood, id");
      
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("store_id, tubes_total, boxes, brand")
        .in("brand", GRABBA_BRANDS);

      const neighborhoodMap: Record<string, { stores: number; tubes: number; brands: Set<string> }> = {};
      
      stores?.forEach(store => {
        const hood = store.neighborhood || "Unknown";
        if (!neighborhoodMap[hood]) neighborhoodMap[hood] = { stores: 0, tubes: 0, brands: new Set() };
        neighborhoodMap[hood].stores++;
      });

      orders?.forEach(order => {
        const store = stores?.find(s => s.id === order.store_id);
        const hood = store?.neighborhood || "Unknown";
        if (neighborhoodMap[hood]) {
          neighborhoodMap[hood].tubes += order.tubes_total || (order.boxes || 0) * 100;
          neighborhoodMap[hood].brands.add(order.brand);
        }
      });

      return Object.entries(neighborhoodMap)
        .map(([name, data]) => ({ name, ...data, brands: Array.from(data.brands) }))
        .sort((a, b) => b.tubes - a.tubes)
        .slice(0, 10);
    },
  });

  const totalLiveTubes = liveInventory?.reduce((sum, inv) => sum + (inv.current_tubes_left || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              Grabba Inventory Intelligence
            </h1>
            <p className="text-muted-foreground mt-1">
              Live tube counts, ETA, and neighborhood performance across all Grabba brands
            </p>
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {GRABBA_BRANDS.map(brand => (
                <SelectItem key={brand} value={brand}>
                  {getBrandConfig(brand).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Global Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Package className="h-5 w-5" />
                <span className="text-sm">Live Tubes in Field</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                {totalLiveTubes.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatTubesAsBoxes(totalLiveTubes).fractionLabel}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <Box className="h-5 w-5" />
                <span className="text-sm">Total Boxes Sold</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                {orderStats?.totalBoxes?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                {orderStats?.totalTubes?.toLocaleString() || 0} tubes
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm">Avg Tubes/Week</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                {orderStats?.avgTubesPerWeek?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Clock className="h-5 w-5" />
                <span className="text-sm">Avg ETA to Restock</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                {orderStats?.etaDays || 0} days
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="live" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="live">Live Inventory</TabsTrigger>
            <TabsTrigger value="neighborhoods">Neighborhood Intelligence</TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Live Tube Inventory by Store</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingInventory ? (
                  <p className="text-muted-foreground">Loading inventory...</p>
                ) : liveInventory?.length === 0 ? (
                  <p className="text-muted-foreground">No inventory data available</p>
                ) : (
                  <div className="space-y-3">
                    {liveInventory?.map(inv => {
                      const config = getBrandConfig(inv.brand);
                      const boxInfo = formatTubesAsBoxes(inv.current_tubes_left || 0);
                      return (
                        <div key={inv.id} className={`p-4 rounded-xl border bg-gradient-to-br ${config.gradient}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{inv.store?.name || 'Unknown Store'}</span>
                                <Badge className={config.pill}>{config.label}</Badge>
                              </div>
                              {inv.store?.neighborhood && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3" /> {inv.store.neighborhood}
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-foreground">
                                {(inv.current_tubes_left || 0).toLocaleString()} tubes
                              </div>
                              <div className="text-sm text-muted-foreground">{boxInfo.fractionLabel}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Updated: {inv.last_updated ? format(new Date(inv.last_updated), "MM/dd/yyyy") : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="neighborhoods">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Top Neighborhoods by Tube Movement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {neighborhoodStats?.map((hood, i) => (
                    <div key={hood.name} className="p-4 rounded-xl border border-border/50 bg-card/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-muted-foreground">#{i + 1}</span>
                          <div>
                            <div className="font-medium text-foreground">{hood.name}</div>
                            <div className="text-sm text-muted-foreground">{hood.stores} stores</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-foreground">{hood.tubes.toLocaleString()} tubes</div>
                          <div className="flex gap-1 mt-1">
                            {hood.brands.map(brand => {
                              const config = getBrandConfig(brand);
                              return <Badge key={brand} className={`${config.pill} text-xs`}>{config.icon}</Badge>;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
