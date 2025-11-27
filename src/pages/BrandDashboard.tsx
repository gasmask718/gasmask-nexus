import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  TrendingUp, TrendingDown, DollarSign, Package, Store, 
  MapPin, BarChart3, Users, AlertTriangle, Zap, Clock
} from "lucide-react";

const brandConfigs: Record<string, { name: string; primary: string; secondary: string; gradient: string }> = {
  gasmask: { 
    name: "GasMask", 
    primary: "bg-red-600", 
    secondary: "text-red-600",
    gradient: "from-red-600 to-black"
  },
  hotmama: { 
    name: "HotMama", 
    primary: "bg-rose-400", 
    secondary: "text-rose-400",
    gradient: "from-rose-400 to-rose-600"
  },
  hotscolati: { 
    name: "Hotscolati", 
    primary: "bg-red-700", 
    secondary: "text-red-700",
    gradient: "from-red-700 to-black"
  },
  grabba_r_us: { 
    name: "Grabba R Us", 
    primary: "bg-purple-500", 
    secondary: "text-purple-500",
    gradient: "from-purple-500 to-pink-500"
  },
};

export default function BrandDashboard() {
  const { brand } = useParams<{ brand: string }>();
  const brandConfig = brandConfigs[brand || ""] || brandConfigs.gasmask;

  const { data: brandStats } = useQuery({
    queryKey: ["brand-stats", brand],
    queryFn: async () => {
      // Get orders for this brand
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("*")
        .eq("brand", brand);

      // Get invoices for this brand
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("brand", brand);

      const totalTubes = orders?.reduce((sum, o) => sum + (o.tubes_total || (o.boxes || 0) * 100), 0) || 0;
      const totalBoxes = orders?.reduce((sum, o) => sum + (o.boxes || 0), 0) || 0;
      const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total || inv.total_amount || 0), 0) || 0;
      const unpaidAmount = invoices
        ?.filter(inv => inv.payment_status !== "paid")
        .reduce((sum, inv) => sum + Number(inv.total || inv.total_amount || 0), 0) || 0;

      return {
        totalTubes,
        totalBoxes,
        totalRevenue,
        unpaidAmount,
        orderCount: orders?.length || 0,
        activeStores: new Set(orders?.map(o => o.store_id).filter(Boolean)).size,
      };
    },
  });

  const { data: topStores } = useQuery({
    queryKey: ["brand-top-stores", brand],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select(`
          store_id,
          boxes,
          tubes_total,
          stores (name, neighborhood, boro)
        `)
        .eq("brand", brand);

      // Aggregate by store
      const storeMap = new Map<string, { name: string; tubes: number; boxes: number; neighborhood: string }>();
      orders?.forEach((o) => {
        const store = o.stores as any;
        if (o.store_id && store) {
          const existing = storeMap.get(o.store_id) || { name: store.name, tubes: 0, boxes: 0, neighborhood: store.neighborhood || "" };
          existing.tubes += o.tubes_total || (o.boxes || 0) * 100;
          existing.boxes += o.boxes || 0;
          storeMap.set(o.store_id, existing);
        }
      });

      return Array.from(storeMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.tubes - a.tubes)
        .slice(0, 10);
    },
  });

  const { data: neighborhoodBreakdown } = useQuery({
    queryKey: ["brand-neighborhoods", brand],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select(`
          boxes,
          tubes_total,
          stores (neighborhood, boro)
        `)
        .eq("brand", brand);

      const neighborhoodMap = new Map<string, { tubes: number; stores: Set<string> }>();
      orders?.forEach((o) => {
        const store = o.stores as any;
        if (store?.neighborhood) {
          const existing = neighborhoodMap.get(store.neighborhood) || { tubes: 0, stores: new Set() };
          existing.tubes += o.tubes_total || (o.boxes || 0) * 100;
          neighborhoodMap.set(store.neighborhood, existing);
        }
      });

      return Array.from(neighborhoodMap.entries())
        .map(([name, data]) => ({ name, tubes: data.tubes, storeCount: data.stores.size }))
        .sort((a, b) => b.tubes - a.tubes)
        .slice(0, 10);
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className={`p-6 rounded-xl bg-gradient-to-r ${brandConfig.gradient} text-white`}>
          <h1 className="text-4xl font-bold mb-2">{brandConfig.name}</h1>
          <p className="text-white/80">Brand Performance Dashboard</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Total Tubes Sold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{brandStats?.totalTubes?.toLocaleString() || 0}</div>
              <div className="flex items-center gap-1 text-green-500 text-sm">
                <TrendingUp className="h-3 w-3" />
                +12% this month
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Total Boxes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{brandStats?.totalBoxes?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">100 tubes per box</p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Store className="h-4 w-4" />
                Active Stores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{brandStats?.activeStores || 0}</div>
              <p className="text-xs text-muted-foreground">{brandStats?.orderCount || 0} total orders</p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                ${brandStats?.totalRevenue?.toLocaleString() || 0}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  ${brandStats?.unpaidAmount?.toLocaleString() || 0} unpaid
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for detailed views */}
        <Tabs defaultValue="stores" className="space-y-4">
          <TabsList>
            <TabsTrigger value="stores">Top Stores</TabsTrigger>
            <TabsTrigger value="neighborhoods">Neighborhoods</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="payments">Outstanding</TabsTrigger>
          </TabsList>

          <TabsContent value="stores">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top Performing Stores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Neighborhood</TableHead>
                      <TableHead>Tubes Sold</TableHead>
                      <TableHead>Boxes</TableHead>
                      <TableHead>Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topStores?.map((store, i) => (
                      <TableRow key={store.id}>
                        <TableCell>
                          <Badge variant={i < 3 ? "default" : "outline"} className={i < 3 ? brandConfig.primary : ""}>
                            #{i + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{store.name}</TableCell>
                        <TableCell>{store.neighborhood || "—"}</TableCell>
                        <TableCell>{store.tubes.toLocaleString()}</TableCell>
                        <TableCell>{store.boxes}</TableCell>
                        <TableCell>
                          <div className="w-24">
                            <Progress value={Math.min((store.tubes / (topStores?.[0]?.tubes || 1)) * 100, 100)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!topStores || topStores.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No store data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="neighborhoods">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Neighborhood Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {neighborhoodBreakdown?.map((hood, i) => (
                    <div key={hood.name} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={i < 3 ? brandConfig.secondary : ""}>
                          #{i + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{hood.name}</p>
                          <p className="text-xs text-muted-foreground">{hood.storeCount} stores</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{hood.tubes.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">tubes</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Inventory Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Inventory tracking coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Outstanding Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-8 py-8">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-red-500">
                      ${brandStats?.unpaidAmount?.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Unpaid</p>
                  </div>
                  <div className="h-16 w-px bg-border"></div>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-green-500">
                      ${(brandStats?.totalRevenue || 0) - (brandStats?.unpaidAmount || 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Collected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
