import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Globe, Package, DollarSign, Lightbulb, Search, Plus, CheckCircle, Clock,
  Upload, Truck, Brain, TrendingUp, AlertTriangle, BarChart3, Zap, RefreshCw,
  FileSpreadsheet, ArrowRight, Target, Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";
import { toast } from "sonner";

export default function GrabbaWholesalePlatform() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadSearch, setUploadSearch] = useState("");
  const queryClient = useQueryClient();

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
      const { data } = await supabase
        .from("wholesale_products")
        .select(`*`)
        .eq("is_active", true);
      
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

  // Fetch wholesaler uploads/submissions
  const { data: wholesalerUploads } = useQuery({
    queryKey: ["grabba-wholesaler-uploads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesale_products")
        .select(`*`)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Fetch fulfillment orders
  const { data: fulfillmentOrders } = useQuery({
    queryKey: ["grabba-fulfillment", selectedBrand],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesale_orders_platform")
        .select(`
          *,
          buyer:companies(name, city),
          wholesaler:wholesalers(name, city)
        `)
        .in("status", ["pending", "processing", "shipped", "delivered"])
        .order("created_at", { ascending: false });
      
      let result = (data || []) as any[];
      if (selectedBrand !== 'all') {
        result = result.filter(o => o.brand === selectedBrand);
      }
      return result;
    },
  });

  // KPI calculations
  const activeWholesalers = wholesalers?.filter(w => w.status === 'active')?.length || 0;
  const pendingWholesalers = wholesalers?.filter(w => w.status === 'pending')?.length || 0;
  const totalRevenue = platformOrders?.filter(o => o.status === 'paid' || o.status === 'delivered')
    ?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

  // Fulfillment stats
  const pendingFulfillment = fulfillmentOrders?.filter(o => o.status === 'pending')?.length || 0;
  const processingOrders = fulfillmentOrders?.filter(o => o.status === 'processing')?.length || 0;
  const shippedOrders = fulfillmentOrders?.filter(o => o.status === 'shipped')?.length || 0;
  const deliveredOrders = fulfillmentOrders?.filter(o => o.status === 'delivered')?.length || 0;
  const totalFulfillmentValue = fulfillmentOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

  // Upload stats
  const pendingReview = wholesalerUploads?.filter(u => !u.is_active)?.length || 0;
  const approvedProducts = wholesalerUploads?.filter(u => u.is_active)?.length || 0;

  // AI sourcing stats
  const liveSourcing = sourcingIdeas?.filter(s => s.status === 'live')?.length || 0;
  const testingSourcing = sourcingIdeas?.filter(s => s.status === 'testing')?.length || 0;
  const avgMargin = sourcingIdeas?.length 
    ? Math.round(sourcingIdeas.reduce((sum, s) => {
        const margin = s.supplier_cost && s.suggested_resale_price 
          ? ((s.suggested_resale_price - s.supplier_cost) / s.suggested_resale_price) * 100 
          : 0;
        return sum + margin;
      }, 0) / sourcingIdeas.length)
    : 0;

  const filteredProducts = products?.filter(p => 
    !searchQuery || 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUploads = wholesalerUploads?.filter(u =>
    !uploadSearch ||
    u.name?.toLowerCase().includes(uploadSearch.toLowerCase()) ||
    u.category?.toLowerCase().includes(uploadSearch.toLowerCase())
  );

  const handleApproveProduct = async (productId: string) => {
    const { error } = await supabase
      .from("wholesale_products")
      .update({ is_active: true })
      .eq("id", productId);
    
    if (error) {
      toast.error("Failed to approve product");
    } else {
      toast.success("Product approved");
      queryClient.invalidateQueries({ queryKey: ["grabba-wholesaler-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["grabba-wholesale-products"] });
    }
  };

  const handleRunAISourcing = () => {
    toast.success("AI Sourcing Engine running...", {
      description: "Analyzing market trends and supplier data"
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" />
              Floor 7 — Wholesale Marketplace
            </h1>
            <p className="text-muted-foreground mt-1">
              Marketplace, wholesaler uploads, fulfillment tracking, and AI sourcing engine
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Globe className="h-4 w-4" />
                <span className="text-xs">Wholesalers</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{activeWholesalers}</div>
              <div className="text-xs text-muted-foreground">{pendingWholesalers} pending</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <Package className="h-4 w-4" />
                <span className="text-xs">Products</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{products?.length || 0}</div>
              <div className="text-xs text-muted-foreground">{pendingReview} pending review</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Revenue</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                ${totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-900/5 border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-400">
                <Truck className="h-4 w-4" />
                <span className="text-xs">Fulfillment</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{pendingFulfillment + processingOrders}</div>
              <div className="text-xs text-muted-foreground">{shippedOrders} shipped</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Brain className="h-4 w-4" />
                <span className="text-xs">AI Sourcing</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{liveSourcing}</div>
              <div className="text-xs text-muted-foreground">{testingSourcing} testing</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-900/5 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Avg Margin</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{avgMargin}%</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="marketplace" className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            <TabsTrigger value="wholesalers">Wholesalers</TabsTrigger>
            <TabsTrigger value="uploads">Upload Center</TabsTrigger>
            <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="sourcing">AI Sourcing</TabsTrigger>
          </TabsList>

          {/* MARKETPLACE TAB */}
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

          {/* WHOLESALERS TAB */}
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

          {/* UPLOAD CENTER TAB */}
          <TabsContent value="uploads">
            <div className="space-y-6">
              {/* Upload Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Clock className="h-5 w-5" />
                      <span className="text-sm">Pending Review</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mt-2">{pendingReview}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm">Approved</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mt-2">{approvedProducts}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Upload className="h-5 w-5" />
                      <span className="text-sm">Total Uploads</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mt-2">{wholesalerUploads?.length || 0}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-purple-400">
                      <Globe className="h-5 w-5" />
                      <span className="text-sm">Wholesalers</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mt-2">{activeWholesalers}</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Wholesaler Product Submissions
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search uploads..."
                          value={uploadSearch}
                          onChange={(e) => setUploadSearch(e.target.value)}
                          className="pl-10 w-64"
                        />
                      </div>
                      <Button size="sm" className="gap-2">
                        <Upload className="h-4 w-4" /> Bulk Import
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredUploads?.length === 0 ? (
                    <p className="text-muted-foreground">No uploads found</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredUploads?.map(upload => (
                        <div key={upload.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div className="font-medium text-foreground">{upload.name}</div>
                                <Badge variant={upload.is_active ? 'default' : 'secondary'}>
                                  {upload.is_active ? 'Approved' : 'Pending'}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Category: {upload.category} • 
                                Price: ${upload.price} • 
                                Stock: {upload.stock}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Uploaded {format(new Date(upload.created_at), "MMM d, yyyy h:mm a")}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!upload.is_active && (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleApproveProduct(upload.id)}
                                    className="gap-1"
                                  >
                                    <CheckCircle className="h-4 w-4" /> Approve
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-destructive">
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost">View</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* FULFILLMENT TAB */}
          <TabsContent value="fulfillment">
            <div className="space-y-6">
              {/* Fulfillment Pipeline */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
                  <CardContent className="p-4 text-center">
                    <div className="text-amber-400 text-sm">Pending</div>
                    <div className="text-3xl font-bold text-foreground mt-1">{pendingFulfillment}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
                  <CardContent className="p-4 text-center">
                    <div className="text-blue-400 text-sm">Processing</div>
                    <div className="text-3xl font-bold text-foreground mt-1">{processingOrders}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
                  <CardContent className="p-4 text-center">
                    <div className="text-purple-400 text-sm">Shipped</div>
                    <div className="text-3xl font-bold text-foreground mt-1">{shippedOrders}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
                  <CardContent className="p-4 text-center">
                    <div className="text-green-400 text-sm">Delivered</div>
                    <div className="text-3xl font-bold text-foreground mt-1">{deliveredOrders}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-900/5 border-cyan-500/20">
                  <CardContent className="p-4 text-center">
                    <div className="text-cyan-400 text-sm">Total Value</div>
                    <div className="text-2xl font-bold text-foreground mt-1">${totalFulfillmentValue.toLocaleString()}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Fulfillment Progress */}
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Fulfillment Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Overall Progress</span>
                        <span className="text-foreground">
                          {fulfillmentOrders?.length ? Math.round((deliveredOrders / fulfillmentOrders.length) * 100) : 0}% Complete
                        </span>
                      </div>
                      <Progress 
                        value={fulfillmentOrders?.length ? (deliveredOrders / fulfillmentOrders.length) * 100 : 0} 
                        className="h-3"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fulfillment Orders List */}
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle>Active Fulfillment Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  {fulfillmentOrders?.length === 0 ? (
                    <p className="text-muted-foreground">No fulfillment orders</p>
                  ) : (
                    <div className="space-y-3">
                      {fulfillmentOrders?.slice(0, 20).map(order => (
                        <div key={order.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{order.buyer?.name}</span>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">{order.wholesaler?.name}</span>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {order.buyer?.city} • {format(new Date(order.created_at), "MMM d, yyyy")}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-lg font-bold text-foreground">${order.total_amount?.toLocaleString()}</div>
                              </div>
                              <Badge 
                                variant={
                                  order.status === 'delivered' ? 'default' : 
                                  order.status === 'shipped' ? 'secondary' : 
                                  order.status === 'processing' ? 'outline' : 'destructive'
                                }
                              >
                                {order.status}
                              </Badge>
                              <Button size="sm" variant="outline">Update</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ORDERS TAB */}
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

          {/* AI SOURCING TAB */}
          <TabsContent value="sourcing">
            <div className="space-y-6">
              {/* AI Sourcing Header */}
              <Card className="bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-blue-500/20 border-purple-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                        <Brain className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                          AI Sourcing Engine
                          <Sparkles className="h-5 w-5 text-amber-400" />
                        </h2>
                        <p className="text-muted-foreground">
                          Automated product discovery, margin analysis, and supplier recommendations
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleRunAISourcing} className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600">
                      <RefreshCw className="h-4 w-4" /> Run Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* AI Sourcing Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-400">
                      <Zap className="h-5 w-5" />
                      <span className="text-sm">Live Products</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mt-2">{liveSourcing}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Target className="h-5 w-5" />
                      <span className="text-sm">Testing</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mt-2">{testingSourcing}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-900/5 border-cyan-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <TrendingUp className="h-5 w-5" />
                      <span className="text-sm">Avg Margin</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mt-2">{avgMargin}%</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-purple-400">
                      <BarChart3 className="h-5 w-5" />
                      <span className="text-sm">Total Ideas</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground mt-2">{sourcingIdeas?.length || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Sourcing Ideas */}
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    AI Sourcing Recommendations
                  </CardTitle>
                  <Button size="sm" variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Manual Idea
                  </Button>
                </CardHeader>
                <CardContent>
                  {sourcingIdeas?.length === 0 ? (
                    <div className="text-center py-12">
                      <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No sourcing ideas yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Run the AI engine to discover opportunities</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sourcingIdeas?.map(idea => (
                        <div key={idea.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-foreground">{idea.product_name}</div>
                                <Badge variant={idea.status === 'live' ? 'default' : idea.status === 'testing' ? 'secondary' : 'outline'}>
                                  {idea.status}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Category: {idea.category} • Supplier: {idea.suggested_supplier || 'TBD'}
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">Cost</div>
                                <div className="font-medium text-foreground">${idea.supplier_cost}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">Resale</div>
                                <div className="font-medium text-green-400">${idea.suggested_resale_price}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">Margin</div>
                                <div className="font-bold text-amber-400">
                                  {idea.supplier_cost && idea.suggested_resale_price 
                                    ? Math.round(((idea.suggested_resale_price - idea.supplier_cost) / idea.suggested_resale_price) * 100)
                                    : 0}%
                                </div>
                              </div>
                              <Button size="sm" variant="outline">Action</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
