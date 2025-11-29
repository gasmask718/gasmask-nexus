import { Link } from "react-router-dom";
import { useWholesalerProfile } from "@/services/wholesaler/useWholesalerProfile";
import { useWholesalerProducts } from "@/services/wholesaler/useWholesalerProducts";
import { useWholesalerOrders } from "@/services/wholesaler/useWholesalerOrders";
import { useWholesalerPayouts } from "@/services/wholesaler/useWholesalerPayouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HudCard } from "@/components/portal/HudCard";
import { HudMetric } from "@/components/portal/HudMetric";
import { 
  Package, ShoppingCart, Truck, DollarSign, AlertTriangle, 
  Plus, ArrowRight, Settings, TrendingUp, Clock, CheckCircle 
} from "lucide-react";

export default function WholesalerDashboard() {
  const { profile, isLoading: profileLoading } = useWholesalerProfile();
  const { products, lowStockProducts, isLoading: productsLoading } = useWholesalerProducts();
  const { orders, pendingCount, processingCount, shippedCount, isLoading: ordersLoading } = useWholesalerOrders();
  const { financialSummary, isLoading: financeLoading } = useWholesalerPayouts();

  const isLoading = profileLoading || productsLoading || ordersLoading || financeLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
            Wholesaler Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.company_name || 'Wholesaler'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to="/portal/wholesaler/settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
          <Button asChild>
            <Link to="/portal/wholesaler/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HudCard variant="cyan" glow>
          <HudMetric
            label="Total Products"
            value={products.length}
            icon={<Package className="h-4 w-4" />}
            variant="cyan"
          />
        </HudCard>
        
        <HudCard variant="amber" glow={pendingCount > 0}>
          <HudMetric
            label="Pending Orders"
            value={pendingCount}
            icon={<Clock className="h-4 w-4" />}
            variant="amber"
            trend={pendingCount > 0 ? 'down' : undefined}
            trendValue={pendingCount > 0 ? `${pendingCount} need attention` : undefined}
          />
        </HudCard>

        <HudCard variant="green">
          <HudMetric
            label="Orders Shipped"
            value={shippedCount}
            icon={<Truck className="h-4 w-4" />}
            variant="green"
          />
        </HudCard>

        <HudCard variant="purple" glow>
          <HudMetric
            label="Total Earnings"
            value={`$${(financialSummary?.totalEarnings || 0).toFixed(0)}`}
            icon={<DollarSign className="h-4 w-4" />}
            variant="purple"
          />
        </HudCard>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Orders Queue */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Recent Orders
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/wholesaler/orders">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        order.fulfillment_status === 'pending' ? 'bg-amber-500 animate-pulse' :
                        order.fulfillment_status === 'shipped' ? 'bg-green-500' :
                        'bg-blue-500'
                      }`} />
                      <div>
                        <p className="font-medium text-sm">
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.items?.length || 0} items · ${Number(order.total || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        order.fulfillment_status === 'pending' ? 'destructive' :
                        order.fulfillment_status === 'shipped' ? 'default' :
                        'secondary'
                      }>
                        {order.fulfillment_status}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/portal/wholesaler/orders/${order.id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts & Actions */}
        <div className="space-y-6">
          {/* Low Stock Alert */}
          {lowStockProducts.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-600 flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  Low Stock Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 3).map((product) => (
                    <div key={product.id} className="flex justify-between text-sm">
                      <span className="truncate">{product.product_name}</span>
                      <Badge variant="outline" className="text-amber-600">
                        {product.inventory_qty} left
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3" asChild>
                  <Link to="/portal/wholesaler/products">Manage Inventory</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/portal/wholesaler/products/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Product
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/portal/wholesaler/orders?status=pending">
                  <Clock className="h-4 w-4 mr-2" />
                  Process Pending Orders
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/portal/wholesaler/shipping">
                  <Truck className="h-4 w-4 mr-2" />
                  Print Shipping Labels
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/portal/wholesaler/finance">
                  <DollarSign className="h-4 w-4 mr-2" />
                  View Earnings
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Earnings Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Orders</span>
                <span className="font-medium">{financialSummary?.totalOrders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium">${(financialSummary?.totalEarnings || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending Payout</span>
                <span className="font-medium text-green-600">
                  ${(financialSummary?.pendingPayout || 0).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
