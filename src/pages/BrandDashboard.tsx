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
  TrendingUp, DollarSign, Package, Store, 
  MapPin, BarChart3, Users, AlertTriangle
} from "lucide-react";

const TOBACCO_BRANDS = ["gasmask", "hotmama", "hotscolati", "grabba_r_us"];

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
  const { brand: urlBrand } = useParams<{ brand: string }>();
  const brand = TOBACCO_BRANDS.includes(urlBrand || "") ? urlBrand : "gasmask";
  const brandConfig = brandConfigs[brand || "gasmask"];

  const { data: brandStats } = useQuery({
    queryKey: ["brand-stats", brand],
    queryFn: async () => {
      // Get orders for this brand
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("*, companies(id, name, neighborhood, boro)")
        .eq("brand", brand);

      // Get invoices for this brand
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("brand", brand);

      const totalTubes = orders?.reduce((sum, o) => sum + (o.tubes_total || (o.boxes || 0) * 100), 0) || 0;
      const totalBoxes = orders?.reduce((sum, o) => sum + (o.boxes || 0), 0) || 0;
      const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || Number(inv.total_amount) || 0), 0) || 0;
      const unpaidAmount = invoices
        ?.filter(inv => inv.payment_status !== "paid")
        .reduce((sum, inv) => sum + (Number(inv.total) || Number(inv.total_amount) || 0), 0) || 0;

      // Count unique companies
      const companyIds = new Set(orders?.map(o => o.company_id).filter(Boolean));

      return {
        totalTubes,
        totalBoxes,
        totalRevenue,
        unpaidAmount,
        orderCount: orders?.length || 0,
        activeStores: companyIds.size,
      };
    },
    enabled: !!brand,
  });

  const { data: topStores } = useQuery({
    queryKey: ["brand-top-stores", brand],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select(`
          company_id,
          boxes,
          tubes_total,
          companies (id, name, neighborhood, boro)
        `)
        .eq("brand", brand);

      // Aggregate by company
      const companyMap = new Map<string, { name: string; tubes: number; boxes: number; neighborhood: string }>();
      orders?.forEach((o) => {
        const company = o.companies as { id?: string; name?: string; neighborhood?: string; boro?: string } | null;
        if (o.company_id && company) {
          const existing = companyMap.get(o.company_id) || { 
            name: company.name || "Unknown", 
            tubes: 0, 
            boxes: 0, 
            neighborhood: company.neighborhood || company.boro || "" 
          };
          existing.tubes += o.tubes_total || (o.boxes || 0) * 100;
          existing.boxes += o.boxes || 0;
          companyMap.set(o.company_id, existing);
        }
      });

      return Array.from(companyMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.tubes - a.tubes)
        .slice(0, 10);
    },
    enabled: !!brand,
  });

  const { data: neighborhoodBreakdown } = useQuery({
    queryKey: ["brand-neighborhoods", brand],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select(`
          boxes,
          tubes_total,
          companies (neighborhood, boro)
        `)
        .eq("brand", brand);

      const neighborhoodMap = new Map<string, { tubes: number; storeCount: number }>();
      const seenCompanies = new Map<string, Set<string>>();
      
      orders?.forEach((o) => {
        const company = o.companies as { neighborhood?: string; boro?: string } | null;
        const hood = company?.neighborhood || company?.boro;
        if (hood) {
          const existing = neighborhoodMap.get(hood) || { tubes: 0, storeCount: 0 };
          existing.tubes += o.tubes_total || (o.boxes || 0) * 100;
          neighborhoodMap.set(hood, existing);
        }
      });

      return Array.from(neighborhoodMap.entries())
        .map(([name, data]) => ({ name, tubes: data.tubes, storeCount: data.storeCount }))
        .sort((a, b) => b.tubes - a.tubes)
        .slice(0, 10);
    },
    enabled: !!brand,
  });

  const { data: unpaidInvoices } = useQuery({
    queryKey: ["brand-unpaid", brand],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select(`*, companies(id, name, default_city)`)
        .eq("brand", brand)
        .in("payment_status", ["unpaid", "partial", "overdue"])
        .order("due_date", { ascending: true })
        .limit(10);
      return data || [];
    },
    enabled: !!brand,
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
                All time
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
                Active Companies
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
            <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          </TabsList>

          <TabsContent value="stores">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top Performing Companies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Company</TableHead>
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
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{hood.tubes.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">tubes</p>
                      </div>
                    </div>
                  ))}
                  {(!neighborhoodBreakdown || neighborhoodBreakdown.length === 0) && (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                      No neighborhood data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outstanding">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Outstanding Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-8 py-4 mb-6 bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-red-500">
                      ${brandStats?.unpaidAmount?.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Unpaid</p>
                  </div>
                  <div className="h-16 w-px bg-border"></div>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-green-500">
                      ${((brandStats?.totalRevenue || 0) - (brandStats?.unpaidAmount || 0)).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">Collected</p>
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidInvoices?.map((inv) => {
                      const company = inv.companies as { name?: string } | null;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>{company?.name || "Unknown"}</TableCell>
                          <TableCell className="font-mono">{inv.invoice_number || "—"}</TableCell>
                          <TableCell className="text-red-500 font-bold">
                            ${(Number(inv.total) || Number(inv.total_amount) || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={inv.payment_status === "overdue" ? "destructive" : "secondary"}>
                              {inv.payment_status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!unpaidInvoices || unpaidInvoices.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No outstanding invoices
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}