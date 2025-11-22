import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Store, BarChart3, DollarSign, MessageSquare, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PortalWholesale() {
  const [hubData, setHubData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchWholesaleData();
  }, []);

  async function fetchWholesaleData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Simplified queries to avoid type issues
      const hubResponse: any = await supabase
        .from('wholesale_hubs')
        .select('*')
        .eq('owner_user_id', user.id)
        .maybeSingle();
      
      if (hubResponse.data) {
        setHubData(hubResponse.data);

        const ordersResponse: any = await supabase
          .from('wholesale_orders')
          .select('*')
          .eq('hub_id', hubResponse.data.id)
          .order('created_at', { ascending: false })
          .limit(20);

        setOrders(ordersResponse.data || []);

        const storesResponse: any = await supabase
          .from('stores')
          .select('*')
          .eq('primary_supplier_id', hubResponse.data.id);

        setStores(storesResponse.data || []);
      }
    } catch (error) {
      console.error('Error fetching wholesale data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load wholesale data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hubData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Wholesale Hub Found</h2>
          <p className="text-muted-foreground mb-6">
            Your account is not linked to a wholesale hub. Please contact support.
          </p>
          <Button onClick={() => window.location.href = 'mailto:support@gasmask.com'}>
            Contact Support
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{hubData.name}</h1>
              <p className="text-muted-foreground">Wholesale Distribution Portal</p>
            </div>
            <Badge variant={hubData.status === 'active' ? 'default' : 'secondary'}>
              {hubData.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="stores">Stores</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-4">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{orders.length}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Store className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Active Stores</p>
                    <p className="text-2xl font-bold">{stores.length}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue (MTD)</p>
                    <p className="text-2xl font-bold">$0</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <BarChart3 className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Order Value</p>
                    <p className="text-2xl font-bold">$0</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>
                {orders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No orders yet</p>
                ) : (
                  <div className="space-y-2">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{order.stores?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge>{order.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Top Stores</h3>
                {stores.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No stores linked yet</p>
                ) : (
                  <div className="space-y-2">
                    {stores.slice(0, 5).map((store) => (
                      <div key={store.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{store.name}</p>
                          <p className="text-sm text-muted-foreground">{store.address_city}</p>
                        </div>
                        <Badge variant="outline">{store.type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Inventory Management</h3>
              <p className="text-muted-foreground">Upload and manage your product catalog</p>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">All Orders</h3>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No orders yet</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.stores?.name} • {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge>{order.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="stores">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Linked Stores</h3>
              {stores.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No stores linked yet</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {stores.map((store) => (
                    <Card key={store.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{store.name}</h4>
                        <Badge variant="outline">{store.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {store.address_street}, {store.address_city}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Analytics</h3>
              <p className="text-muted-foreground">Sales analytics and insights</p>
            </Card>
          </TabsContent>

          <TabsContent value="payouts">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Payout History</h3>
              <p className="text-muted-foreground">View your earnings and payout history</p>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Hub Settings</h3>
              <p className="text-muted-foreground">Update your wholesale hub information</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
