import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PortalLayout from '@/components/portal/PortalLayout';
import { ShoppingBag, Package, Users, Settings, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function MarketplaceAdmin() {
  return (
    <PortalLayout title="Marketplace Admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShoppingBag className="h-8 w-8 text-primary" />
              Marketplace Admin
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage marketplace operations and settings
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              System Online
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={Package} label="Total Products" value="2,450" trend="+124" />
          <StatCard icon={Users} label="Active Sellers" value="156" trend="+12" />
          <StatCard icon={ShoppingBag} label="Orders Today" value="89" trend="+15%" />
          <StatCard icon={TrendingUp} label="GMV Today" value="$12.4K" trend="+8%" />
        </div>

        {/* Alerts */}
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-medium">3 products pending approval</p>
                <p className="text-sm text-muted-foreground">Review new product submissions from sellers</p>
              </div>
              <Button variant="outline" size="sm" className="ml-auto">
                Review Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="sellers">Sellers</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ActivityRow icon={Package} text="New product listed: GasMask Premium" time="5m ago" />
                  <ActivityRow icon={Users} text="New seller approved: Miami Wholesale" time="1h ago" />
                  <ActivityRow icon={ShoppingBag} text="Order #1234 shipped" time="2h ago" />
                  <ActivityRow icon={CheckCircle} text="Payout processed: $2,450" time="3h ago" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start" variant="outline">
                    <Package className="h-4 w-4 mr-2" />
                    Review Pending Products
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Approve New Sellers
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Marketplace Settings
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Product Management</CardTitle>
                <CardDescription>Manage all marketplace products</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Product management interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sellers">
            <Card>
              <CardHeader>
                <CardTitle>Seller Management</CardTitle>
                <CardDescription>Manage marketplace sellers</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Seller management interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Order Management</CardTitle>
                <CardDescription>Track all marketplace orders</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Order management interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Marketplace Settings</CardTitle>
                <CardDescription>Configure marketplace options</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Settings interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}

function StatCard({ icon: Icon, label, value, trend }: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  trend: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className="text-right">
            <Icon className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-green-500">{trend}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ icon: Icon, text, time }: { icon: React.ElementType; text: string; time: string }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="p-1.5 rounded bg-primary/10">
        <Icon className="h-3 w-3 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm">{text}</p>
      </div>
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {time}
      </span>
    </div>
  );
}
