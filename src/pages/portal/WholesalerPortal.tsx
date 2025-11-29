import { Package, Users, DollarSign, Settings, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import PortalLayout from '@/components/portal/PortalLayout';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

// Mock data
const myProducts = [
  { id: 1, name: 'Premium Grabba Leaf', sku: 'PGL-001', price: 45, orders: 24, status: 'active' },
  { id: 2, name: 'Natural Tobacco Tubes', sku: 'NTT-001', price: 35, orders: 18, status: 'active' },
  { id: 3, name: 'Eco Rolling Papers', sku: 'ERP-001', price: 12, orders: 42, status: 'active' },
];

const recentOrders = [
  { id: 'WO-001', store: 'Smoke King Miami', date: '2024-01-15', amount: '$680', status: 'shipped' },
  { id: 'WO-002', store: 'Quick Stop Tobacco', date: '2024-01-14', amount: '$450', status: 'pending' },
  { id: 'WO-003', store: 'Downtown Smoke', date: '2024-01-12', amount: '$320', status: 'delivered' },
];

const topClients = [
  { name: 'Smoke King Miami', orders: 12, total: '$4,500' },
  { name: 'Quick Stop Tobacco', orders: 8, total: '$2,800' },
  { name: 'Downtown Smoke Shop', orders: 6, total: '$2,100' },
];

export default function WholesalerPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const wholesalerProfile = profileData?.roleProfile as any;

  return (
    <PortalLayout title="Wholesaler Portal">
      <div className="space-y-6">
        {/* Status Banner */}
        {wholesalerProfile?.status === 'pending' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Your wholesaler account is pending verification. We'll review your application shortly.
            </p>
          </div>
        )}

        {/* Company Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{wholesalerProfile?.company_name || 'My Company'}</h2>
                  <p className="text-muted-foreground">{wholesalerProfile?.wholesaler_type || 'Distributor'}</p>
                  <Badge variant={wholesalerProfile?.status === 'verified' ? 'default' : 'secondary'}>
                    {wholesalerProfile?.status || 'pending'}
                  </Badge>
                </div>
              </div>
              <Button variant="outline">Edit Profile</Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Products</CardDescription>
              <CardTitle className="text-3xl">{myProducts.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Orders</CardDescription>
              <CardTitle className="text-3xl">84</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Clients</CardDescription>
              <CardTitle className="text-3xl">12</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Payout</CardDescription>
              <CardTitle className="text-3xl text-primary">$2,450</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* My Products */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  My Products
                </CardTitle>
                <CardDescription>Products you supply to the network</CardDescription>
              </div>
              <Button>Add Product</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell>${product.price}</TableCell>
                    <TableCell>{product.orders}</TableCell>
                    <TableCell>
                      <Badge variant="default">{product.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">{order.id}</TableCell>
                      <TableCell>{order.store}</TableCell>
                      <TableCell className="font-medium">{order.amount}</TableCell>
                      <TableCell>
                        <Badge variant={
                          order.status === 'delivered' ? 'default' : 
                          order.status === 'shipped' ? 'secondary' : 'outline'
                        }>
                          {order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Clients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Top Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topClients.map((client, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-sm text-muted-foreground">{client.orders} orders</p>
                      </div>
                    </div>
                    <p className="font-bold text-primary">{client.total}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Shipping Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Delivery Available</Label>
                  <p className="text-sm text-muted-foreground">We can deliver to stores</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Pickup Available</Label>
                  <p className="text-sm text-muted-foreground">Stores can pick up orders</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Warehouse Drop-off</Label>
                  <p className="text-sm text-muted-foreground">We can drop at central warehouse</p>
                </div>
                <Switch />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
