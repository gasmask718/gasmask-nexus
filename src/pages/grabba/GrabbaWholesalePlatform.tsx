import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Package, DollarSign, Lightbulb, Search, Plus, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";
import { GRABBA_BRANDS, getBrandConfig, GrabbaBrand } from "@/config/grabbaBrands";

export default function GrabbaWholesalePlatform() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch wholesalers
  const { data: wholesalers, isLoading } = useQuery({
    queryKey: ["grabba-wholesalers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesalers")
        .select(`*, company:companies(name)`)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch products with brand filtering
  const { data: products } = useQuery({
    queryKey: ["grabba-wholesale-products", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data } = await supabase
        .from("wholesale_products")
        .select(`*`)
        .eq("is_active", true);
      
      // Filter by brand in JS to avoid type issues
      let result = (data || []) as any[];
      if (selectedBrand !== 'all') {
        result = result.filter(p => p.brand === selectedBrand);
      }
      return result;
    },
  });

  // Fetch platform orders with brand filtering
  const { data: platformOrders } = useQuery({
    queryKey: ["grabba-platform-orders", selectedBrand],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesale_orders_platform")
        .select(`
          *,
          buyer:companies(name),
          wholesaler:wholesalers(name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      
      // Filter by brand in JS to avoid type issues
      let result = (data || []) as any[];
      if (selectedBrand !== 'all') {
        result = result.filter(o => o.brand === selectedBrand);
      }
      return result;
    },
  });

  // Fetch AI sourcing ideas
  const { data: sourcingIdeas } = useQuery({
    queryKey: ["grabba-ai-sourcing"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesale_ai_sourcing")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const activeWholesalers = wholesalers?.filter(w => w.status === 'active')?.length || 0;
  const pendingWholesalers = wholesalers?.filter(w => w.status === 'pending')?.length || 0;
  const totalRevenue = platformOrders?.filter(o => o.status === 'paid' || o.status === 'delivered')
    ?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

  const filteredProducts = products?.filter(p => 
    !searchQuery || 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" />
              National Wholesale Platform
            </h1>
            <p className="text-muted-foreground mt-1">
              Wholesalers upload products, sell through our network, and get sourced with top items
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
                <Globe className="h-5 w-5" />
                <span className="text-sm">Active Wholesalers</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{activeWholesalers}</div>
              <div className="text-sm text-muted-foreground">{pendingWholesalers} pending approval</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <Package className="h-5 w-5" />
                <span className="text-sm">Active Products</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{products?.length || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">Platform Revenue</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                ${totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Lightbulb className="h-5 w-5" />
                <span className="text-sm">AI Sourcing Ideas</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{sourcingIdeas?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="wholesalers" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="wholesalers">Wholesalers</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            <TabsTrigger value="orders">Platform Orders</TabsTrigger>
            <TabsTrigger value="sourcing">AI Sourcing</TabsTrigger>
          </TabsList>

          <TabsContent value="wholesalers">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Wholesaler Directory</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Add Wholesaler
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading wholesalers...</p>
                ) : wholesalers?.length === 0 ? (
                  <p className="text-muted-foreground">No wholesalers found</p>
                ) : (
                  <div className="space-y-3">
                    {wholesalers?.map(ws => (
                      <div key={ws.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">{ws.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {ws.contact_name} • {ws.phone} • {ws.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ws.status === 'active' ? 'default' : ws.status === 'pending' ? 'secondary' : 'destructive'}>
                            {ws.status}
                          </Badge>
                          {ws.status === 'pending' && (
                            <Button size="sm" variant="outline">Approve</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="marketplace">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Product Marketplace</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 max-w-md"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredProducts?.length === 0 ? (
                  <p className="text-muted-foreground">No products found</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredProducts?.map(product => (
                      <div key={product.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-foreground">{product.name}</div>
                            <div className="text-sm text-muted-foreground">{product.description}</div>
                            <Badge variant="outline" className="mt-2">{product.category}</Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-400">${product.price}</div>
                            <div className="text-xs text-muted-foreground">per unit</div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-4">
                          <div className="text-sm text-muted-foreground">
                            Stock: {product.stock} • Case: {product.case_size}
                          </div>
                          <Button size="sm" variant="outline">Order</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Platform Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {platformOrders?.length === 0 ? (
                  <p className="text-muted-foreground">No orders found</p>
                ) : (
                  <div className="space-y-3">
                    {platformOrders?.map(order => (
                      <div key={order.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">
                            {order.buyer?.name} → {order.wholesaler?.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(order.created_at), "MMM d, yyyy h:mm a")}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-xl font-bold text-foreground">${order.total_amount?.toLocaleString()}</div>
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sourcing">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>AI Sourcing Ideas</CardTitle>
                <Button size="sm" className="gap-2">
                  <Lightbulb className="h-4 w-4" /> Add Idea
                </Button>
              </CardHeader>
              <CardContent>
                {sourcingIdeas?.length === 0 ? (
                  <p className="text-muted-foreground">No sourcing ideas yet</p>
                ) : (
                  <div className="space-y-3">
                    {sourcingIdeas?.map(idea => (
                      <div key={idea.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground">{idea.product_name}</div>
                            <div className="text-sm text-muted-foreground">
                              Category: {idea.category} • Supplier: {idea.suggested_supplier || 'TBD'}
                            </div>
                          </div>
                          <Badge variant={idea.status === 'live' ? 'default' : idea.status === 'testing' ? 'secondary' : 'outline'}>
                            {idea.status}
                          </Badge>
                        </div>
                        <div className="flex gap-4 mt-3 text-sm">
                          <span className="text-muted-foreground">Cost: <span className="text-foreground">${idea.supplier_cost}</span></span>
                          <span className="text-muted-foreground">Resale: <span className="text-green-400">${idea.suggested_resale_price}</span></span>
                          <span className="text-muted-foreground">
                            Margin: <span className="text-amber-400">
                              {idea.supplier_cost && idea.suggested_resale_price 
                                ? Math.round(((idea.suggested_resale_price - idea.supplier_cost) / idea.suggested_resale_price) * 100)
                                : 0}%
                            </span>
                          </span>
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
