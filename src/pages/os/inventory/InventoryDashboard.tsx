// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY DASHBOARD — Central Command for Inventory Operations
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Warehouse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Truck,
  Brain,
  RefreshCw,
  Plus,
  ArrowRight,
  DollarSign,
  Box,
  ShoppingCart,
  Clock,
  Lightbulb,
} from 'lucide-react';
import { useInventoryDashboardStats, useInventoryAlerts, useLowStockReport, useRunInventoryEngine } from '@/services/inventory';
import { useWarehouses } from '@/services/warehouse';
import { usePurchaseOrders } from '@/services/procurement';
import { getInsightsSummary } from '@/lib/inventory/calculateInventoryInsights';
import { useQuery } from '@tanstack/react-query';

export default function InventoryDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: stats, isLoading: statsLoading } = useInventoryDashboardStats();
  const { data: alerts } = useInventoryAlerts({ unresolved: true });
  const { data: lowStock } = useLowStockReport();
  const { data: warehouses } = useWarehouses();
  const { data: purchaseOrders } = usePurchaseOrders();
  const runEngine = useRunInventoryEngine();
  
  // Fetch insights summary for dashboard cards
  const { data: insightsSummary } = useQuery({
    queryKey: ['inventory-insights-summary-dashboard'],
    queryFn: () => getInsightsSummary(),
  });

  const incomingPOs = purchaseOrders?.filter(po => 
    ['placed', 'paid', 'in_transit', 'shipped'].includes(po.status || '')
  ) || [];

  const handleRunScan = () => {
    runEngine.mutate('scan_alerts');
  };

  const handleComputeScores = () => {
    runEngine.mutate('compute_scores');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              Inventory Engine
            </h1>
            <p className="text-muted-foreground mt-1">
              Central command for stock levels, products, and fulfillment
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleComputeScores} disabled={runEngine.isPending}>
              <Brain className="h-4 w-4 mr-2" />
              AI Score Products
            </Button>
            <Button onClick={handleRunScan} disabled={runEngine.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${runEngine.isPending ? 'animate-spin' : ''}`} />
              Scan Alerts
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.totalProducts || 0}</p>
                  <p className="text-xs text-muted-foreground">Products</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Box className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.totalUnitsOnHand?.toLocaleString() || 0}</p>
                  <p className="text-xs text-muted-foreground">On Hand</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.totalUnitsReserved?.toLocaleString() || 0}</p>
                  <p className="text-xs text-muted-foreground">Reserved</p>
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
                  <p className="text-2xl font-bold">{stats?.totalUnitsInTransit?.toLocaleString() || 0}</p>
                  <p className="text-xs text-muted-foreground">In Transit</p>
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
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.outOfStockItems || 0}</p>
                  <p className="text-xs text-muted-foreground">Out of Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
            <TabsTrigger value="alerts">Alerts ({alerts?.length || 0})</TabsTrigger>
            <TabsTrigger value="incoming">Incoming ({incomingPOs.length})</TabsTrigger>
            <TabsTrigger value="dead-stock">Dead Stock</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to="/os/inventory/products">
                      <Package className="h-5 w-5 mb-1" />
                      <span className="text-xs">Products</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to="/os/warehouse">
                      <Warehouse className="h-5 w-5 mb-1" />
                      <span className="text-xs">Warehouses</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to="/os/procurement">
                      <Truck className="h-5 w-5 mb-1" />
                      <span className="text-xs">Procurement</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to="/os/procurement/suppliers">
                      <Box className="h-5 w-5 mb-1" />
                      <span className="text-xs">Suppliers</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to="/os/procurement/purchase-orders/new">
                      <Plus className="h-5 w-5 mb-1" />
                      <span className="text-xs">New PO</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to="/os/inventory/insights">
                      <Lightbulb className="h-5 w-5 mb-1" />
                      <span className="text-xs">Insights</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Insights Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    Inventory Insights
                  </CardTitle>
                  <CardDescription>AI-powered risk and forecast analysis</CardDescription>
                </div>
                <Button size="sm" asChild>
                  <Link to="/os/inventory/insights">
                    View All
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link to="/os/inventory/insights?risk=high" className="block">
                    <div className="p-4 border rounded-lg hover:border-destructive/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-destructive/10 rounded-lg">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-destructive">
                            {insightsSummary?.atRiskCount || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">At-Risk SKUs</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <Link to="/os/inventory/insights?tab=deadstock" className="block">
                    <div className="p-4 border rounded-lg hover:border-orange-500/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <Clock className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-orange-500">
                            {insightsSummary?.deadStockCount || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Dead Stock</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <Link to="/os/inventory/insights?tab=overstock" className="block">
                    <div className="p-4 border rounded-lg hover:border-yellow-500/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                          <TrendingDown className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-yellow-600">
                            {insightsSummary?.overstockCount || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Overstock</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Warehouses Summary */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Warehouses</CardTitle>
                  <CardDescription>Stock distribution by location</CardDescription>
                </div>
                <Button size="sm" asChild>
                  <Link to="/os/warehouse">
                    View All
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {warehouses?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {warehouses.slice(0, 6).map((wh) => (
                      <div key={wh.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Warehouse className="h-4 w-4 text-primary" />
                            <span className="font-medium">{wh.name}</span>
                          </div>
                          <Badge variant={wh.is_active ? 'default' : 'secondary'}>
                            {wh.type || 'central'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {wh.city}, {wh.state}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No warehouses configured
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="low-stock">
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Report</CardTitle>
                <CardDescription>Items at or below reorder point</CardDescription>
              </CardHeader>
              <CardContent>
                {lowStock?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">On Hand</TableHead>
                        <TableHead className="text-right">Reorder Point</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStock.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">
                            {item.product_id?.slice(0, 8)}...
                          </TableCell>
                          <TableCell>{item.warehouse?.name || '-'}</TableCell>
                          <TableCell className="text-right font-mono">
                            {item.quantity_on_hand || 0}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.reorder_point || 0}
                          </TableCell>
                          <TableCell>
                            <Badge variant={(item.quantity_on_hand || 0) === 0 ? 'destructive' : 'secondary'}>
                              {(item.quantity_on_hand || 0) === 0 ? 'Out of Stock' : 'Low Stock'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>All stock levels are healthy</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Alerts</CardTitle>
                <CardDescription>Unresolved stock alerts</CardDescription>
              </CardHeader>
              <CardContent>
                {alerts?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <Badge variant="outline">{alert.alert_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              alert.severity === 'critical' ? 'destructive' :
                              alert.severity === 'warning' ? 'secondary' : 'outline'
                            }>
                              {alert.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>{alert.message}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {alert.created_at ? new Date(alert.created_at).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No unresolved alerts</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incoming">
            <Card>
              <CardHeader>
                <CardTitle>Incoming Shipments</CardTitle>
                <CardDescription>Purchase orders in transit</CardDescription>
              </CardHeader>
              <CardContent>
                {incomingPOs.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO #</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>ETA</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomingPOs.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-sm">
                            PO-{po.id.slice(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell>{(po.supplier as any)?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{po.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {po.estimated_arrival 
                              ? new Date(po.estimated_arrival).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">{po.products?.length || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No incoming shipments</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dead-stock">
            <Card>
              <CardHeader>
                <CardTitle>Dead Stock Analysis</CardTitle>
                <CardDescription>Items with no movement in 90+ days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Run AI Score to identify dead stock</p>
                  <Button variant="outline" className="mt-3" onClick={handleComputeScores}>
                    <Brain className="h-4 w-4 mr-2" />
                    Analyze Products
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
