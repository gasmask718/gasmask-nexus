import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStoreStats } from "@/services/store/useStoreStats";
import { useStoreOrders } from "@/services/store/useStoreOrders";
import { 
  ShoppingCart, 
  Package, 
  Truck, 
  DollarSign, 
  FileText,
  TrendingUp,
  Clock,
  CheckCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function StoreDashboard() {
  const { data: stats, isLoading: statsLoading } = useStoreStats();
  const { data: orders, isLoading: ordersLoading } = useStoreOrders();

  const recentOrders = orders?.slice(0, 5) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Store Dashboard</h1>
            <p className="text-muted-foreground">Manage your B2B purchases and orders</p>
          </div>
          <Link to="/portal/store/products">
            <Button size="lg" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Browse Products
            </Button>
          </Link>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Orders</p>
                  <p className="text-3xl font-bold">{stats?.activeOrders || 0}</p>
                </div>
                <Package className="h-10 w-10 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                  <p className="text-3xl font-bold">{stats?.pendingOrders || 0}</p>
                </div>
                <Clock className="h-10 w-10 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Awaiting Delivery</p>
                  <p className="text-3xl font-bold">{stats?.awaitingDelivery || 0}</p>
                </div>
                <Truck className="h-10 w-10 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recent Deliveries</p>
                  <p className="text-3xl font-bold">{stats?.recentDeliveries || 0}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Spending This Week</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.spendingThisWeek || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spend</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.totalSpend || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={stats?.unpaidInvoices ? "border-destructive/50" : ""}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${stats?.unpaidInvoices ? 'bg-destructive/10' : 'bg-muted'}`}>
                  <FileText className={`h-6 w-6 ${stats?.unpaidInvoices ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unpaid Invoices</p>
                  <p className="text-2xl font-bold">{stats?.unpaidInvoices || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/portal/store/products" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Browse Products
                </Button>
              </Link>
              <Link to="/portal/store/cart" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Package className="h-4 w-4" />
                  View Cart
                </Button>
              </Link>
              <Link to="/portal/store/orders" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Truck className="h-4 w-4" />
                  Track Orders
                </Button>
              </Link>
              <Link to="/portal/store/invoices" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText className="h-4 w-4" />
                  View Invoices
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Orders</CardTitle>
              <Link to="/portal/store/orders">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No orders yet. Start shopping!
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      to={`/portal/store/orders/${order.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-muted">
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.created_at && format(new Date(order.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(order.total || 0)}</p>
                        <Badge variant={
                          order.fulfillment_status === 'delivered' ? 'default' :
                          order.fulfillment_status === 'shipped' ? 'secondary' :
                          'outline'
                        }>
                          {order.fulfillment_status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
