import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PortalLayout from '@/components/portal/PortalLayout';
import { Globe, Package, TrendingUp, Users, Truck, DollarSign, MapPin, ShoppingCart } from 'lucide-react';

export default function NationalWholesale() {
  return (
    <PortalLayout title="National Wholesale Portal">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" />
              National Wholesale Portal
            </h1>
            <p className="text-muted-foreground mt-1">
              Nationwide distribution and wholesale operations
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-1">
            Enterprise
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={MapPin}
            label="Active Regions"
            value="12"
            change="+2 this quarter"
          />
          <StatCard
            icon={Users}
            label="Partner Wholesalers"
            value="156"
            change="+18 this month"
          />
          <StatCard
            icon={Package}
            label="SKUs Available"
            value="2,340"
            change="Full catalog"
          />
          <StatCard
            icon={DollarSign}
            label="Monthly Volume"
            value="$1.2M"
            change="+15% growth"
          />
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="regions">Regions</TabsTrigger>
            <TabsTrigger value="partners">Partners</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Performance Metrics
                  </CardTitle>
                  <CardDescription>National wholesale performance overview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MetricRow label="Order Fill Rate" value="98.5%" color="text-green-500" />
                  <MetricRow label="On-Time Delivery" value="96.2%" color="text-green-500" />
                  <MetricRow label="Partner Satisfaction" value="4.8/5" color="text-green-500" />
                  <MetricRow label="Average Order Value" value="$3,450" color="text-primary" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-blue-500" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Latest wholesale transactions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ActivityItem 
                    title="New Partner: Miami Wholesale Co."
                    time="2 hours ago"
                    type="partner"
                  />
                  <ActivityItem 
                    title="Bulk Order: 500 units to TX Region"
                    time="4 hours ago"
                    type="order"
                  />
                  <ActivityItem 
                    title="Price Update: Q4 wholesale rates"
                    time="1 day ago"
                    type="pricing"
                  />
                  <ActivityItem 
                    title="New Region: Pacific Northwest"
                    time="2 days ago"
                    type="region"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Create Bulk Order
                </Button>
                <Button variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Add Partner
                </Button>
                <Button variant="outline">
                  <MapPin className="h-4 w-4 mr-2" />
                  Manage Regions
                </Button>
                <Button variant="outline">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Update Pricing
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regions">
            <Card>
              <CardHeader>
                <CardTitle>Regional Distribution</CardTitle>
                <CardDescription>Manage nationwide wholesale regions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Regional management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="partners">
            <Card>
              <CardHeader>
                <CardTitle>Wholesale Partners</CardTitle>
                <CardDescription>Manage partner relationships</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Partner management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Order Management</CardTitle>
                <CardDescription>Track and manage wholesale orders</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Order management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle>Pricing Tiers</CardTitle>
                <CardDescription>Manage wholesale pricing structures</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Pricing management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}

// Helper Components
function StatCard({ icon: Icon, label, value, change }: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  change: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{change}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function ActivityItem({ title, time, type }: { title: string; time: string; type: string }) {
  const colors: Record<string, string> = {
    partner: 'bg-green-500/20 text-green-500',
    order: 'bg-blue-500/20 text-blue-500',
    pricing: 'bg-orange-500/20 text-orange-500',
    region: 'bg-purple-500/20 text-purple-500',
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
      <div className={`w-2 h-2 rounded-full ${colors[type]?.split(' ')[0] || 'bg-primary'}`} />
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}
