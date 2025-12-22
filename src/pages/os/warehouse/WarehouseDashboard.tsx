import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Warehouse, Package, TrendingUp, Truck, AlertTriangle, RefreshCw, Plus, Brain } from 'lucide-react';
import { useWarehouseStats, useWarehouses, useRunWarehouseBrain } from '@/services/warehouse';
import { WarehouseInventoryTab } from './tabs/WarehouseInventoryTab';
import { WarehouseMovementsTab } from './tabs/WarehouseMovementsTab';
import { WarehousePurchaseOrdersTab } from './tabs/WarehousePurchaseOrdersTab';
import { WarehouseRoutingTab } from './tabs/WarehouseRoutingTab';
import WarehouseFormModal from '@/components/inventory/WarehouseFormModal';

export default function WarehouseDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [modalOpen, setModalOpen] = useState(false);
  const { data: stats, isLoading: statsLoading } = useWarehouseStats();
  const { data: warehouses } = useWarehouses();
  const runBrain = useRunWarehouseBrain();

  const handleRunRouting = () => {
    runBrain.mutate('route_orders');
  };

  const handleRunRestock = () => {
    runBrain.mutate('restock_insights');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Warehouse className="h-8 w-8 text-primary" />
              Warehouse & Logistics Brain
            </h1>
            <p className="text-muted-foreground mt-1">
              Central command for inventory, stock movements, and fulfillment
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRunRestock} disabled={runBrain.isPending}>
              <Brain className="h-4 w-4 mr-2" />
              AI Restock Insights
            </Button>
            <Button onClick={handleRunRouting} disabled={runBrain.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${runBrain.isPending ? 'animate-spin' : ''}`} />
              Run Routing Engine
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Warehouse className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.totalWarehouses || 0}</p>
                  <p className="text-xs text-muted-foreground">Warehouses</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Package className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.totalStockUnits?.toLocaleString() || 0}</p>
                  <p className="text-xs text-muted-foreground">Units On Hand</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.reservedUnits?.toLocaleString() || 0}</p>
                  <p className="text-xs text-muted-foreground">Reserved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.lowStockItems || 0}</p>
                  <p className="text-xs text-muted-foreground">Low Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Truck className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.openPOs || 0}</p>
                  <p className="text-xs text-muted-foreground">Open POs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Package className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.unroutedOrders || 0}</p>
                  <p className="text-xs text-muted-foreground">Unrouted Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="routing">Routing Engine</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Warehouses List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Warehouses</CardTitle>
                  <CardDescription>Active warehouse locations</CardDescription>
                </div>
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Warehouse
                </Button>
              </CardHeader>
              <CardContent>
                {warehouses?.length ? (
                  <div className="space-y-3">
                    {warehouses.map((wh) => (
                      <div key={wh.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Warehouse className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{wh.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {wh.city}, {wh.state} • Code: {wh.code}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={wh.is_active ? 'default' : 'secondary'}>
                            {wh.type || 'central'}
                          </Badge>
                          <Badge variant={wh.is_active ? 'outline' : 'destructive'}>
                            {wh.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Warehouse className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No warehouses configured yet</p>
                    <Button variant="outline" className="mt-3" size="sm" onClick={() => setModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Warehouse
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Advisor Panel */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI Warehouse Advisor
                </CardTitle>
                <CardDescription>
                  Get intelligent recommendations for inventory and fulfillment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-start">
                    <span className="text-sm font-medium">Best Price Supplier</span>
                    <span className="text-xs text-muted-foreground">Find optimal sourcing</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-start">
                    <span className="text-sm font-medium">Predict Stockout</span>
                    <span className="text-xs text-muted-foreground">Forecast inventory needs</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-start">
                    <span className="text-sm font-medium">Optimize MOQ</span>
                    <span className="text-xs text-muted-foreground">Best quantity discounts</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-start">
                    <span className="text-sm font-medium">Cost Analysis</span>
                    <span className="text-xs text-muted-foreground">Break down expenses</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <WarehouseInventoryTab />
          </TabsContent>

          <TabsContent value="movements">
            <WarehouseMovementsTab />
          </TabsContent>

          <TabsContent value="purchase-orders">
            <WarehousePurchaseOrdersTab />
          </TabsContent>

          <TabsContent value="routing">
            <WarehouseRoutingTab />
          </TabsContent>
        </Tabs>
      </div>

      <WarehouseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        warehouseId={null}
      />
    </div>
  );
}
