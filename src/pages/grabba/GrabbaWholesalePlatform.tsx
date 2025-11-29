import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Globe, Package, DollarSign, Lightbulb, Search, Plus, CheckCircle, Clock,
  Upload, Truck, Brain, TrendingUp, AlertTriangle, BarChart3, Zap, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";
import { toast } from "sonner";
import { EntityModal, ExportButton } from "@/components/crud";
import { DeleteConfirmModal } from "@/components/crud/DeleteConfirmModal";
import { GlobalAddButton } from "@/components/crud/GlobalAddButton";
import { TableRowActions } from "@/components/crud/TableRowActions";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import { useCrudOperations } from "@/hooks/useCrudOperations";
import { wholesalerFields } from "@/config/entityFieldConfigs";

export default function GrabbaWholesalePlatform() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const queryClient = useQueryClient();

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingWholesaler, setEditingWholesaler] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string } | null>(null);

  // CRUD operations
  const wholesalerCrud = useCrudOperations({
    table: "wholesalers",
    queryKey: ["grabba-wholesalers"],
    successMessages: {
      create: "Wholesaler added",
      update: "Wholesaler updated",
      delete: "Wholesaler removed"
    }
  });

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

  // Fetch products
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

  // Fetch platform orders
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
        .limit(100);
      
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

  const pendingFulfillment = fulfillmentOrders?.filter(o => o.status === 'pending')?.length || 0;
  const processingOrders = fulfillmentOrders?.filter(o => o.status === 'processing')?.length || 0;
  const shippedOrders = fulfillmentOrders?.filter(o => o.status === 'shipped')?.length || 0;

  const liveSourcing = sourcingIdeas?.filter(s => s.status === 'live')?.length || 0;
  const testingSourcing = sourcingIdeas?.filter(s => s.status === 'testing')?.length || 0;

  // Filter and paginate
  const filteredWholesalers = wholesalers?.filter(w =>
    !searchQuery ||
    w.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const paginatedWholesalers = filteredWholesalers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const filteredProducts = products?.filter(p => 
    !searchQuery || 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleApproveWholesaler = async (id: string) => {
    await wholesalerCrud.update({ id, status: 'active' });
  };

  const handleRunAISourcing = () => {
    toast.success("AI Sourcing Engine running...", {
      description: "Analyzing market trends and supplier data"
    });
  };

  // Handlers
  const handleCreate = async (data: Record<string, any>) => {
    await wholesalerCrud.create({ ...data, status: 'pending' });
    setCreateModalOpen(false);
  };

  const handleUpdate = async (data: Record<string, any>) => {
    if (editingWholesaler) {
      await wholesalerCrud.update({ id: editingWholesaler.id, ...data });
      setEditingWholesaler(null);
    }
  };

  const handleDelete = async () => {
    if (deletingItem) {
      await wholesalerCrud.remove(deletingItem.id);
      setDeletingItem(null);
    }
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
              Marketplace, wholesaler management, fulfillment tracking, and AI sourcing engine
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
                <span className="text-xs">Orders</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{platformOrders?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="wholesalers" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="wholesalers">Wholesalers</TabsTrigger>
              <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
              <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="sourcing">AI Sourcing</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button onClick={() => setCreateModalOpen(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Add Wholesaler
              </Button>
            </div>
          </div>

          {/* Wholesalers Tab */}
          <TabsContent value="wholesalers">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Wholesaler Directory</CardTitle>
                <CardDescription>{filteredWholesalers.length} wholesalers</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedWholesalers.map((ws: any) => (
                      <TableRow key={ws.id}>
                        <TableCell className="font-medium">{ws.name}</TableCell>
                        <TableCell>{ws.contact_name || '-'}</TableCell>
                        <TableCell>{ws.phone || '-'}</TableCell>
                        <TableCell>{ws.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={ws.status === 'active' ? 'default' : ws.status === 'pending' ? 'secondary' : 'destructive'}>
                            {ws.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TableRowActions
                            actions={[
                              { type: 'edit', onClick: () => setEditingWholesaler(ws) },
                              ...(ws.status === 'pending' ? [{ type: 'activate' as const, label: 'Approve', onClick: () => handleApproveWholesaler(ws.id) }] : []),
                              { type: 'delete', onClick: () => setDeletingItem({ id: ws.id, name: ws.name }) }
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredWholesalers.length / pageSize)}
                  pageSize={pageSize}
                  totalItems={filteredWholesalers.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marketplace Tab */}
          <TabsContent value="marketplace">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Product Marketplace</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredProducts?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No products found</p>
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

          {/* Fulfillment Tab */}
          <TabsContent value="fulfillment">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Fulfillment Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Wholesaler</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fulfillmentOrders?.slice(0, 20).map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono">{order.id.slice(0,8)}</TableCell>
                        <TableCell>{order.buyer?.name || '-'}</TableCell>
                        <TableCell>{order.wholesaler?.name || '-'}</TableCell>
                        <TableCell>${(order.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'shipped' ? 'secondary' : 'outline'}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.created_at ? format(new Date(order.created_at), "MMM d") : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Platform Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platformOrders?.slice(0, 20).map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono">{order.id.slice(0,8)}</TableCell>
                        <TableCell>{order.buyer?.name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.brand}</Badge>
                        </TableCell>
                        <TableCell>${(order.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === 'delivered' || order.status === 'paid' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.created_at ? format(new Date(order.created_at), "MMM d") : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Sourcing Tab */}
          <TabsContent value="sourcing">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    AI Sourcing Engine
                  </CardTitle>
                  <CardDescription>AI-generated product sourcing opportunities</CardDescription>
                </div>
                <Button onClick={handleRunAISourcing} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Run AI Analysis
                </Button>
              </CardHeader>
              <CardContent>
                {sourcingIdeas?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sourcing ideas yet. Run AI analysis to generate recommendations.</p>
                ) : (
                  <div className="space-y-3">
                    {sourcingIdeas?.map((idea: any) => (
                      <div key={idea.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{idea.product_name}</span>
                          <Badge variant={idea.status === 'live' ? 'default' : 'secondary'}>
                            {idea.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{idea.reasoning}</p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span>Cost: ${idea.supplier_cost}</span>
                          <span>Suggested: ${idea.suggested_resale_price}</span>
                          <span className="text-green-400">
                            Margin: {idea.supplier_cost && idea.suggested_resale_price
                              ? Math.round(((idea.suggested_resale_price - idea.supplier_cost) / idea.suggested_resale_price) * 100)
                              : 0}%
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

      {/* Modals */}
      <EntityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Add Wholesaler"
        fields={wholesalerFields}
        onSubmit={handleCreate}
        mode="create"
      />

      <EntityModal
        open={!!editingWholesaler}
        onOpenChange={(open) => !open && setEditingWholesaler(null)}
        title="Edit Wholesaler"
        fields={wholesalerFields}
        defaultValues={editingWholesaler || {}}
        onSubmit={handleUpdate}
        mode="edit"
      />

      <DeleteConfirmModal
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title="Delete Wholesaler"
        itemName={deletingItem?.name}
        onConfirm={handleDelete}
      />

      <GlobalAddButton
        label="Add Wholesaler"
        onClick={() => setCreateModalOpen(true)}
        variant="floating"
      />
    </div>
  );
}
