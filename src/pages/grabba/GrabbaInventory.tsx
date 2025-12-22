import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Package, TrendingUp, Clock, MapPin, Box, Calculator, 
  Zap, Search, AlertTriangle, BarChart3, Building2, Plus
} from "lucide-react";
import { format } from "date-fns";
import { GRABBA_BRAND_IDS, getBrandConfig, formatTubesAsBoxes, type GrabbaBrand, GRABBA_BRAND_CONFIG } from "@/config/grabbaSkyscraper";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";
import { AIInventoryWatch } from "@/components/grabba/intelligence";
import { EntityModal, FieldConfig, ExportButton } from "@/components/crud";
import { DeleteConfirmModal } from "@/components/crud/DeleteConfirmModal";
import { GlobalAddButton } from "@/components/crud/GlobalAddButton";
import { TableRowActions } from "@/components/crud/TableRowActions";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import { useCrudOperations } from "@/hooks/useCrudOperations";
import { inventoryFields } from "@/config/entityFieldConfigs";

export default function GrabbaInventory() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string } | null>(null);

  // CRUD operations
  const inventoryCrud = useCrudOperations({
    table: "store_tube_inventory",
    queryKey: ["grabba-live-inventory"],
    successMessages: {
      create: "Inventory record created",
      update: "Inventory updated",
      delete: "Inventory record deleted"
    }
  });

  // Fetch stores for dropdown
  const { data: stores } = useQuery({
    queryKey: ["stores-for-inventory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");
      return data || [];
    },
  });

  // Dynamic inventory fields with store options
  const dynamicInventoryFields = inventoryFields.map(field => {
    if (field.name === 'store_id') {
      return {
        ...field,
        options: stores?.map(s => ({ value: s.id, label: s.name })) || []
      };
    }
    return field;
  });

  // Live inventory
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

  // Consumption engine
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
        orderCount: 0,
        daysSinceLastOrder: 0,
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
      const etaDays = avgTubesPerDay > 0 ? Math.round(estimatedInventory / avgTubesPerDay) : 0;

      return { totalTubes, totalBoxes, avgTubesPerWeek, avgTubesPerDay, estimatedInventory, etaDays, orderCount: orders.length, daysSinceLastOrder: daysSinceLast };
    },
  });

  // Brand breakdown
  const { data: brandBreakdown } = useQuery({
    queryKey: ["grabba-brand-breakdown"],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("brand, tubes_total, boxes")
        .in("brand", [...GRABBA_BRAND_IDS]);

      const breakdown: Record<GrabbaBrand, { tubes: number; boxes: number }> = {} as any;
      GRABBA_BRAND_IDS.forEach(brand => {
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

  // Neighborhood stats
  const { data: neighborhoodStats } = useQuery({
    queryKey: ["grabba-neighborhood-intelligence", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      
      const { data: stores } = await supabase.from("stores").select("neighborhood, id, name");
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("store_id, tubes_total, boxes, brand")
        .in("brand", brandsToQuery);

      const neighborhoodMap: Record<string, { stores: number; tubes: number; boxes: number }> = {};
      
      stores?.forEach(store => {
        const hood = store.neighborhood || "Unknown";
        if (!neighborhoodMap[hood]) {
          neighborhoodMap[hood] = { stores: 0, tubes: 0, boxes: 0 };
        }
        neighborhoodMap[hood].stores++;
      });

      orders?.forEach(order => {
        const store = stores?.find(s => s.id === order.store_id);
        const hood = store?.neighborhood || "Unknown";
        if (neighborhoodMap[hood]) {
          neighborhoodMap[hood].tubes += order.tubes_total || (order.boxes || 0) * 100;
          neighborhoodMap[hood].boxes += order.boxes || 0;
        }
      });

      return Object.entries(neighborhoodMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.tubes - a.tubes)
        .slice(0, 15);
    },
  });

  const lowStockItems = liveInventory?.filter(inv => (inv.current_tubes_left || 0) < 50) || [];
  const totalLiveTubes = liveInventory?.reduce((sum, inv) => sum + (inv.current_tubes_left || 0), 0) || 0;

  // Filter and paginate
  const filteredInventory = liveInventory?.filter(inv => 
    !search || 
    inv.store?.name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.store?.neighborhood?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const paginatedInventory = filteredInventory.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Handlers
  const handleCreate = async (data: Record<string, any>) => {
    await inventoryCrud.create(data);
    setCreateModalOpen(false);
  };

  const handleUpdate = async (data: Record<string, any>) => {
    if (editingItem) {
      await inventoryCrud.update({ id: editingItem.id, ...data });
      setEditingItem(null);
    }
  };

  const handleDelete = async () => {
    if (deletingItem) {
      await inventoryCrud.remove(deletingItem.id);
      setDeletingItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              Grabba Inventory Engine
            </h1>
            <p className="text-muted-foreground mt-1">
              Floor 3 — Live tube counts, ETA engine, consumption tracking
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>

        {/* Estimated Inventory Header */}
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

        {/* KPI Cards */}
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

        {/* AI Inventory Watch Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            {/* Tabs */}
            <Tabs defaultValue="inventory" className="space-y-6">
              <div className="flex items-center justify-between">
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="inventory">Live Inventory</TabsTrigger>
                  <TabsTrigger value="brands">Brand Breakdown</TabsTrigger>
                  <TabsTrigger value="neighborhoods">Neighborhoods</TabsTrigger>
                  <TabsTrigger value="alerts">Low Stock Alerts</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button onClick={() => setCreateModalOpen(true)} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Inventory
                  </Button>
                </div>
              </div>

          {/* Live Inventory Tab */}
          <TabsContent value="inventory">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Live Store Inventory
                </CardTitle>
                <CardDescription>{filteredInventory.length} inventory records</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Tubes Left</TableHead>
                      <TableHead>Boxes</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInventory.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.store?.name || 'N/A'}
                          <div className="text-xs text-muted-foreground">{inv.store?.neighborhood}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{inv.brand}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={inv.current_tubes_left < 50 ? 'text-red-500 font-bold' : ''}>
                            {inv.current_tubes_left || 0}
                          </span>
                        </TableCell>
                        <TableCell>{inv.boxes_on_hand || Math.floor((inv.current_tubes_left || 0) / 100)}</TableCell>
                        <TableCell>
                          {inv.last_updated ? format(new Date(inv.last_updated), "MMM d, h:mm a") : '-'}
                        </TableCell>
                        <TableCell>
                          <TableRowActions
                            actions={[
                              { type: 'edit', onClick: () => setEditingItem(inv) },
                              { type: 'delete', onClick: () => setDeletingItem({ id: inv.id, name: inv.store?.name || 'Inventory' }) }
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredInventory.length / pageSize)}
                  pageSize={pageSize}
                  totalItems={filteredInventory.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brand Breakdown Tab */}
          <TabsContent value="brands">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Brand Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {brandBreakdown && GRABBA_BRAND_IDS.map(brand => {
                    const config = GRABBA_BRAND_CONFIG[brand];
                    const data = brandBreakdown[brand] || { tubes: 0, boxes: 0 };
                    return (
                      <Card key={brand} className={`bg-gradient-to-br ${config?.gradient || ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span>{config?.icon}</span>
                            <span className="font-medium">{config?.label}</span>
                          </div>
                          <p className="text-2xl font-bold">{data.tubes.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{data.boxes} boxes</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Neighborhoods Tab */}
          <TabsContent value="neighborhoods">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Neighborhood Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Neighborhood</TableHead>
                      <TableHead>Stores</TableHead>
                      <TableHead>Total Tubes</TableHead>
                      <TableHead>Total Boxes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {neighborhoodStats?.map((hood: any) => (
                      <TableRow key={hood.name}>
                        <TableCell className="font-medium">{hood.name}</TableCell>
                        <TableCell>{hood.stores}</TableCell>
                        <TableCell>{hood.tubes.toLocaleString()}</TableCell>
                        <TableCell>{hood.boxes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                  Low Stock Alerts ({lowStockItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lowStockItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No low stock alerts</p>
                ) : (
                  <div className="space-y-2">
                    {lowStockItems.map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div>
                          <p className="font-medium">{inv.store?.name}</p>
                          <p className="text-sm text-muted-foreground">{inv.brand} - {inv.store?.neighborhood}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-red-500">{inv.current_tubes_left}</p>
                          <p className="text-xs text-muted-foreground">tubes left</p>
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
          
          {/* AI Inventory Watch Sidebar */}
          <div className="hidden lg:block">
            <AIInventoryWatch />
          </div>
        </div>
      </div>

      {/* Modals */}
      <EntityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Add Inventory Record"
        fields={dynamicInventoryFields}
        onSubmit={handleCreate}
        mode="create"
      />

      <EntityModal
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        title="Edit Inventory"
        fields={dynamicInventoryFields}
        defaultValues={editingItem || {}}
        onSubmit={handleUpdate}
        mode="edit"
      />

      <DeleteConfirmModal
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title="Delete Inventory Record"
        itemName={deletingItem?.name}
        onConfirm={handleDelete}
      />

      <GlobalAddButton
        label="Add Inventory"
        onClick={() => setCreateModalOpen(true)}
        variant="floating"
      />
    </div>
  );
}
