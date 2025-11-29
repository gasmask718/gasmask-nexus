import { ShoppingCart, Package, History, Sparkles, Store } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PortalLayout from '@/components/portal/PortalLayout';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

// Mock data
const catalogItems = [
  { id: 1, name: 'GasMask Tubes (100pk)', price: 45, stock: 'In Stock' },
  { id: 2, name: 'Hot Mama Boxes (50pk)', price: 120, stock: 'In Stock' },
  { id: 3, name: 'Grabba R Us Premium', price: 85, stock: 'Low Stock' },
  { id: 4, name: 'Display Stand - Large', price: 35, stock: 'In Stock' },
];

const recentOrders = [
  { id: 'ORD-001', date: '2024-01-15', items: 3, total: '$450', status: 'delivered' },
  { id: 'ORD-002', date: '2024-01-10', items: 5, total: '$680', status: 'shipped' },
  { id: 'ORD-003', date: '2024-01-05', items: 2, total: '$200', status: 'delivered' },
];

const restockSuggestions = [
  { product: 'GasMask Tubes', reason: 'Running low based on your sales pattern', urgency: 'high' },
  { product: 'Hot Mama Boxes', reason: 'Predicted to run out in 5 days', urgency: 'medium' },
];

export default function StorePortal() {
  const { data: profileData } = useCurrentUserProfile();
  const storeProfile = profileData?.roleProfile as any;

  return (
    <PortalLayout title="Store Portal">
      <div className="space-y-6">
        {/* Status Banner */}
        {storeProfile?.status === 'pending' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Your store account is pending verification. You'll be able to place orders once approved.
            </p>
          </div>
        )}

        {/* Store Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{storeProfile?.store_name || 'My Store'}</h2>
                <p className="text-muted-foreground">
                  {storeProfile?.city && `${storeProfile.city}, ${storeProfile.state || ''}`}
                </p>
                <Badge variant={storeProfile?.status === 'active' ? 'default' : 'secondary'}>
                  {storeProfile?.status || 'pending'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Restock Suggestions */}
        {restockSuggestions.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Restock Suggestions
              </CardTitle>
              <CardDescription>AI-powered recommendations based on your sales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {restockSuggestions.map((suggestion, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-background border">
                    <div>
                      <p className="font-medium">{suggestion.product}</p>
                      <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={suggestion.urgency === 'high' ? 'destructive' : 'secondary'}>
                        {suggestion.urgency}
                      </Badge>
                      <Button size="sm">Reorder</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wholesale Catalog */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Wholesale Catalog
                </CardTitle>
                <CardDescription>Browse products and place orders</CardDescription>
              </div>
              <Button>
                <ShoppingCart className="h-4 w-4 mr-2" />
                View Cart (0)
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {catalogItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-lg font-bold text-primary">${item.price}</p>
                  </div>
                  <div className="text-right space-y-2">
                    <Badge variant={item.stock === 'In Stock' ? 'outline' : 'secondary'}>
                      {item.stock}
                    </Badge>
                    <Button size="sm" className="w-full">Add to Cart</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              My Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell>{order.items}</TableCell>
                    <TableCell className="font-medium">{order.total}</TableCell>
                    <TableCell>
                      <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
