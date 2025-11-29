import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Package, TrendingUp, Clock, MapPin, Box, Calculator, 
  Zap, Search, AlertTriangle, BarChart3, Building2 
} from "lucide-react";
import { format } from "date-fns";
import { GRABBA_BRANDS, getBrandConfig, formatTubesAsBoxes, GrabbaBrand, GRABBA_BRAND_CONFIG } from "@/config/grabbaBrands";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 3 — GRABBA INVENTORY ENGINE
// Live tube counts, ETA engine, consumption tracking, neighborhood intelligence
// ═══════════════════════════════════════════════════════════════════════════════

export default function GrabbaInventory() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [search, setSearch] = useState("");

  // ─────────────────────────────────────────────────────────────────────────────
  // LIVE MANUAL INVENTORY (store_tube_inventory)
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: liveInventory, isLoading: loadingInventory } = useQuery({
    queryKey: ["grabba-live-inventory", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data } = await supabase
        .from("store_tube_inventory")
        .select(`
          *,
          store:stores(id, name, company_id, neighborhood)
        `)
        .in("brand", brandsToQuery)
        .order("last_updated", { ascending: false });

      return data || [];
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTOMATED CONSUMPTION ENGINE + ETA ENGINE
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: consumptionEngine } = useQuery({
    queryKey: ["grabba-consumption-engine", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("*")
        .in("brand", brandsToQuery)
        .order("created_at", { ascending: true });
      
      if (!orders || orders.length === 0) return {
        totalTubes: 0,
        totalBoxes: 0,
        avgTubesPerWeek: 0,
        avgTubesPerDay: 0,
        estimatedInventory: 0,
        etaDays: 0,
        consumptionRate: 0,
        lastOrderDate: null,
        daysSinceLastOrder: 0,
        orderCount: 0,
      };

      const totalTubes = orders.reduce((sum, o) => sum + (o.tubes_total || (o.boxes || 0) * 100), 0);
      const totalBoxes = orders.reduce((sum, o) => sum + (o.boxes || 0), 0);
      
      const firstOrder = new Date(orders[0].created_at);
      const lastOrder = new Date(orders[orders.length - 1].created_at);
      const weeksBetween = Math.max(1, Math.floor((lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24 * 7)));
      const avgTubesPerWeek = Math.round(totalTubes / weeksBetween);
      const avgTubesPerDay = Math.round(avgTubesPerWeek / 7);

      const lastOrderTubes = orders[orders.length - 1].tubes_total || (orders[orders.length - 1].boxes || 0) * 100;
      const daysSinceLast = Math.floor((Date.now() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedConsumption = Math.round(avgTubesPerDay * daysSinceLast);
      const estimatedInventory = Math.max(0, lastOrderTubes - estimatedConsumption);
      const tubesPerDay = avgTubesPerDay;
      const etaDays = tubesPerDay > 0 ? Math.round(estimatedInventory / tubesPerDay) : 0;

      return { 
        totalTubes, 
        totalBoxes, 
        avgTubesPerWeek, 
        avgTubesPerDay,
        estimatedInventory, 
        etaDays,
        consumptionRate: avgTubesPerDay,
        lastOrderDate: lastOrder,
        daysSinceLastOrder: daysSinceLast,
        orderCount: orders.length,
      };
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // BRAND BREAKDOWN
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: brandBreakdown } = useQuery({
    queryKey: ["grabba-brand-breakdown"],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("brand, tubes_total, boxes")
        .in("brand", GRABBA_BRANDS);

      const breakdown: Record<GrabbaBrand, { tubes: number; boxes: number }> = {} as any;
      GRABBA_BRANDS.forEach(brand => {
        breakdown[brand] = { tubes: 0, boxes: 0 };
      });

      orders?.forEach(order => {
        const brand = order.brand as GrabbaBrand;
        if (breakdown[brand]) {
          breakdown[brand].tubes += order.tubes_total || (order.boxes || 0) * 100;
          breakdown[brand].boxes += order.boxes || 0;
        }
      });

      return breakdown;
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NEIGHBORHOOD INTELLIGENCE
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: neighborhoodStats } = useQuery({
    queryKey: ["grabba-neighborhood-intelligence", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      
      const { data: stores } = await supabase
        .from("stores")
        .select("neighborhood, id, name");
      
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("store_id, tubes_total, boxes, brand")
        .in("brand", brandsToQuery);

      const neighborhoodMap: Record<string, { 
        stores: number; 
        tubes: number; 
        boxes: number;
        brands: Set<string>;
        storeNames: string[];
        avgTubesPerStore: number;
      }> = {};
      
      stores?.forEach(store => {
        const hood = store.neighborhood || "Unknown";
        if (!neighborhoodMap[hood]) {
          neighborhoodMap[hood] = { stores: 0, tubes: 0, boxes: 0, brands: new Set(), storeNames: [], avgTubesPerStore: 0 };
        }
        neighborhoodMap[hood].stores++;
        neighborhoodMap[hood].storeNames.push(store.name);
      });

      orders?.forEach(order => {
        const store = stores?.find(s => s.id === order.store_id);
        const hood = store?.neighborhood || "Unknown";
        if (neighborhoodMap[hood]) {
          neighborhoodMap[hood].tubes += order.tubes_total || (order.boxes || 0) * 100;
          neighborhoodMap[hood].boxes += order.boxes || 0;
          neighborhoodMap[hood].brands.add(order.brand);
        }
      });

      // Calculate averages
      Object.values(neighborhoodMap).forEach(hood => {
        hood.avgTubesPerStore = hood.stores > 0 ? Math.round(hood.tubes / hood.stores) : 0;
      });

      return Object.entries(neighborhoodMap)
        .map(([name, data]) => ({ 
          name, 
          stores: data.stores,
          tubes: data.tubes,
          boxes: data.boxes,
          brands: Array.from(data.brands),
          avgTubesPerStore: data.avgTubesPerStore,
        }))
        .sort((a, b) => b.tubes - a.tubes)
        .slice(0, 15);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // LOW STOCK ALERTS
  // ─────────────────────────────────────────────────────────────────────────────
  const lowStockItems = liveInventory?.filter(inv => (inv.current_tubes_left || 0) < 50) || [];

  const totalLiveTubes = liveInventory?.reduce((sum, inv) => sum + (inv.current_tubes_left || 0), 0) || 0;
  const totalBrandTubes = brandBreakdown 
    ? Object.values(brandBreakdown).reduce((sum, b) => sum + b.tubes, 0) 
    : 0;

  // Filter inventory by search
  const filteredInventory = liveInventory?.filter(inv => 
    !search || 
    inv.store?.name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.store?.neighborhood?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* HEADER WITH ESTIMATED INVENTORY */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              Grabba Inventory Engine
            </h1>
            <p className="text-muted-foreground mt-1">
              Floor 3 — Live tube counts, ETA engine, consumption tracking, and neighborhood intelligence
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* ESTIMATED INVENTORY HEADER */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/20">
                  <Calculator className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Total Inventory</p>
                  <p className="text-4xl font-bold text-foreground">
                    {(consumptionEngine?.estimatedInventory || 0).toLocaleString()} tubes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatTubesAsBoxes(consumptionEngine?.estimatedInventory || 0).fractionLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">{consumptionEngine?.etaDays || 0}</p>
                  <p className="text-xs text-muted-foreground">Days Until Restock</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-500">{consumptionEngine?.avgTubesPerDay || 0}</p>
                  <p className="text-xs text-muted-foreground">Tubes/Day Burn</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{consumptionEngine?.orderCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* KPI CARDS */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Package className="h-4 w-4" />
                <span className="text-xs">Live Tubes in Field</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {totalLiveTubes.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <Box className="h-4 w-4" />
                <span className="text-xs">Total Boxes Sold</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {consumptionEngine?.totalBoxes?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Avg Tubes/Week</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {consumptionEngine?.avgTubesPerWeek?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Days Since Order</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {consumptionEngine?.daysSinceLastOrder || 0}
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${lowStockItems.length > 0 ? 'from-red-500/10 to-red-900/5 border-red-500/20' : 'from-emerald-500/10 to-emerald-900/5 border-emerald-500/20'}`}>
            <CardContent className="p-4">
              <div className={`flex items-center gap-2 ${lowStockItems.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Low Stock Alerts</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {lowStockItems.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* BRAND BREAKDOWN */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Brand Breakdown
            </CardTitle>
            <CardDescription>Tube distribution across all Grabba brands</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {GRABBA_BRANDS.map(brand => {
                const config = GRABBA_BRAND_CONFIG[brand];
                const data = brandBreakdown?.[brand] || { tubes: 0, boxes: 0 };
                const percentage = totalBrandTubes > 0 ? (data.tubes / totalBrandTubes) * 100 : 0;
                
                return (
                  <div key={brand} className={`p-4 rounded-xl border ${config.gradient}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{config.icon}</span>
                      <span className="font-medium text-foreground">{config.label}</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {data.tubes.toLocaleString()} tubes
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {data.boxes.toLocaleString()} boxes
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{percentage.toFixed(1)}% of total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* TABS: LIVE INVENTORY | TUBE MATH | NEIGHBORHOODS */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <Tabs defaultValue="live" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="live">Live Inventory</TabsTrigger>
            <TabsTrigger value="tubemath">Tube Math Engine</TabsTrigger>
            <TabsTrigger value="neighborhoods">Neighborhood Intelligence</TabsTrigger>
            <TabsTrigger value="alerts">Low Stock Alerts</TabsTrigger>
          </TabsList>

          {/* ─────────────────────────────────────────────────────────────────────────────
              LIVE INVENTORY TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="live">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Live Tube Inventory by Store</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search stores..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInventory ? (
                  <p className="text-muted-foreground">Loading inventory...</p>
                ) : filteredInventory?.length === 0 ? (
                  <p className="text-muted-foreground">No inventory data available</p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredInventory?.map(inv => {
                      const config = getBrandConfig(inv.brand);
                      const boxInfo = formatTubesAsBoxes(inv.current_tubes_left || 0);
                      const isLow = (inv.current_tubes_left || 0) < 50;
                      return (
                        <div key={inv.id} className={`p-4 rounded-xl border ${isLow ? 'border-red-500/50 bg-red-500/5' : ''} ${config.gradient}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{inv.store?.name || 'Unknown Store'}</span>
                                <Badge className={config.pill}>{config.label}</Badge>
                                {isLow && <Badge variant="destructive">Low Stock</Badge>}
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

          {/* ─────────────────────────────────────────────────────────────────────────────
              TUBE MATH ENGINE TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="tubemath">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Tube Math Engine
                </CardTitle>
                <CardDescription>Automated consumption calculations and ETA predictions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Total Tubes Sold</span>
                      </div>
                      <p className="text-2xl font-bold">{consumptionEngine?.totalTubes?.toLocaleString() || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Box className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Total Boxes</span>
                      </div>
                      <p className="text-2xl font-bold">{consumptionEngine?.totalBoxes || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Consumption Rate</span>
                      </div>
                      <p className="text-2xl font-bold">{consumptionEngine?.avgTubesPerDay || 0}/day</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="text-sm text-muted-foreground">Weekly Burn</span>
                      </div>
                      <p className="text-2xl font-bold">{consumptionEngine?.avgTubesPerWeek || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* ETA Engine */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      ETA Engine
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estimated Current Inventory</span>
                      <span className="font-bold">{consumptionEngine?.estimatedInventory?.toLocaleString() || 0} tubes</span>
                    </div>
                    <Progress 
                      value={Math.min(((consumptionEngine?.estimatedInventory || 0) / (consumptionEngine?.avgTubesPerWeek || 100)) * 100, 100)} 
                      className="h-3"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">Days Until Restock Needed</span>
                        <Badge 
                          variant={consumptionEngine?.etaDays && consumptionEngine.etaDays < 7 ? "destructive" : "secondary"}
                          className="ml-2"
                        >
                          {consumptionEngine?.etaDays || 0} days
                        </Badge>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">Last Order</span>
                        <p className="font-medium">
                          {consumptionEngine?.lastOrderDate 
                            ? format(new Date(consumptionEngine.lastOrderDate), "MMM dd, yyyy")
                            : "No orders yet"
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              NEIGHBORHOOD INTELLIGENCE TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="neighborhoods">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Neighborhood Intelligence
                </CardTitle>
                <CardDescription>Tube distribution and performance by neighborhood</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {neighborhoodStats?.map((hood, i) => (
                    <div key={hood.name} className="p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className={`text-2xl font-bold ${i < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                            #{i + 1}
                          </span>
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {hood.name}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {hood.stores} stores • {hood.avgTubesPerStore.toLocaleString()} avg tubes/store
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-foreground">{hood.tubes.toLocaleString()} tubes</div>
                          <div className="text-sm text-muted-foreground">{hood.boxes.toLocaleString()} boxes</div>
                          <div className="flex gap-1 mt-1 justify-end">
                            {hood.brands.map(brand => {
                              const config = getBrandConfig(brand as GrabbaBrand);
                              return <Badge key={brand} className={`${config.pill} text-xs`}>{config.icon}</Badge>;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!neighborhoodStats || neighborhoodStats.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No neighborhood data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              LOW STOCK ALERTS TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="alerts">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Low Stock Alerts
                </CardTitle>
                <CardDescription>Stores with less than 50 tubes remaining</CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockItems.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="text-muted-foreground">All stores are well-stocked!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lowStockItems.map(inv => {
                      const config = getBrandConfig(inv.brand);
                      return (
                        <div key={inv.id} className="p-4 rounded-xl border border-red-500/50 bg-red-500/5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                              <div>
                                <span className="font-medium text-foreground">{inv.store?.name || 'Unknown Store'}</span>
                                <Badge className={`${config.pill} ml-2`}>{config.label}</Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xl font-bold text-red-500">
                                {(inv.current_tubes_left || 0)} tubes left
                              </span>
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
        </Tabs>
      </div>
    </div>
  );
}
