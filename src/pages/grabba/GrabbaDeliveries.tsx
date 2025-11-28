import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, MapPin, DollarSign, CheckCircle, Clock, Plus, User } from "lucide-react";
import { format } from "date-fns";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar, BrandBadge } from "@/components/grabba/BrandFilterBar";
import { GrabbaBrand } from "@/config/grabbaBrands";

export default function GrabbaDeliveries() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();

  // Fetch drivers
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

  // Fetch today's routes with brand filtering
  const { data: todayRoutes } = useQuery({
    queryKey: ["grabba-routes-today", selectedBrand],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const brandsToQuery = getBrandQuery();
      
      const { data } = await supabase
        .from("driver_routes")
        .select(`
          *,
          driver:grabba_drivers(name, phone),
          stops:driver_route_stops(
            *,
            company:companies(name, default_phone),
            store:stores(name, address)
          )
        `)
        .eq("route_date", today)
        .order("created_at", { ascending: false });
      
      // Filter by brand if applicable
      let result = data || [];
      if (selectedBrand !== 'all') {
        result = result.filter((route: any) => 
          route.stops?.some((stop: any) => stop.brand === selectedBrand)
        );
      }
      return result;
    },
  });

  // Fetch unpaid accounts for collection with brand filtering
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

  // Calculate KPIs
  const routesToday = todayRoutes?.length || 0;
  const stopsToday = todayRoutes?.reduce((sum, r) => sum + (r.stops?.length || 0), 0) || 0;
  const totalOwed = unpaidAccounts?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
  const completedStops = todayRoutes?.reduce(
    (sum, r) => sum + (r.stops?.filter((s: any) => s.completed)?.length || 0), 0
  ) || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              Grabba Deliveries & Drivers
            </h1>
            <p className="text-muted-foreground mt-1">
              Routes, drivers, bikers, collections, and delivery performance for Grabba
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Truck className="h-5 w-5" />
                <span className="text-sm">Routes Today</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{routesToday}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <MapPin className="h-5 w-5" />
                <span className="text-sm">Stops Today</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{stopsToday}</div>
              <div className="text-sm text-muted-foreground">{completedStops} completed</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">Total Owed</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                ${totalOwed.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <User className="h-5 w-5" />
                <span className="text-sm">Active Drivers</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{drivers?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="routes" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="routes">Today's Routes</TabsTrigger>
            <TabsTrigger value="unpaid">Unpaid Accounts</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
          </TabsList>

          <TabsContent value="routes">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Today's Routes</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Create Route
                </Button>
              </CardHeader>
              <CardContent>
                {todayRoutes?.length === 0 ? (
                  <p className="text-muted-foreground">No routes scheduled for today</p>
                ) : (
                  <div className="space-y-4">
                    {todayRoutes?.map(route => (
                      <div key={route.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Truck className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{route.driver?.name || 'Unassigned'}</div>
                              <div className="text-sm text-muted-foreground">{route.driver?.phone}</div>
                            </div>
                          </div>
                          <Badge variant={route.status === 'completed' ? 'default' : 'secondary'}>
                            {route.status}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 mt-4">
                          {route.stops?.map((stop: any, i: number) => (
                            <div key={stop.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                                <div>
                                  <div className="text-sm font-medium text-foreground">
                                    {stop.company?.name || stop.store?.name || 'Unknown'}
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
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unpaid">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Unpaid Accounts for Collection</CardTitle>
              </CardHeader>
              <CardContent>
                {unpaidAccounts?.length === 0 ? (
                  <p className="text-muted-foreground">No unpaid accounts</p>
                ) : (
                  <div className="space-y-3">
                    {unpaidAccounts?.map(inv => (
                      <div key={inv.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">{inv.company?.name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">
                            {inv.company?.neighborhood} • {inv.company?.default_phone}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-amber-400">${inv.total_amount?.toLocaleString()}</div>
                          <Button size="sm" variant="outline" className="mt-2">Add to Route</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Active Drivers</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Add Driver
                </Button>
              </CardHeader>
              <CardContent>
                {drivers?.length === 0 ? (
                  <p className="text-muted-foreground">No active drivers</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {drivers?.map(driver => (
                      <div key={driver.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-full bg-primary/10">
                            <User className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{driver.name}</div>
                            <div className="text-sm text-muted-foreground">{driver.phone}</div>
                            {driver.region && (
                              <Badge variant="outline" className="mt-1">{driver.region}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
