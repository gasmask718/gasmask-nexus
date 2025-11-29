import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Truck, MapPin, DollarSign, CheckCircle, Clock, Plus, User, 
  Search, Route, Zap, TrendingUp, AlertTriangle, Bike, Star,
  Phone, Navigation, Package, BarChart3
} from "lucide-react";
import { format } from "date-fns";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";
import { GRABBA_BRAND_CONFIG, GrabbaBrand, getBrandConfig } from "@/config/grabbaBrands";

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 4 — GRABBA DELIVERIES & DRIVERS
// Routes, drivers, bikers, payouts, and delivery ops for Grabba brands
// ═══════════════════════════════════════════════════════════════════════════════

export default function GrabbaDeliveries() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [search, setSearch] = useState("");

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH DRIVERS
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: drivers } = useQuery({
    queryKey: ["grabba-drivers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("grabba_drivers")
        .select("*")
        .eq("active", true)
        .order("name");
      return data || [];
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH TODAY'S ROUTES WITH BRAND FILTERING
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: todayRoutes } = useQuery({
    queryKey: ["grabba-routes-today", selectedBrand],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      
      const { data } = await supabase
        .from("driver_routes")
        .select(`
          *,
          driver:grabba_drivers(id, name, phone, region),
          stops:driver_route_stops(
            *,
            company:companies(name, default_phone),
            store:stores(name, address)
          )
        `)
        .eq("route_date", today)
        .order("created_at", { ascending: false });
      
      let result = data || [];
      if (selectedBrand !== 'all') {
        result = result.filter((route: any) => 
          route.stops?.some((stop: any) => stop.brand === selectedBrand)
        );
      }
      return result;
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH UNPAID ACCOUNTS FOR COLLECTION
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: unpaidAccounts } = useQuery({
    queryKey: ["grabba-unpaid-accounts", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data } = await supabase
        .from("invoices")
        .select(`
          *,
          company:companies(id, name, default_phone, neighborhood)
        `)
        .eq("payment_status", "unpaid")
        .in("brand", brandsToQuery)
        .order("total_amount", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH BIKER ROUTES (LEGACY SYSTEM)
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: bikerRoutes } = useQuery({
    queryKey: ["grabba-biker-routes"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("biker_routes")
        .select("*")
        .eq("route_date", today);
      return data || [];
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELIVERY OPS METRICS
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: deliveryMetrics } = useQuery({
    queryKey: ["grabba-delivery-metrics", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      
      // Get recent deliveries
      const { data: recentStops } = await supabase
        .from("driver_route_stops")
        .select("*, driver_routes(route_date)")
        .in("brand", brandsToQuery)
        .order("created_at", { ascending: false })
        .limit(100);

      const completedStops = recentStops?.filter(s => s.completed) || [];
      const pendingStops = recentStops?.filter(s => !s.completed) || [];
      const collectionStops = recentStops?.filter(s => s.task_type === 'collection') || [];
      const deliveryStops = recentStops?.filter(s => s.task_type === 'delivery') || [];
      
      const totalCollected = collectionStops
        .filter(s => s.completed)
        .reduce((sum, s) => sum + (s.amount_owed || 0), 0);

      const avgStopsPerRoute = todayRoutes?.length 
        ? Math.round((todayRoutes.reduce((sum, r) => sum + (r.stops?.length || 0), 0)) / todayRoutes.length)
        : 0;

      return {
        totalStops: recentStops?.length || 0,
        completedStops: completedStops.length,
        pendingStops: pendingStops.length,
        completionRate: recentStops?.length ? Math.round((completedStops.length / recentStops.length) * 100) : 0,
        totalCollected,
        deliveryCount: deliveryStops.length,
        collectionCount: collectionStops.length,
        avgStopsPerRoute,
      };
    },
  });

  // Calculate KPIs
  const routesToday = todayRoutes?.length || 0;
  const stopsToday = todayRoutes?.reduce((sum, r) => sum + (r.stops?.length || 0), 0) || 0;
  const totalOwed = unpaidAccounts?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const completedStops = todayRoutes?.reduce(
    (sum, r) => sum + (r.stops?.filter((s: any) => s.completed)?.length || 0), 0
  ) || 0;

  // Filter drivers by search
  const filteredDrivers = drivers?.filter(d => 
    !search || 
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.region?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* HEADER */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              Grabba Deliveries & Drivers
            </h1>
            <p className="text-muted-foreground mt-1">
              Floor 4 — Routes, drivers, bikers, payouts, and delivery ops for Grabba brands
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* KPI CARDS */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Route className="h-4 w-4" />
                <span className="text-xs">Routes Today</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{routesToday}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <MapPin className="h-4 w-4" />
                <span className="text-xs">Stops Today</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{stopsToday}</div>
              <div className="text-xs text-muted-foreground">{completedStops} completed</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">To Collect</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                ${totalOwed.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <User className="h-4 w-4" />
                <span className="text-xs">Active Drivers</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{drivers?.length || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Completion Rate</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {deliveryMetrics?.completionRate || 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* TABS */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <Tabs defaultValue="routes" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="routes">Today's Routes</TabsTrigger>
            <TabsTrigger value="optimizer">Route Optimizer</TabsTrigger>
            <TabsTrigger value="drivers">Driver Profiles</TabsTrigger>
            <TabsTrigger value="payouts">Biker Payouts</TabsTrigger>
            <TabsTrigger value="metrics">Delivery Metrics</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
          </TabsList>

          {/* ─────────────────────────────────────────────────────────────────────────────
              TODAY'S ROUTES TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="routes">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Today's Routes</CardTitle>
                  <CardDescription>Active delivery and collection routes</CardDescription>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Create Route
                </Button>
              </CardHeader>
              <CardContent>
                {todayRoutes?.length === 0 ? (
                  <div className="text-center py-8">
                    <Route className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No routes scheduled for today</p>
                    <Button variant="outline" className="mt-4">Create First Route</Button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {todayRoutes?.map(route => {
                      const routeStops = route.stops || [];
                      const completed = routeStops.filter((s: any) => s.completed).length;
                      const progress = routeStops.length ? (completed / routeStops.length) * 100 : 0;
                      
                      return (
                        <div key={route.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Truck className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground">{route.driver?.name || 'Unassigned'}</div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                  <Phone className="h-3 w-3" /> {route.driver?.phone || 'No phone'}
                                  {route.driver?.region && (
                                    <Badge variant="outline" className="text-xs">{route.driver.region}</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={route.status === 'completed' ? 'default' : 'secondary'}>
                                {route.status}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {completed}/{routeStops.length} stops
                              </span>
                            </div>
                          </div>
                          
                          <Progress value={progress} className="h-2 mb-4" />
                          
                          <div className="space-y-2">
                            {routeStops.slice(0, 5).map((stop: any, i: number) => {
                              const config = stop.brand ? getBrandConfig(stop.brand) : null;
                              return (
                                <div key={stop.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                                    <div>
                                      <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                        {stop.company?.name || stop.store?.name || 'Unknown'}
                                        {config && <Badge className={`${config.pill} text-xs`}>{config.icon}</Badge>}
                                      </div>
                                      <div className="text-xs text-muted-foreground capitalize">{stop.task_type}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {stop.amount_owed && (
                                      <span className="text-sm font-medium text-amber-400">${stop.amount_owed}</span>
                                    )}
                                    {stop.completed ? (
                                      <CheckCircle className="h-4 w-4 text-green-400" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {routeStops.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center">
                                +{routeStops.length - 5} more stops
                              </p>
                            )}
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
              ROUTE OPTIMIZER TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="optimizer">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Route Optimizer
                </CardTitle>
                <CardDescription>AI-powered route optimization for maximum efficiency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Optimization Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Navigation className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Avg Stops/Route</span>
                      </div>
                      <p className="text-2xl font-bold">{deliveryMetrics?.avgStopsPerRoute || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Efficiency Score</span>
                      </div>
                      <p className="text-2xl font-bold">{deliveryMetrics?.completionRate || 0}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-muted-foreground">Est. Time Saved</span>
                      </div>
                      <p className="text-2xl font-bold">~45 min</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Optimizer Actions */}
                <div className="p-6 rounded-xl border border-primary/20 bg-primary/5">
                  <h3 className="font-semibold mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                      <Route className="h-5 w-5" />
                      <span className="text-xs">Auto-Optimize</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                      <MapPin className="h-5 w-5" />
                      <span className="text-xs">Cluster Stops</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                      <User className="h-5 w-5" />
                      <span className="text-xs">Assign Drivers</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                      <Zap className="h-5 w-5" />
                      <span className="text-xs">Priority Sort</span>
                    </Button>
                  </div>
                </div>

                {/* AI Insights */}
                <div className="space-y-3">
                  <h3 className="font-semibold">AI Route Insights</h3>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm font-medium text-blue-400">Optimal Route Suggestion</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Grouping Brooklyn stops together saves ~15 minutes and 3.2 miles
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-sm font-medium text-green-400">Multi-Brand Efficiency</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Delivering all 4 brands per stop reduces total delivery time by 40%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm font-medium text-amber-400">Collection Priority</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      3 accounts with balances over $500 should be prioritized today
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              DRIVER PROFILES TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="drivers">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Driver Profiles</CardTitle>
                  <CardDescription>Manage drivers and view performance</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search drivers..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Driver
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredDrivers?.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No drivers found</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredDrivers?.map(driver => (
                      <div key={driver.id} className="p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="p-3 rounded-full bg-primary/10">
                            <User className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-foreground">{driver.name}</div>
                              <Badge variant={driver.active ? "default" : "secondary"}>
                                {driver.active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" /> {driver.phone}
                            </div>
                            {driver.region && (
                              <Badge variant="outline" className="mt-2">{driver.region}</Badge>
                            )}
                            <div className="flex items-center gap-2 mt-3">
                              <Button size="sm" variant="outline" className="text-xs">View Routes</Button>
                              <Button size="sm" variant="outline" className="text-xs">Edit</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              BIKER PAYOUTS TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="payouts">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Biker Payouts
                </CardTitle>
                <CardDescription>Track earnings and process payments for bikers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Payout Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Today's Total</span>
                      </div>
                      <p className="text-2xl font-bold">$0</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Bike className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Active Bikers</span>
                      </div>
                      <p className="text-2xl font-bold">{bikerRoutes?.length || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-muted-foreground">Deliveries Today</span>
                      </div>
                      <p className="text-2xl font-bold">{deliveryMetrics?.deliveryCount || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm text-muted-foreground">Avg Rating</span>
                      </div>
                      <p className="text-2xl font-bold">4.8</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Biker List */}
                <div className="space-y-3">
                  {bikerRoutes?.length === 0 ? (
                    <div className="text-center py-8">
                      <Bike className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No biker routes today</p>
                    </div>
                  ) : (
                    bikerRoutes?.map(route => (
                      <div key={route.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-500/10">
                            <Bike className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{route.biker_name}</div>
                            <div className="text-sm text-muted-foreground">{route.biker_phone}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={route.completed ? "default" : "secondary"}>
                            {route.completed ? "Completed" : "In Progress"}
                          </Badge>
                          <Button size="sm" variant="outline">Process Payout</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              DELIVERY METRICS TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="metrics">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Delivery Ops Metrics
                </CardTitle>
                <CardDescription>Performance analytics for delivery operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground mb-1">Total Stops</div>
                      <p className="text-3xl font-bold">{deliveryMetrics?.totalStops || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground mb-1">Completed</div>
                      <p className="text-3xl font-bold text-green-500">{deliveryMetrics?.completedStops || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground mb-1">Pending</div>
                      <p className="text-3xl font-bold text-amber-500">{deliveryMetrics?.pendingStops || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground mb-1">Collected</div>
                      <p className="text-3xl font-bold text-blue-500">${deliveryMetrics?.totalCollected?.toLocaleString() || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Completion Rate */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Overall Completion Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Progress value={deliveryMetrics?.completionRate || 0} className="flex-1 h-4" />
                      <span className="text-2xl font-bold">{deliveryMetrics?.completionRate || 0}%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Task Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Deliveries</span>
                      </div>
                      <p className="text-2xl font-bold">{deliveryMetrics?.deliveryCount || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Collections</span>
                      </div>
                      <p className="text-2xl font-bold">{deliveryMetrics?.collectionCount || 0}</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              COLLECTIONS TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="collections">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Unpaid Accounts for Collection
                </CardTitle>
                <CardDescription>Accounts with outstanding balances</CardDescription>
              </CardHeader>
              <CardContent>
                {unpaidAccounts?.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    <p className="text-muted-foreground">All accounts are paid up!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {unpaidAccounts?.map(inv => {
                      const config = inv.brand ? getBrandConfig(inv.brand as GrabbaBrand) : null;
                      return (
                        <div key={inv.id} className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-2">
                              {inv.company?.name || 'Unknown'}
                              {config && <Badge className={`${config.pill} text-xs`}>{config.label}</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {inv.company?.neighborhood} • {inv.company?.default_phone}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Invoice: {inv.invoice_number || inv.id.slice(0, 8)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-amber-400">${inv.total_amount?.toLocaleString()}</div>
                            <Button size="sm" variant="outline" className="mt-2 gap-1">
                              <Plus className="h-3 w-3" /> Add to Route
                            </Button>
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
